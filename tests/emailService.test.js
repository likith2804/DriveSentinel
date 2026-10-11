import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    validateEmailAddress,
    loadBackendConfig,
    getSanitizedConfig
} from '../server/config.js';
import {
    sendTestEmail,
    sendEscalationAlert,
    sendSessionSummaryEmail,
    verifySmtpConnection,
    resetTransporter,
    resetEmailServiceState
} from '../server/emailService.js';

describe('Backend Email Service & Security Verification', () => {
    beforeEach(() => {
        resetEmailServiceState();
        process.env.MOCK_EMAIL = 'true';
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_PORT = '465';
        process.env.SMTP_USER = 'safety-system@gmail.com';
        process.env.SMTP_PASS = 'mock-16-char-pass';
        process.env.ALERT_RECIPIENT_EMAIL = 'authorized-driver-contact@example.com';
    });

    it('strictly validates email addresses against invalid inputs', () => {
        expect(validateEmailAddress('valid.driver@example.com')).toBe(true);
        expect(validateEmailAddress('user+alert@gmail.com')).toBe(true);
        expect(validateEmailAddress('')).toBe(false);
        expect(validateEmailAddress('notanemail')).toBe(false);
        expect(validateEmailAddress('missing@domain')).toBe(false);
        expect(validateEmailAddress('@nodomain.com')).toBe(false);
        expect(validateEmailAddress(null)).toBe(false);
        expect(validateEmailAddress(undefined)).toBe(false);
    });

    it('sanitizes config and NEVER exposes SMTP passwords or secrets to callers', () => {
        const sanitized = getSanitizedConfig();
        expect(sanitized).toBeDefined();
        expect(sanitized.smtpPass).toBeUndefined(); // MUST NEVER BE PRESENT
        expect(sanitized.password).toBeUndefined();
        expect(sanitized.pass).toBeUndefined();
        expect(sanitized.senderEmail).toContain('***'); // Masked email
        expect(sanitized.smtpHost).toBe('smtp.gmail.com');
        expect(sanitized.smtpPort).toBe(465);
    });

    it('rejects dispatch when authorized recipient email is invalid or missing', async () => {
        await expect(sendEscalationAlert({
            incidentId: 'INC-TEST-001',
            durationMs: 30000,
            indicators: ['Eyes closed for 30s'],
            recipientEmail: 'invalid-email-address'
        })).rejects.toThrow(/Invalid authorized recipient email address/);
    });

    it('generates complete escalation payload and simulates acceptance in mock mode', async () => {
        const result = await sendEscalationAlert({
            incidentId: 'INC-VERIFY-001',
            timestamp: Date.now(),
            durationMs: 32000,
            indicators: [
                'Sustained continuous eye closure (32.0s)',
                'Abnormal blink rate (4 blinks/min)'
            ],
            warningLevel: 'PERSISTENT CONCERN',
            recommendation: 'Contact driver via vehicle hands-free system immediately.',
            recipientEmail: 'emergency-contact@example.com'
        });

        expect(result.success).toBe(true);
        expect(result.mock).toBe(true);
        expect(result.incidentId).toBe('INC-VERIFY-001');
        expect(result.status).toBe('accepted_mock');
        expect(result.messageId).toMatch(/<mock-alert-INC-VERIFY-001@smart-vehicle-safety>/);
        expect(result.recipient).toBe('emergency-contact@example.com');
    });

    it('server-side deduplication suppresses duplicate alert for same incident ID within 10 minutes', async () => {
        const payload = {
            incidentId: 'INC-DEDUP-999',
            durationMs: 30000,
            indicators: ['Eyes closed continuously'],
            recipientEmail: 'emergency@example.com'
        };

        // First dispatch succeeds
        const first = await sendEscalationAlert(payload);
        expect(first.success).toBe(true);

        // Immediate second dispatch with identical incidentId must be deduplicated
        const second = await sendEscalationAlert(payload);
        expect(second.success).toBe(true);
        expect(second.status).toBe('deduplicated');
        expect(second.note).toContain('suppressed');
    });

    it('generates session summary report email with CSV payload in mock mode', async () => {
        const mockEvents = [
            { id: 'EVT-1', timestamp: Date.now(), category: 'drowsiness', severity: 'high', durationMs: 3000, title: 'Eye Closure', explanation: 'Closed for 3s', status: 'cleared' },
            { id: 'EVT-2', timestamp: Date.now(), category: 'head_pose', severity: 'high', durationMs: 1500, title: 'Head Nod', explanation: 'Nod observed', status: 'cleared' }
        ];

        const result = await sendSessionSummaryEmail({
            sessionId: 'SES-TEST-SUMMARY-001',
            startTime: Date.now() - 60000,
            endTime: Date.now(),
            durationMs: 60000,
            stats: {
                sustainedClosureCount: 1,
                headNoddingCount: 1,
                totalBlinks: 25,
                longBlinkCount: 2,
                maxSeverityReached: 'high'
            },
            events: mockEvents,
            recipientEmail: 'supervisor@example.com'
        });

        expect(result.success).toBe(true);
        expect(result.mock).toBe(true);
        expect(result.sessionId).toBe('SES-TEST-SUMMARY-001');
        expect(result.note).toContain('CSV attachment');
    });

    it('provides truthful delivery status: distinguishes SMTP acceptance from mailbox arrival', async () => {
        const testResult = await sendTestEmail('test-driver@example.com');
        expect(testResult.success).toBe(true);
        // Does not falsely claim 'inbox_delivered'
        expect(testResult.status).not.toBe('inbox_delivered');
        expect(testResult.note).toBeDefined();
    });

    it('handles missing credentials cleanly without crashing or pretending real email was sent', async () => {
        process.env.MOCK_EMAIL = 'false';
        process.env.SMTP_USER = '';
        process.env.SMTP_PASS = '';

        const verify = await verifySmtpConnection();
        expect(verify.ready).toBe(false);
        expect(verify.message).toContain('not configured');
    });

    it('handles SMTP provider failures gracefully and reports error details', async () => {
        process.env.MOCK_EMAIL = 'false';
        process.env.SMTP_USER = 'driver@gmail.com';
        process.env.SMTP_PASS = 'live-app-password';

        const nodemailer = await import('nodemailer');
        vi.spyOn(nodemailer.default, 'createTransport').mockReturnValue({
            verify: vi.fn().mockRejectedValue(new Error('Invalid login: 535-5.7.8 Bad credentials')),
            sendMail: vi.fn().mockRejectedValue(new Error('SMTP Provider connection timeout'))
        });

        const verify = await verifySmtpConnection();
        expect(verify.ready).toBe(false);
        expect(verify.error).toContain('Bad credentials');

        await expect(sendEscalationAlert({
            incidentId: 'INC-ERR-001',
            durationMs: 30000,
            recipientEmail: 'contact@example.com'
        })).rejects.toThrow(/SMTP Provider connection timeout/);
    });
});
