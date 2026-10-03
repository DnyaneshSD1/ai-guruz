package ai.guruz.learnmind.common.events;

import ai.guruz.learnmind.common.security.CurrentUser;
import java.time.Instant;
import java.util.Map;

public class Events {

    private final EventPublisher publisher;
    private final String service;

    public Events(EventPublisher publisher, String service) {
        this.publisher = publisher;
        this.service = service;
    }

    public void audit(CurrentUser user, String type, String resourceType, String resourceId, Map<String, Object> meta) {
        emit(user.tenantId(), user.id(), user.name(), LearnEvent.AUDIT, type, resourceType, resourceId, meta);
    }

    public void activity(CurrentUser user, String type, String resourceType, String resourceId, Map<String, Object> meta) {
        emit(user.tenantId(), user.id(), user.name(), LearnEvent.ACTIVITY, type, resourceType, resourceId, meta);
    }

    public void emit(String tenantId, String userId, String userName, String category, String type,
                     String resourceType, String resourceId, Map<String, Object> meta) {
        publisher.publish(new LearnEvent(tenantId, userId, userName, category, type, resourceType, resourceId,
                meta == null ? Map.of() : meta, Instant.now(), service));
    }
}
