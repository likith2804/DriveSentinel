// alertManager.js - Centralized alert management, escalation, cooldowns, and audio control
import { CONFIG } from '../config.js';
import { WarningLevel } from './riskAssessment.js';
import { playCautionChime, startAlarm, stopAlarm, testAlarmSound, isMuted, setMuted } from '../utils/audio.js';

let currentWarningLevel = WarningLevel.NORMAL;
let highConcernStartTimestamp = 0;
let lastAlertSoundTimestamp = 0;
let dismissedConditionKey = null;

// Callbacks for UI updates
const listeners = [];

export function subscribeAlertChanges(callback) {
    listeners.push(callback);
}

function notifyListeners(alertState) {
    listeners.forEach(fn => fn(alertState));
}

/**
 * Resets alert manager state
 */
export function resetAlertManager() {
    currentWarningLevel = WarningLevel.NORMAL;
    highConcernStartTimestamp = 0;
    lastAlertSoundTimestamp = 0;
    dismissedConditionKey = null;
    stopAlarm();
    notifyListeners(getAlertState());
}

/**
 * Evaluates warning state and manages audio escalation and cooldowns
 * 
 * @param {object} assessmentResult - From assessDriverRisk
 * @param {number} currentTime - Timestamp (performance.now())
 */
export function processAlertState(assessmentResult, currentTime = performance.now()) {
    const { level, contributingFactors, recommendation } = assessmentResult;
    const previousLevel = currentWarningLevel;
    currentWarningLevel = level;

    // Track how long high concern has been active for escalation
    if (level === WarningLevel.HIGH_CONCERN || level === WarningLevel.PERSISTENT_CONCERN) {
        if (highConcernStartTimestamp === 0) {
            highConcernStartTimestamp = currentTime;
        }
    } else {
        highConcernStartTimestamp = 0;
    }

    // Audio triggers based on warning level
    if (CONFIG.ALERTS.AUDIO_ENABLED && !isMuted()) {
        const timeSinceLastSound = currentTime - lastAlertSoundTimestamp;

        if (level === WarningLevel.PERSISTENT_CONCERN) {
            startAlarm('persistent');
            lastAlertSoundTimestamp = currentTime;
        } else if (level === WarningLevel.HIGH_CONCERN) {
            startAlarm('high');
            lastAlertSoundTimestamp = currentTime;
        } else if (level === WarningLevel.CAUTION) {
            stopAlarm();
            // Play gentle chime on state transition to caution or after cooldown
            if (previousLevel !== WarningLevel.CAUTION && timeSinceLastSound >= CONFIG.ALERTS.COOLDOWN_MS) {
                playCautionChime();
                lastAlertSoundTimestamp = currentTime;
            }
        } else {
            // Normal
            stopAlarm();
        }
    } else {
        stopAlarm();
    }

    const state = getAlertState(assessmentResult);
    notifyListeners(state);
    return state;
}

/**
 * Dismiss active banner without clearing underlying detector
 */
export function dismissActiveBanner() {
    dismissedConditionKey = currentWarningLevel;
    stopAlarm();
    notifyListeners(getAlertState());
}

/**
 * Returns active alert status
 */
export function getAlertState(assessmentResult = null) {
    return {
        level: currentWarningLevel,
        levelName: getLevelName(currentWarningLevel),
        isAudioMuted: isMuted(),
        isAlarmPlaying: currentWarningLevel >= WarningLevel.HIGH_CONCERN && !isMuted() && CONFIG.ALERTS.AUDIO_ENABLED,
        contributingFactors: assessmentResult ? assessmentResult.contributingFactors : [],
        recommendation: assessmentResult ? assessmentResult.recommendation : 'Normal',
        dismissed: dismissedConditionKey === currentWarningLevel
    };
}

export function getConsecutiveHighDuration(currentTime = performance.now()) {
    if (highConcernStartTimestamp === 0) return 0;
    return currentTime - highConcernStartTimestamp;
}

function getLevelName(level) {
    switch (level) {
        case WarningLevel.NORMAL: return 'Normal';
        case WarningLevel.CAUTION: return 'Caution';
        case WarningLevel.HIGH_CONCERN: return 'High Concern';
        case WarningLevel.PERSISTENT_CONCERN: return 'Persistent Concern';
        default: return 'Unknown';
    }
}

export { testAlarmSound, isMuted, setMuted };
