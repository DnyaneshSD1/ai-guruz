package ai.guruz.learnmind.common.ai;

import ai.guruz.learnmind.common.LearnMindProperties;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Runs an agent step against the configured model and always returns a usable value:
 * if the model is unreachable or its output fails validation, the caller's offline fallback is used
 * and the result is flagged so the UI can say so.
 */
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);
    private static final JsonMapper MAPPER = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private final LlmClient client;
    private final int maxInputChars;

    public AiService(LlmClient client, LearnMindProperties.Ai config) {
        this.client = client;
        this.maxInputChars = config.maxInputChars() > 0 ? config.maxInputChars() : client.maxInputChars();
    }

    public record Clipped(String text, boolean truncated) {}

    /** Fits source material to the provider's input budget. Callers surface {@code truncated} to the user. */
    public Clipped clip(String text) {
        if (text == null) {
            return new Clipped("", false);
        }
        return text.length() <= maxInputChars
                ? new Clipped(text, false)
                : new Clipped(text.substring(0, maxInputChars), true);
    }

    public <T> AiResult<T> json(String task, String system, String prompt, Class<T> type,
                                Predicate<T> valid, Supplier<T> fallback) {
        long start = System.currentTimeMillis();
        if (client != LlmClient.NONE) {
            try {
                String raw = client.complete(system + "\nRespond with a single JSON object and nothing else.", prompt, true);
                T value = MAPPER.readValue(extractJson(raw), type);
                if (value != null && valid.test(value)) {
                    return new AiResult<>(value, client.name(), false, System.currentTimeMillis() - start);
                }
                log.warn("{}: model output failed validation, using fallback", task);
            } catch (Exception e) {
                log.warn("{}: model call failed ({}), using fallback", task, e.getMessage());
            }
        }
        return new AiResult<>(fallback.get(), "heuristic", true, System.currentTimeMillis() - start);
    }

    public AiResult<String> text(String task, String system, String prompt, Supplier<String> fallback) {
        long start = System.currentTimeMillis();
        if (client != LlmClient.NONE) {
            try {
                String raw = client.complete(system, prompt, false);
                if (raw != null && raw.strip().length() > 80) {
                    return new AiResult<>(raw.strip(), client.name(), false, System.currentTimeMillis() - start);
                }
                log.warn("{}: model output too short, using fallback", task);
            } catch (Exception e) {
                log.warn("{}: model call failed ({}), using fallback", task, e.getMessage());
            }
        }
        return new AiResult<>(fallback.get(), "heuristic", true, System.currentTimeMillis() - start);
    }

    /** Models sometimes wrap JSON in prose or code fences; keep only the outermost object. */
    static String extractJson(String raw) {
        if (raw == null) {
            throw new IllegalArgumentException("empty model output");
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalArgumentException("no JSON object in model output");
        }
        return raw.substring(start, end + 1);
    }
}
