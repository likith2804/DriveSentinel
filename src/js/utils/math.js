// math.js - Geometry, EAR calculation, and temporal smoothing utilities

/**
 * Calculates Euclidean distance between two 2D/3D points
 */
export function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z !== undefined && p2.z !== undefined) ? (p1.z - p2.z) : 0;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculates Eye Aspect Ratio (EAR) given 6 landmark points
 * p1: outer corner, p4: inner corner
 * p2, p3: upper eyelid points
 * p6, p5: lower eyelid points
 * Formula: (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
 */
export function calculateEAR(p1, p2, p3, p4, p5, p6) {
    if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0;
    const vertical1 = distance(p2, p6);
    const vertical2 = distance(p3, p5);
    const horizontal = distance(p1, p4);

    if (horizontal < 1e-6) return 0;
    return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Exponential Moving Average for scalar values
 */
export function exponentialMovingAverage(current, previous, alpha = 0.3) {
    if (previous === null || previous === undefined || isNaN(previous)) return current;
    return alpha * current + (1 - alpha) * previous;
}

/**
 * Clamp a number between min and max
 */
export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/**
 * Estimates 3D head orientation (pitch, yaw, roll in degrees) from MediaPipe landmarks
 * Landmarks:
 * 1: Nose tip
 * 152: Chin
 * 10: Forehead / top of head
 * 33: Left eye outer corner
 * 263: Right eye outer corner
 * 61: Left mouth corner
 * 291: Right mouth corner
 */
export function estimateHeadPose(landmarks) {
    if (!landmarks || landmarks.length < 468) {
        return { pitch: 0, yaw: 0, roll: 0, valid: false };
    }

    const nose = landmarks[1];
    const chin = landmarks[152];
    const forehead = landmarks[10];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    if (!nose || !chin || !forehead || !leftEye || !rightEye) {
        return { pitch: 0, yaw: 0, roll: 0, valid: false };
    }

    // 1. Roll: Angle between the two eye corners in the XY image plane
    const eyeDx = rightEye.x - leftEye.x;
    const eyeDy = rightEye.y - leftEye.y;
    const roll = Math.atan2(eyeDy, eyeDx) * (180 / Math.PI);

    // 2. Yaw: Horizontal head turn
    // Compare nose horizontal position relative to midpoint between eyes
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeDist = Math.abs(rightEye.x - leftEye.x);
    // Relative offset scaled by inter-ocular distance
    const yawOffset = (nose.x - eyeMidX) / (eyeDist || 0.001);
    // Approximate yaw in degrees (normal range around -45 to +45)
    const yaw = clamp(yawOffset * 90, -90, 90);

    // 3. Pitch: Vertical head tilt (nodding)
    // When the head tilts down (nodding), the distance from nose to chin shrinks in Y,
    // and nose moves downward relative to eye midpoint, while chin moves closer in Z.
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const totalFaceHeight = Math.abs(chin.y - forehead.y) || 0.001;
    const noseToEyeY = (nose.y - eyeMidY) / totalFaceHeight;
    const noseToChinY = (chin.y - nose.y) / totalFaceHeight;
    
    // In neutral face, noseToEyeY is ~0.35-0.4 and noseToChinY is ~0.4-0.45.
    // When nodding down, noseToChinY drops and nose-chin Z difference changes.
    const pitchRatio = (noseToChinY - 0.42);
    // Invert sign so downward pitch is negative, upward is positive
    const pitch = clamp(pitchRatio * 150, -60, 60);

    return {
        pitch: Math.round(pitch * 10) / 10,
        yaw: Math.round(yaw * 10) / 10,
        roll: Math.round(roll * 10) / 10,
        valid: true
    };
}
