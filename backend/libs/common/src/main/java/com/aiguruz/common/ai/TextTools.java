package com.aiguruz.common.ai;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Plain-text heuristics behind the offline fallbacks (no model required). */
public final class TextTools {

    private static final Pattern SENTENCE_END = Pattern.compile("(?<=[.!?])\\s+(?=[A-Z0-9\"'(])");
    private static final Pattern WORD = Pattern.compile("[^\\p{L}\\p{Nd}]+");
    private static final Set<String> STOPWORDS = Set.of(
            "the", "and", "for", "that", "with", "this", "from", "are", "was", "were", "has", "have", "had", "not",
            "but", "they", "their", "them", "its", "into", "than", "then", "also", "can", "could", "may", "might",
            "will", "would", "should", "been", "being", "which", "when", "where", "what", "who", "whom", "how", "why",
            "these", "those", "such", "some", "any", "all", "each", "more", "most", "other", "over", "under", "about",
            "between", "through", "during", "after", "before", "there", "here", "our", "your", "you", "his", "her",
            "she", "him", "one", "two", "use", "used", "using", "very", "often", "many", "much", "only", "both",
            "does", "did", "while", "because", "however", "thus", "per", "via", "etc", "within", "without", "page");

    private TextTools() {}

    public static List<String> sentences(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) {
            return out;
        }
        for (String s : SENTENCE_END.split(text.replaceAll("\\s+", " ").strip())) {
            String trimmed = s.strip();
            if (trimmed.length() >= 30 && trimmed.length() <= 400) {
                out.add(trimmed);
            }
        }
        return out;
    }

    public static List<String> keywords(String text, int limit) {
        Map<String, Integer> counts = frequencies(text);
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry::getKey))
                .limit(limit)
                .map(e -> titleCase(e.getKey()))
                .toList();
    }

    /** Extractive summary: the highest-scoring sentences, returned in their original order. */
    public static List<String> topSentences(String text, int limit) {
        List<String> all = sentences(text);
        Map<String, Integer> counts = frequencies(text);
        record Scored(int index, String sentence, double score) {}
        List<Scored> scored = new ArrayList<>();
        for (int i = 0; i < all.size(); i++) {
            String[] words = WORD.split(all.get(i).toLowerCase(Locale.ROOT));
            double sum = 0;
            for (String w : words) {
                sum += counts.getOrDefault(w, 0);
            }
            scored.add(new Scored(i, all.get(i), sum / Math.max(8, words.length)));
        }
        return scored.stream()
                .sorted(Comparator.comparingDouble(Scored::score).reversed())
                .limit(limit)
                .sorted(Comparator.comparingInt(Scored::index))
                .map(Scored::sentence)
                .toList();
    }

    public static String titleCase(String s) {
        if (s == null || s.isBlank()) {
            return "";
        }
        String t = s.strip();
        return t.substring(0, 1).toUpperCase(Locale.ROOT) + t.substring(1);
    }

    private static Map<String, Integer> frequencies(String text) {
        Map<String, Integer> counts = new HashMap<>();
        if (text == null) {
            return counts;
        }
        for (String w : WORD.split(text.toLowerCase(Locale.ROOT))) {
            if (w.length() > 3 && !STOPWORDS.contains(w) && !w.chars().allMatch(Character::isDigit)) {
                counts.merge(w, 1, Integer::sum);
            }
        }
        return counts;
    }
}
