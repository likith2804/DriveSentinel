// eventManager.js - Event bus, deduplication, and timeline logger for safety sessions

let sessionEvents = [];
const activeEvents = new Map(); // category -> event object
let eventCounter = 0;

export function resetEventManager() {
    sessionEvents = [];
    activeEvents.clear();
    eventCounter = 0;
}

/**
 * Dispatches and logs a safety event, deduplicating ongoing states
 * 
 * @param {object} eventParams
 * @param {string} eventParams.category - 'drowsiness' | 'blink' | 'head_pose' | 'motion' | 'tracking' | 'system'
 * @param {string} eventParams.severity - 'info' | 'caution' | 'high' | 'persistent'
 * @param {string} eventParams.title - Short summary
 * @param {string} eventParams.explanation - Detailed explanation
 * @param {boolean} [eventParams.isOngoing=false] - Whether this condition is persistent
 * @param {number} [eventParams.durationMs=0] - Active duration
 */
export function logSafetyEvent({
    category,
    severity,
    title,
    explanation,
    isOngoing = false,
    durationMs = 0
}) {
    const now = Date.now();
    const existing = activeEvents.get(category);

    if (existing && isOngoing) {
        // Update existing active event's duration
        existing.durationMs = durationMs;
        existing.severity = severity;
        existing.explanation = explanation;
        existing.lastUpdated = now;
        return existing;
    }

    if (existing && !isOngoing) {
        // Mark existing ongoing condition as cleared
        existing.status = 'cleared';
        existing.durationMs = durationMs || (now - existing.timestamp);
        activeEvents.delete(category);
    }

    // Create new event
    eventCounter++;
    const newEvent = {
        id: `EVT-${Date.now()}-${eventCounter}`,
        timestamp: now,
        category,
        severity,
        title,
        explanation,
        durationMs: Math.round(durationMs),
        status: isOngoing ? 'active' : 'cleared'
    };

    sessionEvents.push(newEvent);

    if (isOngoing) {
        activeEvents.set(category, newEvent);
    }

    return newEvent;
}

/**
 * Clears an active ongoing category event when condition subsides
 */
export function clearOngoingEvent(category, finalDuration = 0) {
    const existing = activeEvents.get(category);
    if (existing) {
        existing.status = 'cleared';
        if (finalDuration > 0) {
            existing.durationMs = Math.round(finalDuration);
        }
        activeEvents.delete(category);
    }
}

/**
 * Returns all logged events for current session
 */
export function getSessionEvents(filters = {}) {
    let result = [...sessionEvents];
    if (filters.category && filters.category !== 'all') {
        result = result.filter(e => e.category === filters.category);
    }
    if (filters.severity && filters.severity !== 'all') {
        result = result.filter(e => e.severity === filters.severity);
    }
    return result;
}

/**
 * Returns event counts aggregated by category and severity
 */
export function getEventMetrics() {
    const counts = {
        total: sessionEvents.length,
        byCategory: {
            drowsiness: 0,
            blink: 0,
            head_pose: 0,
            motion: 0,
            tracking: 0,
            system: 0
        },
        bySeverity: {
            info: 0,
            caution: 0,
            high: 0,
            persistent: 0
        }
    };

    sessionEvents.forEach(evt => {
        if (counts.byCategory[evt.category] !== undefined) {
            counts.byCategory[evt.category]++;
        }
        if (counts.bySeverity[evt.severity] !== undefined) {
            counts.bySeverity[evt.severity]++;
        }
    });

    return counts;
}
