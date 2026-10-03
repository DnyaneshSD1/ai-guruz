package ai.guruz.learnmind.document;

import ai.guruz.learnmind.common.security.CurrentUser;
import ai.guruz.learnmind.document.Model.StoredDocument;
import ai.guruz.learnmind.document.Model.Visibility;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class DocumentController {

    public record UpdateRequest(String title, Visibility visibility) {}

    public record TextResponse(String documentId, String title, String text, boolean truncated) {}

    public record ExtractionCallback(@NotBlank String storageKey, String text, String error) {}

    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    @PostMapping(path = "/api/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    StoredDocument upload(@RequestParam("file") MultipartFile file,
                          @RequestParam(value = "title", required = false) String title) throws Exception {
        return service.upload(CurrentUser.get(), file, title);
    }

    @GetMapping("/api/documents")
    List<StoredDocument> list(@RequestParam(value = "scope", required = false) String scope) {
        return service.list(CurrentUser.get(), scope);
    }

    @GetMapping("/api/documents/{id}")
    StoredDocument get(@PathVariable String id) {
        return service.readable(CurrentUser.get(), id);
    }

    @GetMapping("/api/documents/{id}/text")
    TextResponse text(@PathVariable String id) {
        StoredDocument doc = service.readable(CurrentUser.get(), id);
        return new TextResponse(doc.id, doc.title, service.text(doc), doc.textTruncated);
    }

    @GetMapping("/api/documents/{id}/download")
    ResponseEntity<InputStreamResource> download(@PathVariable String id) {
        StoredDocument doc = service.readable(CurrentUser.get(), id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(doc.filename).build().toString())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(doc.size)
                .body(new InputStreamResource(service.content(doc)));
    }

    @PatchMapping("/api/documents/{id}")
    StoredDocument update(@PathVariable String id, @RequestBody UpdateRequest req) {
        return service.update(CurrentUser.get(), id, req.title(), req.visibility());
    }

    @DeleteMapping("/api/documents/{id}")
    void delete(@PathVariable String id) {
        service.delete(CurrentUser.get(), id);
    }

    /** Service-internal (X-Internal-Key): result of the S3-triggered extraction Lambda. */
    @PostMapping("/internal/documents/extracted")
    void extracted(@RequestBody ExtractionCallback callback) {
        service.extractionCallback(callback.storageKey(), callback.text(), callback.error());
    }
}
