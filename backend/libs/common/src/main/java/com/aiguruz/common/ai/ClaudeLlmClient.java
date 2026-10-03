package com.aiguruz.common.ai;

import com.aiguruz.common.AiGuruzProperties;
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StopReason;
import java.util.stream.Collectors;

/** Production inference through the Claude API. Reads ANTHROPIC_API_KEY unless a key is configured explicitly. */
public class ClaudeLlmClient implements LlmClient {

    private final AiGuruzProperties.Ai.Claude config;
    private volatile AnthropicClient client;

    public ClaudeLlmClient(AiGuruzProperties.Ai ai) {
        this.config = ai.claude();
    }

    @Override
    public String name() {
        return config.model();
    }

    @Override
    public int maxInputChars() {
        return 600_000;
    }

    @Override
    public String complete(String system, String user, boolean jsonOutput) {
        Message response = client().messages().create(MessageCreateParams.builder()
                .model(config.model())
                .maxTokens(config.maxTokens())
                .system(system)
                .addUserMessage(user)
                .build());

        StopReason stop = response.stopReason().orElse(null);
        if (StopReason.REFUSAL.equals(stop)) {
            throw new IllegalStateException("The model declined this request");
        }
        if (StopReason.MAX_TOKENS.equals(stop)) {
            throw new IllegalStateException("The model response was cut off at the token limit");
        }
        return response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(text -> text.text())
                .collect(Collectors.joining());
    }

    private AnthropicClient client() {
        AnthropicClient existing = client;
        if (existing == null) {
            synchronized (this) {
                if (client == null) {
                    client = config.apiKey().isBlank()
                            ? AnthropicOkHttpClient.fromEnv()
                            : AnthropicOkHttpClient.builder().apiKey(config.apiKey()).build();
                }
                existing = client;
            }
        }
        return existing;
    }
}
