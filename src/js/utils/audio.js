// audio.js - Synthesized multi-tone alarms using the Web Audio API

let audioCtx = null;
let activeOscillator = null;
let activeModulator = null;
let activeIntervalId = null;
let isAudioMuted = false;

/**
 * Initializes and unlocks AudioContext if necessary
 */
export function getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

export function isMuted() {
    return isAudioMuted;
}

export function setMuted(muted) {
    isAudioMuted = !!muted;
    if (isAudioMuted) {
        stopAlarm();
    }
}

/**
 * Plays a short, non-intrusive caution chime (2 gentle pulses)
 */
export function playCautionChime() {
    if (isAudioMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(650, now + 0.12);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.26);
    } catch (e) {
        console.warn("Could not play caution chime:", e);
    }
}

/**
 * Starts continuous alarm based on severity
 * @param {'high'|'persistent'} level 
 */
let currentAlarmLevel = null;

export function startAlarm(level = 'high') {
    if (isAudioMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    // If alarm is already running at the same level, do not duplicate
    if (activeOscillator && currentAlarmLevel === level) {
        return;
    }

    // If level upgraded (e.g. from high to persistent), cleanly stop previous tone
    if (activeOscillator) {
        stopAlarm();
    }

    currentAlarmLevel = level;

    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = level === 'persistent' ? 'sawtooth' : 'triangle';
        gain.gain.value = level === 'persistent' ? 0.12 : 0.08;

        const baseFreq = level === 'persistent' ? 750 : 580;
        const peakFreq = level === 'persistent' ? 1000 : 800;
        const stepTime = level === 'persistent' ? 180 : 350;

        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);

        let toggle = false;
        activeIntervalId = setInterval(() => {
            if (!activeOscillator) return;
            toggle = !toggle;
            const targetFreq = toggle ? peakFreq : baseFreq;
            osc.frequency.setValueAtTime(targetFreq, ctx.currentTime);
        }, stepTime);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        activeOscillator = osc;
    } catch (e) {
        console.warn("Could not start alarm:", e);
    }
}

/**
 * Stops any actively playing continuous alarm
 */
export function stopAlarm() {
    if (activeIntervalId) {
        clearInterval(activeIntervalId);
        activeIntervalId = null;
    }
    if (activeOscillator) {
        try {
            activeOscillator.stop();
            activeOscillator.disconnect();
        } catch (e) {}
        activeOscillator = null;
    }
    if (activeModulator) {
        try {
            activeModulator.stop();
            activeModulator.disconnect();
        } catch (e) {}
        activeModulator = null;
    }
    currentAlarmLevel = null;
}

/**
 * Test sound trigger for settings UI
 */
export function testAlarmSound(level = 'high') {
    const wasMuted = isAudioMuted;
    isAudioMuted = false;
    startAlarm(level);
    setTimeout(() => {
        stopAlarm();
        isAudioMuted = wasMuted;
    }, 1200);
}
