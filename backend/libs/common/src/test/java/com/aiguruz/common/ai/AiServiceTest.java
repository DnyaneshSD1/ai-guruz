package com.aiguruz.common.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiguruz.common.AiGuruzProperties;
import org.junit.jupiter.api.Test;

class AiServiceTest {

    record Answer(String value) {}

    private static final AiGuruzProperties.Ai CONFIG = new AiGuruzProperties.Ai("mock", 20, 5,
            new AiGuruzProperties.Ai.Ollama("http://localhost:11434", "m", 8192),
            new AiGuruzProperties.Ai.Claude("", "claude-opus-5-5", 16000),
            new AiGuruzProperties.Ai.OpenAi("https://api.groq.com/openai/v1", "", "m", 24000));

    private static LlmClient replying(String reply) {
        return new LlmClient() {
            @Override public String name() { return "test-model"; }
            @Override public int maxInputChars() { return 1000; }
            @Override public String complete(String system, String user, boolean jsonOutput) throws Exception {
                if (reply == null) {
                    throw new IllegalStateException("model down");
                }
                return reply;
            }
        };
    }

    @Test
    void extractsJsonWrappedInProseOrFences() {
        assertEquals("{\"a\":1}", AiService.extractJson("Sure! ```json\n{\"a\":1}\n``` hope that helps"));
        assertThrows(IllegalArgumentException.class, () -> AiService.extractJson("no json here"));
    }

    @Test
    void usesTheModelWhenItsOutputIsValid() {
        AiResult<Answer> result = new AiService(replying("{\"value\":\"ok\",\"extra\":true}"), CONFIG)
                .json("t", "s", "p", Answer.class, a -> a.value() != null, () -> new Answer("fallback"));
        assertEquals("ok", result.value().value());
        assertEquals("test-model", result.provider());
        assertFalse(result.fallbackUsed());
    }

    @Test
    void fallsBackWhenTheModelFailsOrOutputIsInvalid() {
        for (String reply : new String[] {null, "not json", "{\"other\":1}"}) {
            AiResult<Answer> result = new AiService(replying(reply), CONFIG)
                    .json("t", "s", "p", Answer.class, a -> a.value() != null, () -> new Answer("fallback"));
            assertEquals("fallback", result.value().value());
            assertEquals("heuristic", result.provider());
            assertTrue(result.fallbackUsed());
        }
    }

    @Test
    void clipReportsTruncation() {
        AiService service = new AiService(LlmClient.NONE, CONFIG);
        assertFalse(service.clip("short").truncated());
        AiService.Clipped clipped = service.clip("x".repeat(50));
        assertTrue(clipped.truncated());
        assertEquals(20, clipped.text().length());
    }
}
