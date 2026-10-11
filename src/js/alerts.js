// alerts.js - Legacy entrypoint proxying to safety/alertManager.js and utils/audio.js
export * from './safety/alertManager.js';
import { isMuted, setMuted, resetAlertManager } from './safety/alertManager.js';

export const activeAlerts = {
    drowsiness: false,
    shaking: false
};

export function initAlerts(alertContainerId, muteBtnId) {
    const muteBtn = document.getElementById(muteBtnId);
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            const current = !isMuted();
            setMuted(current);
            muteBtn.innerText = current ? "Unmute Alarm" : "Mute Alarm";
        });
    }
}

export function setDrowsinessAlert(isActive) {
    activeAlerts.drowsiness = isActive;
}

export function setShakingAlert(isActive) {
    activeAlerts.shaking = isActive;
}

export function resetAllAlerts() {
    activeAlerts.drowsiness = false;
    activeAlerts.shaking = false;
    resetAlertManager();
}
