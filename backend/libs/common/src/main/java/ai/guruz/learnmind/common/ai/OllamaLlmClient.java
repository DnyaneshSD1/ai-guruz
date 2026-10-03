package ai.guruz.learnmind.common.ai;

import ai.guruz.learnmind.common.LearnMindProperties;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/** Fully local inference through an Ollama server. */
public class OllamaLlmClient implements LlmClient {

    private final RestClient client;
    private final LearnMindProperties.Ai.Ollama config;

    public OllamaLlmClient(LearnMindProperties.Ai ai) {
        this.config = ai.ollama();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(ai.timeoutSeconds()));
        this.client = RestClient.builder().baseUrl(config.baseUrl()).requestFactory(factory).build();
    }

    @Override
    public String name() {
        return "ollama:" + config.model();
    }

    @Override
    public int maxInputChars() {
        // Roughly 4 characters per token, leaving half of the context window for the answer.
        return config.contextTokens() * 2;
    }

    @Override
    public String complete(String system, String user, boolean jsonOutput) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", config.model());
        body.put("stream", false);
        body.put("messages", List.of(
                Map.of("role", "system", "content", system),
                Map.of("role", "user", "content", user)));
        body.put("options", Map.of("temperature", 0.3, "num_ctx", config.contextTokens()));
        if (jsonOutput) {
            body.put("format", "json");
        }
        JsonNode response = client.post().uri("/api/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve().body(JsonNode.class);
        if (response == null) {
            throw new IllegalStateException("Empty response from Ollama");
        }
        return response.path("message").path("content").asString();
    }
}
