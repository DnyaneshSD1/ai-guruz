package ai.guruz.learnmind.learning;

import static org.junit.jupiter.api.Assertions.assertEquals;

import ai.guruz.learnmind.learning.Model.ConceptScore;
import ai.guruz.learnmind.learning.Model.ConceptState;
import ai.guruz.learnmind.learning.Model.Decision;
import java.util.List;
import org.junit.jupiter.api.Test;

class PathOptimizerTest {

    private final PathOptimizer optimizer = new PathOptimizer(0.8, 0.5);

    @Test
    void lowScoreIsRemedial() {
        assertEquals(Decision.REMEDIAL, optimizer.decide(0.3, List.of(new ConceptScore("a", 0.3))));
    }

    @Test
    void middlingScoreIsLateral() {
        assertEquals(Decision.LATERAL, optimizer.decide(0.65, List.of(new ConceptScore("a", 0.7), new ConceptScore("b", 0.6))));
    }

    @Test
    void strongScoreAdvances() {
        assertEquals(Decision.ADVANCE, optimizer.decide(0.9, List.of(new ConceptScore("a", 1.0), new ConceptScore("b", 0.8))));
    }

    @Test
    void strongScoreWithOneMissedConceptIsLateral() {
        assertEquals(Decision.LATERAL, optimizer.decide(0.85, List.of(new ConceptScore("a", 1.0), new ConceptScore("b", 0.2))));
    }

    @Test
    void thresholdsAreInclusiveAtTheUpperBand() {
        assertEquals(Decision.LATERAL, optimizer.decide(0.5, List.of()));
        assertEquals(Decision.ADVANCE, optimizer.decide(0.8, List.of()));
    }

    @Test
    void weakConceptsAreListedWeakestFirst() {
        assertEquals(List.of("c", "a"), optimizer.weakConcepts(List.of(
                new ConceptScore("a", 0.5), new ConceptScore("b", 0.9), new ConceptScore("c", 0.1))));
    }

    @Test
    void masteryFavoursTheNewestQuiz() {
        ConceptState state = new ConceptState();
        optimizer.updateMastery(state, 0.0);
        assertEquals(0.0, state.mastery);
        optimizer.updateMastery(state, 1.0);
        assertEquals(0.6, state.mastery);
        assertEquals(2, state.attempts);
    }
}
