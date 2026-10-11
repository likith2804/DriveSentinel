// drowsiness.js - Legacy entrypoint proxying to src/js/vision/drowsiness.js
export * from './vision/drowsiness.js';
import { CONFIG } from './config.js';
import { evaluateEyeClosure, resetDrowsinessState } from './vision/drowsiness.js';
import { isLandmarkerReady, detectFace } from './vision/faceLandmarker.js';

/**
 * Backward compatibility wrapper for original detectDrowsiness
 */
export function detectDrowsiness(videoEl, timestamp) {
    if (!isLandmarkerReady()) {
        return { status: "Detection Error", isDrowsy: false, duration: 0 };
    }
    const result = detectFace(videoEl, timestamp);
    const evalResult = evaluateEyeClosure(result, timestamp);

    return {
        status: evalResult.status,
        isDrowsy: evalResult.closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_HIGH_MS,
        duration: evalResult.closureDurationMs
    };
}
