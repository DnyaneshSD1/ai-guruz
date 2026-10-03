package com.aiguruz.common.ai;

import com.aiguruz.common.AiGuruzProperties;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

/**
 * Inference through any server that speaks the OpenAI chat-completions protocol.
 * The defaults target Groq's free tier; Gemini, OpenRouter and others work by changing the base URL and model.
 */
public class OpenAiCompatibleLlmClient implements LlmClient {

    /** Free tiers rate-limit by the minute, so a 429 is retried a few times before giving up. */
    private static final int MAX_ATTEMPTS = 3;

    private final RestClient client;
    private final AiGuruzProperties.Ai.OpenAi config;

    public OpenAiCompatibleLlmClient(AiGuruzProperties.Ai ai) {
        this.config = ai.openai();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(ai.timeoutSeconds()));
        this.client = RestClient.builder()
                .baseUrl(config.baseUrl())
                .requestFactory(factory)
                .defaultHeader("Authorization", "Bearer " + config.apiKey())
                .build();
    }

    @Override
    public String name() {
        return config.model();
    }

    @Override
    public int maxInputChars() {
        return config.maxInputChars();
    }

    @Override
    public String complete(String system, String user, boolean jsonOutput) throws Exception {
        if (config.apiKey().isBlank()) {
            throw new IllegalStateException("OPENAI_API_KEY is not set");
        }
        boolean jsonMode = jsonOutput;
        for (int attempt = 1; ; attempt++) {
            try {
                return call(system, user, jsonMode);
            } catch (RestClientResponseException e) {
                int status = e.getStatusCode().value();
                if (status == 400 && jsonMode) {
                    // Not every compatible server or model accepts response_format; the prompt already asks for JSON.
                    jsonMode = false;
                } else if (status == 429 && attempt < MAX_ATTEMPTS) {
                    Thread.sleep(retryDelayMillis(e, attempt));
                } else {
                    throw new IllegalStateException("AI provider returned HTTP " + status);
                }
            }
        }
    }

    private String call(String system, String user, boolean jsonMode) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", config.model());
        body.put("temperature", 0.3);
        body.put("messages", List.of(
                Map.of("role", "system", "content", system),
                Map.of("role", "user", "content", user)));
        if (jsonMode) {
            body.put("response_format", Map.of("type", "json_object"));
        }
        JsonNode response = client.post().uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve().body(JsonNode.class);
        if (response == null) {
            throw new IllegalStateException("Empty response from the AI provider");
        }
        return response.path("choices").path(0).path("message").path("content").asString();
    }

    private static long retryDelayMillis(RestClientResponseException e, int attempt) {
        String header = e.getResponseHeaders() == null ? null : e.getResponseHeaders().getFirst("Retry-After");
        try {
            return Math.min(30_000, (long) (Double.parseDouble(header) * 1000) + 250);
        } catch (Exception notANumber) {
            return 4_000L * attempt;
        }
    }
}
