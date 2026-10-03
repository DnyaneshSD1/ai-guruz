package ai.guruz.learnmind.assessment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ai.guruz.learnmind.assessment.AssessmentAgent.GeneratedMcq;
import ai.guruz.learnmind.assessment.AssessmentAgent.GeneratedQuiz;
import ai.guruz.learnmind.assessment.Model.Question;
import java.util.List;
import org.junit.jupiter.api.Test;

class AssessmentAgentTest {

    private static GeneratedMcq mcq(Object correct) {
        return new GeneratedMcq("Q?", List.of("alpha", "beta", "gamma", "delta"), correct, "c", "because");
    }

    @Test
    void correctIndexAcceptsNumberLetterAndOptionText() {
        assertEquals(2, AssessmentAgent.correctIndex(mcq(2)));
        assertEquals(1, AssessmentAgent.correctIndex(mcq("1")));
        assertEquals(1, AssessmentAgent.correctIndex(mcq("B")));
        assertEquals(3, AssessmentAgent.correctIndex(mcq("Delta")));
    }

    @Test
    void correctIndexRejectsOutOfRangeAndMissing() {
        assertNull(AssessmentAgent.correctIndex(mcq(4)));
        assertNull(AssessmentAgent.correctIndex(mcq(null)));
        assertNull(AssessmentAgent.correctIndex(mcq("no such option")));
    }

    @Test
    void fallbackQuizHasOneAnswerableQuestionPerConcept() {
        String lesson = "## Overview\n\nChlorophyll absorbs light most strongly in the blue and red parts of the spectrum. "
                + "The Calvin cycle uses ATP and NADPH to fix carbon dioxide into glucose inside the stroma.";
        GeneratedQuiz quiz = AssessmentAgent.fallbackQuiz("Basics", List.of("Explain photosynthesis"),
                List.of("Chlorophyll", "Calvin cycle"), lesson, List.of("RuBisCO", "Stroma", "Thylakoid"));

        assertEquals(2, quiz.questions().size());
        for (GeneratedMcq q : quiz.questions()) {
            Integer index = AssessmentAgent.correctIndex(q);
            assertEquals(q.concept(), q.options().get(index));
            assertTrue(q.options().size() >= 3);
        }
        assertTrue(quiz.questions().get(0).prompt().contains("_____"), "the concept is blanked out of its sentence");
    }

    @Test
    void keywordGradeRewardsCoverageOfTheGuide() {
        Question q = new Question();
        q.answerGuide = "chlorophyll absorbs light; glucose is produced from carbon dioxide";
        q.concept = "Photosynthesis";
        double good = AssessmentAgent.keywordGrade(q, "Chlorophyll absorbs light and the plant makes glucose from carbon dioxide during photosynthesis").score();
        double poor = AssessmentAgent.keywordGrade(q, "I am not sure what happens here at all").score();
        assertTrue(good > 0.7, "good=" + good);
        assertEquals(0.0, poor);
    }
}
