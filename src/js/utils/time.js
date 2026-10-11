// time.js - Time and duration formatting utilities

/**
 * Format a duration in milliseconds into mm:ss or hh:mm:ss
 * @param {number} ms 
 * @returns {string}
 */
export function formatDuration(ms) {
    if (!ms || ms < 0 || isNaN(ms)) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format milliseconds into seconds with one decimal point (e.g. 2.4s)
 * @param {number} ms 
 * @returns {string}
 */
export function formatSecondsDecimal(ms) {
    if (!ms || ms < 0 || isNaN(ms)) return '0.0';
    return (ms / 1000).toFixed(1);
}

/**
 * Format ISO timestamp or Date to human readable string
 * @param {string|number|Date} dateInput 
 * @returns {string}
 */
export function formatTimestamp(dateInput) {
    if (!dateInput) return '--';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/**
 * Format Date to full date and time string
 * @param {string|number|Date} dateInput 
 * @returns {string}
 */
export function formatDateTime(dateInput) {
    if (!dateInput) return '--';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}
