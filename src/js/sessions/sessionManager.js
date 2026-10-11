// sessionManager.js - Manages session lifecycle, counters, and finalization
import { CONFIG } from '../config.js';
import { resetEventManager, getSessionEvents, getEventMetrics, logSafetyEvent } from '../safety/eventManager.js';
import { saveSessionToStorage } from './sessionStorage.js';

let currentSession = null;
let sessionStartTime = 0;
let isSessionActive = false;

// Statistics aggregated during the session
let sessionStats = {
    fatigueEventsCount: 0,
    longBlinkCount: 0,
    sustainedClosureCount: 0,
    headNoddingCount: 0,
    trackingLossCount: 0,
    warningEscalationsCount: 0,
    motionWarningCount: 0,
    totalBlinks: 0,
    averageBlinkDurationMs: 0,
    maxSeverityReached: 'normal'
};

export function isMonitoringSessionActive() {
    return isSessionActive;
}

export function getCurrentSession() {
    return currentSession;
}

export function getSessionStats() {
    return { ...sessionStats };
}

/**
 * Starts a new monitoring session
 */
export function startNewSession() {
    const now = Date.now();
    sessionStartTime = now;
    isSessionActive = true;

    const sessionId = `SES-${now}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    sessionStats = {
        fatigueEventsCount: 0,
        longBlinkCount: 0,
        sustainedClosureCount: 0,
        headNoddingCount: 0,
        trackingLossCount: 0,
        warningEscalationsCount: 0,
        motionWarningCount: 0,
        totalBlinks: 0,
        averageBlinkDurationMs: 0,
        maxSeverityReached: 'normal'
    };

    resetEventManager();

    currentSession = {
        id: sessionId,
        startTime: now,
        endTime: null,
        durationMs: 0,
        status: 'in_progress',
        configSnapshot: JSON.parse(JSON.stringify(CONFIG))
    };

    logSafetyEvent({
        category: 'system',
        severity: 'info',
        title: 'Session Started',
        explanation: `Driver safety monitoring started (Session ${sessionId})`
    });

    return currentSession;
}

/**
 * Increments specific session stat counters
 */
export function recordSessionStat(type) {
    if (!isSessionActive) return;

    if (type === 'fatigue') sessionStats.fatigueEventsCount++;
    if (type === 'long_blink') sessionStats.longBlinkCount++;
    if (type === 'sustained_closure') sessionStats.sustainedClosureCount++;
    if (type === 'head_nod') sessionStats.headNoddingCount++;
    if (type === 'tracking_loss') sessionStats.trackingLossCount++;
    if (type === 'escalation') sessionStats.warningEscalationsCount++;
    if (type === 'motion') sessionStats.motionWarningCount++;
}

export function updateMaxSeverity(severity) {
    if (!isSessionActive) return;
    const severityRank = { normal: 0, caution: 1, high: 2, persistent: 3 };
    if ((severityRank[severity] || 0) > (severityRank[sessionStats.maxSeverityReached] || 0)) {
        sessionStats.maxSeverityReached = severity;
    }
}

export function updateBlinkStats({ totalBlinks = 0, averageBlinkDurationMs = 0 } = {}) {
    if (!isSessionActive) return;
    sessionStats.totalBlinks = totalBlinks;
    sessionStats.averageBlinkDurationMs = averageBlinkDurationMs;
}

/**
 * Finalizes and persists active monitoring session
 */
export async function finalizeCurrentSession() {
    if (!isSessionActive || !currentSession) return null;

    const now = Date.now();
    const duration = now - sessionStartTime;

    logSafetyEvent({
        category: 'system',
        severity: 'info',
        title: 'Session Completed',
        explanation: `Monitoring stopped after ${(duration / 1000).toFixed(1)}s`
    });

    const finalizedSession = {
        ...currentSession,
        endTime: now,
        durationMs: duration,
        status: 'completed',
        stats: { ...sessionStats },
        events: getSessionEvents(),
        eventMetrics: getEventMetrics()
    };

    isSessionActive = false;
    currentSession = null;

    // Save to local IndexedDB
    try {
        await saveSessionToStorage(finalizedSession);
    } catch (err) {
        console.error('Failed to save session to storage:', err);
    }

    return finalizedSession;
}

/**
 * Resets active session counters without saving
 */
export function resetCurrentSession() {
    sessionStartTime = Date.now();
    sessionStats = {
        fatigueEventsCount: 0,
        longBlinkCount: 0,
        sustainedClosureCount: 0,
        headNoddingCount: 0,
        trackingLossCount: 0,
        warningEscalationsCount: 0,
        motionWarningCount: 0,
        maxSeverityReached: 'normal'
    };
    resetEventManager();
}
