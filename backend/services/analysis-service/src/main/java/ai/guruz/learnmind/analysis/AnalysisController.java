package ai.guruz.learnmind.analysis;

import ai.guruz.learnmind.analysis.Model.Analysis;
import ai.guruz.learnmind.analysis.Model.AnalysisRepository;
import ai.guruz.learnmind.analysis.Model.Status;
import ai.guruz.learnmind.analysis.Model.Type;
import ai.guruz.learnmind.common.LearnMindProperties;
import ai.guruz.learnmind.common.ai.AiResult;
import ai.guruz.learnmind.common.ai.AiService;
import ai.guruz.learnmind.common.ai.TextTools;
import ai.guruz.learnmind.common.client.ServiceClient;
import ai.guruz.learnmind.common.events.Events;
import ai.guruz.learnmind.common.security.CurrentUser;
import ai.guruz.learnmind.common.web.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.json.JsonMapper;

@RestController
public class AnalysisController {

    private static final Logger log = LoggerFactory.getLogger(AnalysisController.class);
    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    public record CreateRequest(@NotBlank String documentId, @NotNull Type type, boolean regenerate) {}

    record DocumentText(String documentId, String title, String text, boolean truncated) {}

    private final AnalysisRepository analyses;
    private final Analyzer analyzer;
    private final AiService ai;
    private final ServiceClient services;
    private final LearnMindProperties props;
    private final Events events;
    private final ExecutorService workers = Executors.newFixedThreadPool(2);

    public AnalysisController(AnalysisRepository analyses, Analyzer analyzer, AiService ai, ServiceClient services,
                              LearnMindProperties props, Events events) {
        this.analyses = analyses;
        this.analyzer = analyzer;
        this.ai = ai;
        this.services = services;
        this.props = props;
        this.events = events;
    }

    /** Starts an analysis and returns immediately; clients poll GET /api/analyses/{id} until it is READY. */
    @PostMapping("/api/analyses")
    Analysis create(@Valid @RequestBody CreateRequest req) {
        CurrentUser user = CurrentUser.get();
        if (!req.regenerate()) {
            Optional<Analysis> existing = analyses.findFirstByTenantIdAndUserIdAndDocumentIdAndTypeOrderByCreatedAtDesc(
                    user.tenantId(), user.id(), req.documentId(), req.type());
            if (existing.isPresent() && existing.get().status != Status.FAILED) {
                return existing.get();
            }
        }
        // The document service applies its own access rules to this call, made with the caller's token.
        DocumentText doc = services.get(props.services().documentUrl() + "/api/documents/" + req.documentId() + "/text",
                user, DocumentText.class);
        if (doc == null || doc.text() == null || doc.text().isBlank()) {
            throw ApiException.badRequest("The document has no readable text");
        }
        analyses.deleteByTenantIdAndUserIdAndDocumentIdAndType(user.tenantId(), user.id(), req.documentId(), req.type());

        Analysis analysis = new Analysis();
        analysis.tenantId = user.tenantId();
        analysis.userId = user.id();
        analysis.documentId = req.documentId();
        analysis.documentTitle = doc.title();
        analysis.type = req.type();
        Analysis saved = analyses.save(analysis);
        workers.submit(() -> run(saved, doc, user));
        return saved;
    }

    @GetMapping("/api/analyses")
    List<Analysis> list(@RequestParam String documentId) {
        CurrentUser user = CurrentUser.get();
        return analyses.findByTenantIdAndUserIdAndDocumentIdOrderByCreatedAtDesc(user.tenantId(), user.id(), documentId);
    }

    @GetMapping("/api/analyses/{id}")
    Analysis get(@PathVariable String id) {
        CurrentUser user = CurrentUser.get();
        return analyses.findById(id)
                .filter(a -> a.tenantId.equals(user.tenantId()) && a.userId.equals(user.id()))
                .orElseThrow(() -> ApiException.notFound("Analysis"));
    }

    private void run(Analysis analysis, DocumentText doc, CurrentUser user) {
        try {
            AiService.Clipped clipped = ai.clip(doc.text());
            AiResult<?> result = analyzer.run(analysis.type, doc.title(), clipped.text());
            analysis.result = result.value();
            analysis.provider = result.provider();
            analysis.fallbackUsed = result.fallbackUsed();
            analysis.sourceTruncated = clipped.truncated() || doc.truncated();
            analysis.durationMs = result.durationMs();
            analysis.confidence = grounding(result.value(), clipped.text());
            analysis.status = Status.READY;
        } catch (Exception e) {
            log.error("Analysis {} failed", analysis.id, e);
            analysis.status = Status.FAILED;
            analysis.error = "The analysis could not be completed";
        }
        analyses.save(analysis);
        events.activity(user, "ANALYSIS_COMPLETED", "analysis", analysis.id, Map.of(
                "type", analysis.type.name(),
                "status", analysis.status.name(),
                "durationMs", analysis.durationMs,
                "confidence", analysis.confidence,
                "provider", String.valueOf(analysis.provider)));
    }

    /** How much of what the analysis says can be traced to the source: key terms of the result found in the text. */
    static double grounding(Object result, String source) {
        List<String> terms = TextTools.keywords(MAPPER.writeValueAsString(result), 30);
        if (terms.isEmpty()) {
            return 0;
        }
        String haystack = source.toLowerCase(Locale.ROOT);
        long found = terms.stream().filter(t -> haystack.contains(t.toLowerCase(Locale.ROOT))).count();
        return Math.round(100.0 * found / terms.size()) / 100.0;
    }
}
