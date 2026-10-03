package ai.guruz.learnmind.analysis;

import ai.guruz.learnmind.analysis.Model.DeepAnalysis;
import ai.guruz.learnmind.analysis.Model.ExamPrep;
import ai.guruz.learnmind.analysis.Model.ExamQuestion;
import ai.guruz.learnmind.analysis.Model.Flashcard;
import ai.guruz.learnmind.analysis.Model.MindMap;
import ai.guruz.learnmind.analysis.Model.MindNode;
import ai.guruz.learnmind.analysis.Model.Summary;
import ai.guruz.learnmind.analysis.Model.Theme;
import ai.guruz.learnmind.analysis.Model.Type;
import ai.guruz.learnmind.common.ai.AiResult;
import ai.guruz.learnmind.common.ai.AiService;
import ai.guruz.learnmind.common.ai.TextTools;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Component;

/** Turns document text into one of the four analysis products, with an extractive fallback for each. */
@Component
public class Analyzer {

    private static final String SYSTEM = """
            You are an academic content analyst. Work only from the document provided by the user: \
            do not add facts that are not in it. Write clearly for students.""";

    private final AiService ai;

    public Analyzer(AiService ai) {
        this.ai = ai;
    }

    public AiResult<?> run(Type type, String title, String text) {
        String source = "Document title: " + title + "\n\nDocument text:\n" + text;
        return switch (type) {
            case SUMMARY -> ai.json("summary", SYSTEM, """
                    Summarise the document. JSON shape:
                    {"overview": "one paragraph, 4-6 sentences", "keyPoints": ["6-10 key points"], "keywords": ["8-12 key terms"]}

                    """ + source, Summary.class,
                    s -> notBlank(s.overview()) && filled(s.keyPoints()),
                    () -> summaryFallback(text));
            case MIND_MAP -> ai.json("mind-map", SYSTEM, """
                    Build a mind map of the document: a root topic, 4-7 main branches, each with 2-5 sub-branches. \
                    Labels are short phrases (at most 8 words). JSON shape:
                    {"root": {"label": "topic", "children": [{"label": "branch", "children": [{"label": "sub-branch", "children": []}]}]}}

                    """ + source, MindMap.class,
                    m -> m.root() != null && notBlank(m.root().label()) && filled(m.root().children()),
                    () -> mindMapFallback(title, text));
            case DEEP_ANALYSIS -> ai.json("deep-analysis", SYSTEM, """
                    Analyse the document in depth. JSON shape:
                    {"themes": [{"title": "theme", "explanation": "2-4 sentences"}],
                     "insights": ["non-obvious takeaways"],
                     "gaps": ["limitations, open issues or missing evidence in the document"],
                     "questions": ["questions for further study"]}
                    Give 3-6 themes and 3-6 items in each list.

                    """ + source, DeepAnalysis.class,
                    d -> filled(d.themes()) && filled(d.insights()),
                    () -> deepFallback(text));
            case EXAM_PREP -> ai.json("exam-prep", SYSTEM, """
                    Prepare exam revision material from the document. JSON shape:
                    {"flashcards": [{"front": "term or question", "back": "answer"}],
                     "questions": [{"question": "exam-style question", "answer": "model answer", "difficulty": "easy|medium|hard"}],
                     "studyTips": ["how to revise this material"]}
                    Give 8-12 flashcards, 5-8 questions and 3-5 study tips.

                    """ + source, ExamPrep.class,
                    e -> filled(e.flashcards()) && filled(e.questions()),
                    () -> examFallback(text));
        };
    }

    static Summary summaryFallback(String text) {
        List<String> points = TextTools.topSentences(text, 8);
        String overview = String.join(" ", points.subList(0, Math.min(3, points.size())));
        return new Summary(overview.isBlank() ? "The document is too short to summarise." : overview,
                points, TextTools.keywords(text, 10));
    }

    static MindMap mindMapFallback(String title, String text) {
        List<String> sentences = TextTools.sentences(text);
        List<MindNode> branches = new ArrayList<>();
        for (String keyword : TextTools.keywords(text, 6)) {
            List<MindNode> leaves = sentences.stream()
                    .filter(s -> s.toLowerCase(Locale.ROOT).contains(keyword.toLowerCase(Locale.ROOT)))
                    .limit(3)
                    .map(s -> new MindNode(shorten(s, 90), List.of()))
                    .toList();
            branches.add(new MindNode(keyword, leaves));
        }
        return new MindMap(new MindNode(title, branches));
    }

    static DeepAnalysis deepFallback(String text) {
        List<String> keywords = TextTools.keywords(text, 5);
        List<String> sentences = TextTools.sentences(text);
        List<Theme> themes = keywords.stream()
                .map(k -> new Theme(k, sentenceAbout(sentences, k)))
                .toList();
        List<String> questions = new ArrayList<>();
        for (int i = 0; i + 1 < keywords.size(); i++) {
            questions.add("How does " + keywords.get(i).toLowerCase(Locale.ROOT) + " relate to "
                    + keywords.get(i + 1).toLowerCase(Locale.ROOT) + " in this document?");
        }
        return new DeepAnalysis(themes, TextTools.topSentences(text, 5),
                List.of("This analysis was produced without an AI model, so it lists the most prominent themes "
                        + "but cannot judge the strength of the document's arguments."),
                questions);
    }

    static ExamPrep examFallback(String text) {
        List<String> sentences = TextTools.sentences(text);
        List<String> keywords = TextTools.keywords(text, 10);
        List<Flashcard> cards = keywords.stream()
                .map(k -> new Flashcard(k, sentenceAbout(sentences, k)))
                .toList();
        List<ExamQuestion> questions = keywords.stream().limit(6)
                .map(k -> new ExamQuestion("Explain the role of " + k.toLowerCase(Locale.ROOT) + " as described in the document.",
                        sentenceAbout(sentences, k), "medium"))
                .toList();
        return new ExamPrep(cards, questions, List.of(
                "Cover the back of each flashcard and recall it before checking.",
                "Answer each question in writing, then compare with the model answer.",
                "Revisit the cards you missed after one day and again after one week."));
    }

    private static String sentenceAbout(List<String> sentences, String keyword) {
        String needle = keyword.toLowerCase(Locale.ROOT);
        return sentences.stream().filter(s -> s.toLowerCase(Locale.ROOT).contains(needle)).findFirst()
                .orElse("See the document for the discussion of " + needle + ".");
    }

    private static String shorten(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1).strip() + "…";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static boolean filled(List<?> list) {
        return list != null && !list.isEmpty();
    }
}
