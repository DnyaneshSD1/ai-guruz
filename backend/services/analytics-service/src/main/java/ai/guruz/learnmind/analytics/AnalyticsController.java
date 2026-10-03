package ai.guruz.learnmind.analytics;

import ai.guruz.learnmind.analytics.AnalyticsApplication.Event;
import ai.guruz.learnmind.analytics.AnalyticsApplication.EventRepository;
import ai.guruz.learnmind.common.events.LearnEvent;
import ai.guruz.learnmind.common.security.CurrentUser;
import ai.guruz.learnmind.common.security.Role;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AnalyticsController {

    /** PRD targets, reported next to the measured averages. */
    static final long ANALYSIS_TARGET_MS = 15_000;
    static final long CURRICULUM_TARGET_MS = 300_000;
    /** Upper bound of events aggregated per dashboard request; beyond this, move to pre-aggregated rollups. */
    static final int MAX_EVENTS = 20_000;

    public record DayCount(String date, long count) {}

    public record DayScore(String date, double averageScore) {}

    public record Learner(String userId, String name, long assessments, Double averageScore, Instant lastActive) {}

    public record Timing(Double averageMs, long targetMs, Double withinTargetShare, long samples) {}

    public record Dashboard(String scope, int days, Map<String, Long> totals, Double averageScore,
                            Map<String, Long> decisions, Double pathDivergence, Double averageConfidence,
                            Timing analysisTiming, Timing curriculumTiming, List<DayCount> activity,
                            List<DayScore> scoreTrend, List<Learner> learners, boolean truncated) {}

    public record AuditPage(List<Event> items, int page, int size, long total) {}

    private final EventRepository events;

    public AnalyticsController(EventRepository events) {
        this.events = events;
    }

    /** Service-internal (X-Internal-Key): event intake when EVENTS_MODE=http. */
    @PostMapping("/internal/events")
    void ingest(@RequestBody LearnEvent event) {
        store(event);
    }

    void store(LearnEvent in) {
        Event event = new Event();
        event.tenantId = in.tenantId();
        event.userId = in.userId();
        event.userName = in.userName();
        event.category = in.category();
        event.type = in.type();
        event.resourceType = in.resourceType();
        event.resourceId = in.resourceId();
        event.metadata = in.metadata();
        event.timestamp = in.timestamp() == null ? Instant.now() : in.timestamp();
        event.service = in.service();
        events.save(event);
    }

    /** scope=me: the caller's own learning. scope=tenant: the whole institution (teachers and admins). */
    @GetMapping("/api/analytics/dashboard")
    Dashboard dashboard(@RequestParam(defaultValue = "me") String scope, @RequestParam(defaultValue = "30") int days) {
        CurrentUser user = CurrentUser.get();
        boolean tenantWide = "tenant".equals(scope);
        if (tenantWide) {
            user.require(Role.TEACHER, Role.ADMIN);
        }
        int window = Math.max(1, Math.min(days, 365));
        Instant since = Instant.now().minus(Duration.ofDays(window));
        Page<Event> page = tenantWide
                ? events.findByTenantIdAndTimestampAfterOrderByTimestampDesc(user.tenantId(), since, PageRequest.of(0, MAX_EVENTS))
                : events.findByTenantIdAndUserIdAndTimestampAfterOrderByTimestampDesc(user.tenantId(), user.id(), since,
                        PageRequest.of(0, MAX_EVENTS));
        List<Event> all = page.getContent();

        Map<String, Long> totals = new LinkedHashMap<>();
        totals.put("documents", count(all, "DOCUMENT_UPLOADED"));
        totals.put("analyses", count(all, "ANALYSIS_COMPLETED"));
        totals.put("curricula", count(all, "CURRICULUM_CREATED"));
        totals.put("assessments", count(all, "ASSESSMENT_SUBMITTED"));
        totals.put("activeLearners", all.stream().filter(e -> LearnEvent.ACTIVITY.equals(e.category))
                .map(e -> e.userId).distinct().count());

        List<Event> assessments = of(all, "ASSESSMENT_SUBMITTED");
        List<Event> decisionEvents = of(all, "PATH_DECISION");
        Map<String, Long> decisions = new LinkedHashMap<>();
        for (String d : List.of("ADVANCE", "LATERAL", "REMEDIAL")) {
            decisions.put(d, decisionEvents.stream().filter(e -> d.equals(e.metadata.get("decision"))).count());
        }
        // Share of path decisions that changed the default path: the "personalised path divergence" metric.
        Double divergence = decisionEvents.isEmpty() ? null
                : round((decisions.get("LATERAL") + decisions.get("REMEDIAL")) / (double) decisionEvents.size());

        Map<String, Long> perDay = new TreeMap<>();
        for (int i = window - 1; i >= 0 && window <= 90; i--) {
            perDay.put(LocalDate.now(ZoneOffset.UTC).minusDays(i).toString(), 0L);
        }
        all.stream().filter(e -> LearnEvent.ACTIVITY.equals(e.category))
                .forEach(e -> perDay.merge(day(e), 1L, Long::sum));

        Map<String, List<Double>> scoresPerDay = new TreeMap<>();
        assessments.forEach(e -> scoresPerDay.computeIfAbsent(day(e), k -> new ArrayList<>()).add(number(e, "score")));

        List<Learner> learners = new ArrayList<>();
        if (tenantWide) {
            Map<String, List<Event>> byUser = new LinkedHashMap<>();
            all.stream().filter(e -> LearnEvent.ACTIVITY.equals(e.category))
                    .forEach(e -> byUser.computeIfAbsent(e.userId, k -> new ArrayList<>()).add(e));
            byUser.forEach((userId, list) -> {
                List<Event> quizzes = of(list, "ASSESSMENT_SUBMITTED");
                learners.add(new Learner(userId, list.get(0).userName, quizzes.size(),
                        average(quizzes.stream().map(e -> number(e, "score")).toList()), list.get(0).timestamp));
            });
            learners.sort(Comparator.comparing(Learner::lastActive).reversed());
        }

        return new Dashboard(tenantWide ? "tenant" : "me", window, totals,
                average(assessments.stream().map(e -> number(e, "score")).toList()),
                decisions, divergence,
                average(of(all, "ANALYSIS_COMPLETED").stream().map(e -> number(e, "confidence")).toList()),
                timing(of(all, "ANALYSIS_COMPLETED"), ANALYSIS_TARGET_MS),
                timing(of(all, "CURRICULUM_CREATED"), CURRICULUM_TARGET_MS),
                perDay.entrySet().stream().map(e -> new DayCount(e.getKey(), e.getValue())).toList(),
                scoresPerDay.entrySet().stream().map(e -> new DayScore(e.getKey(), average(e.getValue()))).toList(),
                learners, page.getTotalElements() > all.size());
    }

    @GetMapping("/api/audit-logs")
    @PreAuthorize("hasRole('ADMIN')")
    AuditPage auditLogs(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size,
                        @RequestParam(required = false) String type) {
        CurrentUser user = CurrentUser.get();
        PageRequest request = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 200)));
        Page<Event> found = type == null || type.isBlank()
                ? events.findByTenantIdAndCategoryOrderByTimestampDesc(user.tenantId(), LearnEvent.AUDIT, request)
                : events.findByTenantIdAndCategoryAndTypeOrderByTimestampDesc(user.tenantId(), LearnEvent.AUDIT, type, request);
        return new AuditPage(found.getContent(), request.getPageNumber(), request.getPageSize(), found.getTotalElements());
    }

    private static Timing timing(List<Event> samples, long targetMs) {
        List<Double> durations = samples.stream().map(e -> number(e, "durationMs")).toList();
        if (durations.isEmpty()) {
            return new Timing(null, targetMs, null, 0);
        }
        long within = durations.stream().filter(d -> d <= targetMs).count();
        return new Timing(average(durations), targetMs, round(within / (double) durations.size()), durations.size());
    }

    private static List<Event> of(List<Event> all, String type) {
        return all.stream().filter(e -> type.equals(e.type)).toList();
    }

    private static long count(List<Event> all, String type) {
        return all.stream().filter(e -> type.equals(e.type)).count();
    }

    private static double number(Event event, String key) {
        Object value = event.metadata == null ? null : event.metadata.get(key);
        return value instanceof Number n ? n.doubleValue() : 0;
    }

    private static String day(Event event) {
        return event.timestamp.atZone(ZoneOffset.UTC).toLocalDate().toString();
    }

    private static Double average(List<Double> values) {
        return values.isEmpty() ? null : round(values.stream().mapToDouble(Double::doubleValue).average().orElse(0));
    }

    private static double round(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
