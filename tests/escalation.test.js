import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processEscalation, resetEscalationManager, getEscalationState } from '../src/js/safety/escalationManager.js';
import { WarningLevel } from '../src/js/safety/riskAssessment.js';
import { CONFIG } from '../src/js/config.js';
import * as emailService from '../src/js/services/emailService.js';

describe('Emergency Email Escalation Manager', () => {
    let sendAlertEmailSpy;

    beforeEach(() => {
        resetEscalationManager();
        CONFIG.EMAIL.ENABLED = true;
        CONFIG.EMAIL.ESCALATION_THRESHOLD_SEC = 30; // 30-second requirement
        CONFIG.EMAIL.COOLDOWN_MS = 60000;          // 60-second cooldown
        CONFIG.EMAIL.RECIPIENT_EMAIL = 'authorized-contact@example.com';

        sendAlertEmailSpy = vi.spyOn(emailService, 'sendAlertEmail').mockResolvedValue({
            success: true,
            status: 'accepted_by_smtp',
            messageId: '<test-message-id@smtp.gmail.com>',
            recipient: 'authorized-contact@example.com'
        });
    });

    it('does NOT interpret missing facial data as confirmed eye closure or escalate', () => {
        const missingFaceEyeData = {
            faceDetected: false,
            areBothEyesClosed: false,
            closureDurationMs: 0
        };
        const missingFaceHeadData = {
            faceDetected: false
        };
        const normalAssessment = {
            level: WarningLevel.NORMAL,
            levelName: 'Monitoring Unavailable',
            contributingFactors: ['Driver face outside camera view']
        };

        // Advance simulated time past 35 seconds
        processEscalation({
            eyeData: missingFaceEyeData,
            headData: missingFaceHeadData,
            assessment: normalAssessment,
            currentTime: 0
        });

        const stateAfter35s = processEscalation({
            eyeData: missingFaceEyeData,
            headData: missingFaceHeadData,
            assessment: normalAssessment,
            currentTime: 35000
        });

        expect(stateAfter35s.isHighRiskActive).toBe(false);
        expect(stateAfter35s.highRiskDurationMs).toBe(0);
        expect(sendAlertEmailSpy).not.toHaveBeenCalled();
    });

    it('requires continuous high-risk persistence to reach the 30-second escalation threshold', () => {
        const eyeData = {
            faceDetected: true,
            areBothEyesClosed: true,
            closureDurationMs: 3000
        };
        const headData = { faceDetected: true };
        const highAssessment = {
            level: WarningLevel.HIGH_CONCERN,
            levelName: 'High Concern',
            contributingFactors: ['Sustained continuous eye closure (3.0s)'],
            recommendation: 'Prepare to stop and rest.'
        };

        // At 0 seconds: High risk begins
        const t0 = processEscalation({ eyeData, headData, assessment: highAssessment, currentTime: 10000 });
        expect(t0.isHighRiskActive).toBe(true);
        expect(sendAlertEmailSpy).not.toHaveBeenCalled();

        // At 20 seconds: Threshold not reached (threshold is 30s)
        const t20 = processEscalation({ eyeData, headData, assessment: highAssessment, currentTime: 30000 });
        expect(t20.highRiskDurationMs).toBe(20000);
        expect(t20.isThresholdReached).toBe(false);
        expect(sendAlertEmailSpy).not.toHaveBeenCalled();

        // At 30 seconds: Threshold reached -> Triggers escalation email
        const t30 = processEscalation({ eyeData, headData, assessment: highAssessment, currentTime: 40000 });
        expect(t30.isThresholdReached).toBe(true);
        expect(t30.isEscalatedForEpisode).toBe(true);
        expect(sendAlertEmailSpy).toHaveBeenCalledTimes(1);

        const emailArgs = sendAlertEmailSpy.mock.calls[0][0];
        expect(emailArgs.recipientEmail).toBe('authorized-contact@example.com');
        expect(emailArgs.warningLevel).toBe('High Concern');
        expect(emailArgs.durationMs).toBe(30000);
        expect(emailArgs.incidentId).toMatch(/^INC-/);
    });

    it('deduplicates events: fires exactly once per continuous high-risk episode', () => {
        const eyeData = { faceDetected: true, areBothEyesClosed: true, closureDurationMs: 4000 };
        const headData = { faceDetected: true };
        const persistentAssessment = {
            level: WarningLevel.PERSISTENT_CONCERN,
            levelName: 'Persistent Concern',
            contributingFactors: ['Critical continuous eye closure (5.0s)'],
            recommendation: 'Pull over safely immediately.'
        };

        // Start at t = 0
        processEscalation({ eyeData, headData, assessment: persistentAssessment, currentTime: 0 });
        // At 30s -> fires 1st time
        processEscalation({ eyeData, headData, assessment: persistentAssessment, currentTime: 30000 });
        expect(sendAlertEmailSpy).toHaveBeenCalledTimes(1);

        // At 35s, 40s, 50s continuing the same episode -> must NOT send duplicate emails
        processEscalation({ eyeData, headData, assessment: persistentAssessment, currentTime: 35000 });
        processEscalation({ eyeData, headData, assessment: persistentAssessment, currentTime: 40000 });
        processEscalation({ eyeData, headData, assessment: persistentAssessment, currentTime: 50000 });
        expect(sendAlertEmailSpy).toHaveBeenCalledTimes(1);
    });

    it('resets high-risk escalation counter if driver recovers before threshold', () => {
        const closedEyeData = { faceDetected: true, areBothEyesClosed: true, closureDurationMs: 3000 };
        const openEyeData = { faceDetected: true, areBothEyesClosed: false, closureDurationMs: 0 };
        const headData = { faceDetected: true };
        const highAssessment = { level: WarningLevel.HIGH_CONCERN, levelName: 'High Concern', contributingFactors: [] };
        const normalAssessment = { level: WarningLevel.NORMAL, levelName: 'Normal', contributingFactors: [] };

        // Starts high risk at t = 0
        processEscalation({ eyeData: closedEyeData, headData, assessment: highAssessment, currentTime: 0 });
        // After 25 seconds (less than 30s threshold)
        processEscalation({ eyeData: closedEyeData, headData, assessment: highAssessment, currentTime: 25000 });
        expect(sendAlertEmailSpy).not.toHaveBeenCalled();

        // Driver opens eyes and returns to normal at 26s
        const recoveryState = processEscalation({ eyeData: openEyeData, headData, assessment: normalAssessment, currentTime: 26000 });
        expect(recoveryState.isHighRiskActive).toBe(false);
        expect(recoveryState.highRiskDurationMs).toBe(0);

        // Driver closes eyes again at 27s - timer must start afresh from 0!
        const restartState = processEscalation({ eyeData: closedEyeData, headData, assessment: highAssessment, currentTime: 27000 });
        expect(restartState.highRiskDurationMs).toBe(0);
        expect(sendAlertEmailSpy).not.toHaveBeenCalled();
    });

    it('enforces email cooldown to prevent alert flooding across new episodes', () => {
        const closedEyeData = { faceDetected: true, areBothEyesClosed: true, closureDurationMs: 3000 };
        const openEyeData = { faceDetected: true, areBothEyesClosed: false, closureDurationMs: 0 };
        const headData = { faceDetected: true };
        const highAssessment = { level: WarningLevel.HIGH_CONCERN, levelName: 'High Concern', contributingFactors: [] };
        const normalAssessment = { level: WarningLevel.NORMAL, levelName: 'Normal', contributingFactors: [] };

        // Episode 1: Reaches 30s at t = 30,000 -> sends 1st email
        processEscalation({ eyeData: closedEyeData, headData, assessment: highAssessment, currentTime: 0 });
        processEscalation({ eyeData: closedEyeData, headData, assessment: highAssessment, currentTime: 30000 });
        expect(sendAlertEmailSpy).toHaveBeenCalledTimes(1);

        // Episode 1 ends at t = 35,000
        processEscalation({ eyeData: openEyeData, headData, assessment: normalAssessment, currentTime: 35000 });

        // Episode 2 starts at t = 40,000 and reaches 30s duration at t = 70,000
        // But time since last email is 70,000 - 30,000 = 40,000ms < 60,000ms cooldown!
        processEscalation({ eyeData: closedEyeData, headData, assessment: highAssessment, currentTime: 40000 });
        processEscalation({ eyeData: closedEyeData, headData, assessment: highAssessment, currentTime: 70000 });

        // Second email is suppressed because cooldown has not elapsed
        expect(sendAlertEmailSpy).toHaveBeenCalledTimes(1);

        // At t = 95,000 (65s > 60s cooldown): if condition persists and another episode occurs, cooldown is met
        processEscalation({ eyeData: openEyeData, headData, assessment: normalAssessment, currentTime: 71000 });
        processEscalation({ eyeData: closedEyeData, headData, assessment: highAssessment, currentTime: 72000 });
        processEscalation({ eyeData: closedEyeData, headData, assessment: highAssessment, currentTime: 102000 });
        expect(sendAlertEmailSpy).toHaveBeenCalledTimes(2);
    });

    it('respects master email toggle when disabled', () => {
        CONFIG.EMAIL.ENABLED = false;

        const eyeData = { faceDetected: true, areBothEyesClosed: true, closureDurationMs: 3000 };
        const headData = { faceDetected: true };
        const highAssessment = { level: WarningLevel.HIGH_CONCERN, levelName: 'High Concern', contributingFactors: [] };

        processEscalation({ eyeData, headData, assessment: highAssessment, currentTime: 0 });
        processEscalation({ eyeData, headData, assessment: highAssessment, currentTime: 35000 });

        expect(sendAlertEmailSpy).not.toHaveBeenCalled();
    });
});
