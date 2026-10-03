package com.aiguruz.assessment;

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

    public enum QuestionType { MCQ, SHORT }

    public enum Status { OPEN, SUBMITTED }

    public static class Question {
        public String id;
        public QuestionType type;
        public String prompt;
        public List<String> options = new ArrayList<>();
        public String concept;
        // Answer key: removed from API responses until the assessment is submitted.
        public Integer correctIndex;
        public String answerGuide;
        public String explanation;
    }

    public static class Answer {
        public String questionId;
        public Integer selectedIndex;
        public String text;
    }

    public static class QuestionResult {
        public String questionId;
        public double score;
        public String feedback;
    }

    public static class ConceptScore {
        public String concept;
        public double score;

        public ConceptScore() {}

        public ConceptScore(String concept, double score) {
            this.concept = concept;
            this.score = score;
        }
    }

    @Document("assessments")
    @CompoundIndex(def = "{'tenantId': 1, 'userId': 1, 'curriculumId': 1, 'moduleId': 1}")
    public static class Assessment {
        @Id public String id;
        public String tenantId;
        public String userId;
        public String curriculumId;
        public String moduleId;
        public String moduleTitle;
        public String topic;
        public List<Question> questions = new ArrayList<>();
        public Status status = Status.OPEN;
        public List<Answer> answers = new ArrayList<>();
        public List<QuestionResult> results = new ArrayList<>();
        public Double score;
        public List<ConceptScore> conceptScores = new ArrayList<>();
        /** Filled from the learning engine after submission. */
        public String decision;
        public String nextModuleId;
        public String message;
        public String provider;
        public boolean fallbackUsed;
        public Instant createdAt = Instant.now();
        public Instant submittedAt;
    }

    public interface AssessmentRepository extends MongoRepository<Assessment, String> {
        Optional<Assessment> findFirstByTenantIdAndUserIdAndCurriculumIdAndModuleIdAndStatus(
                String tenantId, String userId, String curriculumId, String moduleId, Status status);
        List<Assessment> findByTenantIdAndUserIdAndCurriculumIdOrderByCreatedAtDesc(
                String tenantId, String userId, String curriculumId);
    }
}
