package com.aiguruz.analysis;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.repository.MongoRepository;

public final class Model {

    private Model() {}

    public enum Type { SUMMARY, MIND_MAP, DEEP_ANALYSIS, EXAM_PREP }

    public enum Status { PENDING, READY, FAILED }

    @Document("analyses")
    @CompoundIndex(def = "{'tenantId': 1, 'userId': 1, 'documentId': 1, 'type': 1}")
    public static class Analysis {
        @Id public String id;
        public String tenantId;
        public String userId;
        public String documentId;
        public String documentTitle;
        public Type type;
        public Status status = Status.PENDING;
        /** One of the result records below, depending on type. */
        public Object result;
        /** Share of the result's key terms that occur in the source text, scaled to 0..1. */
        public double confidence;
        public String provider;
        public boolean fallbackUsed;
        public boolean sourceTruncated;
        public long durationMs;
        public String error;
        public Instant createdAt = Instant.now();
    }

    public record Summary(String overview, List<String> keyPoints, List<String> keywords) {}

    public record MindNode(String label, List<MindNode> children) {}

    public record MindMap(MindNode root) {}

    public record Theme(String title, String explanation) {}

    public record DeepAnalysis(List<Theme> themes, List<String> insights, List<String> gaps, List<String> questions) {}

    public record Flashcard(String front, String back) {}

    public record ExamQuestion(String question, String answer, String difficulty) {}

    public record ExamPrep(List<Flashcard> flashcards, List<ExamQuestion> questions, List<String> studyTips) {}

    public interface AnalysisRepository extends MongoRepository<Analysis, String> {
        List<Analysis> findByTenantIdAndUserIdAndDocumentIdOrderByCreatedAtDesc(String tenantId, String userId, String documentId);
        Optional<Analysis> findFirstByTenantIdAndUserIdAndDocumentIdAndTypeOrderByCreatedAtDesc(
                String tenantId, String userId, String documentId, Type type);
        void deleteByTenantIdAndUserIdAndDocumentIdAndType(String tenantId, String userId, String documentId, Type type);
    }
}
