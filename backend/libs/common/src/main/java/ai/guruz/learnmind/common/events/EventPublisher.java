package ai.guruz.learnmind.common.events;

public interface EventPublisher {
    /** Best effort and non-blocking: a failed publish must never fail the user's request. */
    void publish(LearnEvent event);
}
