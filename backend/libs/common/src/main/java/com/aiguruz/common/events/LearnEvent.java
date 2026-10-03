package com.aiguruz.common.events;

import java.time.Instant;
import java.util.Map;

/** category AUDIT feeds the audit log; ACTIVITY feeds learning analytics. */
public record LearnEvent(
        String tenantId,
        String userId,
        String userName,
        String category,
        String type,
        String resourceType,
        String resourceId,
        Map<String, Object> metadata,
        Instant timestamp,
        String service) {

    public static final String AUDIT = "AUDIT";
    public static final String ACTIVITY = "ACTIVITY";
}
