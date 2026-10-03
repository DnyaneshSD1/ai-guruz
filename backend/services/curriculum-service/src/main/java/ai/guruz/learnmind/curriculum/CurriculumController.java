package ai.guruz.learnmind.curriculum;

import ai.guruz.learnmind.common.security.CurrentUser;
import ai.guruz.learnmind.curriculum.CurriculumService.Outcome;
import ai.guruz.learnmind.curriculum.Model.Curriculum;
import ai.guruz.learnmind.curriculum.Model.Decision;
import ai.guruz.learnmind.curriculum.Model.Level;
import ai.guruz.learnmind.curriculum.Model.Module;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CurriculumController {

    public record CreateRequest(@NotBlank @Size(max = 200) String topic, @Size(max = 500) String goal, Level level) {}

    public record OutcomeRequest(@NotNull Decision decision, double score, List<String> weakConcepts) {}

    private final CurriculumService service;

    public CurriculumController(CurriculumService service) {
        this.service = service;
    }

    @PostMapping("/api/curricula")
    Curriculum create(@Valid @RequestBody CreateRequest req) {
        return service.create(CurrentUser.get(), req.topic(), req.goal(), req.level());
    }

    @GetMapping("/api/curricula")
    List<Curriculum> list(@RequestParam(value = "scope", required = false) String scope) {
        return service.list(CurrentUser.get(), scope);
    }

    @GetMapping("/api/curricula/{id}")
    Curriculum get(@PathVariable String id) {
        Curriculum curriculum = service.readable(CurrentUser.get(), id);
        CurriculumService.stripContent(curriculum);
        return curriculum;
    }

    @DeleteMapping("/api/curricula/{id}")
    void delete(@PathVariable String id) {
        service.delete(CurrentUser.get(), id);
    }

    @GetMapping("/api/curricula/{id}/modules/{moduleId}")
    Module module(@PathVariable String id, @PathVariable String moduleId) {
        return service.module(CurrentUser.get(), id, moduleId);
    }

    /**
     * Service-internal (X-Internal-Key plus the learner's token): only the learning engine may move a learner
     * along the path, so a module cannot be marked complete without an assessed quiz.
     */
    @PostMapping("/internal/curricula/{id}/modules/{moduleId}/outcome")
    Outcome outcome(@PathVariable String id, @PathVariable String moduleId, @Valid @RequestBody OutcomeRequest req) {
        return service.applyOutcome(CurrentUser.get(), id, moduleId, req.decision(), req.score(), req.weakConcepts());
    }
}
