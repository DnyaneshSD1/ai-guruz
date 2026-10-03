package ai.guruz.learnmind.assessment;

import ai.guruz.learnmind.assessment.Model.Question;
import ai.guruz.learnmind.assessment.Model.QuestionType;
import ai.guruz.learnmind.common.ai.AiResult;
import ai.guruz.learnmind.common.ai.AiService;
import ai.guruz.learnmind.common.ai.TextTools;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/** Assessment Agent: writes a quiz for a module and grades free-text answers. */
@Component
public class AssessmentAgent {

    /** correctIndex is read loosely: small models answer with a number, a letter ("B") or the option text. */
    record GeneratedMcq(String prompt, List<String> options, Object correctIndex, String concept, String explanation) {}

    record GeneratedTask(String prompt, String answerGuide, String concept) {}

    record GeneratedQuiz(List<GeneratedMcq> questions, GeneratedTask task) {}

    record Grade(Double score, String feedback) {}

    private static final String SYSTEM = """
            You are an assessment designer. You write fair questions that test understanding of the lesson \
            (not trivia), each tied to exactly one of the listed concepts.""";

    private final AiService ai;

    public AssessmentAgent(AiService ai) {
        this.ai = ai;
    }

    public AiResult<List<Question>> quiz(String topic, String moduleTitle, List<String> objectives, List<String> concepts,
                                         String lesson, List<String> otherConcepts) {
        String prompt = """
                Course topic: %s
                Module: %s
                Concepts (use these exact names in the "concept" field): %s

                Lesson:
                %s

                Write 5 multiple-choice questions (4 options each, exactly one correct) that together cover every concept, \
                and 1 short written task. JSON shape:
                {"questions": [{"prompt": "the question text",
                                "options": ["full text of answer 1", "full text of answer 2", "full text of answer 3", "full text of answer 4"],
                                "correctIndex": 2,
                                "concept": "one of the concepts", "explanation": "why the correct option is right"}],
                 "task": {"prompt": "a task answerable in 3-6 sentences", "answerGuide": "what a good answer contains",
                          "concept": "one of the concepts"}}
                Every question needs all four answer texts written out in "options"; "correctIndex" is the \
                zero-based position of the correct one and should vary between questions.
                """.formatted(topic, moduleTitle, String.join("; ", concepts), ai.clip(lesson).text());

        AiResult<GeneratedQuiz> generated = ai.json("quiz", SYSTEM, prompt, GeneratedQuiz.class,
                q -> q.questions() != null && q.questions().stream().filter(AssessmentAgent::valid).count() >= 3,
                () -> fallbackQuiz(moduleTitle, objectives, concepts, lesson, otherConcepts));

        List<Question> questions = new ArrayList<>();
        for (GeneratedMcq mcq : generated.value().questions()) {
            if (!valid(mcq)) {
                continue;
            }
            Question q = new Question();
            q.id = UUID.randomUUID().toString();
            q.type = QuestionType.MCQ;
            q.prompt = mcq.prompt().strip();
            q.options = mcq.options();
            q.correctIndex = correctIndex(mcq);
            q.concept = matchConcept(mcq.concept(), concepts);
            q.explanation = mcq.explanation();
            questions.add(q);
        }
        GeneratedTask task = generated.value().task();
        if (task != null && task.prompt() != null && !task.prompt().isBlank()) {
            Question q = new Question();
            q.id = UUID.randomUUID().toString();
            q.type = QuestionType.SHORT;
            q.prompt = task.prompt().strip();
            q.answerGuide = task.answerGuide();
            q.concept = matchConcept(task.concept(), concepts);
            questions.add(q);
        }
        return new AiResult<>(questions, generated.provider(), generated.fallbackUsed(), generated.durationMs());
    }

    public Grade gradeShort(Question question, String answer) {
        if (answer == null || answer.strip().length() < 15) {
            return new Grade(0.0, "No substantial answer was given.");
        }
        String prompt = """
                Task: %s
                A good answer contains: %s

                Learner's answer:
                %s

                Grade the answer. JSON shape: {"score": 0.0 to 1.0, "feedback": "1-2 sentences addressed to the learner"}
                """.formatted(question.prompt, question.answerGuide, answer);
        return ai.json("grade", "You are a fair, encouraging grader. Judge only against the answer guide.", prompt,
                Grade.class,
                g -> g.score() != null && g.score() >= 0 && g.score() <= 1,
                () -> keywordGrade(question, answer)).value();
    }

    /** Offline grading: how many of the guide's key terms the answer mentions. */
    static Grade keywordGrade(Question question, String answer) {
        List<String> expected = TextTools.keywords(question.answerGuide + " " + question.concept, 8);
        String given = answer.toLowerCase(Locale.ROOT);
        long hits = expected.stream().filter(k -> given.contains(k.toLowerCase(Locale.ROOT))).count();
        double score = expected.isEmpty() ? 0.5 : Math.min(1.0, hits / Math.max(2.0, expected.size() * 0.6));
        return new Grade(Math.round(score * 100) / 100.0,
                "Graded by key-term coverage (" + hits + " of " + expected.size() + " expected terms mentioned).");
    }

    /** Offline quiz: cloze questions built from lesson sentences, with other concepts as distractors. */
    static GeneratedQuiz fallbackQuiz(String moduleTitle, List<String> objectives, List<String> concepts,
                                      String lesson, List<String> otherConcepts) {
        Random random = new Random(moduleTitle.hashCode());
        // Headings and list fragments make poor cloze statements; keep full sentences only.
        List<String> sentences = TextTools.sentences(lesson.replaceAll("(?m)^\\s*(#+|[-=]{3,}|\\*\\*[^*]+\\*\\*\\s*$).*$", " ")
                        .replaceAll("[#*>`_]", " ")).stream()
                .filter(sentence -> sentence.split("\\s+").length >= 8).toList();
        List<GeneratedMcq> questions = new ArrayList<>();
        for (String concept : concepts) {
            Set<String> options = new LinkedHashSet<>();
            options.add(concept);
            List<String> pool = new ArrayList<>(concepts);
            pool.addAll(otherConcepts);
            Collections.shuffle(pool, random);
            pool.stream().filter(c -> !c.equalsIgnoreCase(concept)).limit(3).forEach(options::add);
            if (options.size() < 3) {
                options.add("None of the concepts in this course");
                options.add("A topic outside this module");
            }
            List<String> shuffled = new ArrayList<>(options);
            Collections.shuffle(shuffled, random);

            Pattern mention = Pattern.compile(Pattern.quote(concept), Pattern.CASE_INSENSITIVE);
            String statement = sentences.stream().filter(s -> mention.matcher(s).find()).findFirst().orElse(null);
            String prompt = statement != null
                    ? "Which concept completes this statement from the lesson?\n\n\"" + mention.matcher(statement).replaceAll("_____") + "\""
                    : "Which of these concepts is taught in the module \"" + moduleTitle + "\"?";
            questions.add(new GeneratedMcq(prompt, shuffled, shuffled.indexOf(concept), concept,
                    statement != null ? statement : concept + " is one of the concepts this module teaches."));
        }
        String objective = objectives.isEmpty() ? "the main idea of " + moduleTitle : objectives.get(0);
        GeneratedTask task = new GeneratedTask(
                "In 3-6 sentences and in your own words: " + objective + ".",
                String.join("; ", objectives) + ". Key concepts: " + String.join(", ", concepts),
                concepts.isEmpty() ? moduleTitle : concepts.get(0));
        return new GeneratedQuiz(questions, task);
    }

    private static boolean valid(GeneratedMcq q) {
        return q.prompt() != null && !q.prompt().isBlank()
                && q.options() != null && q.options().size() >= 3
                && q.options().stream().allMatch(o -> o != null && !o.isBlank())
                && correctIndex(q) != null;
    }

    static Integer correctIndex(GeneratedMcq q) {
        Object raw = q.correctIndex();
        Integer index = null;
        if (raw instanceof Number n) {
            index = n.intValue();
        } else if (raw instanceof String text && !text.isBlank()) {
            String t = text.strip();
            if (t.matches("\\d+")) {
                index = Integer.parseInt(t);
            } else if (t.length() == 1 && Character.isLetter(t.charAt(0))) {
                index = Character.toUpperCase(t.charAt(0)) - 'A';
            } else {
                for (int i = 0; i < q.options().size(); i++) {
                    if (q.options().get(i).strip().equalsIgnoreCase(t)) {
                        index = i;
                    }
                }
            }
        }
        return index != null && index >= 0 && index < q.options().size() ? index : null;
    }

    /** Models paraphrase concept names; map each back to the module's own list so mastery is tracked consistently. */
    private static String matchConcept(String raw, List<String> concepts) {
        if (concepts.isEmpty()) {
            return raw;
        }
        if (raw != null) {
            String needle = raw.strip().toLowerCase(Locale.ROOT);
            for (String c : concepts) {
                String candidate = c.toLowerCase(Locale.ROOT);
                if (candidate.equals(needle) || candidate.contains(needle) || needle.contains(candidate)) {
                    return c;
                }
            }
        }
        return concepts.get(0);
    }
}
