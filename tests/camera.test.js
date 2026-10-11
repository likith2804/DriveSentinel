import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cameraState, initCamera, stopCamera, startCamera } from '../src/js/camera.js';

describe('Camera WebRTC Management & Error Handling', () => {
    beforeEach(() => {
        stopCamera();
    });

    it('initializes cameraState cleanly', () => {
        const mockVideo = {};
        initCamera(mockVideo);
        expect(cameraState.isActive).toBe(false);
        expect(cameraState.stream).toBeNull();
        expect(cameraState.videoElement).toBe(mockVideo);
    });

    it('handles permission denial gracefully with clear error message', async () => {
        const mockVideo = {};
        initCamera(mockVideo);

        vi.stubGlobal('navigator', {
            mediaDevices: {
                getUserMedia: vi.fn().mockRejectedValue({ name: 'NotAllowedError' })
            }
        });

        await expect(startCamera()).rejects.toThrow('Camera permission was denied');
        expect(cameraState.isActive).toBe(false);
        expect(cameraState.error).toContain('Camera permission was denied');

        vi.unstubAllGlobals();
    });

    it('stops camera and calls track.stop() on all tracks', () => {
        const mockTrack = { stop: vi.fn() };
        cameraState.stream = {
            getTracks: () => [mockTrack]
        };
        cameraState.videoElement = {
            pause: vi.fn(),
            srcObject: cameraState.stream
        };
        cameraState.isActive = true;

        stopCamera();

        expect(mockTrack.stop).toHaveBeenCalled();
        expect(cameraState.isActive).toBe(false);
        expect(cameraState.stream).toBeNull();
        expect(cameraState.videoElement.srcObject).toBeNull();
    });
});
