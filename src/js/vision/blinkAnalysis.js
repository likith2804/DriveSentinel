// blinkAnalysis.js - Finite state machine for blink counting, duration, and frequency analysis
import { CONFIG } from '../config.js';

export const BlinkState = {
    OPEN: 'OPEN',
    CLOSING: 'CLOSING',
    CLOSED: 'CLOSED'
};

let currentState = BlinkState.OPEN;
let blinkStartTime = 0;
let totalBlinks = 0;
let totalLongBlinks = 0;
let blinkHistory = []; // Array of { timestamp, duration, isLong }
let cumulativeBlinkDuration = 0;

/**
 * Resets the blink analysis engine
 */
export function resetBlinkAnalysis() {
    currentState = BlinkState.OPEN;
    blinkStartTime = 0;
    totalBlinks = 0;
    totalLongBlinks = 0;
    blinkHistory = [];
    cumulativeBlinkDuration = 0;
}

/**
 * Updates blink state machine per video frame
 * 
 * @param {boolean} areEyesClosed - Whether both eyes are currently evaluated as closed
 * @param {number} currentTime - Timestamp (performance.now())
 * @returns {object} Latest blink metrics and event triggers
 */
export function processBlinkFrame(areEyesClosed, currentTime = performance.now()) {
    let completedBlink = null;

    if (currentState === BlinkState.OPEN) {
        if (areEyesClosed) {
            currentState = BlinkState.CLOSED;
            blinkStartTime = currentTime;
        }
    } else if (currentState === BlinkState.CLOSED) {
        if (!areEyesClosed) {
            // Blink finished
            const duration = currentTime - blinkStartTime;
            currentState = BlinkState.OPEN;

            // Filter out momentary single-frame noise glitches (< 70ms)
            if (duration >= 70) {
                const isLong = duration >= CONFIG.BLINK.LONG_BLINK_THRESHOLD_MS;
                totalBlinks++;
                cumulativeBlinkDuration += duration;
                if (isLong) {
                    totalLongBlinks++;
                }

                completedBlink = {
                    timestamp: currentTime,
                    duration: Math.round(duration),
                    isLong
                };

                blinkHistory.push(completedBlink);
            }
            blinkStartTime = 0;
        }
    }

    // Prune blink history older than rolling frequency window
    const windowCutoff = currentTime - CONFIG.BLINK.FREQUENCY_WINDOW_MS;
    blinkHistory = blinkHistory.filter(b => b.timestamp >= windowCutoff);

    // Calculate rolling blink rate (blinks per minute)
    const windowMinutes = CONFIG.BLINK.FREQUENCY_WINDOW_MS / 60000;
    const rollingBlinkRate = Math.round((blinkHistory.length / windowMinutes) * 10) / 10;

    // Calculate average duration
    const avgDuration = totalBlinks > 0 ? Math.round(cumulativeBlinkDuration / totalBlinks) : 0;

    // Pattern assessment
    let patternStatus = 'Normal';
    if (rollingBlinkRate > CONFIG.BLINK.HIGH_BLINK_RATE_THRESHOLD) {
        patternStatus = 'Elevated (Fatigue/Strain)';
    } else if (rollingBlinkRate < CONFIG.BLINK.LOW_BLINK_RATE_THRESHOLD && totalBlinks > 5) {
        patternStatus = 'Low (Staring/Fatigue)';
    }

    return {
        state: currentState,
        totalBlinks,
        totalLongBlinks,
        recentBlinkCount: blinkHistory.length,
        rollingBlinkRate,
        averageBlinkDurationMs: avgDuration,
        patternStatus,
        completedBlink
    };
}

export function getBlinkHistory() {
    return [...blinkHistory];
}
