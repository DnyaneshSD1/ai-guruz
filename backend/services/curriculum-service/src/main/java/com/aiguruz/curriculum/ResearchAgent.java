package com.aiguruz.curriculum;

import com.aiguruz.curriculum.Model.Source;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/**
 * Research Agent: gathers background on a topic from Wikipedia (an open, citable source) and keeps the links
 * so every curriculum shows where its material came from. Any failure degrades to "no sources" rather than an error.
 */
@Component
public class ResearchAgent {

    private static final Logger log = LoggerFactory.getLogger(ResearchAgent.class);
    private static final int MAX_SNIPPET = 1500;

    private final boolean enabled;
    private final String baseUrl;
    private final RestClient client;

    public ResearchAgent(@Value("${aiguruz.research.enabled}") boolean enabled,
                         @Value("${aiguruz.research.base-url}") String baseUrl) {
        this.enabled = enabled;
        this.baseUrl = baseUrl;
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory)
                .defaultHeader("User-Agent", "AIGuruz/1.0 (adaptive learning platform)")
                .build();
    }

    public List<Source> research(String topic) {
        List<Source> sources = new ArrayList<>();
        if (!enabled) {
            return sources;
        }
        try {
            JsonNode search = client.get().uri(b -> b.path("/w/api.php")
                            .queryParam("action", "query").queryParam("list", "search")
                            .queryParam("srsearch", "{topic}").queryParam("srlimit", 4)
                            .queryParam("format", "json").build(topic))
                    .retrieve().body(JsonNode.class);
            List<String> titles = new ArrayList<>();
            search.path("query").path("search").forEach(hit -> titles.add(hit.path("title").asString()));
            if (titles.isEmpty()) {
                return sources;
            }
            JsonNode pages = client.get().uri(b -> b.path("/w/api.php")
                            .queryParam("action", "query").queryParam("prop", "extracts")
                            .queryParam("explaintext", 1).queryParam("exintro", 1).queryParam("redirects", 1)
                            .queryParam("titles", "{titles}").queryParam("format", "json")
                            .build(String.join("|", titles)))
                    .retrieve().body(JsonNode.class);
            pages.path("query").path("pages").forEach(page -> {
                String extract = page.path("extract").asString("").strip();
                if (extract.length() > 80) {
                    Source source = new Source();
                    source.title = page.path("title").asString();
                    source.url = baseUrl + "/wiki/" + source.title.replace(' ', '_');
                    source.snippet = extract.length() > MAX_SNIPPET ? extract.substring(0, MAX_SNIPPET) + "…" : extract;
                    sources.add(source);
                }
            });
        } catch (Exception e) {
            log.warn("Research for '{}' unavailable: {}", topic, e.getMessage());
        }
        return sources;
    }
}
