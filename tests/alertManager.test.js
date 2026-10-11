import { describe, it, expect, beforeEach } from 'vitest';
import { processAlertState, resetAlertManager, getAlertState, dismissActiveBanner, isMuted, setMuted } from '../src/js/safety/alertManager.js';
import { WarningLevel } from '../src/js/safety/riskAssessment.js';

describe('Alert Manager, Escalation, and Audio Logic', () => {
    beforeEach(() => {
        resetAlertManager();
        setMuted(false);
    });

    it('processes caution alert state properly without triggering full siren', () => {
        const assessment = {
            level: WarningLevel.CAUTION,
            levelName: 'Caution',
            contributingFactors: ['Prolonged eye closure'],
            recommendation: 'Stay alert'
        };

        const state = processAlertState(assessment, 1000);
        expect(state.level).toBe(WarningLevel.CAUTION);
        expect(state.levelName).toBe('Caution');
        expect(state.isAlarmPlaying).toBe(false); // Caution uses chime, not continuous siren
    });

    it('manages mute states independently of visual alerts', () => {
        setMuted(true);
        expect(isMuted()).toBe(true);

        const highAssessment = {
            level: WarningLevel.HIGH_CONCERN,
            levelName: 'High Concern',
            contributingFactors: ['Sustained closure'],
            recommendation: 'Prepare to stop'
        };

        const state = processAlertState(highAssessment, 2000);
        expect(state.level).toBe(WarningLevel.HIGH_CONCERN);
        expect(state.isAudioMuted).toBe(true);
        expect(state.isAlarmPlaying).toBe(false); // Muted suppresses audio playback
    });

    it('dismisses banner without clearing underlying detector state', () => {
        const highAssessment = {
            level: WarningLevel.HIGH_CONCERN,
            levelName: 'High Concern',
            contributingFactors: ['Sustained closure'],
            recommendation: 'Prepare to stop'
        };

        processAlertState(highAssessment, 3000);
        dismissActiveBanner();

        const state = getAlertState();
        expect(state.level).toBe(WarningLevel.HIGH_CONCERN); // Condition remains active
        expect(state.dismissed).toBe(true);                  // Banner is dismissed
    });
});
