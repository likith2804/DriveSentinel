import { describe, it, expect, beforeEach } from 'vitest';
import { CONFIG, DEFAULT_CONFIG, validateConfig, resetConfigToDefaults, saveConfig } from '../src/js/config.js';

describe('Configuration & Threshold Validation', () => {
    beforeEach(() => {
        resetConfigToDefaults();
    });

    it('loads documented default thresholds correctly', () => {
        expect(CONFIG.DROWSINESS.EYE_CLOSURE_CAUTION_MS).toBe(1500);
        expect(CONFIG.DROWSINESS.EYE_CLOSURE_HIGH_MS).toBe(3000);
        expect(CONFIG.DROWSINESS.EYE_CLOSURE_PERSISTENT_MS).toBe(5000);
        expect(CONFIG.BLINK.LONG_BLINK_THRESHOLD_MS).toBe(400);
        expect(CONFIG.HEAD_POSE.NOD_PITCH_THRESHOLD_DEG).toBe(-14);
        expect(CONFIG.MOTION.MOTION_MAGNITUDE_THRESHOLD).toBe(3.5);
    });

    it('validates and clamps custom config out-of-bounds numbers', () => {
        const invalidConfig = {
            DROWSINESS: {
                EYE_CLOSURE_CAUTION_MS: 100, // Too low, should clamp to 500
                EYE_CLOSURE_HIGH_MS: 200,    // Less than caution, should clamp to caution + 500
                EYE_CLOSURE_PERSISTENT_MS: 400
            },
            BLINK: {
                LONG_BLINK_THRESHOLD_MS: 50 // Too low, should clamp to 200
            }
        };

        const validated = validateConfig(invalidConfig);
        expect(validated.DROWSINESS.EYE_CLOSURE_CAUTION_MS).toBe(500);
        expect(validated.DROWSINESS.EYE_CLOSURE_HIGH_MS).toBe(1000);
        expect(validated.DROWSINESS.EYE_CLOSURE_PERSISTENT_MS).toBe(2000);
        expect(validated.BLINK.LONG_BLINK_THRESHOLD_MS).toBe(200);
    });

    it('resets configuration back to defaults properly', () => {
        saveConfig({
            ...CONFIG,
            DROWSINESS: { ...CONFIG.DROWSINESS, EYE_CLOSURE_CAUTION_MS: 2200 }
        });
        expect(CONFIG.DROWSINESS.EYE_CLOSURE_CAUTION_MS).toBe(2200);

        resetConfigToDefaults();
        expect(CONFIG.DROWSINESS.EYE_CLOSURE_CAUTION_MS).toBe(1500);
    });
});
