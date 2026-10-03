package com.aiguruz.common.events;

import com.aiguruz.common.security.InternalKeyFilter;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** Local/default transport: posts events straight to analytics-service. */
public class HttpEventPublisher implements EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(HttpEventPublisher.class);

    private final RestClient client;
    private final String internalKey;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public HttpEventPublisher(String analyticsUrl, String internalKey) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.client = RestClient.builder().baseUrl(analyticsUrl).requestFactory(factory).build();
        this.internalKey = internalKey;
    }

    @Override
    public void publish(LearnEvent event) {
        executor.submit(() -> {
            try {
                client.post().uri("/internal/events")
                        .header(InternalKeyFilter.HEADER, internalKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(event)
                        .retrieve().toBodilessEntity();
            } catch (Exception e) {
                log.warn("Could not publish event {}: {}", event.type(), e.getMessage());
            }
        });
    }
}
