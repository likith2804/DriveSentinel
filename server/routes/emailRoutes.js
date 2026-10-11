// server/routes/emailRoutes.js - Express API endpoints for email notifications
import express from 'express';
import { getSanitizedConfig } from '../config.js';
import {
    verifySmtpConnection,
    sendTestEmail,
    sendEscalationAlert,
    sendSessionSummaryEmail
} from '../emailService.js';

const router = express.Router();

/**
 * GET /api/email/status
 * Returns email configuration state and connectivity without exposing secrets
 */
router.get('/status', async (req, res) => {
    try {
        const sanitizedConfig = getSanitizedConfig();
        const verification = await verifySmtpConnection();

        return res.json({
            success: true,
            config: sanitizedConfig,
            verification,
            serverTimestamp: Date.now()
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/**
 * POST /api/email/test
 * Sends a test verification email
 */
router.post('/test', async (req, res) => {
    try {
        const { recipientEmail } = req.body || {};
        const result = await sendTestEmail(recipientEmail);
        return res.json(result);
    } catch (err) {
        console.error('Test email dispatch failed:', err.message);
        return res.status(400).json({
            success: false,
            error: err.message,
            code: err.code || 'SEND_ERROR'
        });
    }
});

/**
 * POST /api/email/alert
 * Escalation email triggered when sustained high risk exceeds 30s threshold
 */
router.post('/alert', async (req, res) => {
    try {
        const {
            incidentId,
            timestamp,
            durationMs,
            indicators,
            warningLevel,
            recommendation,
            recipientEmail
        } = req.body || {};

        const result = await sendEscalationAlert({
            incidentId,
            timestamp,
            durationMs,
            indicators,
            warningLevel,
            recommendation,
            recipientEmail
        });

        // If suppressed by cooldown, return 429 or 200 with clear status
        if (!result.success && result.status === 'cooldown_active') {
            return res.status(429).json(result);
        }

        return res.json(result);
    } catch (err) {
        console.error('Escalation alert dispatch failed:', err.message);
        return res.status(400).json({
            success: false,
            error: err.message,
            code: err.code || 'ALERT_SEND_ERROR'
        });
    }
});

/**
 * POST /api/email/summary
 * Optional session summary email dispatched when monitoring ends
 */
router.post('/summary', async (req, res) => {
    try {
        const {
            sessionId,
            startTime,
            endTime,
            durationMs,
            stats,
            events,
            recipientEmail
        } = req.body || {};

        const result = await sendSessionSummaryEmail({
            sessionId,
            startTime,
            endTime,
            durationMs,
            stats,
            events,
            recipientEmail
        });

        return res.json(result);
    } catch (err) {
        console.error('Session summary email dispatch failed:', err.message);
        return res.status(400).json({
            success: false,
            error: err.message,
            code: err.code || 'SUMMARY_SEND_ERROR'
        });
    }
});

export default router;
