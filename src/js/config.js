// config.js - Centralized configuration settings and persistent preference store

export const DEFAULT_CONFIG = {
    DROWSINESS: {
        // Caution threshold: eyes continuously closed for 1.5 seconds
        EYE_CLOSURE_CAUTION_MS: 1500,
        // High concern threshold: eyes continuously closed for 3.0 seconds (Default documented standard)
        EYE_CLOSURE_HIGH_MS: 3000,
        // Persistent concern threshold: eyes closed for 5.0 seconds
        EYE_CLOSURE_PERSISTENT_MS: 5000,
        // Eye blendshape threshold above which an eye is considered closed (0 to 1)
        BLINK_BLENDSHAPE_THRESHOLD: 0.35,
        // Eye Aspect Ratio (EAR) threshold below which an eye is closed
        EAR_THRESHOLD: 0.21,
        // Temporal smoothing factor for eye metrics (0 = fully historical, 1 = raw instantaneous)
        SMOOTHING_ALPHA: 0.3
    },
    BLINK: {
        // A normal blink lasts 100ms - 350ms. Beyond this is considered a long blink / micro-sleep precursor.
        LONG_BLINK_THRESHOLD_MS: 400,
        // Window in milliseconds to measure rolling blink frequency
        FREQUENCY_WINDOW_MS: 60000,
        // Abnormal blink frequency thresholds (blinks per minute)
        LOW_BLINK_RATE_THRESHOLD: 6,
        HIGH_BLINK_RATE_THRESHOLD: 32
    },
    HEAD_POSE: {
        // Downward pitch angle (degrees) indicating head drop / nodding
        NOD_PITCH_THRESHOLD_DEG: -14,
        // Upward pitch limit (driver looking up or away)
        UPWARD_PITCH_THRESHOLD_DEG: 22,
        // Yaw angle limit (driver looking left/right off-road)
        YAW_DISTRACTION_DEG: 28,
        // Sustained head drop duration to trigger alert
        NOD_DURATION_MS: 1600,
        // Repetitive nodding cycles within window to trigger fatigue alert
        NOD_CYCLE_COUNT: 2,
        NOD_CYCLE_WINDOW_MS: 12000
    },
    TRACKING: {
        // Grace period in ms before flagging missing face as tracking loss
        GRACE_PERIOD_MS: 1500,
        // Minimum landmark visibility score
        MIN_CONFIDENCE: 0.5
    },
    MOTION: {
        // Process interval for motion analysis (ms)
        PROCESS_INTERVAL_MS: 100,
        // Feature displacement or optical flow magnitude threshold
        MOTION_MAGNITUDE_THRESHOLD: 3.5,
        // Consecutive frames exceeding threshold to trigger motion alert
        CONSECUTIVE_FRAMES_WARNING: 4,
        // How long movement must stop before alert clears (ms)
        CLEAR_DURATION_MS: 2500,
        // Scaled canvas resolution for OpenCV processing
        RESOLUTION_W: 160,
        RESOLUTION_H: 120,
        // Temporal smoothing factor for motion
        SMOOTHING_ALPHA: 0.25
    },
    ALERTS: {
        // Cooldown between repeated audio alerts for the same category (ms)
        COOLDOWN_MS: 5000,
        // Escalation grace period from High to Persistent if condition continues (ms)
        ESCALATION_DURATION_MS: 4000,
        // Audio enabled globally
        AUDIO_ENABLED: true,
        // Visual overlay landmarks on webcam
        SHOW_LANDMARK_OVERLAY: true
    },
    EMAIL: {
        // Master toggle for email escalation
        ENABLED: true,
        // Configurable escalation threshold: persistent high-risk duration before sending email (seconds)
        ESCALATION_THRESHOLD_SEC: 30,
        // Cooldown between repeated emails to prevent alert spamming (ms)
        COOLDOWN_MS: 60000,
        // Authorized recipient email address
        RECIPIENT_EMAIL: '',
        // Send a session summary email when monitoring stops
        SEND_SESSION_SUMMARY: false,
        // Backend API endpoint base
        API_BASE_URL: '/api'
    },
    STORAGE: {
        // Maximum number of saved sessions to retain
        MAX_SAVED_SESSIONS: 50
    },
    UI: {
        COLOR_GREEN: 'status-green',
        COLOR_YELLOW: 'status-yellow',
        COLOR_ORANGE: 'status-orange',
        COLOR_RED: 'status-red',
        COLOR_GRAY: 'status-gray'
    }
};

const STORAGE_KEY = 'smart_vehicle_safety_config_v2';

// Deep clone helper
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Current active configuration
export let CONFIG = deepClone(DEFAULT_CONFIG);

/**
 * Loads configuration from localStorage, falling back to defaults
 */
export function loadConfig() {
    try {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure any missing fields are preserved
                CONFIG = mergeConfigs(deepClone(DEFAULT_CONFIG), parsed);
                return CONFIG;
            }
        }
    } catch (e) {
        console.warn('Failed to load saved configuration, using defaults:', e);
    }
    CONFIG = deepClone(DEFAULT_CONFIG);
    return CONFIG;
}

/**
 * Saves current configuration to localStorage
 */
export function saveConfig(newConfig) {
    const validated = validateConfig(newConfig);
    CONFIG = deepClone(validated);
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(CONFIG));
        }
    } catch (e) {
        console.error('Failed to persist configuration to localStorage:', e);
    }
    return CONFIG;
}

/**
 * Resets configuration back to factory defaults
 */
export function resetConfigToDefaults() {
    CONFIG = deepClone(DEFAULT_CONFIG);
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch (e) {}
    return CONFIG;
}

/**
 * Merges target with source safely
 */
function mergeConfigs(target, source) {
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            mergeConfigs(target[key], source[key]);
        } else if (source[key] !== undefined) {
            target[key] = source[key];
        }
    }
    return target;
}

/**
 * Validates and clamps configuration values
 */
export function validateConfig(config) {
    const out = deepClone(config);

    if (!out.DROWSINESS) out.DROWSINESS = deepClone(DEFAULT_CONFIG.DROWSINESS);
    out.DROWSINESS.EYE_CLOSURE_CAUTION_MS = Math.max(500, Math.min(10000, Number(out.DROWSINESS.EYE_CLOSURE_CAUTION_MS) || 1500));
    out.DROWSINESS.EYE_CLOSURE_HIGH_MS = Math.max(out.DROWSINESS.EYE_CLOSURE_CAUTION_MS + 500, Math.min(15000, Number(out.DROWSINESS.EYE_CLOSURE_HIGH_MS) || 3000));
    out.DROWSINESS.EYE_CLOSURE_PERSISTENT_MS = Math.max(out.DROWSINESS.EYE_CLOSURE_HIGH_MS + 1000, Math.min(25000, Number(out.DROWSINESS.EYE_CLOSURE_PERSISTENT_MS) || 5000));
    out.DROWSINESS.BLINK_BLENDSHAPE_THRESHOLD = Math.max(0.1, Math.min(0.9, Number(out.DROWSINESS.BLINK_BLENDSHAPE_THRESHOLD) || 0.35));
    out.DROWSINESS.EAR_THRESHOLD = Math.max(0.1, Math.min(0.4, Number(out.DROWSINESS.EAR_THRESHOLD) || 0.21));

    if (!out.BLINK) out.BLINK = deepClone(DEFAULT_CONFIG.BLINK);
    out.BLINK.LONG_BLINK_THRESHOLD_MS = Math.max(200, Math.min(1500, Number(out.BLINK.LONG_BLINK_THRESHOLD_MS) || 400));
    out.BLINK.FREQUENCY_WINDOW_MS = Math.max(10000, Math.min(180000, Number(out.BLINK.FREQUENCY_WINDOW_MS) || 60000));

    if (!out.HEAD_POSE) out.HEAD_POSE = deepClone(DEFAULT_CONFIG.HEAD_POSE);
    out.HEAD_POSE.NOD_PITCH_THRESHOLD_DEG = Math.min(-5, Math.max(-45, Number(out.HEAD_POSE.NOD_PITCH_THRESHOLD_DEG) || -14));
    out.HEAD_POSE.NOD_DURATION_MS = Math.max(500, Math.min(5000, Number(out.HEAD_POSE.NOD_DURATION_MS) || 1600));

    if (!out.MOTION) out.MOTION = deepClone(DEFAULT_CONFIG.MOTION);
    out.MOTION.MOTION_MAGNITUDE_THRESHOLD = Math.max(0.5, Math.min(20, Number(out.MOTION.MOTION_MAGNITUDE_THRESHOLD) || 3.5));
    out.MOTION.CONSECUTIVE_FRAMES_WARNING = Math.max(2, Math.min(15, Number(out.MOTION.CONSECUTIVE_FRAMES_WARNING) || 4));

    if (!out.ALERTS) out.ALERTS = deepClone(DEFAULT_CONFIG.ALERTS);
    out.ALERTS.COOLDOWN_MS = Math.max(1000, Math.min(30000, Number(out.ALERTS.COOLDOWN_MS) || 5000));
    out.ALERTS.AUDIO_ENABLED = Boolean(out.ALERTS.AUDIO_ENABLED);
    out.ALERTS.SHOW_LANDMARK_OVERLAY = Boolean(out.ALERTS.SHOW_LANDMARK_OVERLAY);

    if (!out.EMAIL) out.EMAIL = deepClone(DEFAULT_CONFIG.EMAIL);
    out.EMAIL.ENABLED = Boolean(out.EMAIL.ENABLED !== false);
    out.EMAIL.ESCALATION_THRESHOLD_SEC = Math.max(5, Math.min(300, Number(out.EMAIL.ESCALATION_THRESHOLD_SEC) || 30));
    out.EMAIL.COOLDOWN_MS = Math.max(10000, Math.min(600000, Number(out.EMAIL.COOLDOWN_MS) || 60000));
    out.EMAIL.RECIPIENT_EMAIL = String(out.EMAIL.RECIPIENT_EMAIL || '').trim();
    out.EMAIL.SEND_SESSION_SUMMARY = Boolean(out.EMAIL.SEND_SESSION_SUMMARY);
    out.EMAIL.API_BASE_URL = String(out.EMAIL.API_BASE_URL || '/api').trim();

    return out;
}

// Initial load
loadConfig();
