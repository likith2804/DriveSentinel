import { describe, it, expect, beforeEach } from 'vitest';
import { processBlinkFrame, resetBlinkAnalysis, BlinkState } from '../src/js/vision/blinkAnalysis.js';

describe('Blink Analysis State Machine', () => {
    beforeEach(() => {
        resetBlinkAnalysis();
    });

    it('counts completed blinks upon state transition from CLOSED to OPEN', () => {
        // Frame 1: Eyes open at t = 1000
        const f1 = processBlinkFrame(false, 1000);
        expect(f1.state).toBe(BlinkState.OPEN);
        expect(f1.totalBlinks).toBe(0);

        // Frame 2: Eyes close at t = 1100
        const f2 = processBlinkFrame(true, 1100);
        expect(f2.state).toBe(BlinkState.CLOSED);
        expect(f2.totalBlinks).toBe(0);

        // Frame 3: Eyes still closed at t = 1250 (150ms elapsed)
        const f3 = processBlinkFrame(true, 1250);
        expect(f3.state).toBe(BlinkState.CLOSED);
        expect(f3.totalBlinks).toBe(0);

        // Frame 4: Eyes reopen at t = 1300 (total blink duration: 200ms)
        const f4 = processBlinkFrame(false, 1300);
        expect(f4.state).toBe(BlinkState.OPEN);
        expect(f4.totalBlinks).toBe(1);
        expect(f4.totalLongBlinks).toBe(0);
        expect(f4.completedBlink).not.toBeNull();
        expect(f4.completedBlink.duration).toBe(200);
        expect(f4.completedBlink.isLong).toBe(false);
    });

    it('flags long-blink events when duration exceeds threshold (e.g. 450ms)', () => {
        // Blink starts at t = 2000
        processBlinkFrame(true, 2000);
        // Blink ends at t = 2450 (450ms duration)
        const res = processBlinkFrame(false, 2450);

        expect(res.totalBlinks).toBe(1);
        expect(res.totalLongBlinks).toBe(1);
        expect(res.completedBlink.isLong).toBe(true);
        expect(res.completedBlink.duration).toBe(450);
    });

    it('filters momentary noise glitches (< 70ms)', () => {
        // Single frame noise: closed at t = 1000, open at t = 1030 (30ms)
        processBlinkFrame(true, 1000);
        const res = processBlinkFrame(false, 1030);

        expect(res.totalBlinks).toBe(0);
        expect(res.completedBlink).toBeNull();
    });
});
