package ai.guruz.learnmind.learning;

import ai.guruz.learnmind.learning.Model.ConceptScore;
import ai.guruz.learnmind.learning.Model.ConceptState;
import ai.guruz.learnmind.learning.Model.Decision;
import java.util.Comparator;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Knowledge Evaluator and Learning Path Optimizer.
 *
 * <ul>
 *   <li>score below the remedial threshold: REMEDIAL (re-teach the weak concepts before moving on)</li>
 *   <li>score below the advance threshold, or a strong score with one concept clearly missed: LATERAL
 *       (an applied practice module on the gaps; the path continues)</li>
 *   <li>otherwise: ADVANCE</li>
 * </ul>
 */
@Component
public class PathOptimizer {

    /** A concept scored below this in the quiz is treated as a gap. */
    static final double WEAK_CONCEPT = 0.6;
    /** Weight of the newest quiz in the mastery average. */
    static final double RECENCY = 0.6;

    private final double advanceThreshold;
    private final double remedialThreshold;

    public PathOptimizer(@Value("${learnmind.learning.advance-threshold}") double advanceThreshold,
                         @Value("${learnmind.learning.remedial-threshold}") double remedialThreshold) {
        this.advanceThreshold = advanceThreshold;
        this.remedialThreshold = remedialThreshold;
    }

    public Decision decide(double score, List<ConceptScore> conceptScores) {
        if (score < remedialThreshold) {
            return Decision.REMEDIAL;
        }
        boolean missedConcept = conceptScores.stream().anyMatch(c -> c.score() < remedialThreshold);
        if (score < advanceThreshold || missedConcept) {
            return Decision.LATERAL;
        }
        return Decision.ADVANCE;
    }

    /** Weakest first. */
    public List<String> weakConcepts(List<ConceptScore> conceptScores) {
        return conceptScores.stream()
                .filter(c -> c.score() < WEAK_CONCEPT)
                .sorted(Comparator.comparingDouble(ConceptScore::score))
                .map(ConceptScore::concept)
                .toList();
    }

    public void updateMastery(ConceptState state, double quizScore) {
        state.mastery = state.attempts == 0 ? quizScore : RECENCY * quizScore + (1 - RECENCY) * state.mastery;
        state.mastery = Math.round(state.mastery * 100) / 100.0;
        state.attempts++;
    }
}
