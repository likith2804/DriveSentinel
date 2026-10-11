import { CONFIG, DEFAULT_CONFIG, saveConfig, resetConfigToDefaults } from '../config.js';
import { testAlarmSound } from '../utils/audio.js';
import { checkEmailServiceStatus, sendTestEmail } from '../services/emailService.js';

let containerEl = null;

export function initSettingsUI(container) {
    containerEl = container;
}

/**
 * Renders settings form with current values
 */
export function renderSettingsView() {
    if (!containerEl) return;

    containerEl.innerHTML = `
        <div class="panel-section-header">
            <div>
                <h2>System Settings & Calibration</h2>
                <p class="section-subtitle">Adjust detection sensitivity, alert timings, and hardware preferences</p>
            </div>
            <div class="actions-group">
                <button id="btnRestoreDefaults" class="btn btn-secondary btn-sm">Restore Defaults</button>
            </div>
        </div>

        <form id="settingsForm" class="settings-form">
            <!-- Drowsiness Group -->
            <div class="settings-group">
                <h3 class="settings-group-title">Driver Fatigue & Eye-Closure Thresholds</h3>
                <div class="settings-grid">
                    <div class="form-field">
                        <label for="cfg_eyeCaution">Caution Threshold (seconds)</label>
                        <input type="number" step="0.1" min="0.5" max="5.0" id="cfg_eyeCaution" value="${(CONFIG.DROWSINESS.EYE_CLOSURE_CAUTION_MS / 1000).toFixed(1)}" />
                        <span class="field-hint">Continuous eye closure duration before triggering Level 1 Caution.</span>
                    </div>

                    <div class="form-field">
                        <label for="cfg_eyeHigh">High Concern Threshold (seconds)</label>
                        <input type="number" step="0.1" min="1.5" max="10.0" id="cfg_eyeHigh" value="${(CONFIG.DROWSINESS.EYE_CLOSURE_HIGH_MS / 1000).toFixed(1)}" />
                        <span class="field-hint">Continuous closure duration triggering Level 2 Alarm Siren.</span>
                    </div>

                    <div class="form-field">
                        <label for="cfg_eyePersistent">Persistent Concern Threshold (seconds)</label>
                        <input type="number" step="0.1" min="2.5" max="15.0" id="cfg_eyePersistent" value="${(CONFIG.DROWSINESS.EYE_CLOSURE_PERSISTENT_MS / 1000).toFixed(1)}" />
                        <span class="field-hint">Continuous closure duration triggering Level 3 Persistent Emergency Siren.</span>
                    </div>

                    <div class="form-field">
                        <label for="cfg_ear">Eye Aspect Ratio (EAR) Threshold</label>
                        <input type="number" step="0.01" min="0.12" max="0.35" id="cfg_ear" value="${CONFIG.DROWSINESS.EAR_THRESHOLD}" />
                        <span class="field-hint">Geometric threshold below which eyelid aperture is considered closed (0.18 - 0.25).</span>
                    </div>

                    <div class="form-field">
                        <label for="cfg_longBlink">Long Blink Threshold (ms)</label>
                        <input type="number" step="10" min="200" max="1000" id="cfg_longBlink" value="${CONFIG.BLINK.LONG_BLINK_THRESHOLD_MS}" />
                        <span class="field-hint">Duration beyond ordinary blinks flagging drowsiness precursor (> 400ms).</span>
                    </div>
                </div>
            </div>

            <!-- Head Pose Group -->
            <div class="settings-group">
                <h3 class="settings-group-title">Head Pose & Nodding Detection</h3>
                <div class="settings-grid">
                    <div class="form-field">
                        <label for="cfg_nodPitch">Downward Pitch Threshold (degrees)</label>
                        <input type="number" step="1" min="-35" max="-5" id="cfg_nodPitch" value="${CONFIG.HEAD_POSE.NOD_PITCH_THRESHOLD_DEG}" />
                        <span class="field-hint">Negative vertical head tilt indicating head nodding / bowing toward chest.</span>
                    </div>

                    <div class="form-field">
                        <label for="cfg_nodDuration">Sustained Nod Duration (seconds)</label>
                        <input type="number" step="0.1" min="0.5" max="4.0" id="cfg_nodDuration" value="${(CONFIG.HEAD_POSE.NOD_DURATION_MS / 1000).toFixed(1)}" />
                        <span class="field-hint">Minimum duration head must remain bowed to confirm nod event.</span>
                    </div>
                </div>
            </div>

            <!-- Motion Group -->
            <div class="settings-group">
                <h3 class="settings-group-title">Motion Analysis (OpenCV.js)</h3>
                <div class="settings-grid">
                    <div class="form-field">
                        <label for="cfg_motionSensitivity">Motion Magnitude Threshold (pixels)</label>
                        <input type="number" step="0.5" min="1.0" max="15.0" id="cfg_motionSensitivity" value="${CONFIG.MOTION.MOTION_MAGNITUDE_THRESHOLD}" />
                        <span class="field-hint">Optical flow vector magnitude required to trigger camera instability alert.</span>
                    </div>

                    <div class="form-field">
                        <label for="cfg_consecutiveFrames">Required Consecutive Frames</label>
                        <input type="number" step="1" min="2" max="10" id="cfg_consecutiveFrames" value="${CONFIG.MOTION.CONSECUTIVE_FRAMES_WARNING}" />
                        <span class="field-hint">Consecutive frames above threshold before raising alert.</span>
                    </div>
                </div>
            </div>

            <!-- Alerts & Hardware Group -->
            <div class="settings-group">
                <h3 class="settings-group-title">Alert Management & Audio Synthesizer</h3>
                <div class="settings-grid">
                    <div class="form-field">
                        <label for="cfg_cooldown">Alert Audio Cooldown (seconds)</label>
                        <input type="number" step="1" min="2" max="20" id="cfg_cooldown" value="${CONFIG.ALERTS.COOLDOWN_MS / 1000}" />
                        <span class="field-hint">Minimum quiet period between recurring alarm triggers.</span>
                    </div>

                    <div class="form-field form-field-checkbox">
                        <label>
                            <input type="checkbox" id="cfg_audioEnabled" ${CONFIG.ALERTS.AUDIO_ENABLED ? 'checked' : ''} />
                            Enable Multi-Tone Synthesized Audio Alarms
                        </label>
                        <span class="field-hint">Allows browser Web Audio API siren and chime playback.</span>
                    </div>

                    <div class="form-field form-field-checkbox">
                        <label>
                            <input type="checkbox" id="cfg_showOverlay" ${CONFIG.ALERTS.SHOW_LANDMARK_OVERLAY ? 'checked' : ''} />
                            Show Facial Landmark Mesh Overlay on Live Camera
                        </label>
                        <span class="field-hint">Displays real-time eye contours and orientation crosshair.</span>
                    </div>

                    <div class="form-field">
                        <label>Audio Verification Test</label>
                        <div class="inline-buttons">
                            <button type="button" id="btnTestSoundHigh" class="btn btn-secondary btn-sm">Test High Alarm</button>
                            <button type="button" id="btnTestSoundPersistent" class="btn btn-danger btn-sm">Test Persistent Alarm</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Email Notifications Group -->
            <div class="settings-group">
                <h3 class="settings-group-title">Authorized Contact & Free Email Escalation</h3>
                <p class="section-subtitle" style="margin-top: -8px; margin-bottom: 16px; font-size: 13px; color: #64748b;">
                    Configures automated emergency alerts when high-risk drowsiness persists continuously for the 30-second escalation threshold. Uses free Gmail SMTP with an App Password stored exclusively in the backend <code>.env</code> file.
                </p>
                <div class="settings-grid">
                    <div class="form-field">
                        <label for="cfg_emailRecipient">Authorized Recipient Email Address</label>
                        <input type="email" id="cfg_emailRecipient" placeholder="e.g. emergency-contact@example.com" value="${CONFIG.EMAIL?.RECIPIENT_EMAIL || ''}" />
                        <span class="field-hint">Designated emergency contact who receives alerts when critical fatigue persists.</span>
                    </div>

                    <div class="form-field">
                        <label for="cfg_emailThreshold">Escalation Threshold (seconds)</label>
                        <input type="number" step="1" min="5" max="120" id="cfg_emailThreshold" value="${CONFIG.EMAIL?.ESCALATION_THRESHOLD_SEC || 30}" />
                        <span class="field-hint">Continuous high-risk duration required to trigger automated emergency email (default: 30s).</span>
                    </div>

                    <div class="form-field">
                        <label for="cfg_emailCooldown">Email Notification Cooldown (seconds)</label>
                        <input type="number" step="5" min="15" max="300" id="cfg_emailCooldown" value="${(CONFIG.EMAIL?.COOLDOWN_MS || 60000) / 1000}" />
                        <span class="field-hint">Minimum interval between emails to prevent spamming the recipient.</span>
                    </div>

                    <div class="form-field form-field-checkbox">
                        <label>
                            <input type="checkbox" id="cfg_emailEnabled" ${CONFIG.EMAIL?.ENABLED !== false ? 'checked' : ''} />
                            Enable Automated Email Escalation (Gmail SMTP)
                        </label>
                        <span class="field-hint">Dispatches emergency notification if sustained closure reaches escalation threshold.</span>
                    </div>

                    <div class="form-field form-field-checkbox">
                        <label>
                            <input type="checkbox" id="cfg_emailSendSummary" ${CONFIG.EMAIL?.SEND_SESSION_SUMMARY ? 'checked' : ''} />
                            Send Session Summary Email with CSV on Stop
                        </label>
                        <span class="field-hint">Automatically emails complete session incident metrics and CSV attachment when monitoring stops.</span>
                    </div>

                    <!-- Email Backend Status & Live Test Panel -->
                    <div class="form-field" style="grid-column: 1 / -1;">
                        <label>Email Service Connection & Delivery Verification</label>
                        <div class="backend-status-card" id="emailBackendStatusCard" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-top: 6px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span id="backendStatusBadge" class="badge badge-neutral">Checking backend...</span>
                                <button type="button" id="btnRefreshEmailStatus" class="btn btn-secondary btn-sm">Refresh Status</button>
                            </div>
                            <p id="backendStatusDescription" style="font-size: 13px; color: #475569; margin: 4px 0 10px;">
                                Connecting to local Node.js email service...
                            </p>
                            <div class="inline-buttons" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                <button type="button" id="btnSendTestEmail" class="btn btn-secondary btn-sm">Send Test Email</button>
                                <span id="testEmailFeedback" class="test-feedback-text" style="font-size: 12px; color: #64748b;"></span>
                            </div>
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #64748b;">
                                <strong>Delivery Status Notice:</strong> Delivery verification accurately distinguishes <em>SMTP acceptance</em> (queued by mail server) from confirmed recipient inbox receipt. Passwords and credentials are never stored in the browser.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="settingsFeedback" class="settings-feedback hidden"></div>

            <div class="form-actions-bar">
                <button type="submit" class="btn btn-primary">Save Changes</button>
                <button type="button" id="btnCancelSettings" class="btn btn-secondary">Cancel</button>
            </div>
        </form>
    `;

    bindSettingsEvents();
}

function bindSettingsEvents() {
    const form = document.getElementById('settingsForm');
    const feedback = document.getElementById('settingsFeedback');

    document.getElementById('btnTestSoundHigh').addEventListener('click', () => {
        testAlarmSound('high');
    });

    document.getElementById('btnTestSoundPersistent').addEventListener('click', () => {
        testAlarmSound('persistent');
    });

    document.getElementById('btnRestoreDefaults').addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Restore all thresholds and preferences to factory defaults?')) {
            resetConfigToDefaults();
            renderSettingsView();
            showFeedback('Defaults restored successfully.', 'success');
        }
    });

    document.getElementById('btnCancelSettings').addEventListener('click', () => {
        renderSettingsView();
        showFeedback('Changes discarded.', 'info');
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        try {
            const eyeCautionSec = parseFloat(document.getElementById('cfg_eyeCaution').value);
            const eyeHighSec = parseFloat(document.getElementById('cfg_eyeHigh').value);
            const eyePersistentSec = parseFloat(document.getElementById('cfg_eyePersistent').value);

            if (eyeCautionSec >= eyeHighSec) {
                showFeedback('Caution threshold must be less than High Concern threshold.', 'error');
                return;
            }

            if (eyeHighSec >= eyePersistentSec) {
                showFeedback('High Concern threshold must be less than Persistent Concern threshold.', 'error');
                return;
            }

            const updated = {
                DROWSINESS: {
                    ...CONFIG.DROWSINESS,
                    EYE_CLOSURE_CAUTION_MS: eyeCautionSec * 1000,
                    EYE_CLOSURE_HIGH_MS: eyeHighSec * 1000,
                    EYE_CLOSURE_PERSISTENT_MS: eyePersistentSec * 1000,
                    EAR_THRESHOLD: parseFloat(document.getElementById('cfg_ear').value)
                },
                BLINK: {
                    ...CONFIG.BLINK,
                    LONG_BLINK_THRESHOLD_MS: parseInt(document.getElementById('cfg_longBlink').value, 10)
                },
                HEAD_POSE: {
                    ...CONFIG.HEAD_POSE,
                    NOD_PITCH_THRESHOLD_DEG: parseFloat(document.getElementById('cfg_nodPitch').value),
                    NOD_DURATION_MS: parseFloat(document.getElementById('cfg_nodDuration').value) * 1000
                },
                MOTION: {
                    ...CONFIG.MOTION,
                    MOTION_MAGNITUDE_THRESHOLD: parseFloat(document.getElementById('cfg_motionSensitivity').value),
                    CONSECUTIVE_FRAMES_WARNING: parseInt(document.getElementById('cfg_consecutiveFrames').value, 10)
                },
                ALERTS: {
                    ...CONFIG.ALERTS,
                    COOLDOWN_MS: parseFloat(document.getElementById('cfg_cooldown').value) * 1000,
                    AUDIO_ENABLED: document.getElementById('cfg_audioEnabled').checked,
                    SHOW_LANDMARK_OVERLAY: document.getElementById('cfg_showOverlay').checked
                },
                EMAIL: {
                    ...CONFIG.EMAIL,
                    ENABLED: document.getElementById('cfg_emailEnabled').checked,
                    RECIPIENT_EMAIL: document.getElementById('cfg_emailRecipient').value.trim(),
                    ESCALATION_THRESHOLD_SEC: Math.max(5, Math.min(120, parseFloat(document.getElementById('cfg_emailThreshold').value) || 30)),
                    COOLDOWN_MS: Math.max(15000, Math.min(300000, parseFloat(document.getElementById('cfg_emailCooldown').value) * 1000 || 60000)),
                    SEND_SESSION_SUMMARY: document.getElementById('cfg_emailSendSummary').checked
                }
            };

            // Validate email format if provided
            const emailInput = updated.EMAIL.RECIPIENT_EMAIL;
            if (emailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
                showFeedback('Please enter a valid email address (e.g. name@example.com).', 'error');
                return;
            }

            saveConfig(updated);
            showFeedback('Settings saved successfully and applied to monitoring pipeline.', 'success');
        } catch (err) {
            showFeedback(`Error validating settings: ${err.message}`, 'error');
        }
    });

    // Email backend connection status updater
    const statusBadge = document.getElementById('backendStatusBadge');
    const statusDesc = document.getElementById('backendStatusDescription');
    const testBtn = document.getElementById('btnSendTestEmail');
    const testFeedback = document.getElementById('testEmailFeedback');
    const refreshBtn = document.getElementById('btnRefreshEmailStatus');

    async function refreshEmailStatusDisplay(force = false) {
        if (!statusBadge || !statusDesc) return;
        statusBadge.textContent = 'Checking...';
        statusBadge.className = 'badge badge-neutral';

        const status = await checkEmailServiceStatus(force);
        if (!status.isAvailable) {
            statusBadge.textContent = 'Backend Offline';
            statusBadge.className = 'badge badge-neutral';
            statusDesc.textContent = 'Email server is offline (node server/index.js). Local AI detection and alarms remain 100% active.';
        } else if (status.mockMode) {
            statusBadge.textContent = 'Mock Email Mode Active';
            statusBadge.className = 'badge badge-warning';
            statusDesc.textContent = 'Mock Mode active (MOCK_EMAIL=true). Escalation alerts are simulated in-memory without contacting external servers.';
        } else if (status.isConfigured && status.smtpVerified) {
            statusBadge.textContent = 'Gmail SMTP Ready';
            statusBadge.className = 'badge badge-success';
            statusDesc.textContent = `Authenticated with Gmail SMTP. Sender: ${status.senderEmail || 'Authorized Sender'}. Ready to deliver escalations.`;
        } else if (status.isConfigured && !status.smtpVerified) {
            statusBadge.textContent = 'SMTP Auth Issue';
            statusBadge.className = 'badge badge-danger';
            statusDesc.textContent = `Gmail connection failed: ${status.message || 'Check App Password in .env'}. Local alarms remain active.`;
        } else {
            statusBadge.textContent = 'Credentials Required';
            statusBadge.className = 'badge badge-warning';
            statusDesc.textContent = 'Backend running, but Gmail App Password is not yet set in .env. Local alarms active.';
        }
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => refreshEmailStatusDisplay(true));
    }

    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            const recipient = document.getElementById('cfg_emailRecipient').value.trim();
            if (!recipient) {
                if (testFeedback) {
                    testFeedback.textContent = '⚠️ Please enter an authorized recipient email above.';
                    testFeedback.style.color = '#dc2626';
                }
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
                if (testFeedback) {
                    testFeedback.textContent = '⚠️ Please enter a valid email format (e.g. name@domain.com).';
                    testFeedback.style.color = '#dc2626';
                }
                return;
            }

            testBtn.disabled = true;
            if (testFeedback) {
                testFeedback.textContent = '⏳ Dispatching test email...';
                testFeedback.style.color = '#0284c7';
            }

            try {
                const res = await sendTestEmail(recipient);
                if (res.success) {
                    if (res.mock) {
                        testFeedback.textContent = '✅ [Mock Mode] Simulated email accepted locally.';
                        testFeedback.style.color = '#16a34a';
                    } else {
                        testFeedback.textContent = '✅ Accepted by SMTP Server (Queued for Delivery)';
                        testFeedback.style.color = '#16a34a';
                    }
                } else {
                    testFeedback.textContent = `❌ ${res.error || 'Failed to dispatch'}`;
                    testFeedback.style.color = '#dc2626';
                }
            } catch (err) {
                testFeedback.textContent = `❌ ${err.message}`;
                testFeedback.style.color = '#dc2626';
            } finally {
                testBtn.disabled = false;
            }
        });
    }

    // Initial check
    refreshEmailStatusDisplay(false);

    function showFeedback(msg, type) {
        if (!feedback) return;
        feedback.textContent = msg;
        feedback.className = `settings-feedback feedback-${type}`;
        feedback.classList.remove('hidden');
        setTimeout(() => {
            feedback.classList.add('hidden');
        }, 4000);
    }
}
