// shakeDetection.js - Legacy entrypoint proxying to src/js/vision/motionAnalysis.js
export * from './vision/motionAnalysis.js';
import { analyzeMotion, resetMotionState } from './vision/motionAnalysis.js';
import { CONFIG } from './config.js';

export function initShakeDetection(canvasEl) {
    if (canvasEl) {
        canvasEl.width = CONFIG.MOTION.RESOLUTION_W;
        canvasEl.height = CONFIG.MOTION.RESOLUTION_H;
    }
    resetMotionState();
}

export function detectShake(videoEl, canvasEl) {
    const res = analyzeMotion(videoEl, canvasEl, performance.now());
    return res.motionDetected;
}
