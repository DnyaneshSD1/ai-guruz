package ai.guruz.learnmind.analytics;

import java.time.Instant;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootApplication
@EnableMongoRepositories(considerNestedRepositories = true)
public class AnalyticsApplication {

    /** Append-only record of something that happened in the platform. AUDIT events are the audit log. */
    @Document("events")
    @CompoundIndex(def = "{'tenantId': 1, 'timestamp': -1}")
    @CompoundIndex(def = "{'tenantId': 1, 'category': 1, 'timestamp': -1}")
    public static class Event {
        @Id public String id;
        public String tenantId;
        public String userId;
        public String userName;
        public String category;
        public String type;
        public String resourceType;
        public String resourceId;
        public Map<String, Object> metadata;
        public Instant timestamp;
        public String service;
    }

    public interface EventRepository extends MongoRepository<Event, String> {
        Page<Event> findByTenantIdAndTimestampAfterOrderByTimestampDesc(String tenantId, Instant after, Pageable page);
        Page<Event> findByTenantIdAndUserIdAndTimestampAfterOrderByTimestampDesc(
                String tenantId, String userId, Instant after, Pageable page);
        Page<Event> findByTenantIdAndCategoryOrderByTimestampDesc(String tenantId, String category, Pageable page);
        Page<Event> findByTenantIdAndCategoryAndTypeOrderByTimestampDesc(
                String tenantId, String category, String type, Pageable page);
    }

    public static void main(String[] args) {
        SpringApplication.run(AnalyticsApplication.class, args);
    }
}
