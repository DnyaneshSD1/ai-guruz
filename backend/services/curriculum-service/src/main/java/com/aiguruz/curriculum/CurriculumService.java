package com.aiguruz.curriculum;

import com.aiguruz.common.ai.AiResult;
import com.aiguruz.common.events.Events;
import com.aiguruz.common.security.CurrentUser;
import com.aiguruz.common.security.Role;
import com.aiguruz.common.web.ApiException;
import com.aiguruz.curriculum.Model.Curriculum;
import com.aiguruz.curriculum.Model.CurriculumRepository;
import com.aiguruz.curriculum.Model.Decision;
import com.aiguruz.curriculum.Model.Kind;
import com.aiguruz.curriculum.Model.Level;
import com.aiguruz.curriculum.Model.Module;
import com.aiguruz.curriculum.Model.ModuleStatus;
import com.aiguruz.curriculum.Model.Status;
import com.aiguruz.curriculum.PlannerAgent.Plan;
import com.aiguruz.curriculum.PlannerAgent.PlannedModule;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class CurriculumService {

    private static final Logger log = LoggerFactory.getLogger(CurriculumService.class);
    /** After this many remedial rounds on one core module the learner moves on instead of looping forever. */
    static final int MAX_REMEDIALS_PER_MODULE = 2;

    public record Outcome(Decision applied, String insertedModuleId, String nextModuleId, Curriculum curriculum) {}

    private final CurriculumRepository curricula;
    private final ResearchAgent researcher;
    private final PlannerAgent planner;
    private final Events events;
    private final ExecutorService workers = Executors.newFixedThreadPool(2);

    public CurriculumService(CurriculumRepository curricula, ResearchAgent researcher, PlannerAgent planner, Events events) {
        this.curricula = curricula;
        this.researcher = researcher;
        this.planner = planner;
        this.events = events;
    }

    /** Returns at once with status GENERATING; research and planning continue in the background. */
    public Curriculum create(CurrentUser user, String topic, String goal, Level startLevel) {
        Curriculum curriculum = new Curriculum();
        curriculum.tenantId = user.tenantId();
        curriculum.userId = user.id();
        curriculum.userName = user.name();
        curriculum.topic = topic.strip();
        curriculum.goal = goal == null ? null : goal.strip();
        curriculum.startLevel = startLevel == null ? Level.BEGINNER : startLevel;
        Curriculum saved = curricula.save(curriculum);
        workers.submit(() -> generate(saved, user));
        return saved;
    }

    public List<Curriculum> list(CurrentUser user, String scope) {
        List<Curriculum> found;
        if ("tenant".equals(scope)) {
            user.require(Role.TEACHER, Role.ADMIN);
            found = curricula.findByTenantIdOrderByCreatedAtDesc(user.tenantId());
        } else {
            found = curricula.findByTenantIdAndUserIdOrderByCreatedAtDesc(user.tenantId(), user.id());
        }
        found.forEach(CurriculumService::stripContent);
        return found;
    }

    /** Owners have full access; teachers and admins of the same institution may read a learner's path. */
    public Curriculum readable(CurrentUser user, String id) {
        return curricula.findById(id)
                .filter(c -> c.tenantId.equals(user.tenantId()))
                .filter(c -> c.userId.equals(user.id()) || user.hasAny(Role.TEACHER, Role.ADMIN))
                .orElseThrow(() -> ApiException.notFound("Curriculum"));
    }

    public Curriculum owned(CurrentUser user, String id) {
        return curricula.findById(id)
                .filter(c -> c.tenantId.equals(user.tenantId()) && c.userId.equals(user.id()))
                .orElseThrow(() -> ApiException.notFound("Curriculum"));
    }

    public void delete(CurrentUser user, String id) {
        curricula.delete(owned(user, id));
    }

    /** Opens a module, writing its lesson on first access. Locked modules stay closed until the path reaches them. */
    public Module module(CurrentUser user, String curriculumId, String moduleId) {
        Curriculum curriculum = readable(user, curriculumId);
        Module module = find(curriculum, moduleId);
        if (module.status == ModuleStatus.LOCKED) {
            throw ApiException.forbidden("Complete the previous module's quiz to unlock this one");
        }
        if (module.content == null) {
            AiResult<String> lesson = planner.lesson(curriculum, module);
            // Re-read before saving: the path may have changed while the lesson was being written.
            curriculum = readable(user, curriculumId);
            module = find(curriculum, moduleId);
            module.content = lesson.value();
            module.contentProvider = lesson.provider();
            save(curriculum);
        }
        return module;
    }

    /** Applies the learning engine's decision for a finished module and returns where the learner goes next. */
    public Outcome applyOutcome(CurrentUser user, String curriculumId, String moduleId, Decision decision,
                                double score, List<String> weakConcepts) {
        Curriculum curriculum = owned(user, curriculumId);
        Module module = find(curriculum, moduleId);
        int index = curriculum.modules.indexOf(module);
        boolean retake = module.status == ModuleStatus.COMPLETED;
        module.status = ModuleStatus.COMPLETED;
        module.score = module.score == null ? score : Math.max(module.score, score);
        module.completedAt = Instant.now();

        Decision applied = decision;
        String inserted = null;
        if (retake) {
            // A repeated quiz only improves the recorded score; the path was already adapted the first time.
            applied = Decision.ADVANCE;
        }
        if (decision == Decision.REMEDIAL && remedialCount(curriculum, module) >= MAX_REMEDIALS_PER_MODULE) {
            applied = Decision.ADVANCE;
        }
        if (applied == Decision.REMEDIAL || applied == Decision.LATERAL) {
            Kind kind = applied == Decision.REMEDIAL ? Kind.REMEDIAL : Kind.LATERAL;
            Module extra = planner.adaptiveModule(module, kind, weakConcepts);
            curriculum.modules.add(index + 1, extra);
            inserted = extra.id;
        }
        // A remedial module must be passed before the path continues; a lateral one is an optional detour.
        if (!retake && applied != Decision.REMEDIAL) {
            curriculum.modules.stream().skip(index + 1L)
                    .filter(m -> m.status == ModuleStatus.LOCKED).findFirst()
                    .ifPresent(m -> m.status = ModuleStatus.AVAILABLE);
        }
        save(curriculum);
        String next = curriculum.modules.stream()
                .filter(m -> m.status == ModuleStatus.AVAILABLE).map(m -> m.id).findFirst().orElse(null);
        stripContent(curriculum);
        return new Outcome(applied, inserted, next, curriculum);
    }

    static void stripContent(Curriculum curriculum) {
        curriculum.modules.forEach(m -> m.content = null);
    }

    private void generate(Curriculum curriculum, CurrentUser user) {
        long start = System.currentTimeMillis();
        try {
            curriculum.sources = researcher.research(curriculum.topic);
            AiResult<Plan> plan = planner.plan(curriculum.topic, curriculum.goal, curriculum.startLevel, curriculum.sources);
            curriculum.summary = plan.value().summary();
            for (PlannedModule planned : plan.value().modules()) {
                Module module = new Module();
                module.id = UUID.randomUUID().toString();
                module.title = planned.title().strip();
                module.level = parseLevel(planned.level());
                module.objectives = planned.objectives() == null ? List.of() : planned.objectives();
                module.concepts = planned.concepts();
                module.estimatedMinutes = planned.estimatedMinutes() == null ? 20 : planned.estimatedMinutes();
                curriculum.modules.add(module);
            }
            curriculum.modules.get(0).status = ModuleStatus.AVAILABLE;
            curriculum.provider = plan.provider();
            curriculum.fallbackUsed = plan.fallbackUsed();
            curriculum.status = Status.READY;
        } catch (Exception e) {
            log.error("Curriculum {} failed", curriculum.id, e);
            curriculum.status = Status.FAILED;
            curriculum.error = "The curriculum could not be generated";
        }
        curriculum.generationMs = System.currentTimeMillis() - start;
        save(curriculum);
        events.activity(user, "CURRICULUM_CREATED", "curriculum", curriculum.id, Map.of(
                "topic", curriculum.topic,
                "status", curriculum.status.name(),
                "modules", curriculum.modules.size(),
                "durationMs", curriculum.generationMs));
    }

    private void save(Curriculum curriculum) {
        curriculum.updatedAt = Instant.now();
        curricula.save(curriculum);
    }

    private static long remedialCount(Curriculum curriculum, Module module) {
        String root = module.parentModuleId != null ? module.parentModuleId : module.id;
        return curriculum.modules.stream()
                .filter(m -> m.kind == Kind.REMEDIAL && root.equals(m.parentModuleId)).count();
    }

    private static Module find(Curriculum curriculum, String moduleId) {
        return curriculum.modules.stream().filter(m -> m.id.equals(moduleId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Module"));
    }

    private static Level parseLevel(String raw) {
        try {
            return Level.valueOf(raw.strip().toUpperCase());
        } catch (Exception e) {
            return Level.INTERMEDIATE;
        }
    }
}
