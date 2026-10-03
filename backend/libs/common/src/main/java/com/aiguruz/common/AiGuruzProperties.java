package com.aiguruz.common;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Settings shared by every service. Each value can be overridden by an environment variable (see application.yml). */
@ConfigurationProperties("aiguruz")
public record AiGuruzProperties(
        @DefaultValue Security security,
        @DefaultValue Events events,
        @DefaultValue Ai ai,
        @DefaultValue Services services) {

    public record Security(
            @DefaultValue("http://localhost:8101/.well-known/jwks.json") String jwkSetUri,
            @DefaultValue("local-internal-key-change-me") String internalKey,
            @DefaultValue List<String> publicPaths) {}

    /** mode: http (direct call to analytics-service), sqs (AWS), none. */
    public record Events(
            @DefaultValue("http") String mode,
            @DefaultValue("") String queueUrl) {}

    /** provider: ollama (local), openai (any OpenAI-compatible API, e.g. Groq), claude (Anthropic API), mock (offline heuristics only). */
    public record Ai(
            @DefaultValue("ollama") String provider,
            @DefaultValue("0") int maxInputChars,
            @DefaultValue("300") int timeoutSeconds,
            @DefaultValue Ollama ollama,
            @DefaultValue Claude claude,
            @DefaultValue OpenAi openai) {

        /** Any server that speaks the OpenAI chat-completions protocol (Groq, Gemini, OpenRouter, ...). */
        public record OpenAi(
                @DefaultValue("https://api.groq.com/openai/v1") String baseUrl,
                @DefaultValue("") String apiKey,
                @DefaultValue("llama-3.3-70b-versatile") String model,
                @DefaultValue("24000") int maxInputChars) {}

        public record Ollama(
                @DefaultValue("http://localhost:11434") String baseUrl,
                @DefaultValue("llama3.2:3b") String model,
                @DefaultValue("8192") int contextTokens) {}

        public record Claude(
                @DefaultValue("") String apiKey,
                @DefaultValue("claude-opus-5-5") String model,
                @DefaultValue("16000") long maxTokens) {}
    }

    public record Services(
            @DefaultValue("http://localhost:8102") String documentUrl,
            @DefaultValue("http://localhost:8104") String curriculumUrl,
            @DefaultValue("http://localhost:8106") String learningUrl,
            @DefaultValue("http://localhost:8107") String analyticsUrl) {}
}
