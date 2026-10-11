// riskAssessment.js - Deterministic, multi-factor fatigue and distraction assessment engine
import { CONFIG } from '../config.js';

export const WarningLevel = {
    NORMAL: 0,
    CAUTION: 1,
    HIGH_CONCERN: 2,
    PERSISTENT_CONCERN: 3
};

/**
 * Assesses driver risk level based on live indicators
 * 
 * @param {object} params
 * @param {object} params.eyeData - From evaluateEyeClosure
 * @param {object} params.blinkData - From processBlinkFrame
 * @param {object} params.headData - From evaluateHeadPose
 * @param {object} params.motionData - From analyzeMotion
 * @param {number} params.consecutiveHighConcernDurationMs - How long high concern has been active
 */
export function assessDriverRisk({
    eyeData,
    blinkData,
    headData,
    motionData,
    consecutiveHighConcernDurationMs = 0
}) {
    const contributingFactors = [];
    let score = 0; // 0 - 100 rule-based score
    let level = WarningLevel.NORMAL;
    let recommendation = 'Normal driver state. Maintain road awareness.';

    // 1. Missing Face / Tracking check
    if (!eyeData.faceDetected || !headData.faceDetected) {
        return {
            level: WarningLevel.NORMAL,
            levelName: 'Monitoring Unavailable',
            score: 0,
            statusLabel: 'Face Not Detected',
            contributingFactors: ['Driver face outside camera view or occluded'],
            recommendation: 'Position camera so driver face is clearly visible.',
            isMonitoringActive: false
        };
    }

    // 2. Sustained Eye Closure assessment
    if (eyeData.areBothEyesClosed) {
        const duration = eyeData.closureDurationMs;
        if (duration >= CONFIG.DROWSINESS.EYE_CLOSURE_PERSISTENT_MS) {
            score += 65;
            contributingFactors.push(`Critical continuous eye closure (${(duration / 1000).toFixed(1)}s)`);
        } else if (duration >= CONFIG.DROWSINESS.EYE_CLOSURE_HIGH_MS) {
            score += 50;
            contributingFactors.push(`Sustained continuous eye closure (${(duration / 1000).toFixed(1)}s)`);
        } else if (duration >= CONFIG.DROWSINESS.EYE_CLOSURE_CAUTION_MS) {
            score += 25;
            contributingFactors.push(`Prolonged eye closure (${(duration / 1000).toFixed(1)}s)`);
        }
    }

    // 3. Blink Pattern & Long Blinks assessment
    if (blinkData) {
        if (blinkData.completedBlink && blinkData.completedBlink.isLong) {
            score += 20;
            contributingFactors.push(`Long blink detected (${blinkData.completedBlink.duration}ms)`);
        }
        if (blinkData.patternStatus && blinkData.patternStatus.includes('Fatigue')) {
            score += 15;
            contributingFactors.push(`Abnormal blink rate: ${blinkData.rollingBlinkRate} blinks/min`);
        }
    }

    // 4. Head Nodding & Posture assessment
    if (headData) {
        if (headData.isNodding) {
            score += 40;
            contributingFactors.push(`Downward head nod detected (${(headData.nodDurationMs / 1000).toFixed(1)}s)`);
        }
        if (headData.repetitiveNodding) {
            score += 30;
            contributingFactors.push('Repetitive head nodding pattern observed');
        }
        if (headData.headPoseStatus && (headData.headPoseStatus.includes('Left') || headData.headPoseStatus.includes('Right'))) {
            score += 15;
            contributingFactors.push(`Head turned off-road (${headData.headPoseStatus})`);
        }
    }

    // 5. Camera Shake / Motion assessment (Motion contributes as secondary operational note)
    if (motionData && motionData.motionDetected) {
        contributingFactors.push(`Apparent camera motion detected (${motionData.smoothedMagnitude.toFixed(1)})`);
    }

    // Cap score at 100
    score = Math.min(100, score);

    // Determine Warning Level based on score and critical conditions
    const hasCriticalEyeClosure = eyeData.closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_HIGH_MS;
    const hasPersistentEyeClosure = eyeData.closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_PERSISTENT_MS;
    const hasNoddingAndLongBlink = headData.isNodding && (blinkData?.totalLongBlinks > 0);

    if (hasPersistentEyeClosure || (hasCriticalEyeClosure && consecutiveHighConcernDurationMs >= CONFIG.ALERTS.ESCALATION_DURATION_MS) || score >= 80) {
        level = WarningLevel.PERSISTENT_CONCERN;
        recommendation = 'CRITICAL WARNING: Persistent severe drowsiness indicators! Pull over safely immediately.';
    } else if (hasCriticalEyeClosure || hasNoddingAndLongBlink || score >= 45) {
        level = WarningLevel.HIGH_CONCERN;
        recommendation = 'HIGH CONCERN: Driver drowsiness detected. Prepare to stop and rest.';
    } else if (score >= 20 || (eyeData.closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_CAUTION_MS)) {
        level = WarningLevel.CAUTION;
        recommendation = 'CAUTION: Early fatigue indicators observed. Stay alert.';
    } else {
        level = WarningLevel.NORMAL;
        recommendation = 'Normal driving condition.';
    }

    const levelNames = {
        [WarningLevel.NORMAL]: 'Normal',
        [WarningLevel.CAUTION]: 'Caution',
        [WarningLevel.HIGH_CONCERN]: 'High Concern',
        [WarningLevel.PERSISTENT_CONCERN]: 'Persistent Concern'
    };

    return {
        level,
        levelName: levelNames[level],
        score,
        contributingFactors,
        recommendation,
        isMonitoringActive: true
    };
}
