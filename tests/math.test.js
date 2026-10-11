import { describe, it, expect } from 'vitest';
import { distance, calculateEAR, exponentialMovingAverage, clamp, estimateHeadPose } from '../src/js/utils/math.js';

describe('Math and Geometry Utilities', () => {
    it('calculates 2D and 3D Euclidean distances correctly', () => {
        expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
        expect(distance({ x: 0, y: 0, z: 0 }, { x: 2, y: 3, z: 6 })).toBe(7);
    });

    it('calculates Eye Aspect Ratio (EAR) properly', () => {
        // Open eye coordinates
        const p1 = { x: 0, y: 0 };
        const p4 = { x: 10, y: 0 };
        const p2 = { x: 3, y: 3 };
        const p6 = { x: 3, y: -3 };
        const p3 = { x: 7, y: 3 };
        const p5 = { x: 7, y: -3 };

        const openEar = calculateEAR(p1, p2, p3, p4, p5, p6);
        // vertical1 = 6, vertical2 = 6, horizontal = 10 -> (6+6)/(20) = 0.6
        expect(openEar).toBeCloseTo(0.6, 2);

        // Closed eye coordinates
        const c_p2 = { x: 3, y: 0.5 };
        const c_p6 = { x: 3, y: -0.5 };
        const c_p3 = { x: 7, y: 0.5 };
        const c_p5 = { x: 7, y: -0.5 };

        const closedEar = calculateEAR(p1, c_p2, c_p3, p4, c_p5, c_p6);
        // vertical1 = 1, vertical2 = 1, horizontal = 10 -> (1+1)/20 = 0.1
        expect(closedEar).toBeCloseTo(0.1, 2);
    });

    it('applies exponential moving average correctly', () => {
        expect(exponentialMovingAverage(10, null, 0.3)).toBe(10);
        // alpha * 10 + (1 - alpha) * 0 -> 0.3 * 10 + 0.7 * 0 = 3
        expect(exponentialMovingAverage(10, 0, 0.3)).toBeCloseTo(3, 2);
    });

    it('clamps values within range', () => {
        expect(clamp(15, 0, 10)).toBe(10);
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(7, 0, 10)).toBe(7);
    });

    it('estimates head pose (pitch, yaw, roll) from geometric landmarks', () => {
        // Construct synthetic 468 landmark array
        const landmarks = new Array(468).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
        landmarks[1] = { x: 0.5, y: 0.5, z: 0 };     // Nose
        landmarks[152] = { x: 0.5, y: 0.8, z: 0 };   // Chin
        landmarks[10] = { x: 0.5, y: 0.1, z: 0 };    // Forehead
        landmarks[33] = { x: 0.4, y: 0.35, z: 0 };   // Left eye
        landmarks[263] = { x: 0.6, y: 0.35, z: 0 };  // Right eye

        const pose = estimateHeadPose(landmarks);
        expect(pose.valid).toBe(true);
        expect(pose.roll).toBeCloseTo(0, 1);
        expect(pose.yaw).toBeCloseTo(0, 1);
    });
});
