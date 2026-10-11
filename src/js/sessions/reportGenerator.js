// reportGenerator.js - CSV export and printable PDF report generator
import { formatDateTime, formatDuration, formatTimestamp } from '../utils/time.js';

/**
 * Generates and triggers download of CSV file from session events
 */
export function exportSessionEventsToCSV(session) {
    if (!session || !session.events) return;

    const headers = ['Event ID', 'Timestamp (ISO)', 'Time', 'Category', 'Severity', 'Duration (ms)', 'Title', 'Explanation', 'Status'];
    const rows = session.events.map(e => [
        escapeCsv(e.id),
        escapeCsv(new Date(e.timestamp).toISOString()),
        escapeCsv(formatTimestamp(e.timestamp)),
        escapeCsv(e.category),
        escapeCsv(e.severity),
        e.durationMs || 0,
        escapeCsv(e.title),
        escapeCsv(e.explanation),
        escapeCsv(e.status)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `driver_safety_events_${session.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function escapeCsv(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

/**
 * Opens a print-optimized window for printing/saving as PDF
 */
export function openPrintableSessionReport(session) {
    if (!session) return;

    const eventsHtml = (session.events || []).map(e => `
        <tr>
            <td>${formatTimestamp(e.timestamp)}</td>
            <td><span class="badge badge-${e.severity}">${e.severity.toUpperCase()}</span></td>
            <td>${e.category}</td>
            <td>${e.title}</td>
            <td>${e.durationMs ? (e.durationMs / 1000).toFixed(1) + 's' : '--'}</td>
            <td>${e.explanation}</td>
        </tr>
    `).join('');

    const reportHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Driver Safety Monitoring Report - ${session.id}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #1e293b;
                margin: 40px;
                line-height: 1.5;
            }
            .header {
                border-bottom: 2px solid #0284c7;
                padding-bottom: 16px;
                margin-bottom: 24px;
            }
            h1 { margin: 0 0 6px 0; color: #0f172a; font-size: 24px; }
            .subtitle { color: #64748b; font-size: 14px; margin: 0; }
            .meta-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 16px;
                margin-bottom: 24px;
                background: #f8fafc;
                padding: 16px;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
            }
            .meta-item .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
            .meta-item .value { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 4px; }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-bottom: 28px;
            }
            .stat-card {
                border: 1px solid #e2e8f0;
                padding: 12px;
                border-radius: 6px;
                text-align: center;
            }
            .stat-num { font-size: 22px; font-weight: bold; color: #0284c7; }
            .stat-desc { font-size: 12px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background: #f1f5f9; color: #334155; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
            .badge-caution { background: #fed7aa; color: #9a3412; }
            .badge-high { background: #fecaca; color: #991b1b; }
            .badge-persistent { background: #fee2e2; color: #7f1d1d; }
            .badge-info { background: #e0f2fe; color: #075985; }
            .disclaimer-box {
                margin-top: 40px;
                padding: 16px;
                border: 1px solid #fed7aa;
                background-color: #fffbeb;
                border-radius: 6px;
                font-size: 12px;
                color: #92400e;
            }
            @media print {
                body { margin: 20px; }
                .no-print { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #0284c7; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print or Save as PDF</button>
        </div>

        <div class="header">
            <h1>Driver Monitoring & Safety Session Report</h1>
            <p class="subtitle">Smart Vehicle Safety Assistance System — Research Prototype</p>
        </div>

        <div class="meta-grid">
            <div class="meta-item">
                <div class="label">Session ID</div>
                <div class="value">${session.id}</div>
            </div>
            <div class="meta-item">
                <div class="label">Start Time</div>
                <div class="value">${formatDateTime(session.startTime)}</div>
            </div>
            <div class="meta-item">
                <div class="label">End Time</div>
                <div class="value">${formatDateTime(session.endTime)}</div>
            </div>
            <div class="meta-item">
                <div class="label">Total Duration</div>
                <div class="value">${formatDuration(session.durationMs)}</div>
            </div>
        </div>

        <h3 style="margin-bottom: 12px;">Safety Metric Summary</h3>
        <div class="stats-grid" style="grid-template-columns: repeat(6, 1fr);">
            <div class="stat-card">
                <div class="stat-num">${session.stats?.sustainedClosureCount || 0}</div>
                <div class="stat-desc">Sustained Closures</div>
            </div>
            <div class="stat-card">
                <div class="stat-num">${session.stats?.totalBlinks || 0}</div>
                <div class="stat-desc">Total Blinks</div>
            </div>
            <div class="stat-card">
                <div class="stat-num">${session.stats?.longBlinkCount || 0}</div>
                <div class="stat-desc">Long Blinks</div>
            </div>
            <div class="stat-card">
                <div class="stat-num">${session.stats?.averageBlinkDurationMs ? session.stats.averageBlinkDurationMs + 'ms' : '--'}</div>
                <div class="stat-desc">Avg Blink Duration</div>
            </div>
            <div class="stat-card">
                <div class="stat-num">${session.stats?.headNoddingCount || 0}</div>
                <div class="stat-desc">Head Nod Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-num">${session.stats?.motionWarningCount || 0}</div>
                <div class="stat-desc">Camera Motion Alerts</div>
            </div>
        </div>

        <h3 style="margin-bottom: 12px;">Configuration & Calibration Used</h3>
        <div class="meta-grid" style="grid-template-columns: repeat(6, 1fr); margin-bottom: 24px;">
            <div class="meta-item">
                <div class="label">Caution Threshold</div>
                <div class="value">${session.configSnapshot?.DROWSINESS?.EYE_CLOSURE_CAUTION_MS ? (session.configSnapshot.DROWSINESS.EYE_CLOSURE_CAUTION_MS / 1000).toFixed(1) + 's' : '1.5s'}</div>
            </div>
            <div class="meta-item">
                <div class="label">High Alert Threshold</div>
                <div class="value">${session.configSnapshot?.DROWSINESS?.EYE_CLOSURE_HIGH_MS ? (session.configSnapshot.DROWSINESS.EYE_CLOSURE_HIGH_MS / 1000).toFixed(1) + 's' : '3.0s'}</div>
            </div>
            <div class="meta-item">
                <div class="label">Persistent Threshold</div>
                <div class="value">${session.configSnapshot?.DROWSINESS?.EYE_CLOSURE_PERSISTENT_MS ? (session.configSnapshot.DROWSINESS.EYE_CLOSURE_PERSISTENT_MS / 1000).toFixed(1) + 's' : '5.0s'}</div>
            </div>
            <div class="meta-item">
                <div class="label">EAR Threshold</div>
                <div class="value">${session.configSnapshot?.DROWSINESS?.EAR_THRESHOLD || '0.21'}</div>
            </div>
            <div class="meta-item">
                <div class="label">Long Blink Limit</div>
                <div class="value">${session.configSnapshot?.BLINK?.LONG_BLINK_THRESHOLD_MS ? session.configSnapshot.BLINK.LONG_BLINK_THRESHOLD_MS + 'ms' : '400ms'}</div>
            </div>
            <div class="meta-item">
                <div class="label">Motion Sensitivity</div>
                <div class="value">${session.configSnapshot?.MOTION?.MOTION_MAGNITUDE_THRESHOLD ? session.configSnapshot.MOTION.MOTION_MAGNITUDE_THRESHOLD + ' px' : '3.5 px'}</div>
            </div>
        </div>

        <h3 style="margin-bottom: 12px;">Logged Safety Events (${session.events?.length || 0})</h3>
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Severity</th>
                    <th>Category</th>
                    <th>Event</th>
                    <th>Duration</th>
                    <th>Explanation</th>
                </tr>
            </thead>
            <tbody>
                ${eventsHtml || '<tr><td colspan="6" style="text-align: center;">No safety incidents logged during this session.</td></tr>'}
            </tbody>
        </table>

        <div class="disclaimer-box">
            <strong>System Notice & Limitations:</strong>
            This report was generated by an experimental college computer vision driver assistance prototype running client-side MediaPipe and OpenCV.js algorithms. It detects visual fatigue correlates (eyelid closure, blink patterns, geometric head pitch) and camera motion. It is not an automotive certified safety device and does not provide clinical or medical diagnoses.
        </div>
    </body>
    </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
        printWin.document.write(reportHtml);
        printWin.document.close();
    }
}
