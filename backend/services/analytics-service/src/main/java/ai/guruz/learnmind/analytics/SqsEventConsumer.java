package ai.guruz.learnmind.analytics;

import ai.guruz.learnmind.common.LearnMindProperties;
import ai.guruz.learnmind.common.events.LearnEvent;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.Message;
import tools.jackson.databind.json.JsonMapper;

/** Production intake (EVENTS_MODE=sqs): long-polls the events queue. A message is deleted only once it is stored. */
@Component
@ConditionalOnProperty(name = "learnmind.events.mode", havingValue = "sqs")
public class SqsEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(SqsEventConsumer.class);

    private final AnalyticsController intake;
    private final String queueUrl;
    private final SqsClient sqs = SqsClient.create();
    private final JsonMapper mapper = JsonMapper.builder().build();
    private volatile boolean running = true;

    public SqsEventConsumer(AnalyticsController intake, LearnMindProperties props) {
        this.intake = intake;
        this.queueUrl = props.events().queueUrl();
    }

    @PostConstruct
    void start() {
        Thread.ofVirtual().name("sqs-events").start(this::poll);
    }

    @PreDestroy
    void stop() {
        running = false;
    }

    private void poll() {
        while (running) {
            try {
                for (Message message : sqs.receiveMessage(b -> b.queueUrl(queueUrl)
                        .maxNumberOfMessages(10).waitTimeSeconds(20)).messages()) {
                    intake.store(mapper.readValue(message.body(), LearnEvent.class));
                    sqs.deleteMessage(b -> b.queueUrl(queueUrl).receiptHandle(message.receiptHandle()));
                }
            } catch (Exception e) {
                log.warn("Event polling failed: {}", e.getMessage());
                try {
                    Thread.sleep(5_000);
                } catch (InterruptedException interrupted) {
                    return;
                }
            }
        }
    }
}
