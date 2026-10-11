import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isLandmarkerReady, getActiveDelegate, detectFace, renderLandmarkOverlay, disposeFaceLandmarker } from '../src/js/vision/faceLandmarker.js';

describe('MediaPipe Face Landmarker Subsystem', () => {
    beforeEach(() => {
        disposeFaceLandmarker();
    });

    it('reports not ready before initialization', () => {
        expect(isLandmarkerReady()).toBe(false);
        const res = detectFace({}, 1000);
        expect(res).toBeNull();
    });

    it('renders overlay onto canvas context gracefully', () => {
        const mockCtx = {
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            stroke: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn()
        };

        const mockCanvas = {
            width: 640,
            height: 480,
            getContext: vi.fn(() => mockCtx)
        };

        // 1. Render empty detection
        renderLandmarkOverlay(mockCanvas, null);
        expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);

        // 2. Render detection with landmarks
        const mockLandmarks = new Array(468).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
        renderLandmarkOverlay(mockCanvas, {
            faceLandmarks: [mockLandmarks]
        });

        expect(mockCtx.stroke).toHaveBeenCalled();
        expect(mockCtx.beginPath).toHaveBeenCalled();
    });

    it('cleans up resources on dispose', () => {
        disposeFaceLandmarker();
        expect(isLandmarkerReady()).toBe(false);
    });
});
