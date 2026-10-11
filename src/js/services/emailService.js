// src/js/services/emailService.js - Frontend client for Node.js Express Email Backend
import { CONFIG } from '../config.js';

let cachedStatus = {
    isAvailable: false,
    isConfigured: false,
    mockMode: false,
    defaultRecipient: '',
    message: 'Checking backend status...',
    lastChecked: 0
};

/**
 * Resolves the API endpoint URL
 */
function getApiUrl(path) {
    const base = (CONFIG.EMAIL && CONFIG.EMAIL.API_BASE_URL) || '/api';
    return `${base.replace(/\/$/, '')}${path}`;
}

/**
 * Checks connectivity and configuration of the Node.js email backend
 */
export async function checkEmailServiceStatus(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedStatus.lastChecked && (now - cachedStatus.lastChecked < 10000)) {
        return cachedStatus;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        let res;
        try {
            res = await fetch(getApiUrl('/email/status'), {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
        } catch (fetchErr) {
            // If relative /api proxy fails (e.g. Vite without proxy), try direct localhost:3001
            res = await fetch('http://localhost:3001/api/email/status', {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!res.ok) {
            throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        cachedStatus = {
            isAvailable: true,
            isConfigured: Boolean(data.config?.isConfigured),
            mockMode: Boolean(data.config?.mockEmail),
            defaultRecipient: data.config?.defaultRecipient || '',
            senderEmail: data.config?.senderEmail || '',
            smtpVerified: Boolean(data.verification?.ready),
            message: data.verification?.message || 'Email backend ready.',
            lastChecked: now
        };
    } catch (err) {
        cachedStatus = {
            isAvailable: false,
            isConfigured: false,
            mockMode: false,
            defaultRecipient: '',
            senderEmail: '',
            smtpVerified: false,
            message: 'Email backend offline. Local alarms and monitoring remain fully functional.',
            error: err.message,
            lastChecked: now
        };
    }

    return cachedStatus;
}

/**
 * Sends a test email to verify configuration
 */
export async function sendTestEmail(recipientEmail) {
    const targetRecipient = (recipientEmail || CONFIG.EMAIL.RECIPIENT_EMAIL || '').trim();

    try {
        const payload = { recipientEmail: targetRecipient };
        let res;
        try {
            res = await fetch(getApiUrl('/email/test'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            res = await fetch('http://localhost:3001/api/email/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const data = await res.json();
        if (!res.ok) {
            return {
                success: false,
                error: data.error || `HTTP ${res.status}`,
                code: data.code
            };
        }
        return data;
    } catch (err) {
        return {
            success: false,
            isBackendOffline: true,
            error: `Failed to contact email backend: ${err.message}`
        };
    }
}

/**
 * Sends an emergency escalation alert email
 */
export async function sendAlertEmail({
    incidentId,
    timestamp,
    durationMs,
    indicators = [],
    warningLevel = 'HIGH CONCERN',
    recommendation,
    recipientEmail
}) {
    const targetRecipient = (recipientEmail || CONFIG.EMAIL.RECIPIENT_EMAIL || '').trim();

    try {
        const payload = {
            incidentId,
            timestamp: timestamp || Date.now(),
            durationMs,
            indicators,
            warningLevel,
            recommendation,
            recipientEmail: targetRecipient
        };

        let res;
        try {
            res = await fetch(getApiUrl('/email/alert'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            res = await fetch('http://localhost:3001/api/email/alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const data = await res.json();
        if (!res.ok) {
            return {
                success: false,
                status: data.status || 'error',
                error: data.error || `HTTP ${res.status}`,
                remainingSec: data.remainingSec
            };
        }
        return data;
    } catch (err) {
        return {
            success: false,
            isBackendOffline: true,
            error: `Failed to connect to email backend: ${err.message}`
        };
    }
}

/**
 * Sends a session summary report email with CSV attachment
 */
export async function sendSessionSummaryEmail({
    sessionId,
    startTime,
    endTime,
    durationMs,
    stats,
    events,
    recipientEmail
}) {
    const targetRecipient = (recipientEmail || CONFIG.EMAIL.RECIPIENT_EMAIL || '').trim();

    try {
        const payload = {
            sessionId,
            startTime,
            endTime,
            durationMs,
            stats,
            events,
            recipientEmail: targetRecipient
        };

        let res;
        try {
            res = await fetch(getApiUrl('/email/summary'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            res = await fetch('http://localhost:3001/api/email/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const data = await res.json();
        if (!res.ok) {
            return {
                success: false,
                error: data.error || `HTTP ${res.status}`
            };
        }
        return data;
    } catch (err) {
        return {
            success: false,
            isBackendOffline: true,
            error: `Failed to connect to email backend: ${err.message}`
        };
    }
}
