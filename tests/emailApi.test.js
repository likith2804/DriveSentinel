import { describe, it, expect, beforeEach } from 'vitest';
import app from '../server/index.js';
import { resetEmailServiceState } from '../server/emailService.js';

// Helper to simulate request to Express app using native node http listener or fetch
describe('Email Backend Express API Endpoints', () => {
    let server;
    let baseUrl;

    beforeEach(async () => {
        resetEmailServiceState();
        process.env.MOCK_EMAIL = 'true';
        process.env.ALERT_RECIPIENT_EMAIL = 'test-contact@example.com';

        if (!server) {
            await new Promise(resolve => {
                server = app.listen(0, () => {
                    const port = server.address().port;
                    baseUrl = `http://127.0.0.1:${port}`;
                    resolve();
                });
            });
        }
    });

    it('GET /api/health returns healthy server status', async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('ok');
    });

    it('GET /api/email/status returns sanitized configuration without secrets', async () => {
        const res = await fetch(`${baseUrl}/api/email/status`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.config.mockEmail).toBe(true);
        expect(data.config.smtpPass).toBeUndefined(); // NEVER EXPOSED
        expect(data.verification.ready).toBe(true);
    });

    it('POST /api/email/test dispatches test verification in mock mode', async () => {
        const res = await fetch(`${baseUrl}/api/email/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientEmail: 'test-recipient@example.com' })
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.mock).toBe(true);
        expect(data.recipient).toBe('test-recipient@example.com');
    });

    it('POST /api/email/alert validates recipient and sends escalation payload', async () => {
        const res = await fetch(`${baseUrl}/api/email/alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                incidentId: 'INC-API-TEST',
                durationMs: 31000,
                indicators: ['Continuous eye closure 31s'],
                warningLevel: 'HIGH CONCERN',
                recommendation: 'Alert driver immediately.',
                recipientEmail: 'driver-guard@example.com'
            })
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.incidentId).toBe('INC-API-TEST');
        expect(data.status).toBe('accepted_mock');
    });

    it('POST /api/email/summary accepts session report and attaches CSV', async () => {
        const res = await fetch(`${baseUrl}/api/email/summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'SES-API-TEST',
                startTime: Date.now() - 30000,
                endTime: Date.now(),
                durationMs: 30000,
                stats: { sustainedClosureCount: 2, totalBlinks: 15 },
                events: [{ id: 'EVT-1', category: 'drowsiness', severity: 'high', title: 'Closure', durationMs: 3000 }],
                recipientEmail: 'safety-mgr@example.com'
            })
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.mock).toBe(true);
        expect(data.sessionId).toBe('SES-API-TEST');
    });

    it('POST /api/email/alert rejects malformed recipient emails with HTTP 400', async () => {
        const res = await fetch(`${baseUrl}/api/email/alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                incidentId: 'INC-BAD-EMAIL',
                recipientEmail: 'not-valid-email'
            })
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid authorized recipient email address');
    });
});
