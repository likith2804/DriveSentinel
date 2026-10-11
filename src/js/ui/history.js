import { getAllSessionsFromStorage, deleteSessionFromStorage, clearAllSessionsFromStorage } from '../sessions/sessionStorage.js';
import { exportSessionEventsToCSV, openPrintableSessionReport } from '../sessions/reportGenerator.js';
import { formatDateTime, formatDuration, formatTimestamp } from '../utils/time.js';
import { sendSessionSummaryEmail } from '../services/emailService.js';
import { CONFIG } from '../config.js';

let containerEl = null;
let currentLoadedSessions = [];

export function initHistoryUI(container) {
    containerEl = container;
}

/**
 * Loads and renders all saved sessions
 */
export async function renderHistoryView() {
    if (!containerEl) return;

    currentLoadedSessions = await getAllSessionsFromStorage();

    containerEl.innerHTML = `
        <div class="panel-section-header">
            <div>
                <h2>Session History & Reports</h2>
                <p class="section-subtitle">Local IndexedDB audit logs for monitoring sessions</p>
            </div>
            <div class="actions-group">
                <button id="btnClearAllHistory" class="btn btn-secondary btn-sm" ${currentLoadedSessions.length === 0 ? 'disabled' : ''}>
                    Clear All History
                </button>
            </div>
        </div>

        <div class="history-table-container">
            ${currentLoadedSessions.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>No Saved Sessions Found</h3>
                    <p>Start a live monitoring session and click "Stop Monitoring" to save session telemetry and events.</p>
                </div>
            ` : `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Session ID</th>
                            <th>Date & Time</th>
                            <th>Duration</th>
                            <th>Sustained Closures</th>
                            <th>Head Nods</th>
                            <th>Total Events</th>
                            <th>Peak Warning</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentLoadedSessions.map(session => `
                            <tr>
                                <td><code>${session.id}</code></td>
                                <td>${formatDateTime(session.startTime)}</td>
                                <td><strong>${formatDuration(session.durationMs)}</strong></td>
                                <td>${session.stats?.sustainedClosureCount || 0}</td>
                                <td>${session.stats?.headNoddingCount || 0}</td>
                                <td>${session.events?.length || 0}</td>
                                <td>
                                    <span class="badge badge-${getSeverityBadgeClass(session.stats?.maxSeverityReached)}">
                                        ${(session.stats?.maxSeverityReached || 'normal').toUpperCase()}
                                    </span>
                                </td>
                                <td class="table-actions">
                                    <button class="btn-action btn-view" data-session-id="${session.id}" title="View Details">Details</button>
                                    <button class="btn-action btn-csv" data-session-id="${session.id}" title="Export CSV">CSV</button>
                                    <button class="btn-action btn-print" data-session-id="${session.id}" title="Print / PDF">Report</button>
                                    <button class="btn-action btn-email" data-session-id="${session.id}" title="Email Session Summary">Email</button>
                                    <button class="btn-action btn-delete" data-session-id="${session.id}" title="Delete">&times;</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>

        <!-- Session Detail Modal Container -->
        <div id="sessionDetailModal" class="modal-backdrop hidden"></div>
    `;

    bindHistoryEvents();
}

function bindHistoryEvents() {
    // Clear all button
    const clearBtn = document.getElementById('btnClearAllHistory');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete all saved monitoring sessions? This cannot be undone.')) {
                await clearAllSessionsFromStorage();
                renderHistoryView();
            }
        });
    }

    // Action buttons inside table
    containerEl.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-session-id');
            const session = currentLoadedSessions.find(s => s.id === id);
            if (session) openDetailModal(session);
        });
    });

    containerEl.querySelectorAll('.btn-csv').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-session-id');
            const session = currentLoadedSessions.find(s => s.id === id);
            if (session) exportSessionEventsToCSV(session);
        });
    });

    containerEl.querySelectorAll('.btn-print').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-session-id');
            const session = currentLoadedSessions.find(s => s.id === id);
            if (session) openPrintableSessionReport(session);
        });
    });

    containerEl.querySelectorAll('.btn-email').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-session-id');
            const session = currentLoadedSessions.find(s => s.id === id);
            if (session) await handleEmailSession(session);
        });
    });

    containerEl.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-session-id');
            if (confirm(`Delete session ${id}?`)) {
                await deleteSessionFromStorage(id);
                renderHistoryView();
            }
        });
    });
}

function openDetailModal(session) {
    const modal = document.getElementById('sessionDetailModal');
    if (!modal) return;

    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-header">
                <div>
                    <h3>Session Details</h3>
                    <code class="text-muted">${session.id}</code>
                </div>
                <button id="btnCloseModal" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="modal-meta-row">
                    <div><strong>Start:</strong> ${formatDateTime(session.startTime)}</div>
                    <div><strong>Duration:</strong> ${formatDuration(session.durationMs)}</div>
                    <div><strong>Peak Warning:</strong> ${(session.stats?.maxSeverityReached || 'normal').toUpperCase()}</div>
                </div>

                <div class="stat-pills-row" style="grid-template-columns: repeat(6, 1fr);">
                    <div class="stat-pill">
                        <span>Closures</span>
                        <strong>${session.stats?.sustainedClosureCount || 0}</strong>
                    </div>
                    <div class="stat-pill">
                        <span>Total Blinks</span>
                        <strong>${session.stats?.totalBlinks || 0}</strong>
                    </div>
                    <div class="stat-pill">
                        <span>Long Blinks</span>
                        <strong>${session.stats?.longBlinkCount || 0}</strong>
                    </div>
                    <div class="stat-pill">
                        <span>Avg Blink</span>
                        <strong>${session.stats?.averageBlinkDurationMs ? session.stats.averageBlinkDurationMs + 'ms' : '--'}</strong>
                    </div>
                    <div class="stat-pill">
                        <span>Nod Events</span>
                        <strong>${session.stats?.headNoddingCount || 0}</strong>
                    </div>
                    <div class="stat-pill">
                        <span>Motion Alerts</span>
                        <strong>${session.stats?.motionWarningCount || 0}</strong>
                    </div>
                </div>

                <h4>Event Log (${session.events?.length || 0})</h4>
                <div class="modal-events-list">
                    ${(session.events || []).length === 0 ? '<p class="text-muted">No safety events recorded.</p>' : `
                        <table class="sub-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Category</th>
                                    <th>Title</th>
                                    <th>Duration</th>
                                    <th>Explanation</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${session.events.map(e => `
                                    <tr>
                                        <td>${formatTimestamp(e.timestamp)}</td>
                                        <td><span class="badge badge-${e.severity}">${e.category}</span></td>
                                        <td><strong>${escapeHtml(e.title)}</strong></td>
                                        <td>${e.durationMs > 0 ? (e.durationMs / 1000).toFixed(1) + 's' : '--'}</td>
                                        <td>${escapeHtml(e.explanation)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
            <div class="modal-footer">
                <button id="modalBtnCsv" class="btn btn-secondary">Download CSV</button>
                <button id="modalBtnPrint" class="btn btn-primary">Generate PDF Report</button>
                <button id="modalBtnEmail" class="btn btn-secondary">Email Summary + CSV</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    document.getElementById('btnCloseModal').addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    document.getElementById('modalBtnCsv').addEventListener('click', () => {
        exportSessionEventsToCSV(session);
    });

    document.getElementById('modalBtnPrint').addEventListener('click', () => {
        openPrintableSessionReport(session);
    });

    document.getElementById('modalBtnEmail').addEventListener('click', async () => {
        await handleEmailSession(session);
    });
}

async function handleEmailSession(session) {
    let recipient = (CONFIG.EMAIL?.RECIPIENT_EMAIL || '').trim();
    if (!recipient) {
        recipient = prompt('Enter recipient email address to receive this session summary and CSV report:');
        if (!recipient) return;
        recipient = recipient.trim();
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        alert('Invalid email address format.');
        return;
    }
    try {
        const res = await sendSessionSummaryEmail({
            sessionId: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            durationMs: session.durationMs,
            stats: session.stats,
            events: session.events,
            recipientEmail: recipient
        });
        if (res.success) {
            alert(res.mock
                ? '[Mock Mode] Session summary simulated successfully!'
                : 'Session summary email accepted by SMTP server for delivery queue (with CSV attachment)!');
        } else {
            alert(`Failed to send session summary email: ${res.error || 'Unknown error'}`);
        }
    } catch (err) {
        alert(`Error sending email: ${err.message}`);
    }
}

function getSeverityBadgeClass(sev) {
    if (sev === 'persistent' || sev === 'high') return 'danger';
    if (sev === 'caution') return 'warning';
    return 'success';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
