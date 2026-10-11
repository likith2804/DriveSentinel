import { describe, it, expect, beforeEach } from 'vitest';
import { logSafetyEvent, clearOngoingEvent, getSessionEvents, getEventMetrics, resetEventManager } from '../src/js/safety/eventManager.js';

describe('Safety Event Manager & Deduplication', () => {
    beforeEach(() => {
        resetEventManager();
    });

    it('logs discrete events and avoids duplicate records for ongoing states', () => {
        // Event 1: Start prolonged closure
        const e1 = logSafetyEvent({
            category: 'drowsiness',
            severity: 'caution',
            title: 'Prolonged Closure',
            explanation: 'Eyes closed 1.6s',
            isOngoing: true,
            durationMs: 1600
        });

        expect(getSessionEvents().length).toBe(1);
        expect(e1.status).toBe('active');

        // Subsequent update for ongoing condition (does not duplicate event item)
        const e2 = logSafetyEvent({
            category: 'drowsiness',
            severity: 'high',
            title: 'Prolonged Closure',
            explanation: 'Eyes closed 3.1s',
            isOngoing: true,
            durationMs: 3100
        });

        expect(getSessionEvents().length).toBe(1);
        expect(e2.durationMs).toBe(3100);
        expect(e2.severity).toBe('high');

        // Condition clears
        clearOngoingEvent('drowsiness', 3500);
        const events = getSessionEvents();
        expect(events.length).toBe(1);
        expect(events[0].status).toBe('cleared');
        expect(events[0].durationMs).toBe(3500);
    });

    it('calculates metrics aggregated by category and severity', () => {
        logSafetyEvent({ category: 'blink', severity: 'caution', title: 'Long blink' });
        logSafetyEvent({ category: 'head_pose', severity: 'high', title: 'Nod event' });
        logSafetyEvent({ category: 'motion', severity: 'caution', title: 'Camera motion' });

        const metrics = getEventMetrics();
        expect(metrics.total).toBe(3);
        expect(metrics.byCategory.blink).toBe(1);
        expect(metrics.byCategory.head_pose).toBe(1);
        expect(metrics.byCategory.motion).toBe(1);
        expect(metrics.bySeverity.caution).toBe(2);
        expect(metrics.bySeverity.high).toBe(1);
    });
});
