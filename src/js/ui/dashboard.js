import { CONFIG } from '../config.js';
import { formatSecondsDecimal, formatTimestamp } from '../utils/time.js';
import { getEscalationState } from '../safety/escalationManager.js';

let dom = {};

export function initDashboardUI(elements) {
    dom = { ...elements };
    initTimelineFilters();
}

/**
 * Updates telemetry cards and gauges on the dashboard
 */
export function updateLiveTelemetry({
    eyeData,
    blinkData,
    headData,
    motionData,
    assessment,
    sessionStats,
    sessionDurationMs
}) {
    // 1. Overall Status and Warning Level
    if (dom.statusOverall) {
        dom.statusOverall.textContent = assessment.levelName || 'Normal';
        dom.statusOverall.className = `badge badge-${getLevelCssClass(assessment.level)}`;
    }

    // 2. Risk Score & Contributing Indicators
    if (dom.riskScoreDisplay) {
        dom.riskScoreDisplay.textContent = `${assessment.score}%`;
        dom.riskScoreDisplay.className = `metric-value text-${getLevelCssClass(assessment.level)}`;
    }
    if (dom.contributingFactorsList) {
        if (assessment.contributingFactors.length > 0) {
            dom.contributingFactorsList.innerHTML = assessment.contributingFactors
                .map(f => `<span class="factor-tag">${escapeHtml(f)}</span>`)
                .join('');
        } else {
            dom.contributingFactorsList.innerHTML = '<span class="text-muted">No warning indicators active</span>';
        }
    }

    // 3. Eye Closure Timer & Metrics
    if (dom.closureTimer) {
        dom.closureTimer.textContent = formatSecondsDecimal(eyeData.closureDurationMs);
        if (eyeData.closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_HIGH_MS) {
            dom.closureTimer.parentElement.className = 'timer-display alert-critical';
        } else if (eyeData.closureDurationMs >= CONFIG.DROWSINESS.EYE_CLOSURE_CAUTION_MS) {
            dom.closureTimer.parentElement.className = 'timer-display alert-caution';
        } else {
            dom.closureTimer.parentElement.className = 'timer-display';
        }
    }

    if (dom.earLeft) dom.earLeft.textContent = eyeData.leftEAR ? eyeData.leftEAR.toFixed(2) : '--';
    if (dom.earRight) dom.earRight.textContent = eyeData.rightEAR ? eyeData.rightEAR.toFixed(2) : '--';
    if (dom.statusDrowsiness) {
        dom.statusDrowsiness.textContent = eyeData.status;
        dom.statusDrowsiness.className = `badge ${eyeData.areBothEyesClosed ? 'badge-danger' : 'badge-success'}`;
    }

    // 4. Blink Statistics
    if (dom.blinkCount) dom.blinkCount.textContent = blinkData ? blinkData.totalBlinks : 0;
    if (dom.longBlinkCount) dom.longBlinkCount.textContent = blinkData ? blinkData.totalLongBlinks : 0;
    if (dom.blinkRate) dom.blinkRate.textContent = blinkData ? `${blinkData.rollingBlinkRate}/m` : '--';

    // 5. Head Pose & Nodding
    if (dom.headPoseStatus) {
        dom.headPoseStatus.textContent = headData.headPoseStatus || '--';
        dom.headPoseStatus.className = `badge ${headData.isNodding ? 'badge-danger' : 'badge-neutral'}`;
    }
    if (dom.poseAngles) {
        dom.poseAngles.textContent = `P: ${headData.pitch}° | Y: ${headData.yaw}° | R: ${headData.roll}°`;
    }
    if (dom.nodEventsCount) {
        dom.nodEventsCount.textContent = headData.totalNodEvents || 0;
    }

    // 6. Motion Analysis
    if (dom.statusShaking) {
        dom.statusShaking.textContent = motionData.status;
        dom.statusShaking.className = `badge ${motionData.motionDetected ? 'badge-warning' : 'badge-success'}`;
    }
    if (dom.motionIntensity) {
        dom.motionIntensity.textContent = `${motionData.smoothedMagnitude.toFixed(1)} px`;
    }
    if (dom.motionProgressBar) {
        const percent = Math.min(100, (motionData.smoothedMagnitude / (CONFIG.MOTION.MOTION_MAGNITUDE_THRESHOLD * 2.5)) * 100);
        dom.motionProgressBar.style.width = `${percent}%`;
        dom.motionProgressBar.className = `progress-fill ${motionData.motionDetected ? 'bg-orange' : 'bg-primary'}`;
    }

    // 7. Session Statistics Counters
    if (dom.statSustainedClosures) dom.statSustainedClosures.textContent = sessionStats.sustainedClosureCount;
    if (dom.statLongBlinks) dom.statLongBlinks.textContent = sessionStats.longBlinkCount;
    if (dom.statHeadNods) dom.statHeadNods.textContent = sessionStats.headNoddingCount;
    if (dom.statTrackingLoss) dom.statTrackingLoss.textContent = sessionStats.trackingLossCount;
}

/**
 * Updates banner alerts container
 */
export function renderActiveAlertBanner(alertState, onDismiss) {
    if (!dom.alertContainer) return;

    if (alertState.level === 0 || alertState.dismissed) {
        dom.alertContainer.innerHTML = '';
        dom.alertContainer.classList.add('hidden');
        return;
    }

    dom.alertContainer.classList.remove('hidden');
    const isCritical = alertState.level >= 2;
    const bannerClass = isCritical ? 'alert-box alert-danger' : 'alert-box alert-warning';
    const icon = isCritical ? '🚨' : '⚠️';

    const esc = getEscalationState();
    let escalationHtml = '';
    if (isCritical && esc.isHighRiskActive) {
        if (esc.isEscalatedForEpisode) {
            const statusText = esc.lastDispatchResult?.mock
                ? 'Mock Email Alert Accepted'
                : 'Escalation Alert Accepted by SMTP Queue';
            escalationHtml = `<div class="alert-escalation" style="margin-top: 6px; font-size: 12px; color: #fee2e2; font-weight: 600;">📧 ${statusText}</div>`;
        } else {
            const remainingSec = Math.max(0, Math.ceil((esc.thresholdMs - esc.highRiskDurationMs) / 1000));
            escalationHtml = `<div class="alert-escalation" style="margin-top: 6px; font-size: 12px; color: #fef08a;">⏳ Emergency Contact Email Escalation in ${remainingSec}s if sustained</div>`;
        }
    }

    dom.alertContainer.innerHTML = `
        <div class="${bannerClass}">
            <div class="alert-content">
                <span class="alert-icon">${icon}</span>
                <div class="alert-texts">
                    <strong class="alert-title">${alertState.levelName.toUpperCase()}: ${escapeHtml(alertState.recommendation)}</strong>
                    <div class="alert-details">${alertState.contributingFactors.map(f => escapeHtml(f)).join(' • ')}</div>
                    ${escalationHtml}
                </div>
            </div>
            <button id="btnDismissBanner" class="btn-icon" title="Dismiss visual banner (does not silence active condition)">&times;</button>
        </div>
    `;

    const dismissBtn = document.getElementById('btnDismissBanner');
    if (dismissBtn && onDismiss) {
        dismissBtn.addEventListener('click', onDismiss);
    }
}

/**
 * Renders the live event timeline table
 */
export function renderEventTimeline(events) {
    if (!dom.eventTimelineList) return;

    if (!events || events.length === 0) {
        dom.eventTimelineList.innerHTML = '<li class="timeline-empty">No events recorded in this session.</li>';
        return;
    }

    // Show recent 12 events
    const recent = events.slice(-12).reverse();
    dom.eventTimelineList.innerHTML = recent.map(evt => `
        <li class="timeline-item timeline-${evt.severity}">
            <div class="timeline-time">${formatTimestamp(evt.timestamp)}</div>
            <div class="timeline-body">
                <div class="timeline-title">
                    <span class="badge badge-${evt.severity}">${evt.category.toUpperCase()}</span>
                    <strong>${escapeHtml(evt.title)}</strong>
                    ${evt.durationMs > 0 ? `<span class="timeline-duration">(${(evt.durationMs / 1000).toFixed(1)}s)</span>` : ''}
                </div>
                <div class="timeline-explanation">${escapeHtml(evt.explanation)}</div>
            </div>
            <div class="timeline-status">
                <span class="status-dot status-${evt.status}"></span>
                ${evt.status}
            </div>
        </li>
    `).join('');
}

function initTimelineFilters() {
    if (dom.filterCategory) {
        dom.filterCategory.addEventListener('change', () => {
            if (dom.onFilterChange) dom.onFilterChange();
        });
    }
    if (dom.filterSeverity) {
        dom.filterSeverity.addEventListener('change', () => {
            if (dom.onFilterChange) dom.onFilterChange();
        });
    }
}

function getLevelCssClass(level) {
    switch (level) {
        case 0: return 'success';
        case 1: return 'warning';
        case 2: return 'danger';
        case 3: return 'critical';
        default: return 'neutral';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
