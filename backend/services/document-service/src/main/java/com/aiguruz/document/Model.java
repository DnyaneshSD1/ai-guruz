package com.aiguruz.document;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.repository.MongoRepository;

public final class Model {

    private Model() {}

    public enum Visibility { PRIVATE, SHARED }

    public enum Status { PROCESSING, READY, FAILED }

    @Document("documents")
    public static class StoredDocument {
        @Id public String id;
        @Indexed public String tenantId;
        @Indexed public String ownerId;
        public String ownerName;
        public String title;
        public String filename;
        public String contentType;
        public long size;
        @JsonIgnore @Indexed public String storageKey;
        public Visibility visibility = Visibility.PRIVATE;
        public Status status = Status.PROCESSING;
        public String error;
        public int charCount;
        public boolean textTruncated;
        public Instant createdAt = Instant.now();
    }

    /** Extracted text is kept apart from the metadata so listings stay small. */
    @Document("document_texts")
    public static class DocumentText {
        @Id public String documentId;
        public String text;
    }

    public interface DocumentRepository extends MongoRepository<StoredDocument, String> {
        List<StoredDocument> findByTenantIdAndOwnerIdOrderByCreatedAtDesc(String tenantId, String ownerId);
        List<StoredDocument> findByTenantIdAndVisibilityOrderByCreatedAtDesc(String tenantId, Visibility visibility);
        List<StoredDocument> findByTenantIdOrderByCreatedAtDesc(String tenantId);
        Optional<StoredDocument> findByStorageKey(String storageKey);
    }

    public interface TextRepository extends MongoRepository<DocumentText, String> {}
}
