package com.aiguruz.curriculum;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.repository.MongoRepository;

public final class Model {

    private Model() {}

    public enum Level { BEGINNER, INTERMEDIATE, ADVANCED, EXPERT }

    /** CORE modules come from the planner; REMEDIAL and LATERAL ones are inserted by the learning path optimizer. */
    public enum Kind { CORE, REMEDIAL, LATERAL }

    public enum ModuleStatus { LOCKED, AVAILABLE, COMPLETED }

    public enum Status { GENERATING, READY, FAILED }

    public enum Decision { ADVANCE, REMEDIAL, LATERAL }

    public static class Source {
        public String title;
        public String url;
        public String snippet;
    }

    public static class Module {
        public String id;
        public String title;
        public Level level;
        public Kind kind = Kind.CORE;
        public List<String> objectives = new ArrayList<>();
        public List<String> concepts = new ArrayList<>();
        public int estimatedMinutes;
        public ModuleStatus status = ModuleStatus.LOCKED;
        /** Markdown lesson, generated the first time the learner opens the module. */
        public String content;
        public String contentProvider;
        /** For REMEDIAL/LATERAL modules: the core module they were created for. */
        public String parentModuleId;
        public Double score;
        public Instant completedAt;
    }

    @Document("curricula")
    @CompoundIndex(def = "{'tenantId': 1, 'userId': 1, 'createdAt': -1}")
    public static class Curriculum {
        @Id public String id;
        public String tenantId;
        public String userId;
        public String userName;
        public String topic;
        public String goal;
        public Level startLevel = Level.BEGINNER;
        public Status status = Status.GENERATING;
        public String summary;
        public List<Source> sources = new ArrayList<>();
        public List<Module> modules = new ArrayList<>();
        public String provider;
        public boolean fallbackUsed;
        public long generationMs;
        public String error;
        public Instant createdAt = Instant.now();
        public Instant updatedAt = Instant.now();
    }

    public interface CurriculumRepository extends MongoRepository<Curriculum, String> {
        List<Curriculum> findByTenantIdAndUserIdOrderByCreatedAtDesc(String tenantId, String userId);
        List<Curriculum> findByTenantIdOrderByCreatedAtDesc(String tenantId);
    }
}
