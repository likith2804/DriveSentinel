import { describe, it, expect } from 'vitest';
import { startNewSession, finalizeCurrentSession, isMonitoringSessionActive, recordSessionStat, updateMaxSeverity, updateBlinkStats, getSessionStats } from '../src/js/sessions/sessionManager.js';

describe('Session Lifecycle & Telemetry Management', () => {
    it('manages session initialization, stat tracking, and finalization', async () => {
        expect(isMonitoringSessionActive()).toBe(false);

        // Start session
        const session = startNewSession();
        expect(isMonitoringSessionActive()).toBe(true);
        expect(session.id).toMatch(/^SES-\d+-[A-Z0-9]+$/);
        expect(session.status).toBe('in_progress');

        // Record telemetry events
        recordSessionStat('fatigue');
        recordSessionStat('long_blink');
        recordSessionStat('head_nod');
        updateMaxSeverity('high');
        updateBlinkStats({ totalBlinks: 42, averageBlinkDurationMs: 230 });

        const stats = getSessionStats();
        expect(stats.fatigueEventsCount).toBe(1);
        expect(stats.longBlinkCount).toBe(1);
        expect(stats.headNoddingCount).toBe(1);
        expect(stats.totalBlinks).toBe(42);
        expect(stats.averageBlinkDurationMs).toBe(230);
        expect(stats.maxSeverityReached).toBe('high');

        // Finalize session
        const finalized = await finalizeCurrentSession();
        expect(isMonitoringSessionActive()).toBe(false);
        expect(finalized.status).toBe('completed');
        expect(finalized.stats.maxSeverityReached).toBe('high');
        expect(finalized.events.length).toBeGreaterThan(0);
    });
});
