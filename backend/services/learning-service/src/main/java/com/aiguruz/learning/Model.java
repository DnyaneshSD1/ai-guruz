package com.aiguruz.learning;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.repository.MongoRepository;

public final class Model {

    private Model() {}

    public enum Decision { ADVANCE, REMEDIAL, LATERAL }

    public record ConceptScore(String concept, double score) {}

    public static class ConceptState {
        public String name;
        /** 0..1, an exponentially weighted average so recent quizzes count more. */
        public double mastery;
        public int attempts;
        public Instant lastAssessedAt;
    }

    /** What one learner knows within one curriculum. */
    @Document("knowledge_states")
    @CompoundIndex(def = "{'tenantId': 1, 'userId': 1, 'curriculumId': 1}", unique = true)
    public static class KnowledgeState {
        @Id public String id;
        public String tenantId;
        public String userId;
        public String curriculumId;
        public List<ConceptState> concepts = new ArrayList<>();
        public Instant updatedAt = Instant.now();
    }

    /** One assessed module and the path decision it led to. */
    @Document("progress_records")
    @CompoundIndex(def = "{'tenantId': 1, 'userId': 1, 'curriculumId': 1, 'createdAt': -1}")
    public static class ProgressRecord {
        @Id public String id;
        public String tenantId;
        public String userId;
        public String curriculumId;
        public String moduleId;
        public String assessmentId;
        public double score;
        public Decision decision;
        public List<String> weakConcepts = new ArrayList<>();
        public Instant createdAt = Instant.now();
    }

    public interface KnowledgeStateRepository extends MongoRepository<KnowledgeState, String> {
        Optional<KnowledgeState> findByTenantIdAndUserIdAndCurriculumId(String tenantId, String userId, String curriculumId);
        List<KnowledgeState> findByTenantIdAndUserId(String tenantId, String userId);
    }

    public interface ProgressRepository extends MongoRepository<ProgressRecord, String> {
        List<ProgressRecord> findByTenantIdAndUserIdAndCurriculumIdOrderByCreatedAtAsc(
                String tenantId, String userId, String curriculumId);
    }
}
