// server/config.js - Backend environment configuration and validation
import dotenv from 'dotenv';
dotenv.config();

export function validateEmailAddress(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

export function loadBackendConfig() {
    const port = parseInt(process.env.PORT || '3001', 10);
    const mockEmail = process.env.MOCK_EMAIL === 'true' || process.env.MOCK_EMAIL === '1';
    const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
    const smtpSecure = process.env.SMTP_SECURE !== 'false';
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').trim();
    const defaultRecipient = (process.env.ALERT_RECIPIENT_EMAIL || '').trim();

    const isPlaceholderUser = !smtpUser || smtpUser.includes('your-email@') || smtpUser.includes('example.com') || smtpUser.includes('test-sender@');
    const isPlaceholderPass = !smtpPass || smtpPass === 'xxxx-xxxx-xxxx-xxxx' || smtpPass === 'mock-app-password';

    const isConfigured = Boolean(
        smtpHost &&
        smtpPort &&
        smtpUser &&
        smtpPass &&
        !isPlaceholderUser &&
        !isPlaceholderPass
    );

    return {
        port,
        mockEmail,
        isConfigured,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        defaultRecipient: validateEmailAddress(defaultRecipient) ? defaultRecipient : '',
        rawRecipient: defaultRecipient
    };
}

/**
 * Returns a sanitized config representation safe for client consumption (NEVER exposes secrets)
 */
export function getSanitizedConfig(config = loadBackendConfig()) {
    return {
        port: config.port,
        mockEmail: config.mockEmail,
        isConfigured: config.isConfigured,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        senderEmail: config.smtpUser ? config.smtpUser.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '',
        defaultRecipient: config.defaultRecipient,
        status: config.mockEmail
            ? 'mock_mode'
            : (config.isConfigured ? 'configured' : 'unconfigured')
    };
}
