package com.aiguruz.document;

import com.aiguruz.common.events.Events;
import com.aiguruz.common.security.CurrentUser;
import com.aiguruz.common.security.Role;
import com.aiguruz.common.web.ApiException;
import com.aiguruz.document.DocumentApplication.DocumentProperties;
import com.aiguruz.document.Model.DocumentRepository;
import com.aiguruz.document.Model.DocumentText;
import com.aiguruz.document.Model.Status;
import com.aiguruz.document.Model.StoredDocument;
import com.aiguruz.document.Model.TextRepository;
import com.aiguruz.document.Model.Visibility;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    private static final Set<String> ALLOWED = Set.of("pdf", "docx", "pptx", "txt", "md", "rtf", "html", "epub");
    /** Keeps a text record safely under MongoDB's 16 MB document limit. */
    static final int MAX_TEXT_CHARS = 2_000_000;

    private final DocumentRepository documents;
    private final TextRepository texts;
    private final Storage storage;
    private final DocumentProperties props;
    private final Events events;
    private final ExecutorService extractor = Executors.newFixedThreadPool(2);

    public DocumentService(DocumentRepository documents, TextRepository texts, Storage storage,
                           DocumentProperties props, Events events) {
        this.documents = documents;
        this.texts = texts;
        this.storage = storage;
        this.props = props;
        this.events = events;
    }

    public StoredDocument upload(CurrentUser user, MultipartFile file, String title) throws Exception {
        String filename = safeName(file.getOriginalFilename());
        String extension = filename.contains(".") ? filename.substring(filename.lastIndexOf('.') + 1) : "";
        if (file.isEmpty()) {
            throw ApiException.badRequest("The file is empty");
        }
        if (!ALLOWED.contains(extension.toLowerCase(Locale.ROOT))) {
            throw ApiException.badRequest("Unsupported file type. Allowed: " + String.join(", ", ALLOWED.stream().sorted().toList()));
        }
        StoredDocument doc = new StoredDocument();
        doc.tenantId = user.tenantId();
        doc.ownerId = user.id();
        doc.ownerName = user.name();
        doc.title = title == null || title.isBlank() ? filename.replaceFirst("\\.[^.]+$", "") : title.strip();
        doc.filename = filename;
        doc.contentType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        doc.size = file.getSize();
        doc.storageKey = user.tenantId() + "/" + UUID.randomUUID() + "/" + filename;
        try (InputStream in = file.getInputStream()) {
            storage.put(doc.storageKey, in, doc.size, doc.contentType);
        }
        StoredDocument saved = documents.save(doc);
        events.audit(user, "DOCUMENT_UPLOADED", "document", saved.id, Map.of("title", saved.title, "size", saved.size));
        if ("inline".equals(props.extraction())) {
            extractor.submit(() -> extractInline(saved.id));
        }
        return saved;
    }

    public List<StoredDocument> list(CurrentUser user, String scope) {
        return switch (scope == null ? "mine" : scope) {
            case "shared" -> documents.findByTenantIdAndVisibilityOrderByCreatedAtDesc(user.tenantId(), Visibility.SHARED);
            case "all" -> {
                user.require(Role.LIBRARIAN, Role.ADMIN);
                yield documents.findByTenantIdOrderByCreatedAtDesc(user.tenantId());
            }
            default -> documents.findByTenantIdAndOwnerIdOrderByCreatedAtDesc(user.tenantId(), user.id());
        };
    }

    /** Readable by the owner, by anyone in the institution when shared, and by librarians and admins. */
    public StoredDocument readable(CurrentUser user, String id) {
        StoredDocument doc = documents.findById(id)
                .filter(d -> d.tenantId.equals(user.tenantId()))
                .orElseThrow(() -> ApiException.notFound("Document"));
        boolean allowed = doc.ownerId.equals(user.id())
                || doc.visibility == Visibility.SHARED
                || user.hasAny(Role.LIBRARIAN, Role.ADMIN);
        if (!allowed) {
            throw ApiException.notFound("Document");
        }
        return doc;
    }

    public StoredDocument update(CurrentUser user, String id, String title, Visibility visibility) {
        StoredDocument doc = manageable(user, id);
        if (title != null && !title.isBlank()) {
            doc.title = title.strip();
        }
        if (visibility != null && visibility != doc.visibility) {
            // Publishing to the institution library is a curation decision, not something every learner can do.
            user.require(Role.TEACHER, Role.LIBRARIAN, Role.ADMIN);
            doc.visibility = visibility;
            events.audit(user, visibility == Visibility.SHARED ? "DOCUMENT_SHARED" : "DOCUMENT_UNSHARED",
                    "document", doc.id, Map.of("title", doc.title));
        }
        return documents.save(doc);
    }

    public void delete(CurrentUser user, String id) {
        StoredDocument doc = manageable(user, id);
        storage.delete(doc.storageKey);
        texts.deleteById(doc.id);
        documents.delete(doc);
        events.audit(user, "DOCUMENT_DELETED", "document", doc.id, Map.of("title", doc.title));
    }

    public String text(StoredDocument doc) {
        if (doc.status != Status.READY) {
            throw ApiException.conflict(doc.status == Status.FAILED
                    ? "Text could not be extracted from this document"
                    : "The document is still being processed");
        }
        return texts.findById(doc.id).map(t -> t.text).orElse("");
    }

    public InputStream content(StoredDocument doc) {
        return storage.get(doc.storageKey);
    }

    /** Called by the extraction Lambda (production) once it has processed the S3 object. */
    public void extractionCallback(String storageKey, String text, String error) {
        StoredDocument doc = documents.findByStorageKey(storageKey).orElseThrow(() -> ApiException.notFound("Document"));
        storeText(doc, text, error);
    }

    private void extractInline(String id) {
        StoredDocument doc = documents.findById(id).orElse(null);
        if (doc == null) {
            return;
        }
        try (InputStream in = storage.get(doc.storageKey)) {
            Tika tika = new Tika();
            tika.setMaxStringLength(MAX_TEXT_CHARS);
            storeText(doc, tika.parseToString(in), null);
        } catch (Throwable e) {
            log.warn("Extraction failed for {}: {}", id, e.toString());
            storeText(doc, null, "Text extraction failed");
        }
    }

    private void storeText(StoredDocument doc, String text, String error) {
        String clean = text == null ? "" : text.replace("\u0000", "").strip();
        if (error != null || clean.isEmpty()) {
            doc.status = Status.FAILED;
            doc.error = error != null ? error : "No readable text was found (scanned PDFs need OCR)";
        } else {
            DocumentText record = new DocumentText();
            record.documentId = doc.id;
            record.text = clean.length() > MAX_TEXT_CHARS ? clean.substring(0, MAX_TEXT_CHARS) : clean;
            texts.save(record);
            doc.status = Status.READY;
            doc.charCount = record.text.length();
            doc.textTruncated = clean.length() >= MAX_TEXT_CHARS;
            doc.error = null;
        }
        documents.save(doc);
    }

    private StoredDocument manageable(CurrentUser user, String id) {
        StoredDocument doc = readable(user, id);
        if (!doc.ownerId.equals(user.id()) && !user.hasAny(Role.LIBRARIAN, Role.ADMIN)) {
            throw ApiException.forbidden("Only the owner, a librarian or an admin can change this document");
        }
        return doc;
    }

    private static String safeName(String original) {
        String name = original == null ? "document" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._ -]", "_").strip();
        return name.isEmpty() ? "document" : name;
    }
}
