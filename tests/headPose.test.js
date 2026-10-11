import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateHeadPose, resetHeadPoseState } from '../src/js/vision/headPose.js';

describe('Head Pose Estimation & Nodding Detection', () => {
    beforeEach(() => {
        resetHeadPoseState();
    });

    function mockPoseResult(pitchDelta = 0, yawOffset = 0) {
        const landmarks = new Array(468).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
        landmarks[1] = { x: 0.5 + yawOffset, y: 0.5, z: 0 };     // Nose
        landmarks[152] = { x: 0.5, y: 0.8 + pitchDelta, z: 0 };  // Chin
        landmarks[10] = { x: 0.5, y: 0.1, z: 0 };                // Forehead
        landmarks[33] = { x: 0.4, y: 0.35, z: 0 };               // Left eye
        landmarks[263] = { x: 0.6, y: 0.35, z: 0 };              // Right eye
        return { faceLandmarks: [landmarks] };
    }

    it('handles face absence and flags tracking loss after grace period', () => {
        // Missing face at t = 1000
        const f1 = evaluateHeadPose(null, 1000);
        expect(f1.faceDetected).toBe(false);
        expect(f1.trackingLossCount).toBe(0);

        // Still missing at t = 2600 (1.6s elapsed > 1.5s grace)
        const f2 = evaluateHeadPose(null, 2600);
        expect(f2.faceDetected).toBe(false);
        expect(f2.trackingLossCount).toBe(1);
        expect(f2.triggeredTrackingLossEvent).toBe(true);
        expect(f2.trackingStatus).toBe('Face Not Detected');
    });

    it('detects downward head nodding pattern when pitch drops below threshold', () => {
        // Forward head frame
        const forward = mockPoseResult(0);
        evaluateHeadPose(forward, 1000);

        // Head bowed down (pitch < -14 degrees)
        const bowed = mockPoseResult(-0.15);

        // Frame 1 bowed at t = 2000: begins pitch drop
        const f1 = evaluateHeadPose(bowed, 2000);
        expect(f1.faceDetected).toBe(true);
        expect(f1.pitch).toBeLessThan(0);

        // Frame 2 at t = 2100: temporal smoothing establishes pitch < -10 deg
        evaluateHeadPose(bowed, 2050);
        const f2 = evaluateHeadPose(bowed, 2100);
        expect(f2.pitch).toBeLessThan(-10);

        // Frame 3 bowed at t = 3700 (1.7s elapsed > 1.6s threshold)
        const f3 = evaluateHeadPose(bowed, 3700);
        expect(f3.isNodding).toBe(true);
        expect(f3.headPoseStatus).toContain('Nodding');

        // Head comes back up at t = 4000
        const f4 = evaluateHeadPose(forward, 4000);
        expect(f4.newNodCompleted).toBe(true);
        expect(f4.totalNodEvents).toBe(1);
    });
});
