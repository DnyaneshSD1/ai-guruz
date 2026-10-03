package com.aiguruz.common.ai;

/** One model call. Implementations throw on any failure; AiService decides how to recover. */
public interface LlmClient {

    String name();

    /** Largest prompt (in characters) this provider is given in one call. */
    int maxInputChars();

    String complete(String system, String user, boolean jsonOutput) throws Exception;

    /** No model configured: AiService goes straight to its offline fallback. */
    LlmClient NONE = new LlmClient() {
        @Override public String name() { return "heuristic"; }
        @Override public int maxInputChars() { return 200_000; }
        @Override public String complete(String system, String user, boolean jsonOutput) {
            throw new UnsupportedOperationException("No LLM provider configured");
        }
    };
}
