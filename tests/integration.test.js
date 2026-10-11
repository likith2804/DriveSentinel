import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateEyeClosure, resetDrowsinessState } from '../src/js/vision/drowsiness.js';
import { processBlinkFrame, resetBlinkAnalysis } from '../src/js/vision/blinkAnalysis.js';
import { evaluateHeadPose, resetHeadPoseState } from '../src/js/vision/headPose.js';
import { assessDriverRisk, WarningLevel } from '../src/js/safety/riskAssessment.js';
import { processAlertState, resetAlertManager } from '../src/js/safety/alertManager.js';
import { logSafetyEvent, getSessionEvents, resetEventManager } from '../src/js/safety/eventManager.js';
import { startNewSession, finalizeCurrentSession } from '../src/js/sessions/sessionManager.js';

describe('End-to-End Safety Pipeline Integration', () => {
    beforeEach(() => {
        resetDrowsinessState();
        resetBlinkAnalysis();
        resetHeadPoseState();
        resetAlertManager();
        resetEventManager();
    });

    it('processes multi-indicator sequence from awake to severe micro-sleep alert', async () => {
        startNewSession();

        // 1. Initial State: Driver is awake and monitoring normally
        const normalLandmarks = new Array(468).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
        normalLandmarks[1] = { x: 0.5, y: 0.5, z: 0 };
        normalLandmarks[152] = { x: 0.5, y: 0.8, z: 0 };
        normalLandmarks[10] = { x: 0.5, y: 0.1, z: 0 };
        normalLandmarks[33] = { x: 0.4, y: 0.35, z: 0 };
        normalLandmarks[133] = { x: 0.45, y: 0.35, z: 0 };
        normalLandmarks[160] = { x: 0.425, y: 0.35 - 0.016, z: 0 };
        normalLandmarks[158] = { x: 0.435, y: 0.35 - 0.016, z: 0 };
        normalLandmarks[144] = { x: 0.425, y: 0.35 + 0.016, z: 0 };
        normalLandmarks[153] = { x: 0.435, y: 0.35 + 0.016, z: 0 };

        normalLandmarks[263] = { x: 0.55, y: 0.35, z: 0 };
        normalLandmarks[362] = { x: 0.60, y: 0.35, z: 0 };
        normalLandmarks[387] = { x: 0.575, y: 0.35 - 0.016, z: 0 };
        normalLandmarks[385] = { x: 0.585, y: 0.35 - 0.016, z: 0 };
        normalLandmarks[373] = { x: 0.575, y: 0.35 + 0.016, z: 0 };
        normalLandmarks[380] = { x: 0.585, y: 0.35 + 0.016, z: 0 };

        const detectionNormal = {
            faceLandmarks: [normalLandmarks],
            faceBlendshapes: [{
                categories: [
                    { categoryName: 'eyeBlinkLeft', score: 0.05 },
                    { categoryName: 'eyeBlinkRight', score: 0.05 }
                ]
            }]
        };

        const eye1 = evaluateEyeClosure(detectionNormal, 1000);
        const blink1 = processBlinkFrame(eye1.areBothEyesClosed, 1000);
        const head1 = evaluateHeadPose(detectionNormal, 1000);
        const risk1 = assessDriverRisk({ eyeData: eye1, blinkData: blink1, headData: head1 });
        const alert1 = processAlertState(risk1, 1000);

        expect(risk1.level).toBe(WarningLevel.NORMAL);
        expect(alert1.level).toBe(WarningLevel.NORMAL);

        // 2. Driver closes eyes at t = 2000ms and holds them closed for 3.5s (to t = 5500ms)
        const closedLandmarks = JSON.parse(JSON.stringify(normalLandmarks));
        closedLandmarks[160].y = 0.35;
        closedLandmarks[158].y = 0.35;
        closedLandmarks[144].y = 0.35;
        closedLandmarks[153].y = 0.35;
        closedLandmarks[387].y = 0.35;
        closedLandmarks[385].y = 0.35;
        closedLandmarks[373].y = 0.35;
        closedLandmarks[380].y = 0.35;

        const detectionClosed = {
            faceLandmarks: [closedLandmarks],
            faceBlendshapes: [{
                categories: [
                    { categoryName: 'eyeBlinkLeft', score: 0.9 },
                    { categoryName: 'eyeBlinkRight', score: 0.9 }
                ]
            }]
        };

        // Two consecutive frames at start of closure
        evaluateEyeClosure(detectionClosed, 2000);
        evaluateEyeClosure(detectionClosed, 2033);

        const eyeClosedMid = evaluateEyeClosure(detectionClosed, 5500); // ~3500ms continuous closure
        expect(eyeClosedMid.closureDurationMs).toBeGreaterThanOrEqual(3000);

        const blinkClosed = processBlinkFrame(eyeClosedMid.areBothEyesClosed, 5500);
        const headClosed = evaluateHeadPose(detectionClosed, 5500);
        const riskClosed = assessDriverRisk({ eyeData: eyeClosedMid, blinkData: blinkClosed, headData: headClosed });
        const alertClosed = processAlertState(riskClosed, 5500);

        // Assert High Concern micro-sleep alarm triggered
        expect(riskClosed.level).toBe(WarningLevel.HIGH_CONCERN);
        expect(alertClosed.level).toBe(WarningLevel.HIGH_CONCERN);
        expect(alertClosed.isAlarmPlaying).toBe(true);

        logSafetyEvent({
            category: 'drowsiness',
            severity: 'high',
            title: 'Critical Eye Closure',
            explanation: 'Eyes closed continuously for 3.5s',
            durationMs: 3500
        });

        // 3. Finalize session and verify persistence record
        const finalized = await finalizeCurrentSession();
        expect(finalized.status).toBe('completed');
        expect(finalized.events.length).toBeGreaterThan(0);
        expect(finalized.events.some(e => e.title === 'Critical Eye Closure')).toBe(true);
    });
});
