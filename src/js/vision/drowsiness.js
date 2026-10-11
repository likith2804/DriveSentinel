// drowsiness.js - Multi-factor eye closure and Eye Aspect Ratio (EAR) tracking
import { CONFIG } from '../config.js';
import { calculateEAR, exponentialMovingAverage } from '../utils/math.js';

let eyeClosureStartTime = 0;
let smoothedLeftEAR = null;
let smoothedRightEAR = null;
let smoothedLeftBlend = null;
let smoothedRightBlend = null;
let consecutiveClosedFrames = 0;
let lastFaceSeenTime = 0;

/**
 * Resets the eye closure tracking state
 */
export function resetDrowsinessState() {
    eyeClosureStartTime = 0;
    smoothedLeftEAR = null;
    smoothedRightEAR = null;
    smoothedLeftBlend = null;
    smoothedRightBlend = null;
    consecutiveClosedFrames = 0;
    lastFaceSeenTime = 0;
}

/**
 * Extracts left/right EAR and blendshape blink scores from MediaPipe result
 * and calculates continuous closure duration and severity.
 * 
 * @param {object} detectionResult - Output from FaceLandmarker
 * @param {number} currentTime - Current timestamp (e.g. performance.now())
 */
export function evaluateEyeClosure(detectionResult, currentTime = performance.now()) {
    if (!detectionResult || !detectionResult.faceLandmarks || detectionResult.faceLandmarks.length === 0) {
        if (lastFaceSeenTime === 0) {
            lastFaceSeenTime = currentTime;
        }
        const missingDuration = currentTime - lastFaceSeenTime;
        const graceExceeded = missingDuration >= CONFIG.TRACKING.GRACE_PERIOD_MS;

        if (graceExceeded) {
            eyeClosureStartTime = 0;
            consecutiveClosedFrames = 0;
        }

        return {
            faceDetected: false,
            leftEyeClosed: false,
            rightEyeClosed: false,
            areBothEyesClosed: false,
            leftEAR: 0,
            rightEAR: 0,
            avgEAR: 0,
            leftBlinkScore: 0,
            rightBlinkScore: 0,
            closureDurationMs: graceExceeded ? 0 : (eyeClosureStartTime > 0 ? Math.round(currentTime - eyeClosureStartTime) : 0),
            status: graceExceeded ? 'No Face Detected' : 'Re-acquiring Face...'
        };
    }

    lastFaceSeenTime = currentTime;

    const landmarks = detectionResult.faceLandmarks[0];

    // Compute raw EAR for Left Eye (landmarks: 33, 160, 158, 133, 153, 144)
    const rawLeftEAR = calculateEAR(
        landmarks[33], landmarks[160], landmarks[158],
        landmarks[133], landmarks[153], landmarks[144]
    );

    // Compute raw EAR for Right Eye (landmarks: 263, 387, 385, 362, 380, 373)
    const rawRightEAR = calculateEAR(
        landmarks[263], landmarks[387], landmarks[385],
        landmarks[362], landmarks[380], landmarks[373]
    );

    // Extract blendshape scores if present
    let rawLeftBlend = 0;
    let rawRightBlend = 0;
    if (detectionResult.faceBlendshapes && detectionResult.faceBlendshapes.length > 0) {
        const categories = detectionResult.faceBlendshapes[0].categories;
        rawLeftBlend = categories.find(c => c.categoryName === 'eyeBlinkLeft')?.score || 0;
        rawRightBlend = categories.find(c => c.categoryName === 'eyeBlinkRight')?.score || 0;
    }

    // Immediate eye-reopening detection:
    // If raw metrics show eyes are open, immediately reset smoothed metrics to raw
    // to avoid trailing smoothing lag keeping eyes falsely marked closed
    const rawBothOpen = (rawLeftBlend < CONFIG.DROWSINESS.BLINK_BLENDSHAPE_THRESHOLD &&
                         rawRightBlend < CONFIG.DROWSINESS.BLINK_BLENDSHAPE_THRESHOLD) &&
                        (rawLeftEAR >= CONFIG.DROWSINESS.EAR_THRESHOLD &&
                         rawRightEAR >= CONFIG.DROWSINESS.EAR_THRESHOLD);

    if (rawBothOpen) {
        smoothedLeftEAR = rawLeftEAR;
        smoothedRightEAR = rawRightEAR;
        smoothedLeftBlend = rawLeftBlend;
        smoothedRightBlend = rawRightBlend;
    } else {
        // Apply temporal smoothing to suppress single-frame landmark jitter
        const alpha = CONFIG.DROWSINESS.SMOOTHING_ALPHA;
        smoothedLeftEAR = exponentialMovingAverage(rawLeftEAR, smoothedLeftEAR, alpha);
        smoothedRightEAR = exponentialMovingAverage(rawRightEAR, smoothedRightEAR, alpha);
        smoothedLeftBlend = exponentialMovingAverage(rawLeftBlend, smoothedLeftBlend, alpha);
        smoothedRightBlend = exponentialMovingAverage(rawRightBlend, smoothedRightBlend, alpha);
    }

    const avgEAR = (smoothedLeftEAR + smoothedRightEAR) / 2;

    // Multi-factor eye closure assessment:
    // Eye is closed if EAR is below threshold OR blendshape is above threshold
    const leftClosed = smoothedLeftBlend > CONFIG.DROWSINESS.BLINK_BLENDSHAPE_THRESHOLD ||
                       smoothedLeftEAR < CONFIG.DROWSINESS.EAR_THRESHOLD;
    const rightClosed = smoothedRightBlend > CONFIG.DROWSINESS.BLINK_BLENDSHAPE_THRESHOLD ||
                        smoothedRightEAR < CONFIG.DROWSINESS.EAR_THRESHOLD;

    const areBothEyesClosed = leftClosed && rightClosed;

    let closureDurationMs = 0;
    let status = 'Open';

    if (areBothEyesClosed) {
        consecutiveClosedFrames++;
        if (eyeClosureStartTime === 0) {
            eyeClosureStartTime = currentTime;
        }
        closureDurationMs = currentTime - eyeClosureStartTime;

        if (closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_PERSISTENT_MS) {
            status = 'Persistent Closure';
        } else if (closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_HIGH_MS) {
            status = 'Severe Closure';
        } else if (closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_CAUTION_MS) {
            status = 'Prolonged Closure';
        } else {
            status = 'Eyes Closed';
        }
    } else {
        consecutiveClosedFrames = 0;
        eyeClosureStartTime = 0;
        closureDurationMs = 0;
        status = 'Normal';
    }

    return {
        faceDetected: true,
        leftEyeClosed: leftClosed,
        rightEyeClosed: rightClosed,
        areBothEyesClosed,
        leftEAR: Math.round(smoothedLeftEAR * 1000) / 1000,
        rightEAR: Math.round(smoothedRightEAR * 1000) / 1000,
        avgEAR: Math.round(avgEAR * 1000) / 1000,
        leftBlinkScore: Math.round(smoothedLeftBlend * 100) / 100,
        rightBlinkScore: Math.round(smoothedRightBlend * 100) / 100,
        closureDurationMs: Math.round(closureDurationMs),
        status
    };
}
