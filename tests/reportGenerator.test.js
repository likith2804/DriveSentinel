import { describe, it, expect, vi } from 'vitest';
import { exportSessionEventsToCSV, openPrintableSessionReport } from '../src/js/sessions/reportGenerator.js';

describe('Report Generation & CSV Exporter', () => {
    it('properly formats CSV rows with escaped special characters', () => {
        const mockSession = {
            id: 'SES-TEST-123',
            startTime: Date.now() - 60000,
            endTime: Date.now(),
            durationMs: 60000,
            events: [
                {
                    id: 'EVT-1',
                    timestamp: Date.now() - 30000,
                    category: 'drowsiness',
                    severity: 'high',
                    durationMs: 3200,
                    title: 'Severe Closure',
                    explanation: 'Eyes closed "unexpectedly" for 3.2s, driver alerted.',
                    status: 'cleared'
                }
            ]
        };

        // Mock document and URL methods in Node environment
        let createdBlob = null;
        const mockLink = {
            setAttribute: vi.fn(),
            click: vi.fn()
        };

        global.document = {
            createElement: vi.fn(() => mockLink),
            body: {
                appendChild: vi.fn(),
                removeChild: vi.fn()
            }
        };

        const originalBlob = global.Blob;
        global.Blob = class MockBlob {
            constructor(parts, options) {
                createdBlob = parts.join('');
            }
        };

        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();

        exportSessionEventsToCSV(mockSession);

        expect(createdBlob).toContain('Event ID,Timestamp (ISO),Time,Category,Severity,Duration (ms),Title,Explanation,Status');
        expect(createdBlob).toContain('"EVT-1"');
        expect(createdBlob).toContain('"drowsiness"');
        expect(createdBlob).toContain('"high"');
        // Quoted quotes properly escaped as ""
        expect(createdBlob).toContain('Eyes closed ""unexpectedly"" for 3.2s, driver alerted.');

        global.Blob = originalBlob;
        delete global.document;
    });
});
