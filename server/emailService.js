// server/emailService.js - Email transport, formatting, deduplication, and verification
import nodemailer from 'nodemailer';
import { loadBackendConfig, validateEmailAddress } from './config.js';

// In-memory cache for deduplication and rate limiting
const sentIncidentsCache = new Map(); // incidentId -> { timestamp, recipient }
let lastAlertSentTime = 0;
const MIN_COOLDOWN_MS = 20000; // Minimum 20s server-side cooldown between alert emails

let transporterInstance = null;

/**
 * Returns or creates the Nodemailer transporter
 */
export function getTransporter() {
    const config = loadBackendConfig();
    if (config.mockEmail || !config.isConfigured) {
        return null;
    }

    if (!transporterInstance) {
        transporterInstance = nodemailer.createTransport({
            host: config.smtpHost,
            port: config.smtpPort,
            secure: config.smtpSecure, // true for 465, false for 587
            auth: {
                user: config.smtpUser,
                pass: config.smtpPass
            },
            tls: {
                rejectUnauthorized: true
            }
        });
    }
    return transporterInstance;
}

/**
 * Resets transporter instance (useful when config changes or in tests)
 */
export function resetTransporter() {
    transporterInstance = null;
}

/**
 * Resets all in-memory email caches and cooldown states (for test isolation)
 */
export function resetEmailServiceState() {
    sentIncidentsCache.clear();
    lastAlertSentTime = 0;
    transporterInstance = null;
}

/**
 * Verifies SMTP connection readiness
 */
export async function verifySmtpConnection() {
    const config = loadBackendConfig();
    if (config.mockEmail) {
        return {
            ready: true,
            mock: true,
            message: 'Mock Email Mode is active. Emails are simulated locally without Gmail credentials.'
        };
    }

    if (!config.isConfigured) {
        return {
            ready: false,
            mock: false,
            message: 'Gmail SMTP credentials are not configured in .env. Please supply SMTP_USER and SMTP_PASS (App Password).'
        };
    }

    try {
        const transporter = getTransporter();
        await transporter.verify();
        return {
            ready: true,
            mock: false,
            message: `Successfully connected and authenticated with ${config.smtpHost}:${config.smtpPort}`
        };
    } catch (err) {
        return {
            ready: false,
            mock: false,
            error: err.message,
            code: err.code,
            message: `SMTP connection verification failed: ${err.message}`
        };
    }
}

/**
 * Sends a test email to verify configuration
 */
export async function sendTestEmail(recipientEmail) {
    const config = loadBackendConfig();
    const targetRecipient = (recipientEmail || config.defaultRecipient || '').trim();

    if (!validateEmailAddress(targetRecipient)) {
        throw new Error(`Invalid recipient email address: "${targetRecipient}"`);
    }

    const testTime = new Date().toLocaleString();
    const subject = `[Smart Vehicle Safety] Test Notification (${testTime})`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background: #0284c7; color: white; padding: 15px; border-radius: 6px; text-align: center;">
                <h2 style="margin: 0;">Smart Vehicle Safety — Email Channel Verification</h2>
            </div>
            <div style="padding: 20px 0; color: #334155; line-height: 1.6;">
                <p>Hello,</p>
                <p>This is an automated test message sent from the <strong>Smart Vehicle Safety & Driver Monitoring System</strong>.</p>
                <div style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 15px 0;">
                    <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${testTime}</p>
                    <p style="margin: 4px 0;"><strong>Recipient:</strong> ${targetRecipient}</p>
                    <p style="margin: 4px 0;"><strong>SMTP Host:</strong> ${config.mockEmail ? 'Mock In-Memory Transport' : config.smtpHost}</p>
                    <p style="margin: 4px 0;"><strong>Delivery Mechanism:</strong> Direct Free Gmail SMTP</p>
                </div>
                <p>If you received this message, the email notification pipeline is operational and authorized to receive high-risk fatigue escalation alerts.</p>
                <p style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px;">
                    <em>Note: Delivery receipt verifies acceptance by the destination mail server queue.</em>
                </p>
            </div>
        </div>
    `;

    if (!config.isConfigured && !config.mockEmail) {
        return {
            success: false,
            status: 'unconfigured',
            error: 'Gmail SMTP credentials are not configured in .env. Add SMTP_USER and SMTP_PASS or enable MOCK_EMAIL=true.',
            recipient: targetRecipient
        };
    }

    if (config.mockEmail) {
        return {
            success: true,
            status: 'accepted_mock',
            mock: true,
            messageId: `<mock-test-${Date.now()}@smart-vehicle-safety>`,
            recipient: targetRecipient,
            note: 'Mock Mode: Email acceptance simulated successfully. No actual transmission was made.'
        };
    }

    const transporter = getTransporter();
    const info = await transporter.sendMail({
        from: `"Smart Vehicle Safety System" <${config.smtpUser}>`,
        to: targetRecipient,
        subject,
        html,
        text: `Smart Vehicle Safety test email sent at ${testTime} to ${targetRecipient}. SMTP channel is operational.`
    });

    return {
        success: true,
        status: 'accepted_by_smtp',
        mock: false,
        messageId: info.messageId,
        smtpResponse: info.response,
        recipient: targetRecipient,
        note: 'Accepted by Gmail SMTP server for delivery queue.'
    };
}

/**
 * Sends a high-risk escalation email alert with deduplication and cooldown checks
 */
export async function sendEscalationAlert({
    incidentId,
    timestamp,
    durationMs,
    indicators = [],
    warningLevel = 'HIGH CONCERN',
    recommendation = 'Attempt to contact driver immediately.',
    recipientEmail
}) {
    const config = loadBackendConfig();
    const targetRecipient = (recipientEmail || config.defaultRecipient || '').trim();

    if (!validateEmailAddress(targetRecipient)) {
        throw new Error(`Invalid authorized recipient email address: "${targetRecipient}"`);
    }

    if (!incidentId) {
        incidentId = `INC-${Date.now()}`;
    }

    const now = Date.now();

    // 1. Deduplication check: Do not re-send the exact same incident within 10 minutes
    if (sentIncidentsCache.has(incidentId)) {
        const cached = sentIncidentsCache.get(incidentId);
        if (now - cached.timestamp < 600000) {
            return {
                success: true,
                status: 'deduplicated',
                incidentId,
                recipient: targetRecipient,
                note: `Duplicate incident alert "${incidentId}" suppressed within active deduplication window.`
            };
        }
    }

    // 2. Cooldown check: Server-side minimum spacing between alert emails
    if (now - lastAlertSentTime < MIN_COOLDOWN_MS) {
        const remainingSec = Math.ceil((MIN_COOLDOWN_MS - (now - lastAlertSentTime)) / 1000);
        return {
            success: false,
            status: 'cooldown_active',
            incidentId,
            recipient: targetRecipient,
            remainingSec,
            note: `Email suppressed by server-side rate limit. Cooldown active for ${remainingSec}s.`
        };
    }

    const eventDate = new Date(timestamp || now);
    const durationFormatted = durationMs ? `${(durationMs / 1000).toFixed(1)} seconds` : 'Sustained (>= 30s threshold)';

    const indicatorsListHtml = indicators.length > 0
        ? indicators.map(ind => `<li style="margin: 4px 0; color: #b91c1c;"><strong>${escapeHtml(ind)}</strong></li>`).join('')
        : '<li style="margin: 4px 0; color: #b91c1c;">Persistent Continuous Eye Closure (>= 30.0s)</li>';

    const subject = `⚠️ [SAFETY ALERT] Driver Drowsiness Escalation - Incident #${incidentId}`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 2px solid #ef4444; border-radius: 8px;">
            <div style="background: #dc2626; color: white; padding: 18px; border-radius: 6px; text-align: center;">
                <h2 style="margin: 0; font-size: 22px;">CRITICAL DRIVER SAFETY ALERT</h2>
                <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Sustained High-Risk Fatigue Condition Escalation</p>
            </div>

            <div style="padding: 20px 0; color: #1e293b; line-height: 1.6;">
                <p style="font-size: 15px;">
                    This automated alert is sent to you as the designated emergency contact for this vehicle.
                    A high-risk drowsiness condition persisted beyond the configured <strong>30-second escalation threshold</strong>.
                </p>

                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: bold; width: 35%;">Incident ID:</td>
                            <td style="padding: 6px 0; font-family: monospace; font-weight: bold; color: #0f172a;">${escapeHtml(incidentId)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Timestamp:</td>
                            <td style="padding: 6px 0; color: #0f172a;">${eventDate.toLocaleString()} (${eventDate.toISOString()})</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Warning Level:</td>
                            <td style="padding: 6px 0; color: #b91c1c; font-weight: bold;">${escapeHtml(warningLevel)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Condition Duration:</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${escapeHtml(durationFormatted)}</td>
                        </tr>
                    </table>
                </div>

                <h3 style="color: #991b1b; margin-top: 18px; margin-bottom: 8px;">Observed Fatigue Indicators:</h3>
                <ul style="background: #fff1f2; padding: 12px 28px; border-radius: 6px; margin: 0 0 18px;">
                    ${indicatorsListHtml}
                </ul>

                <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 20px 0;">
                    <h3 style="color: #b45309; margin: 0 0 8px; font-size: 16px;">RECOMMENDED ACTION:</h3>
                    <p style="margin: 0; color: #78350f; font-weight: 500;">
                        ${escapeHtml(recommendation)}
                    </p>
                    <p style="margin: 8px 0 0; color: #92400e; font-size: 13px;">
                        <strong>Safe Communication Notice:</strong> If contacting the driver via mobile phone, utilize hands-free in-vehicle audio or advise the driver to pull over at the nearest safe rest area. Avoid creating abrupt panic while the vehicle is in motion.
                    </p>
                </div>

                <div style="font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 24px;">
                    <p style="margin: 0 0 4px;">
                        <strong>System Notice:</strong> Generated by the Smart Vehicle Safety & Driver Monitoring System edge prototype. This notification confirms transmission to the SMTP mail relay.
                    </p>
                    <p style="margin: 0;">
                        Delivery status: <em>Accepted by SMTP Server (Queued for Delivery)</em>.
                    </p>
                </div>
            </div>
        </div>
    `;

    // Record cache and last alert timestamp
    sentIncidentsCache.set(incidentId, { timestamp: now, recipient: targetRecipient });
    lastAlertSentTime = now;

    if (!config.isConfigured && !config.mockEmail) {
        return {
            success: false,
            status: 'unconfigured',
            error: 'Gmail SMTP credentials are not configured in .env. Configure SMTP_USER and SMTP_PASS or enable MOCK_EMAIL=true.',
            incidentId,
            recipient: targetRecipient,
            note: 'Local AI alarms remain active. Email dispatch suppressed.'
        };
    }

    if (config.mockEmail) {
        return {
            success: true,
            status: 'accepted_mock',
            mock: true,
            incidentId,
            messageId: `<mock-alert-${incidentId}@smart-vehicle-safety>`,
            recipient: targetRecipient,
            timestamp: now,
            note: 'Mock Mode Active: Alert acceptance simulated. No real email transmitted.'
        };
    }

    const transporter = getTransporter();
    const info = await transporter.sendMail({
        from: `"Smart Vehicle Safety System" <${config.smtpUser}>`,
        to: targetRecipient,
        subject,
        html,
        text: `CRITICAL SAFETY ALERT\nIncident: ${incidentId}\nTime: ${eventDate.toISOString()}\nLevel: ${warningLevel}\nDuration: ${durationFormatted}\nRecommendation: ${recommendation}`
    });

    return {
        success: true,
        status: 'accepted_by_smtp',
        mock: false,
        incidentId,
        messageId: info.messageId,
        smtpResponse: info.response,
        recipient: targetRecipient,
        timestamp: now,
        note: 'Accepted by Gmail SMTP server for delivery queue.'
    };
}

/**
 * Sends a session summary email with CSV attachment
 */
export async function sendSessionSummaryEmail({
    sessionId,
    startTime,
    endTime,
    durationMs,
    stats = {},
    events = [],
    recipientEmail
}) {
    const config = loadBackendConfig();
    const targetRecipient = (recipientEmail || config.defaultRecipient || '').trim();

    if (!validateEmailAddress(targetRecipient)) {
        throw new Error(`Invalid recipient email address: "${targetRecipient}"`);
    }

    if (!sessionId) {
        sessionId = `SES-${Date.now()}`;
    }

    // Build CSV attachment
    const csvHeaders = ['Event ID', 'Timestamp (ISO)', 'Category', 'Severity', 'Duration (ms)', 'Title', 'Explanation', 'Status'];
    const csvRows = (events || []).map(e => [
        `"${(e.id || '').replace(/"/g, '""')}"`,
        `"${new Date(e.timestamp || Date.now()).toISOString()}"`,
        `"${(e.category || '').replace(/"/g, '""')}"`,
        `"${(e.severity || '').replace(/"/g, '""')}"`,
        e.durationMs || 0,
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${(e.explanation || '').replace(/"/g, '""')}"`,
        `"${(e.status || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\r\n');

    const durationSec = durationMs ? Math.round(durationMs / 1000) : 0;
    const durationFormatted = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;

    const subject = `[Smart Vehicle Safety] Monitoring Session Summary - #${sessionId}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px;">
            <div style="background: #0284c7; color: white; padding: 18px; border-radius: 6px; text-align: center;">
                <h2 style="margin: 0; font-size: 20px;">Driver Monitoring Session Summary</h2>
                <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Session ID: ${escapeHtml(sessionId)}</p>
            </div>

            <div style="padding: 20px 0; color: #1e293b; line-height: 1.6;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
                    <p style="margin: 4px 0;"><strong>Start Time:</strong> ${new Date(startTime || Date.now()).toLocaleString()}</p>
                    <p style="margin: 4px 0;"><strong>End Time:</strong> ${new Date(endTime || Date.now()).toLocaleString()}</p>
                    <p style="margin: 4px 0;"><strong>Total Duration:</strong> ${durationFormatted}</p>
                    <p style="margin: 4px 0;"><strong>Maximum Warning Reached:</strong> <span style="font-weight: bold; text-transform: uppercase;">${escapeHtml(stats.maxSeverityReached || 'normal')}</span></p>
                </div>

                <h3 style="color: #0f172a; margin-bottom: 10px;">Aggregated Safety Metrics:</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                    <tr style="background: #f1f5f9;">
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Metric</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Count / Value</th>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 8px;">Sustained Eye Closures</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${stats.sustainedClosureCount || 0}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 8px;">Long Blinks (>400ms)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${stats.longBlinkCount || 0}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 8px;">Head Nod Events</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${stats.headNoddingCount || 0}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 8px;">Tracking Interruptions</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${stats.trackingLossCount || 0}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 8px;">Total Blinks Observed</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">${stats.totalBlinks || 0}</td>
                    </tr>
                </table>

                <p style="font-size: 13px; color: #475569;">
                    The complete incident event audit log has been attached as a CSV spreadsheet (<code>driver_safety_events_${sessionId}.csv</code>).
                </p>

                <div style="font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px;">
                    <em>Smart Vehicle Safety Assistance System — Research Prototype</em>
                </div>
            </div>
        </div>
    `;

    const attachmentFilename = `driver_safety_events_${sessionId}.csv`;

    if (!config.isConfigured && !config.mockEmail) {
        return {
            success: false,
            status: 'unconfigured',
            error: 'Gmail SMTP credentials are not configured in .env. Configure SMTP_USER and SMTP_PASS or enable MOCK_EMAIL=true.',
            sessionId,
            recipient: targetRecipient
        };
    }

    if (config.mockEmail) {
        return {
            success: true,
            status: 'accepted_mock',
            mock: true,
            sessionId,
            messageId: `<mock-summary-${sessionId}@smart-vehicle-safety>`,
            recipient: targetRecipient,
            note: 'Mock Mode Active: Session summary acceptance simulated with CSV attachment.'
        };
    }

    const transporter = getTransporter();
    const info = await transporter.sendMail({
        from: `"Smart Vehicle Safety System" <${config.smtpUser}>`,
        to: targetRecipient,
        subject,
        html,
        text: `Session Summary: ${sessionId}\nDuration: ${durationFormatted}\nSustained Closures: ${stats.sustainedClosureCount || 0}\nLong Blinks: ${stats.longBlinkCount || 0}`,
        attachments: [
            {
                filename: attachmentFilename,
                content: csvContent,
                contentType: 'text/csv'
            }
        ]
    });

    return {
        success: true,
        status: 'accepted_by_smtp',
        mock: false,
        sessionId,
        messageId: info.messageId,
        smtpResponse: info.response,
        recipient: targetRecipient,
        note: 'Accepted by Gmail SMTP server for delivery queue with CSV attachment.'
    };
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
