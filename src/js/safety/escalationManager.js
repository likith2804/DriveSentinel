// src/js/safety/escalationManager.js - Escalation engine for 30s persistent high-risk email alerts
import { CONFIG } from '../config.js';
import { WarningLevel } from './riskAssessment.js';
import { sendAlertEmail } from '../services/emailService.js';
import { logSafetyEvent } from './eventManager.js';

let highRiskStartTimestamp = null;
let isEscalatedForEpisode = false;
let lastEmailSentTimestamp = 0;
let activeIncidentId = null;
let lastDispatchResult = null;
const listeners = [];

export function subscribeEscalationChanges(callback) {
    listeners.push(callback);
}

function notifyListeners(state) {
    listeners.forEach(fn => fn(state));
}

/**
 * Resets escalation state
 */
export function resetEscalationManager() {
    highRiskStartTimestamp = null;
    isEscalatedForEpisode = false;
    lastEmailSentTimestamp = 0;
    activeIncidentId = null;
    lastDispatchResult = null;
    notifyListeners(getEscalationState());
}

/**
 * Evaluates whether current driver telemetry qualifies for the 30-second escalation threshold
 * 
 * Rules:
 * 1. Missing facial data is NOT treated as eye closure (tracking loss must not trigger escalation).
 * 2. High-risk condition must persist continuously for the configured threshold (default: 30 seconds).
 * 3. Escalates only once per continuous high-risk episode (event deduplication).
 * 4. Respects configurable email cooldown (default: 60 seconds).
 * 5. Runs email dispatch asynchronously without blocking local audio/visual alarms.
 */
export function processEscalation({
    eyeData,
    headData,
    assessment,
    currentTime = performance.now()
}) {
    // 1. Missing Face / Tracking Check
    // Critical: Do NOT interpret missing facial data as confirmed eye closure!
    if (!eyeData?.faceDetected || !headData?.faceDetected) {
        if (highRiskStartTimestamp !== null) {
            highRiskStartTimestamp = null;
            isEscalatedForEpisode = false;
            activeIncidentId = null;
        }
        const state = getEscalationState(currentTime);
        notifyListeners(state);
        return state;
    }

    // 2. High-Risk Evaluation
    // A high-risk condition is active if assessment level is HIGH_CONCERN or PERSISTENT_CONCERN
    // with confirmed continuous eye closure or sustained dangerous fatigue.
    const isHighRisk = (
        assessment?.level >= WarningLevel.HIGH_CONCERN &&
        (eyeData.areBothEyesClosed || assessment.level === WarningLevel.PERSISTENT_CONCERN)
    );

    const thresholdMs = ((CONFIG.EMAIL?.ESCALATION_THRESHOLD_SEC !== undefined)
        ? CONFIG.EMAIL.ESCALATION_THRESHOLD_SEC
        : 30) * 1000;

    const cooldownMs = (CONFIG.EMAIL?.COOLDOWN_MS !== undefined)
        ? CONFIG.EMAIL.COOLDOWN_MS
        : 60000;

    if (isHighRisk) {
        if (highRiskStartTimestamp === null) {
            highRiskStartTimestamp = currentTime;
            activeIncidentId = `INC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            isEscalatedForEpisode = false;
        }

        const elapsedDurationMs = currentTime - highRiskStartTimestamp;

        // Check if 30-second threshold is met
        if (elapsedDurationMs >= thresholdMs) {
            const timeSinceLastEmail = currentTime - lastEmailSentTimestamp;
            const cooldownMet = (lastEmailSentTimestamp === 0) || (timeSinceLastEmail >= cooldownMs);

            if (!isEscalatedForEpisode && cooldownMet) {
                if (CONFIG.EMAIL?.ENABLED !== false) {
                    isEscalatedForEpisode = true;
                    lastEmailSentTimestamp = currentTime;

                    const incidentId = activeIncidentId;
                    const recipientEmail = (CONFIG.EMAIL?.RECIPIENT_EMAIL || '').trim();

                    // Log immediate attempt in session history
                    logSafetyEvent({
                        category: 'system',
                        severity: 'persistent',
                        title: 'Email Escalation Dispatched',
                        explanation: `Persistent high risk (${(elapsedDurationMs / 1000).toFixed(1)}s >= ${thresholdMs / 1000}s threshold). Contacting: ${recipientEmail || 'Default recipient'}`,
                        isOngoing: false,
                        durationMs: elapsedDurationMs
                    });

                    // Asynchronous dispatch (local alarms continue uninterrupted)
                    sendAlertEmail({
                        incidentId,
                        timestamp: Date.now(),
                        durationMs: elapsedDurationMs,
                        indicators: assessment?.contributingFactors || ['Persistent Continuous Eye Closure (>= 30s)'],
                        warningLevel: assessment?.levelName || 'HIGH CONCERN',
                        recommendation: assessment?.recommendation || 'Contact driver safely via hands-free communication or advise pulling over.',
                        recipientEmail
                    }).then(res => {
                        lastDispatchResult = {
                            incidentId,
                            timestamp: Date.now(),
                            success: res.success,
                            status: res.status,
                            note: res.note || '',
                            error: res.error || null,
                            recipient: res.recipient || recipientEmail
                        };

                        if (res.success) {
                            const statusLabel = res.mock ? 'Mock Email Mode Accepted' : 'Accepted by Gmail SMTP (Queued for Delivery)';
                            logSafetyEvent({
                                category: 'system',
                                severity: 'info',
                                title: 'Email Relay Accepted',
                                explanation: `Incident #${incidentId}: ${statusLabel} for ${res.recipient}`
                            });
                        } else {
                            logSafetyEvent({
                                category: 'system',
                                severity: 'caution',
                                title: 'Email Dispatch Warning',
                                explanation: `Incident #${incidentId} delivery error: ${res.error || 'Server error'}. Local alarms remain active.`
                            });
                        }
                        notifyListeners(getEscalationState(currentTime));
                    }).catch(err => {
                        lastDispatchResult = {
                            incidentId,
                            timestamp: Date.now(),
                            success: false,
                            error: err.message,
                            recipient: recipientEmail
                        };
                        logSafetyEvent({
                            category: 'system',
                            severity: 'caution',
                            title: 'Email Dispatch Failed',
                            explanation: `Incident #${incidentId} failed: ${err.message}. Local monitoring continues.`
                        });
                        notifyListeners(getEscalationState(currentTime));
                    });
                }
            }
        }
    } else {
        // High risk condition cleared (e.g. eyes reopened, driver alert)
        highRiskStartTimestamp = null;
        isEscalatedForEpisode = false;
        activeIncidentId = null;
    }

    const state = getEscalationState(currentTime);
    notifyListeners(state);
    return state;
}

/**
 * Returns active escalation status and metrics
 */
export function getEscalationState(currentTime = performance.now()) {
    const thresholdMs = ((CONFIG.EMAIL?.ESCALATION_THRESHOLD_SEC !== undefined)
        ? CONFIG.EMAIL.ESCALATION_THRESHOLD_SEC
        : 30) * 1000;

    const cooldownMs = (CONFIG.EMAIL?.COOLDOWN_MS !== undefined)
        ? CONFIG.EMAIL.COOLDOWN_MS
        : 60000;

    const highRiskDurationMs = highRiskStartTimestamp !== null
        ? Math.max(0, currentTime - highRiskStartTimestamp)
        : 0;

    const timeSinceLastEmail = currentTime - lastEmailSentTimestamp;
    const remainingCooldownMs = lastEmailSentTimestamp > 0
        ? Math.max(0, cooldownMs - timeSinceLastEmail)
        : 0;

    return {
        isHighRiskActive: highRiskStartTimestamp !== null,
        highRiskDurationMs,
        thresholdMs,
        isThresholdReached: highRiskDurationMs >= thresholdMs,
        isEscalatedForEpisode,
        lastEmailSentTimestamp,
        lastDispatchResult,
        activeIncidentId,
        remainingCooldownMs,
        isEmailEnabled: CONFIG.EMAIL?.ENABLED !== false
    };
}
