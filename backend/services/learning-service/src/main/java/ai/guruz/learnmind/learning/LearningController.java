package ai.guruz.learnmind.learning;

import ai.guruz.learnmind.common.LearnMindProperties;
import ai.guruz.learnmind.common.client.ServiceClient;
import ai.guruz.learnmind.common.events.Events;
import ai.guruz.learnmind.common.security.CurrentUser;
import ai.guruz.learnmind.learning.Model.ConceptScore;
import ai.guruz.learnmind.learning.Model.ConceptState;
import ai.guruz.learnmind.learning.Model.Decision;
import ai.guruz.learnmind.learning.Model.KnowledgeState;
import ai.guruz.learnmind.learning.Model.KnowledgeStateRepository;
import ai.guruz.learnmind.learning.Model.ProgressRecord;
import ai.guruz.learnmind.learning.Model.ProgressRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LearningController {

    public record EvaluationRequest(@NotBlank String curriculumId, @NotBlank String moduleId, String assessmentId,
                                    double score, @NotNull List<ConceptScore> conceptScores) {}

    public record Evaluation(Decision decision, String nextModuleId, String message, List<String> weakConcepts) {}

    record ModuleDto(String id, String title, String level, String kind, List<String> concepts, String status,
                     Double score) {}

    record CurriculumDto(String id, String topic, String status, List<ModuleDto> modules, Instant createdAt) {}

    record OutcomeRequest(Decision decision, double score, List<String> weakConcepts) {}

    record Outcome(Decision applied, String insertedModuleId, String nextModuleId) {}

    public record Node(String id, String type, String label, Double mastery, Integer attempts, String status, String kind) {}

    public record Edge(String from, String to, String type) {}

    public record Graph(String curriculumId, String topic, List<Node> nodes, List<Edge> edges) {}

    public record Progress(String curriculumId, String topic, int totalModules, int completedModules,
                           Double averageScore, Double averageMastery, int remedialModules, int lateralModules,
                           String nextModuleId, String nextModuleTitle, List<ProgressRecord> history) {}

    public record Recommendation(String type, String title, String detail, String curriculumId, String moduleId,
                                 String topic) {}

    private final KnowledgeStateRepository states;
    private final ProgressRepository progress;
    private final PathOptimizer optimizer;
    private final ServiceClient services;
    private final LearnMindProperties props;
    private final Events events;

    public LearningController(KnowledgeStateRepository states, ProgressRepository progress, PathOptimizer optimizer,
                              ServiceClient services, LearnMindProperties props, Events events) {
        this.states = states;
        this.progress = progress;
        this.optimizer = optimizer;
        this.services = services;
        this.props = props;
        this.events = events;
    }

    /** Service-internal: called by the assessment service once a quiz is graded. */
    @PostMapping("/internal/learning/evaluations")
    Evaluation evaluate(@Valid @RequestBody EvaluationRequest req) {
        CurrentUser user = CurrentUser.get();

        KnowledgeState state = states.findByTenantIdAndUserIdAndCurriculumId(user.tenantId(), user.id(), req.curriculumId())
                .orElseGet(() -> {
                    KnowledgeState created = new KnowledgeState();
                    created.tenantId = user.tenantId();
                    created.userId = user.id();
                    created.curriculumId = req.curriculumId();
                    return created;
                });
        for (ConceptScore scored : req.conceptScores()) {
            ConceptState concept = state.concepts.stream()
                    .filter(c -> c.name.equalsIgnoreCase(scored.concept())).findFirst()
                    .orElseGet(() -> {
                        ConceptState created = new ConceptState();
                        created.name = scored.concept();
                        state.concepts.add(created);
                        return created;
                    });
            optimizer.updateMastery(concept, scored.score());
            concept.lastAssessedAt = Instant.now();
        }
        state.updatedAt = Instant.now();

        Decision decision = optimizer.decide(req.score(), req.conceptScores());
        List<String> weak = optimizer.weakConcepts(req.conceptScores());

        // The curriculum service owns the path; it may soften the decision (e.g. after repeated remedial rounds).
        Outcome outcome = services.post(
                props.services().curriculumUrl() + "/internal/curricula/" + req.curriculumId()
                        + "/modules/" + req.moduleId() + "/outcome",
                user, new OutcomeRequest(decision, req.score(), weak), Outcome.class);
        Decision applied = outcome.applied();

        states.save(state);
        ProgressRecord record = new ProgressRecord();
        record.tenantId = user.tenantId();
        record.userId = user.id();
        record.curriculumId = req.curriculumId();
        record.moduleId = req.moduleId();
        record.assessmentId = req.assessmentId();
        record.score = req.score();
        record.decision = applied;
        record.weakConcepts = weak;
        progress.save(record);

        events.activity(user, "PATH_DECISION", "curriculum", req.curriculumId(), Map.of(
                "decision", applied.name(), "score", req.score(), "moduleId", req.moduleId()));
        return new Evaluation(applied, outcome.nextModuleId(), message(applied, weak, outcome.nextModuleId()), weak);
    }

    /** Learner knowledge graph: the topic, its modules in path order, and every concept with its mastery. */
    @GetMapping("/api/learning/knowledge-graph")
    Graph knowledgeGraph(@RequestParam String curriculumId) {
        CurrentUser user = CurrentUser.get();
        CurriculumDto curriculum = services.get(props.services().curriculumUrl() + "/api/curricula/" + curriculumId,
                user, CurriculumDto.class);
        Map<String, ConceptState> mastery = new HashMap<>();
        states.findByTenantIdAndUserIdAndCurriculumId(user.tenantId(), user.id(), curriculumId)
                .ifPresent(s -> s.concepts.forEach(c -> mastery.put(key(c.name), c)));

        List<Node> nodes = new ArrayList<>();
        List<Edge> edges = new ArrayList<>();
        Map<String, String> conceptIds = new LinkedHashMap<>();
        nodes.add(new Node("topic", "TOPIC", curriculum.topic(), null, null, null, null));
        String previous = "topic";
        for (ModuleDto module : curriculum.modules()) {
            String moduleNode = "m:" + module.id();
            nodes.add(new Node(moduleNode, "MODULE", module.title(), module.score(), null, module.status(), module.kind()));
            edges.add(new Edge(previous, moduleNode, "NEXT"));
            if ("CORE".equals(module.kind())) {
                previous = moduleNode;
            }
            for (String concept : module.concepts()) {
                String conceptNode = conceptIds.computeIfAbsent(key(concept), k -> {
                    ConceptState s = mastery.get(k);
                    String id = "c:" + conceptIds.size();
                    nodes.add(new Node(id, "CONCEPT", concept, s == null ? null : s.mastery,
                            s == null ? 0 : s.attempts, null, null));
                    return id;
                });
                edges.add(new Edge(moduleNode, conceptNode, "TEACHES"));
            }
        }
        return new Graph(curriculumId, curriculum.topic(), nodes, edges);
    }

    @GetMapping("/api/learning/progress")
    List<Progress> progress() {
        CurrentUser user = CurrentUser.get();
        Map<String, KnowledgeState> byCurriculum = states.findByTenantIdAndUserId(user.tenantId(), user.id()).stream()
                .collect(Collectors.toMap(s -> s.curriculumId, s -> s, (a, b) -> a));
        List<Progress> result = new ArrayList<>();
        for (CurriculumDto c : curricula(user)) {
            if (!"READY".equals(c.status())) {
                continue;
            }
            List<ModuleDto> done = c.modules().stream().filter(m -> "COMPLETED".equals(m.status())).toList();
            ModuleDto next = c.modules().stream().filter(m -> "AVAILABLE".equals(m.status())).findFirst().orElse(null);
            KnowledgeState state = byCurriculum.get(c.id());
            result.add(new Progress(c.id(), c.topic(), c.modules().size(), done.size(),
                    average(done.stream().filter(m -> m.score() != null).map(ModuleDto::score).toList()),
                    state == null ? null : average(state.concepts.stream().map(s -> s.mastery).toList()),
                    (int) c.modules().stream().filter(m -> "REMEDIAL".equals(m.kind())).count(),
                    (int) c.modules().stream().filter(m -> "LATERAL".equals(m.kind())).count(),
                    next == null ? null : next.id(), next == null ? null : next.title(),
                    progress.findByTenantIdAndUserIdAndCurriculumIdOrderByCreatedAtAsc(user.tenantId(), user.id(), c.id())));
        }
        return result;
    }

    /** Personalised next steps derived from the learner's own paths and mastery. */
    @GetMapping("/api/learning/recommendations")
    List<Recommendation> recommendations() {
        CurrentUser user = CurrentUser.get();
        List<CurriculumDto> curricula = curricula(user).stream().filter(c -> "READY".equals(c.status())).toList();
        Map<String, String> topics = curricula.stream().collect(Collectors.toMap(CurriculumDto::id, CurriculumDto::topic));
        List<Recommendation> out = new ArrayList<>();

        curricula.stream().limit(3).forEach(c -> c.modules().stream()
                .filter(m -> "AVAILABLE".equals(m.status())).findFirst()
                .ifPresent(m -> out.add(new Recommendation("CONTINUE", "Continue: " + m.title(),
                        switch (m.kind()) {
                            case "REMEDIAL" -> "A reinforcement module prepared for you in " + c.topic();
                            case "LATERAL" -> "A practice detour to close gaps in " + c.topic();
                            default -> "Next step in " + c.topic();
                        }, c.id(), m.id(), c.topic()))));

        states.findByTenantIdAndUserId(user.tenantId(), user.id()).stream()
                .filter(s -> topics.containsKey(s.curriculumId))
                .flatMap(s -> s.concepts.stream().filter(c -> c.mastery < PathOptimizer.WEAK_CONCEPT)
                        .map(c -> Map.entry(s.curriculumId, c)))
                .sorted((a, b) -> Double.compare(a.getValue().mastery, b.getValue().mastery))
                .limit(4)
                .forEach(e -> out.add(new Recommendation("REVIEW", "Review: " + e.getValue().name,
                        "Mastery " + Math.round(e.getValue().mastery * 100) + "% in " + topics.get(e.getKey()),
                        e.getKey(), null, topics.get(e.getKey()))));

        curricula.stream()
                .filter(c -> !c.modules().isEmpty() && c.modules().stream().allMatch(m -> "COMPLETED".equals(m.status())))
                .limit(2)
                .forEach(c -> out.add(new Recommendation("EXPLORE", "Go further: advanced " + c.topic(),
                        "You completed this path. Start a new one at an advanced level.", null, null,
                        "Advanced " + c.topic())));

        if (curricula.isEmpty()) {
            out.add(new Recommendation("START", "Start your first learning path",
                    "Enter any topic and LearnMind will research it and plan a path from beginner to expert.",
                    null, null, null));
        }
        return out;
    }

    private List<CurriculumDto> curricula(CurrentUser user) {
        CurriculumDto[] found = services.get(props.services().curriculumUrl() + "/api/curricula", user, CurriculumDto[].class);
        return found == null ? List.of() : List.of(found);
    }

    private static String message(Decision decision, List<String> weak, String nextModuleId) {
        String focus = weak.stream().limit(3).collect(Collectors.joining(", "));
        return switch (decision) {
            case ADVANCE -> nextModuleId == null
                    ? "Excellent. You have completed this learning path."
                    : "Strong result. The next module is unlocked.";
            case LATERAL -> "Good progress. A practice module" + (focus.isEmpty() ? "" : " on " + focus)
                    + " was added to close the gaps, and the next module is unlocked too.";
            case REMEDIAL -> "This one needs another pass. A reinforcement module" + (focus.isEmpty() ? "" : " on " + focus)
                    + " was added; complete it to continue.";
        };
    }

    private static Double average(List<Double> values) {
        return values.isEmpty() ? null
                : Math.round(values.stream().mapToDouble(Double::doubleValue).average().orElse(0) * 100) / 100.0;
    }

    private static String key(String concept) {
        return concept.strip().toLowerCase(Locale.ROOT);
    }
}
