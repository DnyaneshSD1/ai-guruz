package com.aiguruz.common.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiguruz.common.AiGuruzProperties;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** Runs the client against a local stand-in for an OpenAI-compatible server. */
class OpenAiCompatibleLlmClientTest {

    private static final String OK = "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"hello\"}}]}";

    private HttpServer server;
    private final List<String> requests = new ArrayList<>();
    private final List<String> authHeaders = new ArrayList<>();

    /** respond maps the 1-based request number to {status, body}. */
    private OpenAiCompatibleLlmClient clientFor(Function<Integer, Object[]> respond, String apiKey) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            requests.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            authHeaders.add(exchange.getRequestHeaders().getFirst("Authorization"));
            Object[] reply = respond.apply(requests.size());
            byte[] body = ((String) reply[1]).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.getResponseHeaders().add("Retry-After", "0");
            exchange.sendResponseHeaders((int) reply[0], body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1";
        return new OpenAiCompatibleLlmClient(new AiGuruzProperties.Ai("openai", 0, 5,
                new AiGuruzProperties.Ai.Ollama("http://localhost:11434", "m", 8192),
                new AiGuruzProperties.Ai.Claude("", "claude-opus-5-5", 16000),
                new AiGuruzProperties.Ai.OpenAi(baseUrl, apiKey, "test-model", 24000)));
    }

    @AfterEach
    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void sendsModelKeyAndJsonModeAndReadsTheReply() throws Exception {
        OpenAiCompatibleLlmClient client = clientFor(n -> new Object[] {200, OK}, "secret-key");
        assertEquals("hello", client.complete("sys", "user text", true));
        assertEquals("Bearer secret-key", authHeaders.get(0));
        assertTrue(requests.get(0).contains("\"model\":\"test-model\""));
        assertTrue(requests.get(0).contains("json_object"));
        assertTrue(requests.get(0).contains("user text"));
    }

    @Test
    void retriesWithoutJsonModeWhenTheServerRejectsIt() throws Exception {
        OpenAiCompatibleLlmClient client = clientFor(n -> n == 1 ? new Object[] {400, "{}"} : new Object[] {200, OK}, "k");
        assertEquals("hello", client.complete("sys", "user", true));
        assertEquals(2, requests.size());
        assertFalse(requests.get(1).contains("json_object"));
    }

    @Test
    void retriesWhenRateLimitedThenGivesUp() throws Exception {
        OpenAiCompatibleLlmClient recovering = clientFor(n -> n == 1 ? new Object[] {429, "{}"} : new Object[] {200, OK}, "k");
        assertEquals("hello", recovering.complete("sys", "user", false));
        stop();
        requests.clear();

        OpenAiCompatibleLlmClient limited = clientFor(n -> new Object[] {429, "{}"}, "k");
        assertThrows(IllegalStateException.class, () -> limited.complete("sys", "user", false));
        assertEquals(3, requests.size());
    }

    @Test
    void failsFastWithoutAnApiKey() throws Exception {
        OpenAiCompatibleLlmClient client = clientFor(n -> new Object[] {200, OK}, "");
        assertThrows(IllegalStateException.class, () -> client.complete("sys", "user", false));
        assertEquals(0, requests.size());
    }
}
