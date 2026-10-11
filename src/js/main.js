// main.js - Central Application Controller, Detection Loop, and View Routing
import { CONFIG, loadConfig } from './config.js';
import { initCamera, startCamera, stopCamera, cameraState } from './camera.js';
import { initFaceLandmarker, isLandmarkerReady, detectFace, renderLandmarkOverlay } from './vision/faceLandmarker.js';
import { evaluateEyeClosure, resetDrowsinessState } from './vision/drowsiness.js';
import { processBlinkFrame, resetBlinkAnalysis } from './vision/blinkAnalysis.js';
import { evaluateHeadPose, resetHeadPoseState } from './vision/headPose.js';
import { initOpenCv, analyzeMotion, resetMotionState } from './vision/motionAnalysis.js';
import { assessDriverRisk, WarningLevel } from './safety/riskAssessment.js';
import { processAlertState, resetAlertManager, dismissActiveBanner, isMuted, setMuted } from './safety/alertManager.js';
import { processEscalation, resetEscalationManager, getEscalationState } from './safety/escalationManager.js';
import { checkEmailServiceStatus, sendSessionSummaryEmail } from './services/emailService.js';
import { logSafetyEvent, clearOngoingEvent, getSessionEvents } from './safety/eventManager.js';
import { startNewSession, finalizeCurrentSession, resetCurrentSession, recordSessionStat, updateMaxSeverity, updateBlinkStats, isMonitoringSessionActive, getSessionStats } from './sessions/sessionManager.js';
import { initDashboardUI, updateLiveTelemetry, renderActiveAlertBanner, renderEventTimeline } from './ui/dashboard.js';
import { initHistoryUI, renderHistoryView } from './ui/history.js';
import { initAnalyticsUI, renderAnalyticsView } from './ui/analytics.js';
import { initSettingsUI, renderSettingsView } from './ui/settings.js';
import { initAboutUI, renderAboutView } from './ui/about.js';
import { formatDuration } from './utils/time.js';

// DOM Element Registry
const dom = {
    // Navigation
    navLinks: document.querySelectorAll('.nav-tab'),
    views: {
        dashboard: document.getElementById('view-dashboard'),
        history: document.getElementById('view-history'),
        analytics: document.getElementById('view-analytics'),
        settings: document.getElementById('view-settings'),
        about: document.getElementById('view-about')
    },

    // Header Telemetry
    headerSessionDuration: document.getElementById('headerSessionDuration'),
    headerMonitoringStatus: document.getElementById('headerMonitoringStatus'),
    headerEmailStatus: document.getElementById('headerEmailStatus'),

    // Camera & Canvas
    video: document.getElementById('webcamView'),
    overlayCanvas: document.getElementById('overlayCanvas'),
    hiddenCanvas: document.getElementById('processingCanvas'),
    videoError: document.getElementById('videoErrorMessage'),
    fpsCounter: document.getElementById('fpsCounter'),
    faceTrackingBadge: document.getElementById('faceTrackingBadge'),

    // Primary Controls
    btnStart: document.getElementById('btnStart'),
    btnStop: document.getElementById('btnStop'),
    btnReset: document.getElementById('btnReset'),
    btnMuteToggle: document.getElementById('btnMuteToggle'),
    btnToggleOverlay: document.getElementById('btnToggleOverlay'),

    // Dashboard Telemetry
    statusOverall: document.getElementById('statusOverall'),
    riskScoreDisplay: document.getElementById('riskScoreDisplay'),
    contributingFactorsList: document.getElementById('contributingFactorsList'),
    closureTimer: document.getElementById('closureTimer'),
    statusDrowsiness: document.getElementById('statusDrowsiness'),
    earLeft: document.getElementById('earLeft'),
    earRight: document.getElementById('earRight'),
    blinkCount: document.getElementById('blinkCount'),
    longBlinkCount: document.getElementById('longBlinkCount'),
    blinkRate: document.getElementById('blinkRate'),
    headPoseStatus: document.getElementById('headPoseStatus'),
    poseAngles: document.getElementById('poseAngles'),
    nodEventsCount: document.getElementById('nodEventsCount'),
    statusShaking: document.getElementById('statusShaking'),
    motionIntensity: document.getElementById('motionIntensity'),
    motionProgressBar: document.getElementById('motionProgressBar'),

    // Summary Counters
    statSustainedClosures: document.getElementById('statSustainedClosures'),
    statLongBlinks: document.getElementById('statLongBlinks'),
    statHeadNods: document.getElementById('statHeadNods'),
    statTrackingLoss: document.getElementById('statTrackingLoss'),

    // Alerts & Timeline
    alertContainer: document.getElementById('alertContainer'),
    eventTimelineList: document.getElementById('eventTimelineList'),
    filterCategory: document.getElementById('filterCategory'),
    filterSeverity: document.getElementById('filterSeverity')
};

let animationFrameId = null;
let lastMotionTimestamp = 0;
let sessionTimerIntervalId = null;
let activeSessionStartTime = 0;
let consecutiveHighDuration = 0;
let isLandmarkOverlayEnabled = true;

// FPS tracking
let lastFpsCalcTime = 0;
let frameCounter = 0;
let currentFps = 0;

/**
 * Initializes Application Modules and Services
 */
async function initializeApp() {
    loadConfig();
    isLandmarkOverlayEnabled = CONFIG.ALERTS.SHOW_LANDMARK_OVERLAY;

    // Initialize UI subsystems
    initDashboardUI({
        statusOverall: dom.statusOverall,
        riskScoreDisplay: dom.riskScoreDisplay,
        contributingFactorsList: dom.contributingFactorsList,
        closureTimer: dom.closureTimer,
        earLeft: dom.earLeft,
        earRight: dom.earRight,
        statusDrowsiness: dom.statusDrowsiness,
        blinkCount: dom.blinkCount,
        longBlinkCount: dom.longBlinkCount,
        blinkRate: dom.blinkRate,
        headPoseStatus: dom.headPoseStatus,
        poseAngles: dom.poseAngles,
        nodEventsCount: dom.nodEventsCount,
        statusShaking: dom.statusShaking,
        motionIntensity: dom.motionIntensity,
        motionProgressBar: dom.motionProgressBar,
        statSustainedClosures: dom.statSustainedClosures,
        statLongBlinks: dom.statLongBlinks,
        statHeadNods: dom.statHeadNods,
        statTrackingLoss: dom.statTrackingLoss,
        alertContainer: dom.alertContainer,
        eventTimelineList: dom.eventTimelineList,
        filterCategory: dom.filterCategory,
        filterSeverity: dom.filterSeverity,
        onFilterChange: refreshTimeline
    });

    initHistoryUI(dom.views.history);
    initAnalyticsUI(dom.views.analytics);
    initSettingsUI(dom.views.settings);
    initAboutUI(dom.views.about);

    setupNavigation();
    bindControls();

    // Prepare hidden canvas
    if (dom.hiddenCanvas) {
        dom.hiddenCanvas.width = CONFIG.MOTION.RESOLUTION_W;
        dom.hiddenCanvas.height = CONFIG.MOTION.RESOLUTION_H;
    }

    initCamera(dom.video);
    initOpenCv();

    updateSystemHeaderStatus('Initializing AI Models...', 'warning');
    dom.btnStart.disabled = true;

    try {
        await initFaceLandmarker();
        updateSystemHeaderStatus('System Ready', 'neutral');
        dom.btnStart.disabled = false;
        console.log('Driver Safety System ready. MediaPipe initialized.');
    } catch (err) {
        console.error('Failed to load FaceLandmarker:', err);
        updateSystemHeaderStatus('AI Model Error', 'critical');
        showVideoErrorMessage('Failed to initialize local AI models. Check browser console.');
    }

    // Check email notification service status in background
    checkEmailServiceStatus().then(status => {
        if (!dom.headerEmailStatus) return;
        if (!status.isAvailable) {
            dom.headerEmailStatus.textContent = 'Local Only';
            dom.headerEmailStatus.className = 'badge badge-neutral';
            dom.headerEmailStatus.title = 'Backend offline. Local alarms active.';
        } else if (status.mockMode) {
            dom.headerEmailStatus.textContent = 'Mock Mode';
            dom.headerEmailStatus.className = 'badge badge-warning';
            dom.headerEmailStatus.title = 'Mock Email Mode active. Alerts simulated locally.';
        } else if (status.isConfigured && status.smtpVerified) {
            dom.headerEmailStatus.textContent = 'Gmail Ready';
            dom.headerEmailStatus.className = 'badge badge-success';
            dom.headerEmailStatus.title = 'Connected to Gmail SMTP relay.';
        } else {
            dom.headerEmailStatus.textContent = 'No Credentials';
            dom.headerEmailStatus.className = 'badge badge-warning';
            dom.headerEmailStatus.title = 'Configure App Password in backend .env';
        }
    }).catch(() => {
        if (dom.headerEmailStatus) {
            dom.headerEmailStatus.textContent = 'Local Only';
            dom.headerEmailStatus.className = 'badge badge-neutral';
        }
    });
}

/**
 * Main Frame Processing Loop
 */
function processFrame(time) {
    if (!cameraState.isActive) return;

    // Calculate FPS
    frameCounter++;
    if (time - lastFpsCalcTime >= 1000) {
        currentFps = Math.round((frameCounter * 1000) / (time - lastFpsCalcTime));
        frameCounter = 0;
        lastFpsCalcTime = time;
        if (dom.fpsCounter) dom.fpsCounter.textContent = `${currentFps} FPS`;
    }

    // Match overlay canvas size to video render size
    if (dom.overlayCanvas && dom.video.videoWidth > 0) {
        if (dom.overlayCanvas.width !== dom.video.videoWidth || dom.overlayCanvas.height !== dom.video.videoHeight) {
            dom.overlayCanvas.width = dom.video.videoWidth;
            dom.overlayCanvas.height = dom.video.videoHeight;
        }
    }

    // 1. Face Landmark Inference
    const detectionResult = detectFace(dom.video, time);

    // 2. Render Overlay if enabled
    if (isLandmarkOverlayEnabled && dom.overlayCanvas) {
        renderLandmarkOverlay(dom.overlayCanvas, detectionResult);
    } else if (dom.overlayCanvas) {
        const ctx = dom.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, dom.overlayCanvas.width, dom.overlayCanvas.height);
    }

    // 3. Eye Closure & EAR Evaluation
    const eyeData = evaluateEyeClosure(detectionResult, time);

    // 4. Blink State Machine
    const blinkData = processBlinkFrame(eyeData.areBothEyesClosed, time);
    if (blinkData) {
        updateBlinkStats({
            totalBlinks: blinkData.totalBlinks,
            averageBlinkDurationMs: blinkData.averageBlinkDurationMs
        });
    }

    // 5. Head Pose & Nodding Evaluation
    const headData = evaluateHeadPose(detectionResult, time);

    // Update tracking status badge
    if (dom.faceTrackingBadge) {
        dom.faceTrackingBadge.textContent = headData.trackingStatus;
        dom.faceTrackingBadge.className = `badge badge-${headData.faceDetected ? 'success' : 'warning'}`;
    }

    // 6. Camera Motion Analysis (throttled according to CONFIG)
    let motionData = {
        motionDetected: false,
        magnitude: 0,
        smoothedMagnitude: 0,
        status: 'Normal Stability'
    };
    if (time - lastMotionTimestamp >= CONFIG.MOTION.PROCESS_INTERVAL_MS) {
        motionData = analyzeMotion(dom.video, dom.hiddenCanvas, time);
        lastMotionTimestamp = time;
    }

    // 7. Safety Event Logging & Counters
    recordIncidentEvents(eyeData, blinkData, headData, motionData, time);

    // 8. Multi-Factor Risk Assessment
    const assessment = assessDriverRisk({
        eyeData,
        blinkData,
        headData,
        motionData,
        consecutiveHighConcernDurationMs: consecutiveHighDuration
    });

    if (assessment.level >= WarningLevel.HIGH_CONCERN) {
        consecutiveHighDuration += 16; // approx frame time
        updateMaxSeverity(assessment.level === WarningLevel.PERSISTENT_CONCERN ? 'persistent' : 'high');
    } else if (assessment.level === WarningLevel.CAUTION) {
        consecutiveHighDuration = 0;
        updateMaxSeverity('caution');
    } else {
        consecutiveHighDuration = 0;
    }

    // 9. Process Alerts and Sound Engine
    const alertState = processAlertState(assessment, time);
    renderActiveAlertBanner(alertState, () => dismissActiveBanner());

    // 10. Process Email Escalation (30s threshold, face validity check, email dispatch)
    processEscalation({ eyeData, headData, assessment, currentTime: time });

    // 10. Update Dashboard Telemetry
    const sessionDurationMs = activeSessionStartTime > 0 ? (Date.now() - activeSessionStartTime) : 0;
    updateLiveTelemetry({
        eyeData,
        blinkData,
        headData,
        motionData,
        assessment,
        sessionStats: getSessionStats(),
        sessionDurationMs
    });

    // 11. Refresh Timeline
    refreshTimeline();

    // Request Next Frame
    animationFrameId = requestAnimationFrame(processFrame);
}

/**
 * Handles safety event dispatching and deduplication
 */
function recordIncidentEvents(eyeData, blinkData, headData, motionData, time) {
    if (!isMonitoringSessionActive()) return;

    // Eye Closure event
    if (eyeData.areBothEyesClosed && eyeData.closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_HIGH_MS) {
        logSafetyEvent({
            category: 'drowsiness',
            severity: eyeData.closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_PERSISTENT_MS ? 'persistent' : 'high',
            title: 'Critical Eye Closure',
            explanation: `Eyes closed continuously for ${(eyeData.closureDurationMs / 1000).toFixed(1)}s`,
            isOngoing: true,
            durationMs: eyeData.closureDurationMs
        });
        recordSessionStat('sustained_closure');
    } else if (eyeData.areBothEyesClosed && eyeData.closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_CAUTION_MS) {
        logSafetyEvent({
            category: 'drowsiness',
            severity: 'caution',
            title: 'Prolonged Eye Closure',
            explanation: `Eyes closed for ${(eyeData.closureDurationMs / 1000).toFixed(1)}s`,
            isOngoing: true,
            durationMs: eyeData.closureDurationMs
        });
    } else {
        clearOngoingEvent('drowsiness');
    }

    // Long Blink event
    if (blinkData?.completedBlink?.isLong) {
        logSafetyEvent({
            category: 'blink',
            severity: 'caution',
            title: 'Long Blink Detected',
            explanation: `Blink duration reached ${blinkData.completedBlink.duration}ms (threshold: ${CONFIG.BLINK.LONG_BLINK_THRESHOLD_MS}ms)`,
            isOngoing: false,
            durationMs: blinkData.completedBlink.duration
        });
        recordSessionStat('long_blink');
    }

    // Head Nodding event
    if (headData.newNodCompleted) {
        logSafetyEvent({
            category: 'head_pose',
            severity: 'high',
            title: 'Head-Nodding Event',
            explanation: `Head dropped downward (${headData.pitch}°) confirming drowsiness nod`,
            isOngoing: false,
            durationMs: headData.nodDurationMs
        });
        recordSessionStat('head_nod');
    }

    // Tracking Loss event
    if (headData.triggeredTrackingLossEvent) {
        logSafetyEvent({
            category: 'tracking',
            severity: 'caution',
            title: 'Face Tracking Interrupted',
            explanation: 'Driver face is no longer detected in camera viewing angle',
            isOngoing: false
        });
        recordSessionStat('tracking_loss');
    }

    // Camera Motion event
    if (motionData.motionDetected) {
        logSafetyEvent({
            category: 'motion',
            severity: 'caution',
            title: 'Unusual Camera Motion',
            explanation: `Apparent camera movement detected (intensity: ${motionData.smoothedMagnitude.toFixed(1)}px)`,
            isOngoing: true
        });
        recordSessionStat('motion');
    } else {
        clearOngoingEvent('motion');
    }
}

/**
 * Event Listeners & Button Bindings
 */
function bindControls() {
    dom.btnStart.addEventListener('click', handleStartMonitoring);
    dom.btnStop.addEventListener('click', handleStopMonitoring);
    dom.btnReset.addEventListener('click', handleResetSession);
    dom.btnMuteToggle.addEventListener('click', handleToggleMute);
    dom.btnToggleOverlay.addEventListener('click', handleToggleOverlay);
}

async function handleStartMonitoring() {
    hideVideoErrorMessage();
    try {
        updateSystemHeaderStatus('Requesting Camera Access...', 'warning');
        await startCamera();

        dom.btnStart.disabled = true;
        dom.btnStop.disabled = false;

        // Reset states
        resetDrowsinessState();
        resetBlinkAnalysis();
        resetHeadPoseState();
        resetMotionState();
        resetAlertManager();
        resetEscalationManager();

        // Start session
        startNewSession();
        activeSessionStartTime = Date.now();
        startSessionDurationTimer();

        updateSystemHeaderStatus('Live Monitoring Active', 'success');
        if (dom.statusOverall) dom.statusOverall.textContent = 'Normal';

        // Start main loop
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(processFrame);
    } catch (err) {
        console.error('Failed to start monitoring:', err);
        updateSystemHeaderStatus('Camera Access Error', 'critical');
        showVideoErrorMessage(err.message || 'Unable to access camera.');
        dom.btnStart.disabled = false;
        dom.btnStop.disabled = true;
    }
}

async function handleStopMonitoring() {
    stopCamera();
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    stopSessionDurationTimer();
    resetAlertManager();
    resetEscalationManager();

    dom.btnStart.disabled = false;
    dom.btnStop.disabled = true;

    // Finalize and persist session to IndexedDB
    const finalized = await finalizeCurrentSession();

    // Optionally send session summary email if configured
    if (CONFIG.EMAIL?.SEND_SESSION_SUMMARY && finalized) {
        sendSessionSummaryEmail({
            sessionId: finalized.id,
            startTime: finalized.startTime,
            endTime: finalized.endTime,
            durationMs: finalized.durationMs,
            stats: finalized.stats,
            events: finalized.events,
            recipientEmail: CONFIG.EMAIL?.RECIPIENT_EMAIL
        }).then(res => {
            if (res.success) {
                console.log('Session summary email sent successfully:', res.messageId);
            } else {
                console.warn('Session summary email was not delivered:', res.error);
            }
        }).catch(err => {
            console.warn('Session summary email error:', err.message);
        });
    }

    updateSystemHeaderStatus('Monitoring Stopped', 'neutral');
    if (dom.statusOverall) {
        dom.statusOverall.textContent = 'Stopped';
        dom.statusOverall.className = 'badge badge-neutral';
    }
    if (dom.closureTimer) dom.closureTimer.textContent = '0.0';
    if (dom.faceTrackingBadge) {
        dom.faceTrackingBadge.textContent = 'Camera Off';
        dom.faceTrackingBadge.className = 'badge badge-neutral';
    }

    // Clean overlay canvas
    if (dom.overlayCanvas) {
        const ctx = dom.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, dom.overlayCanvas.width, dom.overlayCanvas.height);
    }

    refreshTimeline();
}

function handleResetSession() {
    resetDrowsinessState();
    resetBlinkAnalysis();
    resetHeadPoseState();
    resetMotionState();
    resetAlertManager();
    resetEscalationManager();
    resetCurrentSession();

    if (dom.closureTimer) dom.closureTimer.textContent = '0.0';
    refreshTimeline();
}

function handleToggleMute() {
    const muted = !isMuted();
    setMuted(muted);
    dom.btnMuteToggle.textContent = muted ? 'Unmute Audio' : 'Mute Audio';
    dom.btnMuteToggle.className = muted ? 'btn btn-danger btn-sm' : 'btn btn-secondary btn-sm';
}

function handleToggleOverlay() {
    isLandmarkOverlayEnabled = !isLandmarkOverlayEnabled;
    dom.btnToggleOverlay.textContent = isLandmarkOverlayEnabled ? 'Hide Landmarks' : 'Show Landmarks';
}

function startSessionDurationTimer() {
    if (sessionTimerIntervalId) clearInterval(sessionTimerIntervalId);
    sessionTimerIntervalId = setInterval(() => {
        if (!activeSessionStartTime) return;
        const elapsed = Date.now() - activeSessionStartTime;
        if (dom.headerSessionDuration) {
            dom.headerSessionDuration.textContent = formatDuration(elapsed);
        }
    }, 1000);
}

function stopSessionDurationTimer() {
    if (sessionTimerIntervalId) {
        clearInterval(sessionTimerIntervalId);
        sessionTimerIntervalId = null;
    }
}

function refreshTimeline() {
    const cat = dom.filterCategory ? dom.filterCategory.value : 'all';
    const sev = dom.filterSeverity ? dom.filterSeverity.value : 'all';
    const events = getSessionEvents({ category: cat, severity: sev });
    renderEventTimeline(events);
}

/**
 * View Navigation
 */
function setupNavigation() {
    dom.navLinks.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetView = tab.getAttribute('data-view');
            switchView(targetView);
        });
    });
}

function switchView(viewName) {
    // Update nav tabs
    dom.navLinks.forEach(tab => {
        if (tab.getAttribute('data-view') === viewName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Toggle views
    Object.keys(dom.views).forEach(key => {
        if (dom.views[key]) {
            if (key === viewName) {
                dom.views[key].classList.remove('hidden');
            } else {
                dom.views[key].classList.add('hidden');
            }
        }
    });

    // Render target view if required
    if (viewName === 'history') {
        renderHistoryView();
    } else if (viewName === 'analytics') {
        renderAnalyticsView();
    } else if (viewName === 'settings') {
        renderSettingsView();
    } else if (viewName === 'about') {
        renderAboutView();
    }
}

function updateSystemHeaderStatus(text, type) {
    if (dom.headerMonitoringStatus) {
        dom.headerMonitoringStatus.textContent = text;
        dom.headerMonitoringStatus.className = `badge badge-${type}`;
    }
}

function showVideoErrorMessage(msg) {
    if (dom.videoError) {
        dom.videoError.textContent = msg;
        dom.videoError.classList.remove('hidden');
    }
}

function hideVideoErrorMessage() {
    if (dom.videoError) {
        dom.videoError.classList.add('hidden');
    }
}

// Tab visibility management to handle background throttling and alarms
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (cameraState.isActive) {
            resetAlertManager();
            logSafetyEvent({
                category: 'system',
                severity: 'info',
                title: 'Tab Hidden',
                explanation: 'Browser tab minimized or moved to background'
            });
        }
    } else {
        if (cameraState.isActive) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(processFrame);
            logSafetyEvent({
                category: 'system',
                severity: 'info',
                title: 'Tab Visible',
                explanation: 'Browser tab restored to foreground'
            });
        }
    }
});

// Clean up camera hardware and audio nodes when user navigates away or closes tab
window.addEventListener('pagehide', () => {
    if (cameraState.isActive) {
        stopCamera();
    }
    resetAlertManager();
});

window.addEventListener('beforeunload', () => {
    if (cameraState.isActive) {
        stopCamera();
    }
    resetAlertManager();
});

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
