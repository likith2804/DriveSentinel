import { describe, it, expect } from 'vitest';
import { assessDriverRisk, WarningLevel } from '../src/js/safety/riskAssessment.js';

describe('Multi-Factor Driver Risk Assessment Engine', () => {
    it('assesses normal driving with awake eyes and forward head as WarningLevel.NORMAL', () => {
        const res = assessDriverRisk({
            eyeData: { faceDetected: true, areBothEyesClosed: false, closureDurationMs: 0 },
            blinkData: { totalBlinks: 10, totalLongBlinks: 0, patternStatus: 'Normal' },
            headData: { faceDetected: true, isNodding: false, repetitiveNodding: false },
            motionData: { motionDetected: false }
        });

        expect(res.level).toBe(WarningLevel.NORMAL);
        expect(res.levelName).toBe('Normal');
        expect(res.score).toBeLessThan(20);
        expect(res.contributingFactors.length).toBe(0);
    });

    it('escalates to CAUTION when prolonged eye closure reaches caution threshold', () => {
        const res = assessDriverRisk({
            eyeData: { faceDetected: true, areBothEyesClosed: true, closureDurationMs: 1600 },
            blinkData: { totalBlinks: 10, totalLongBlinks: 0, patternStatus: 'Normal' },
            headData: { faceDetected: true, isNodding: false, repetitiveNodding: false },
            motionData: { motionDetected: false }
        });

        expect(res.level).toBe(WarningLevel.CAUTION);
        expect(res.levelName).toBe('Caution');
        expect(res.contributingFactors.some(f => f.includes('Prolonged'))).toBe(true);
    });

    it('escalates to HIGH_CONCERN when eye closure reaches high threshold (3.0s)', () => {
        const res = assessDriverRisk({
            eyeData: { faceDetected: true, areBothEyesClosed: true, closureDurationMs: 3200 },
            blinkData: { totalBlinks: 10, totalLongBlinks: 0, patternStatus: 'Normal' },
            headData: { faceDetected: true, isNodding: false, repetitiveNodding: false },
            motionData: { motionDetected: false }
        });

        expect(res.level).toBe(WarningLevel.HIGH_CONCERN);
        expect(res.levelName).toBe('High Concern');
        expect(res.contributingFactors.some(f => f.includes('Sustained continuous eye closure'))).toBe(true);
    });

    it('escalates to PERSISTENT_CONCERN when high concern is sustained or closure >= 5.0s', () => {
        const res = assessDriverRisk({
            eyeData: { faceDetected: true, areBothEyesClosed: true, closureDurationMs: 5100 },
            blinkData: { totalBlinks: 10, totalLongBlinks: 1, patternStatus: 'Normal' },
            headData: { faceDetected: true, isNodding: true, repetitiveNodding: false },
            motionData: { motionDetected: false }
        });

        expect(res.level).toBe(WarningLevel.PERSISTENT_CONCERN);
        expect(res.levelName).toBe('Persistent Concern');
        expect(res.recommendation).toContain('CRITICAL WARNING');
    });

    it('flags Monitoring Unavailable when face is not detected', () => {
        const res = assessDriverRisk({
            eyeData: { faceDetected: false, areBothEyesClosed: false, closureDurationMs: 0 },
            blinkData: null,
            headData: { faceDetected: false, isNodding: false },
            motionData: null
        });

        expect(res.isMonitoringActive).toBe(false);
        expect(res.levelName).toBe('Monitoring Unavailable');
    });
});
