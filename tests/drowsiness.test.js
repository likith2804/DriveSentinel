import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateEyeClosure, resetDrowsinessState } from '../src/js/vision/drowsiness.js';

describe('Eye Closure & Drowsiness Detection', () => {
    beforeEach(() => {
        resetDrowsinessState();
    });

    function mockDetectionResult({ leftBlend = 0, rightBlend = 0, ear = 0.3 } = {}) {
        const landmarks = new Array(468).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
        // Setup eye landmarks for EAR calculation
        // Left Eye: 33, 160, 158, 133, 153, 144
        landmarks[33] = { x: 0.4, y: 0.35, z: 0 };
        landmarks[133] = { x: 0.45, y: 0.35, z: 0 };
        landmarks[160] = { x: 0.425, y: 0.35 - ear * 0.05, z: 0 };
        landmarks[158] = { x: 0.435, y: 0.35 - ear * 0.05, z: 0 };
        landmarks[144] = { x: 0.425, y: 0.35 + ear * 0.05, z: 0 };
        landmarks[153] = { x: 0.435, y: 0.35 + ear * 0.05, z: 0 };

        // Right Eye: 263, 387, 385, 362, 380, 373
        landmarks[263] = { x: 0.55, y: 0.35, z: 0 };
        landmarks[362] = { x: 0.60, y: 0.35, z: 0 };
        landmarks[387] = { x: 0.575, y: 0.35 - ear * 0.05, z: 0 };
        landmarks[385] = { x: 0.585, y: 0.35 - ear * 0.05, z: 0 };
        landmarks[373] = { x: 0.575, y: 0.35 + ear * 0.05, z: 0 };
        landmarks[380] = { x: 0.585, y: 0.35 + ear * 0.05, z: 0 };

        return {
            faceLandmarks: [landmarks],
            faceBlendshapes: [{
                categories: [
                    { categoryName: 'eyeBlinkLeft', score: leftBlend },
                    { categoryName: 'eyeBlinkRight', score: rightBlend }
                ]
            }]
        };
    }

    it('handles missing face with grace period before flagging "No Face Detected"', () => {
        // Frame 1: missing at t = 1000 (within grace period)
        const res1 = evaluateEyeClosure(null, 1000);
        expect(res1.faceDetected).toBe(false);
        expect(res1.status).toBe('Re-acquiring Face...');

        // Frame 2: missing at t = 2600 (1.6s > 1.5s grace period)
        const res2 = evaluateEyeClosure(null, 2600);
        expect(res2.faceDetected).toBe(false);
        expect(res2.status).toBe('No Face Detected');
        expect(res2.closureDurationMs).toBe(0);
    });

    it('identifies open eyes with zero closure duration', () => {
        const openFrame = mockDetectionResult({ leftBlend: 0.05, rightBlend: 0.05, ear: 0.32 });
        const res = evaluateEyeClosure(openFrame, 1000);
        expect(res.faceDetected).toBe(true);
        expect(res.areBothEyesClosed).toBe(false);
        expect(res.closureDurationMs).toBe(0);
        expect(res.status).toBe('Normal');
    });

    it('tracks continuous eye closure across frames and escalates status correctly', () => {
        const closedFrame = mockDetectionResult({ leftBlend: 0.85, rightBlend: 0.85, ear: 0.08 });

        // Frame 1: Eyes close at t = 1000ms
        const f1 = evaluateEyeClosure(closedFrame, 1000);
        expect(f1.areBothEyesClosed).toBe(true);
        expect(f1.closureDurationMs).toBe(0);

        // Frame 2: Eyes still closed at t = 2600ms (1.6s -> passes caution 1.5s)
        const f2 = evaluateEyeClosure(closedFrame, 2600);
        expect(f2.areBothEyesClosed).toBe(true);
        expect(f2.closureDurationMs).toBe(1600);
        expect(f2.status).toBe('Prolonged Closure');

        // Frame 3: Eyes still closed at t = 4200ms (3.2s -> passes high concern 3.0s)
        const f3 = evaluateEyeClosure(closedFrame, 4200);
        expect(f3.closureDurationMs).toBe(3200);
        expect(f3.status).toBe('Severe Closure');

        // Frame 4: Eyes reopen at t = 4500ms -> duration drops back to 0
        const openFrame = mockDetectionResult({ leftBlend: 0.05, rightBlend: 0.05, ear: 0.32 });
        const f4 = evaluateEyeClosure(openFrame, 4500);
        expect(f4.areBothEyesClosed).toBe(false);
        expect(f4.closureDurationMs).toBe(0);
        expect(f4.status).toBe('Normal');
    });
});
