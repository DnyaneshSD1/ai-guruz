package ai.guruz.learnmind.common.ai;

/**
 * @param provider     model that produced the value, or "heuristic" when the offline fallback was used
 * @param fallbackUsed true when the model was unavailable or returned unusable output
 */
public record AiResult<T>(T value, String provider, boolean fallbackUsed, long durationMs) {}
