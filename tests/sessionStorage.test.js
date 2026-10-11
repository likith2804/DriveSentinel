import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveSessionToStorage, getAllSessionsFromStorage, getSessionByIdFromStorage, deleteSessionFromStorage, clearAllSessionsFromStorage } from '../src/js/sessions/sessionStorage.js';

describe('Session Storage Persistence & Fallback CRUD', () => {
    beforeEach(async () => {
        // Clear storage before each test
        await clearAllSessionsFromStorage();
    });

    it('saves and retrieves sessions accurately', async () => {
        const sampleSession = {
            id: 'SES-TEST-STORAGE-1',
            startTime: 1700000000000,
            endTime: 1700000060000,
            durationMs: 60000,
            status: 'completed',
            stats: { sustainedClosureCount: 2, maxSeverityReached: 'high' },
            events: [
                { id: 'EVT-1', category: 'drowsiness', severity: 'high', durationMs: 3200 }
            ]
        };

        const saveSuccess = await saveSessionToStorage(sampleSession);
        expect(saveSuccess).toBe(true);

        const allSessions = await getAllSessionsFromStorage();
        expect(allSessions.length).toBeGreaterThanOrEqual(1);
        expect(allSessions.some(s => s.id === 'SES-TEST-STORAGE-1')).toBe(true);

        const retrieved = await getSessionByIdFromStorage('SES-TEST-STORAGE-1');
        expect(retrieved).not.toBeNull();
        expect(retrieved.id).toBe('SES-TEST-STORAGE-1');
        expect(retrieved.durationMs).toBe(60000);
        expect(retrieved.stats.sustainedClosureCount).toBe(2);
    });

    it('deletes an individual session by ID', async () => {
        const s1 = { id: 'SES-DELETE-ME', startTime: 1700000000000, durationMs: 5000 };
        const s2 = { id: 'SES-KEEP-ME', startTime: 1700000010000, durationMs: 10000 };

        await saveSessionToStorage(s1);
        await saveSessionToStorage(s2);

        await deleteSessionFromStorage('SES-DELETE-ME');

        const remaining = await getAllSessionsFromStorage();
        expect(remaining.some(s => s.id === 'SES-DELETE-ME')).toBe(false);
        expect(remaining.some(s => s.id === 'SES-KEEP-ME')).toBe(true);
    });

    it('clears all saved sessions', async () => {
        await saveSessionToStorage({ id: 'SES-ALL-1', startTime: 1000 });
        await saveSessionToStorage({ id: 'SES-ALL-2', startTime: 2000 });

        await clearAllSessionsFromStorage();

        const remaining = await getAllSessionsFromStorage();
        expect(remaining.length).toBe(0);
    });
});
