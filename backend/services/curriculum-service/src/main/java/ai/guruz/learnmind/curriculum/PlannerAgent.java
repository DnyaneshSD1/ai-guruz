package ai.guruz.learnmind.curriculum;

import ai.guruz.learnmind.common.ai.AiResult;
import ai.guruz.learnmind.common.ai.AiService;
import ai.guruz.learnmind.common.ai.TextTools;
import ai.guruz.learnmind.curriculum.Model.Curriculum;
import ai.guruz.learnmind.curriculum.Model.Kind;
import ai.guruz.learnmind.curriculum.Model.Level;
import ai.guruz.learnmind.curriculum.Model.Module;
import ai.guruz.learnmind.curriculum.Model.Source;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Planner Agent (curriculum outline) and Content Generator (lesson text), each with an offline fallback. */
@Component
public class PlannerAgent {

    public record PlannedModule(String title, String level, List<String> objectives, List<String> concepts,
                                Integer estimatedMinutes) {}

    public record Plan(String summary, List<PlannedModule> modules) {}

    private static final String PLANNER_SYSTEM = """
            You are a curriculum designer. You plan a learning path that takes a learner from their starting level \
            to expert, one module at a time. Each module teaches 2-4 named concepts and builds on the previous one.""";

    private static final String TEACHER_SYSTEM = """
            You are a patient expert teacher writing a self-study lesson in Markdown. Be accurate and concrete, \
            use short paragraphs and examples, and do not invent citations.""";

    private final AiService ai;

    public PlannerAgent(AiService ai) {
        this.ai = ai;
    }

    public AiResult<Plan> plan(String topic, String goal, Level startLevel, List<Source> sources) {
        String research = researchNotes(sources);
        String prompt = """
                Topic: %s
                Learner's goal: %s
                Starting level: %s

                Research notes:
                %s

                Plan 6 to 9 modules that progress from the starting level through to EXPERT. JSON shape:
                {"summary": "2-3 sentences describing the path",
                 "modules": [{"title": "module title", "level": "BEGINNER|INTERMEDIATE|ADVANCED|EXPERT",
                              "objectives": ["2-4 measurable learning objectives"],
                              "concepts": ["2-4 short concept names taught in this module"],
                              "estimatedMinutes": 20}]}
                """.formatted(topic, blankTo(goal, "build solid, practical understanding"), startLevel,
                ai.clip(blankTo(research, "(none available: rely on your own knowledge)")).text());
        return ai.json("curriculum-plan", PLANNER_SYSTEM, prompt, Plan.class,
                p -> p.modules() != null && p.modules().size() >= 4
                        && p.modules().stream().allMatch(m -> m.title() != null && !m.title().isBlank()
                        && m.concepts() != null && !m.concepts().isEmpty()),
                () -> fallbackPlan(topic, startLevel, research));
    }

    public AiResult<String> lesson(Curriculum curriculum, Module module) {
        String approach = switch (module.kind) {
            case CORE -> "Teach the module from first principles at the stated level.";
            case REMEDIAL -> "The learner struggled with these concepts in the previous quiz. Re-teach them more slowly, "
                    + "with simpler language, a different explanation than a textbook would give, analogies and a worked example.";
            case LATERAL -> "The learner knows the basics of these concepts but has gaps. Approach them from a different angle: "
                    + "practical applications, comparisons and common mistakes.";
        };
        String prompt = """
                Course topic: %s
                Module: %s (level %s)
                Learning objectives:
                %s
                Concepts to cover: %s
                Approach: %s

                Background notes:
                %s

                Write the lesson (500-900 words) in Markdown with these sections:
                ## Overview, one "## <concept>" section per concept, ## Worked example, ## Key takeaways (bullets).
                """.formatted(curriculum.topic, module.title, module.level, bullets(module.objectives),
                String.join(", ", module.concepts), approach,
                ai.clip(blankTo(researchNotes(curriculum.sources), "(none)")).text());
        return ai.text("lesson", TEACHER_SYSTEM, prompt, () -> fallbackLesson(curriculum, module));
    }

    /** Module the path optimizer inserts after a weak or partial quiz result. */
    public Module adaptiveModule(Module after, Kind kind, List<String> weakConcepts) {
        List<String> focus = weakConcepts == null || weakConcepts.isEmpty() ? after.concepts : weakConcepts;
        String label = focus.stream().limit(3).collect(Collectors.joining(", "));
        Module module = new Module();
        module.id = java.util.UUID.randomUUID().toString();
        module.kind = kind;
        module.level = after.level;
        module.concepts = new ArrayList<>(focus);
        module.parentModuleId = after.parentModuleId != null ? after.parentModuleId : after.id;
        module.estimatedMinutes = 15;
        module.status = Model.ModuleStatus.AVAILABLE;
        if (kind == Kind.REMEDIAL) {
            module.title = "Reinforce: " + label;
            module.objectives = focus.stream().map(c -> "Rebuild a clear understanding of " + c).toList();
        } else {
            module.title = "Apply it: " + label;
            module.objectives = focus.stream().map(c -> "Use " + c + " in a new, practical context").toList();
        }
        return module;
    }

    static Plan fallbackPlan(String topic, Level startLevel, String research) {
        record Template(String title, Level level, String objective) {}
        List<Template> templates = List.of(
                new Template("Introduction to %s", Level.BEGINNER, "Describe what %s is and why it matters"),
                new Template("Core vocabulary of %s", Level.BEGINNER, "Define the essential terms used in %s"),
                new Template("How %s works", Level.INTERMEDIATE, "Explain the main mechanisms behind %s"),
                new Template("Working with %s in practice", Level.INTERMEDIATE, "Apply %s to a realistic problem"),
                new Template("Advanced techniques in %s", Level.ADVANCED, "Compare advanced approaches within %s"),
                new Template("Trade-offs and pitfalls in %s", Level.ADVANCED, "Analyse trade-offs and common mistakes in %s"),
                new Template("Current frontiers of %s", Level.EXPERT, "Evaluate open problems and recent directions in %s"),
                new Template("Mastery project: %s", Level.EXPERT, "Design and justify an original piece of work in %s"));

        List<String> keywords = TextTools.keywords(research, 24);
        List<PlannedModule> modules = new ArrayList<>();
        int used = 0;
        for (Template t : templates) {
            if (t.level().ordinal() < startLevel.ordinal()) {
                continue;
            }
            List<String> concepts = new ArrayList<>();
            while (concepts.size() < 3 && used < keywords.size()) {
                concepts.add(keywords.get(used++));
            }
            if (concepts.isEmpty()) {
                concepts.add(t.title().formatted(topic));
            }
            modules.add(new PlannedModule(t.title().formatted(topic), t.level().name(),
                    List.of(t.objective().formatted(topic), "Explain how " + String.join(", ", concepts) + " fit together"),
                    concepts, 20));
        }
        return new Plan("A structured path through " + topic + ", from fundamentals to expert-level practice. "
                + "This outline was built without an AI model, so module topics are generic.", modules);
    }

    static String fallbackLesson(Curriculum curriculum, Module module) {
        StringBuilder md = new StringBuilder("## Overview\n\n");
        md.append("This module, **").append(module.title).append("**, is part of your path through ")
                .append(curriculum.topic).append(". By the end you should be able to:\n\n")
                .append(bullets(module.objectives)).append("\n\n");
        String notes = researchNotes(curriculum.sources);
        List<String> sentences = TextTools.sentences(notes);
        for (String concept : module.concepts) {
            md.append("## ").append(concept).append("\n\n");
            List<String> relevant = sentences.stream()
                    .filter(s -> s.toLowerCase().contains(concept.toLowerCase())).limit(3).toList();
            if (relevant.isEmpty()) {
                md.append("Study how **").append(concept).append("** is defined, where it is used in ")
                        .append(curriculum.topic).append(", and how it connects to the other concepts in this module.\n\n");
            } else {
                relevant.forEach(s -> md.append(s).append(' '));
                md.append("\n\n");
            }
        }
        md.append("## Key takeaways\n\n");
        module.concepts.forEach(c -> md.append("- Be able to explain **").append(c).append("** in your own words.\n"));
        if (!curriculum.sources.isEmpty()) {
            md.append("\n## Further reading\n\n");
            curriculum.sources.forEach(s -> md.append("- [").append(s.title).append("](").append(s.url).append(")\n"));
        }
        md.append("\n> This lesson was assembled without an AI model. Connect Ollama or Claude for a full lesson.\n");
        return md.toString();
    }

    private static String researchNotes(List<Source> sources) {
        return sources.stream().map(s -> s.title + ": " + s.snippet).collect(Collectors.joining("\n\n"));
    }

    private static String bullets(List<String> items) {
        return items.stream().map(i -> "- " + i).collect(Collectors.joining("\n"));
    }

    private static String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
