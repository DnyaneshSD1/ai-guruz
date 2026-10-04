package com.aiguruz.analytics;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.aiguruz.analytics.AnalyticsController.ScoreBand;
import java.util.List;
import org.junit.jupiter.api.Test;

class AnalyticsControllerTest {

    @Test
    void scoresFallIntoFiveBandsWithBoundariesGoingUp() {
        List<ScoreBand> bands = AnalyticsController.scoreBands(List.of(0.0, 0.19, 0.2, 0.55, 0.8, 0.99, 1.0));

        assertEquals(List.of("0-20%", "20-40%", "40-60%", "60-80%", "80-100%"), bands.stream().map(ScoreBand::label).toList());
        // 0.2 opens the second band; a perfect 1.0 stays in the top band.
        assertEquals(List.of(2L, 1L, 1L, 0L, 3L), bands.stream().map(ScoreBand::count).toList());
    }

    @Test
    void noScoresGivesFiveEmptyBands() {
        List<ScoreBand> bands = AnalyticsController.scoreBands(List.of());
        assertEquals(5, bands.size());
        assertEquals(0, bands.stream().mapToLong(ScoreBand::count).sum());
    }
}
