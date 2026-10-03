package com.aiguruz.common.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.sqs.SqsAsyncClient;
import tools.jackson.databind.json.JsonMapper;

/** Production transport: events go to an SQS queue that analytics-service consumes. */
public class SqsEventPublisher implements EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(SqsEventPublisher.class);

    private final SqsAsyncClient sqs = SqsAsyncClient.create();
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final String queueUrl;

    public SqsEventPublisher(String queueUrl) {
        this.queueUrl = queueUrl;
    }

    @Override
    public void publish(LearnEvent event) {
        try {
            String body = mapper.writeValueAsString(event);
            sqs.sendMessage(b -> b.queueUrl(queueUrl).messageBody(body)).whenComplete((r, e) -> {
                if (e != null) {
                    log.warn("Could not publish event {}: {}", event.type(), e.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("Could not publish event {}: {}", event.type(), e.getMessage());
        }
    }
}
