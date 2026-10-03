package com.aiguruz.assessment;

import com.aiguruz.assessment.AssessmentAgent.Grade;
import com.aiguruz.assessment.Model.Answer;
import com.aiguruz.assessment.Model.Assessment;
import com.aiguruz.assessment.Model.AssessmentRepository;
import com.aiguruz.assessment.Model.ConceptScore;
import com.aiguruz.assessment.Model.Question;
import com.aiguruz.assessment.Model.QuestionResult;
import com.aiguruz.assessment.Model.QuestionType;
import com.aiguruz.assessment.Model.Status;
import com.aiguruz.common.AiGuruzProperties;
import com.aiguruz.common.ai.AiResult;
import com.aiguruz.common.client.ServiceClient;
import com.aiguruz.common.events.Events;
import com.aiguruz.common.security.CurrentUser;
import com.aiguruz.common.web.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AssessmentController {

    /** A written task counts as much as two multiple-choice questions. */
    private static final double SHORT_WEIGHT = 2.0;

    public record CreateRequest(@NotBlank String curriculumId, @NotBlank String moduleId) {}

    public record SubmitRequest(@NotNull List<Answer> answers) {}

    record ModuleDto(String id, String title, List<String> objectives, List<String> concepts, String content) {}

    record CurriculumDto(String id, String topic, List<ModuleDto> modules) {}

    record EvaluationRequest(String curriculumId, String moduleId, String assessmentId, double score,
                             List<ConceptScore> conceptScores) {}

    record Evaluation(String decision, String nextModuleId, String message) {}

    private final AssessmentRepository assessments;
    private final AssessmentAgent agent;
    private final ServiceClient services;
    private final AiGuruzProperties props;
    private final Events events;

    public AssessmentController(AssessmentRepository assessments, AssessmentAgent agent, ServiceClient services,
                                AiGuruzProperties props, Events events) {
        this.assessments = assessments;
        this.agent = agent;
        this.services = services;
        this.props = props;
        this.events = events;
    }

    /** Returns the learner's open quiz for the module, generating one from the lesson if there is none. */
    @PostMapping("/api/assessments")
    Assessment create(@Valid @RequestBody CreateRequest req) {
        CurrentUser user = CurrentUser.get();
        Optional<Assessment> open = assessments.findFirstByTenantIdAndUserIdAndCurriculumIdAndModuleIdAndStatus(
                user.tenantId(), user.id(), req.curriculumId(), req.moduleId(), Status.OPEN);
        if (open.isPresent()) {
            return forLearner(open.get());
        }
        String base = props.services().curriculumUrl() + "/api/curricula/" + req.curriculumId();
        CurriculumDto curriculum = services.get(base, user, CurriculumDto.class);
        ModuleDto module = services.get(base + "/modules/" + req.moduleId(), user, ModuleDto.class);
        List<String> otherConcepts = curriculum.modules().stream()
                .filter(m -> !m.id().equals(module.id()))
                .flatMap(m -> m.concepts().stream()).distinct().toList();

        AiResult<List<Question>> quiz = agent.quiz(curriculum.topic(), module.title(), module.objectives(),
                module.concepts(), module.content() == null ? "" : module.content(), otherConcepts);

        Assessment assessment = new Assessment();
        assessment.tenantId = user.tenantId();
        assessment.userId = user.id();
        assessment.curriculumId = req.curriculumId();
        assessment.moduleId = req.moduleId();
        assessment.moduleTitle = module.title();
        assessment.topic = curriculum.topic();
        assessment.questions = quiz.value();
        assessment.provider = quiz.provider();
        assessment.fallbackUsed = quiz.fallbackUsed();
        return forLearner(assessments.save(assessment));
    }

    @GetMapping("/api/assessments")
    List<Assessment> list(@RequestParam String curriculumId) {
        CurrentUser user = CurrentUser.get();
        List<Assessment> found = assessments.findByTenantIdAndUserIdAndCurriculumIdOrderByCreatedAtDesc(
                user.tenantId(), user.id(), curriculumId);
        found.forEach(AssessmentController::forLearner);
        return found;
    }

    @GetMapping("/api/assessments/{id}")
    Assessment get(@PathVariable String id) {
        return forLearner(owned(CurrentUser.get(), id));
    }

    @PostMapping("/api/assessments/{id}/submit")
    Assessment submit(@PathVariable String id, @Valid @RequestBody SubmitRequest req) {
        CurrentUser user = CurrentUser.get();
        Assessment assessment = owned(user, id);
        if (assessment.status == Status.SUBMITTED) {
            throw ApiException.conflict("This assessment was already submitted");
        }
        Map<String, Answer> byQuestion = new LinkedHashMap<>();
        req.answers().forEach(a -> byQuestion.put(a.questionId, a));

        double earned = 0;
        double possible = 0;
        Map<String, double[]> perConcept = new LinkedHashMap<>();
        List<QuestionResult> results = new ArrayList<>();
        for (Question q : assessment.questions) {
            Answer answer = byQuestion.get(q.id);
            QuestionResult result = new QuestionResult();
            result.questionId = q.id;
            double weight = 1.0;
            if (q.type == QuestionType.MCQ) {
                boolean correct = answer != null && q.correctIndex != null && q.correctIndex.equals(answer.selectedIndex);
                result.score = correct ? 1 : 0;
                result.feedback = q.explanation;
            } else {
                weight = SHORT_WEIGHT;
                Grade grade = agent.gradeShort(q, answer == null ? null : answer.text);
                result.score = grade.score();
                result.feedback = grade.feedback();
            }
            earned += result.score * weight;
            possible += weight;
            double[] totals = perConcept.computeIfAbsent(q.concept, k -> new double[2]);
            totals[0] += result.score * weight;
            totals[1] += weight;
            results.add(result);
        }

        assessment.answers = req.answers();
        assessment.results = results;
        assessment.score = possible == 0 ? 0 : round(earned / possible);
        assessment.conceptScores = perConcept.entrySet().stream()
                .map(e -> new ConceptScore(e.getKey(), round(e.getValue()[0] / e.getValue()[1]))).toList();
        assessment.status = Status.SUBMITTED;
        assessment.submittedAt = Instant.now();

        // Knowledge Evaluator + Path Optimizer live in the learning engine; it also adapts the curriculum.
        // Nothing is saved until it answers, so a failed call leaves the quiz open and safe to resubmit.
        Evaluation evaluation = services.post(props.services().learningUrl() + "/internal/learning/evaluations", user,
                new EvaluationRequest(assessment.curriculumId, assessment.moduleId, assessment.id, assessment.score,
                        assessment.conceptScores), Evaluation.class);
        assessment.decision = evaluation.decision();
        assessment.nextModuleId = evaluation.nextModuleId();
        assessment.message = evaluation.message();
        assessments.save(assessment);

        events.activity(user, "ASSESSMENT_SUBMITTED", "assessment", assessment.id, Map.of(
                "score", assessment.score,
                "module", assessment.moduleTitle,
                "topic", assessment.topic,
                "decision", String.valueOf(assessment.decision)));
        return assessment;
    }

    private Assessment owned(CurrentUser user, String id) {
        return assessments.findById(id)
                .filter(a -> a.tenantId.equals(user.tenantId()) && a.userId.equals(user.id()))
                .orElseThrow(() -> ApiException.notFound("Assessment"));
    }

    /** Hides the answer key while the assessment is still open. The object is not saved after this. */
    private static Assessment forLearner(Assessment assessment) {
        if (assessment.status == Status.OPEN) {
            assessment.questions.forEach(q -> {
                q.correctIndex = null;
                q.answerGuide = null;
                q.explanation = null;
            });
        }
        return assessment;
    }

    private static double round(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
