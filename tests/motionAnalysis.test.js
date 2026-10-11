import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeMotion, resetMotionState, isOpenCvAvailable, HardwareIMUInterface } from '../src/js/vision/motionAnalysis.js';

describe('Motion Analysis & Hardware IMU Interface', () => {
    beforeEach(() => {
        resetMotionState();
    });

    it('returns Inactive when video or canvas is missing', () => {
        const res = analyzeMotion(null, null, 1000);
        expect(res.status).toBe('Inactive');
        expect(res.motionDetected).toBe(false);
        expect(res.magnitude).toBe(0);
    });

    it('uses fallback optical flow when OpenCV.js is not loaded', () => {
        expect(isOpenCvAvailable()).toBe(false);

        const mockCanvas = {
            width: 160,
            height: 120,
            getContext: () => ({
                drawImage: vi.fn(),
                getImageData: () => ({
                    data: new Uint8ClampedArray(160 * 120 * 4).fill(128)
                })
            })
        };
        const mockVideo = {};

        const res = analyzeMotion(mockVideo, mockCanvas, 1000);
        expect(res.mode).toContain('Fallback');
        expect(res.isHardwareImu).toBe(false);
        expect(res.disclaimer).toContain('Apparent webcam motion only');
    });

    it('HardwareIMUInterface parses serial telemetry lines accurately', () => {
        const imu = new HardwareIMUInterface();
        expect(imu.isConnected).toBe(false);

        // Test telemetry parsing line: "0.12,-0.98,9.81,0.01,-0.02,0.05"
        imu._parseTelemetry('0.12,-0.98,9.81,0.01,-0.02,0.05');
        const reading = imu.getLatestReading();

        expect(reading).not.toBeNull();
        expect(reading.accelX).toBeCloseTo(0.12, 2);
        expect(reading.accelY).toBeCloseTo(-0.98, 2);
        expect(reading.accelZ).toBeCloseTo(9.81, 2);
        expect(reading.isRealHardware).toBe(true);
    });
});
