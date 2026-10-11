// analytics.js - Chart.js based historical analytics and trend visualization
import { Chart, registerables } from 'chart.js';
import { getAllSessionsFromStorage } from '../sessions/sessionStorage.js';

Chart.register(...registerables);

let containerEl = null;
let categoryChartInstance = null;
let severityChartInstance = null;
let trendChartInstance = null;

export function initAnalyticsUI(container) {
    containerEl = container;
}

/**
 * Loads sessions from storage and renders analytics charts
 */
export async function renderAnalyticsView() {
    if (!containerEl) return;

    // Clean up previous charts
    destroyCharts();

    const sessions = await getAllSessionsFromStorage();

    if (sessions.length === 0) {
        containerEl.innerHTML = `
            <div class="panel-section-header">
                <h2>Safety Analytics & Trends</h2>
                <p class="section-subtitle">Aggregate metrics calculated from stored monitoring sessions</p>
            </div>
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>Insufficient Session Data</h3>
                <p>No completed monitoring sessions were found in local storage. Complete at least one driver monitoring session to populate telemetry charts.</p>
            </div>
        `;
        return;
    }

    containerEl.innerHTML = `
        <div class="panel-section-header">
            <div>
                <h2>Safety Analytics & Trends</h2>
                <p class="section-subtitle">Aggregate data derived from ${sessions.length} recorded session(s)</p>
            </div>
        </div>

        <div class="analytics-grid">
            <div class="chart-card">
                <h3>Incident Distribution by Category</h3>
                <div class="chart-wrapper">
                    <canvas id="categoryChart"></canvas>
                </div>
            </div>

            <div class="chart-card">
                <h3>Warning Severity Breakdown</h3>
                <div class="chart-wrapper">
                    <canvas id="severityChart"></canvas>
                </div>
            </div>

            <div class="chart-card chart-card-wide">
                <h3>Fatigue Indicators & Blink Events per Session</h3>
                <div class="chart-wrapper">
                    <canvas id="trendChart"></canvas>
                </div>
            </div>
        </div>
    `;

    // Aggregate category metrics
    const categoryCounts = {
        drowsiness: 0,
        blink: 0,
        head_pose: 0,
        motion: 0,
        tracking: 0
    };

    const severityCounts = {
        caution: 0,
        high: 0,
        persistent: 0
    };

    const sessionLabels = [];
    const sustainedClosuresData = [];
    const headNodsData = [];
    const longBlinksData = [];

    // Process sessions oldest first for chronology
    const chronologicalSessions = [...sessions].reverse().slice(-10);

    chronologicalSessions.forEach((s, idx) => {
        sessionLabels.push(`Session ${idx + 1}`);
        sustainedClosuresData.push(s.stats?.sustainedClosureCount || 0);
        headNodsData.push(s.stats?.headNoddingCount || 0);
        longBlinksData.push(s.stats?.longBlinkCount || 0);

        (s.events || []).forEach(e => {
            if (categoryCounts[e.category] !== undefined) categoryCounts[e.category]++;
            if (severityCounts[e.severity] !== undefined) severityCounts[e.severity]++;
        });
    });

    // 1. Render Category Doughnut Chart
    const catCanvas = document.getElementById('categoryChart');
    if (catCanvas) {
        categoryChartInstance = new Chart(catCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Eye Closure', 'Blink Irregularity', 'Head Nodding', 'Camera Movement', 'Tracking Loss'],
                datasets: [{
                    data: [
                        categoryCounts.drowsiness,
                        categoryCounts.blink,
                        categoryCounts.head_pose,
                        categoryCounts.motion,
                        categoryCounts.tracking
                    ],
                    backgroundColor: ['#ef4444', '#f97316', '#eab308', '#38bdf8', '#94a3b8'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8' } }
                }
            }
        });
    }

    // 2. Render Severity Bar Chart
    const sevCanvas = document.getElementById('severityChart');
    if (sevCanvas) {
        severityChartInstance = new Chart(sevCanvas, {
            type: 'bar',
            data: {
                labels: ['Caution (Level 1)', 'High Concern (Level 2)', 'Persistent (Level 3)'],
                datasets: [{
                    label: 'Event Count',
                    data: [severityCounts.caution, severityCounts.high, severityCounts.persistent],
                    backgroundColor: ['#f59e0b', '#ef4444', '#b91c1c'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: '#334155' } }
                }
            }
        });
    }

    // 3. Render Trend Line Chart
    const trendCanvas = document.getElementById('trendChart');
    if (trendCanvas) {
        trendChartInstance = new Chart(trendCanvas, {
            type: 'line',
            data: {
                labels: sessionLabels,
                datasets: [
                    {
                        label: 'Sustained Eye Closures',
                        data: sustainedClosuresData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Head Nodding Events',
                        data: headNodsData,
                        borderColor: '#eab308',
                        backgroundColor: 'transparent',
                        tension: 0.3
                    },
                    {
                        label: 'Long Blinks',
                        data: longBlinksData,
                        borderColor: '#f97316',
                        backgroundColor: 'transparent',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: '#94a3b8' } }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                    y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: '#334155' } }
                }
            }
        });
    }
}

function destroyCharts() {
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
        categoryChartInstance = null;
    }
    if (severityChartInstance) {
        severityChartInstance.destroy();
        severityChartInstance = null;
    }
    if (trendChartInstance) {
        trendChartInstance.destroy();
        trendChartInstance = null;
    }
}
