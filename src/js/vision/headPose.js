// headPose.js - 3D head orientation estimation, nodding detection, and tracking quality evaluation
import { CONFIG } from '../config.js';
import { estimateHeadPose, exponentialMovingAverage } from '../utils/math.js';

let smoothedPitch = null;
let smoothedYaw = null;
let smoothedRoll = null;

let nodStartTime = 0;
let nodCycleTimestamps = []; // History of completed nod down-up cycles
let totalNodEvents = 0;

let lastFaceSeenTime = 0;
let isTrackingLost = false;
let trackingLossCount = 0;

/**
 * Resets head pose tracking state
 */
export function resetHeadPoseState() {
    smoothedPitch = null;
    smoothedYaw = null;
    smoothedRoll = null;
    nodStartTime = 0;
    nodCycleTimestamps = [];
    totalNodEvents = 0;
    lastFaceSeenTime = 0;
    isTrackingLost = false;
    trackingLossCount = 0;
}

/**
 * Evaluates head pose, nodding behavior, and tracking confidence
 * 
 * @param {object} detectionResult - FaceLandmarker result
 * @param {number} currentTime - Timestamp (performance.now())
 */
export function evaluateHeadPose(detectionResult, currentTime = performance.now()) {
    const hasFace = detectionResult && detectionResult.faceLandmarks && detectionResult.faceLandmarks.length > 0;

    // 1. Face Tracking & Confidence Handling
    if (!hasFace) {
        if (lastFaceSeenTime === 0) {
            lastFaceSeenTime = currentTime;
        }
        const timeSinceLost = currentTime - lastFaceSeenTime;
        const graceExceeded = timeSinceLost >= CONFIG.TRACKING.GRACE_PERIOD_MS;

        let triggeredTrackingLossEvent = false;
        if (graceExceeded && !isTrackingLost) {
            isTrackingLost = true;
            trackingLossCount++;
            triggeredTrackingLossEvent = true;
        }

        // Reset ongoing nod if face disappears
        nodStartTime = 0;

        return {
            faceDetected: false,
            trackingStatus: graceExceeded ? 'Face Not Detected' : 'Re-acquiring Face...',
            confidence: 0,
            pitch: 0,
            yaw: 0,
            roll: 0,
            isNodding: false,
            nodDurationMs: 0,
            totalNodEvents,
            trackingLossCount,
            triggeredTrackingLossEvent,
            headPoseStatus: 'Unavailable'
        };
    }

    // Face is visible
    lastFaceSeenTime = currentTime;
    if (isTrackingLost) {
        isTrackingLost = false;
    }

    const landmarks = detectionResult.faceLandmarks[0];
    const rawPose = estimateHeadPose(landmarks);

    // Temporal smoothing
    const alpha = 0.35;
    smoothedPitch = exponentialMovingAverage(rawPose.pitch, smoothedPitch, alpha);
    smoothedYaw = exponentialMovingAverage(rawPose.yaw, smoothedYaw, alpha);
    smoothedRoll = exponentialMovingAverage(rawPose.roll, smoothedRoll, alpha);

    const pitch = Math.round(smoothedPitch * 10) / 10;
    const yaw = Math.round(smoothedYaw * 10) / 10;
    const roll = Math.round(smoothedRoll * 10) / 10;

    // 2. Head-Nodding Detection
    // Pitch drops below threshold (negative = head bowed down toward chest)
    const isHeadDown = pitch <= CONFIG.HEAD_POSE.NOD_PITCH_THRESHOLD_DEG;

    let isNodding = false;
    let nodDurationMs = 0;
    let newNodCompleted = false;

    if (isHeadDown) {
        if (nodStartTime === 0) {
            nodStartTime = currentTime;
        }
        nodDurationMs = currentTime - nodStartTime;

        if (nodDurationMs >= CONFIG.HEAD_POSE.NOD_DURATION_MS) {
            isNodding = true;
        }
    } else {
        // Head restored upward
        if (nodStartTime > 0) {
            const finalDuration = currentTime - nodStartTime;
            if (finalDuration >= CONFIG.HEAD_POSE.NOD_DURATION_MS) {
                // Completed a full nodding cycle
                totalNodEvents++;
                nodCycleTimestamps.push(currentTime);
                newNodCompleted = true;
            }
            nodStartTime = 0;
        }
    }

    // Filter repetitive nodding cycles within window
    const cycleCutoff = currentTime - CONFIG.HEAD_POSE.NOD_CYCLE_WINDOW_MS;
    nodCycleTimestamps = nodCycleTimestamps.filter(t => t >= cycleCutoff);
    const repetitiveNodding = nodCycleTimestamps.length >= CONFIG.HEAD_POSE.NOD_CYCLE_COUNT;

    // 3. Pose Status & Head Orientation Classification
    let headPoseStatus = 'Forward';
    if (isNodding || repetitiveNodding) {
        headPoseStatus = 'Head Dropping (Nodding)';
    } else if (isHeadDown) {
        headPoseStatus = 'Downward Tilt';
    } else if (pitch >= CONFIG.HEAD_POSE.UPWARD_PITCH_THRESHOLD_DEG) {
        headPoseStatus = 'Looking Up';
    } else if (Math.abs(yaw) >= CONFIG.HEAD_POSE.YAW_DISTRACTION_DEG) {
        headPoseStatus = yaw > 0 ? 'Looking Right' : 'Looking Left';
    }

    return {
        faceDetected: true,
        trackingStatus: 'Monitoring Normally',
        confidence: 0.95,
        pitch,
        yaw,
        roll,
        isNodding: isNodding || repetitiveNodding,
        repetitiveNodding,
        nodDurationMs: Math.round(nodDurationMs),
        totalNodEvents,
        newNodCompleted,
        trackingLossCount,
        headPoseStatus
    };
}
