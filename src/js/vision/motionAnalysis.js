// motionAnalysis.js - OpenCV-based camera motion analysis and optional hardware IMU interface
import { CONFIG } from '../config.js';
import { exponentialMovingAverage } from '../utils/math.js';

let isOpenCvReady = false;
let previousGrayMat = null;
let previousImageData = null;

let consecutiveMotionFrames = 0;
let lastMotionAlertTime = 0;
let smoothedMagnitude = 0;
let lastProcessTimestamp = 0;

/**
 * Initializes OpenCV.js detection hooks
 */
export function initOpenCv() {
    if (typeof window !== 'undefined' && window.cv && window.cv.Mat) {
        isOpenCvReady = true;
        return true;
    }
    // Listen for OpenCV script ready event if loaded asynchronously
    if (typeof window !== 'undefined') {
        window.addEventListener('opencv-ready', () => {
            isOpenCvReady = true;
            console.log('OpenCV.js runtime initialized for motion analysis.');
        });
    }
    return false;
}

export function isOpenCvAvailable() {
    return isOpenCvReady && typeof window !== 'undefined' && !!window.cv && !!window.cv.Mat;
}

/**
 * Resets motion detection state
 */
export function resetMotionState() {
    consecutiveMotionFrames = 0;
    lastMotionAlertTime = 0;
    smoothedMagnitude = 0;
    lastProcessTimestamp = 0;
    previousImageData = null;

    if (previousGrayMat) {
        try {
            previousGrayMat.delete();
        } catch (e) {}
        previousGrayMat = null;
    }
}

/**
 * Performs motion estimation using OpenCV.js optical flow or enhanced gradient fallback
 * 
 * @param {HTMLVideoElement} videoEl 
 * @param {HTMLCanvasElement} canvasEl 
 * @param {number} currentTime 
 */
export function analyzeMotion(videoEl, canvasEl, currentTime = performance.now()) {
    if (!videoEl || !canvasEl) {
        return {
            motionDetected: false,
            magnitude: 0,
            smoothedMagnitude: 0,
            status: 'Inactive',
            mode: 'Offline'
        };
    }

    const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    let rawMagnitude = 0;
    let mode = 'Gradient Optical Flow (Fallback)';

    if (isOpenCvAvailable()) {
        try {
            rawMagnitude = computeOpenCvMotion(canvasEl);
            mode = 'OpenCV.js Optical Flow';
        } catch (err) {
            console.warn('OpenCV motion calculation error, reverting to fallback:', err);
            rawMagnitude = computeFallbackMotion(ctx, canvasEl.width, canvasEl.height);
        }
    } else {
        rawMagnitude = computeFallbackMotion(ctx, canvasEl.width, canvasEl.height);
    }

    // Apply temporal smoothing to eliminate single-frame illumination glints
    const alpha = CONFIG.MOTION.SMOOTHING_ALPHA;
    smoothedMagnitude = exponentialMovingAverage(rawMagnitude, smoothedMagnitude, alpha);
    smoothedMagnitude = Math.round(smoothedMagnitude * 100) / 100;

    let isMotionActive = false;

    // Check against configurable threshold
    if (smoothedMagnitude >= CONFIG.MOTION.MOTION_MAGNITUDE_THRESHOLD) {
        consecutiveMotionFrames++;
        if (consecutiveMotionFrames >= CONFIG.MOTION.CONSECUTIVE_FRAMES_WARNING) {
            isMotionActive = true;
            lastMotionAlertTime = currentTime;
        }
    } else {
        consecutiveMotionFrames = Math.max(0, consecutiveMotionFrames - 1);
    }

    // Cooldown persistence check to prevent UI flickering
    if (!isMotionActive && lastMotionAlertTime > 0) {
        if (currentTime - lastMotionAlertTime < CONFIG.MOTION.CLEAR_DURATION_MS) {
            isMotionActive = true;
        }
    }

    let status = 'Camera Stable';
    if (isMotionActive) {
        status = smoothedMagnitude > (CONFIG.MOTION.MOTION_MAGNITUDE_THRESHOLD * 2) 
            ? 'Heavy Camera Movement' 
            : 'Moderate Camera Movement';
    }

    lastProcessTimestamp = currentTime;

    return {
        motionDetected: isMotionActive,
        magnitude: rawMagnitude,
        smoothedMagnitude,
        consecutiveFrames: consecutiveMotionFrames,
        status,
        mode,
        isHardwareImu: false, // Explicitly false: webcam optical flow estimation, not calibrated IMU
        disclaimer: 'Apparent webcam motion only. Does not measure physical vehicle G-force or chassis vibration.'
    };
}

/**
 * OpenCV.js Lucas-Kanade / Farneback motion estimation
 */
function computeOpenCvMotion(canvasEl) {
    const cv = window.cv;
    const srcMat = cv.imread(canvasEl);
    const grayMat = new cv.Mat();
    cv.cvtColor(srcMat, grayMat, cv.COLOR_RGBA2GRAY);
    srcMat.delete();

    let avgMagnitude = 0;

    if (previousGrayMat && previousGrayMat.rows === grayMat.rows && previousGrayMat.cols === grayMat.cols) {
        const flowMat = new cv.Mat();
        // Compute dense optical flow using Farneback algorithm
        cv.calcOpticalFlowFarneback(
            previousGrayMat,
            grayMat,
            flowMat,
            0.5, // pyr_scale
            3,   // levels
            15,  // winsize
            3,   // iterations
            5,   // poly_n
            1.2, // poly_sigma
            0
        );

        // Calculate average flow vector magnitude across sampled grid
        let totalMag = 0;
        let count = 0;
        const step = 4; // Sample every 4th pixel for high browser FPS

        for (let y = 0; y < flowMat.rows; y += step) {
            for (let x = 0; x < flowMat.cols; x += step) {
                const u = flowMat.floatAt(y, x * 2);
                const v = flowMat.floatAt(y, x * 2 + 1);
                totalMag += Math.sqrt(u * u + v * v);
                count++;
            }
        }

        avgMagnitude = count > 0 ? (totalMag / count) : 0;
        flowMat.delete();
        previousGrayMat.delete();
    }

    previousGrayMat = grayMat;
    return avgMagnitude;
}

/**
 * Gradient-based optical motion calculation fallback (zero external dependencies)
 */
function computeFallbackMotion(ctx, width, height) {
    const currentFrame = ctx.getImageData(0, 0, width, height);
    if (!previousImageData || previousImageData.data.length !== currentFrame.data.length) {
        previousImageData = currentFrame;
        return 0;
    }

    const d1 = previousImageData.data;
    const d2 = currentFrame.data;
    let diffSum = 0;
    let globalLumDiff = 0;
    const sampleStep = 8; // Sample for fast 60fps execution
    let samples = 0;

    for (let i = 0; i < d1.length; i += 4 * sampleStep) {
        const lum1 = d1[i] * 0.299 + d1[i + 1] * 0.587 + d1[i + 2] * 0.114;
        const lum2 = d2[i] * 0.299 + d2[i + 1] * 0.587 + d2[i + 2] * 0.114;
        const diff = Math.abs(lum1 - lum2);
        diffSum += diff;
        globalLumDiff += (lum2 - lum1);
        samples++;
    }

    previousImageData = currentFrame;

    if (samples === 0) return 0;
    const avgDiff = diffSum / samples;
    const avgGlobalShift = Math.abs(globalLumDiff / samples);

    // Illumination spike rejection:
    // If entire image shifts equally (e.g. room light switched on), avgGlobalShift is close to avgDiff.
    // Subtract global uniform shift to avoid false motion alerts on light changes.
    const motionDiff = Math.max(0, avgDiff - avgGlobalShift * 0.7);

    // Normalize roughly to pixel displacement scale
    return (motionDiff / 10);
}

/**
 * Optional Hardware Integration Interface for ESP32 + MPU6050 Accelerometer/Gyroscope
 * Designed for future physical vehicle telemetry integration via Web Serial API.
 */
export class HardwareIMUInterface {
    constructor() {
        this.isConnected = false;
        this.port = null;
        this.reader = null;
        this.latestReading = null;
    }

    isSupported() {
        return typeof navigator !== 'undefined' && 'serial' in navigator;
    }

    async connect() {
        if (!this.isSupported()) {
            throw new Error('Web Serial API is not supported in this browser.');
        }
        try {
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: 115200 });
            this.isConnected = true;
            this._startReadLoop();
            return true;
        } catch (err) {
            this.isConnected = false;
            throw err;
        }
    }

    async disconnect() {
        if (this.reader) {
            await this.reader.cancel();
            this.reader = null;
        }
        if (this.port) {
            await this.port.close();
            this.port = null;
        }
        this.isConnected = false;
    }

    async _startReadLoop() {
        const textDecoder = new TextDecoderStream();
        this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();

        try {
            while (this.isConnected) {
                const { value, done } = await this.reader.read();
                if (done) break;
                if (value) {
                    this._parseTelemetry(value);
                }
            }
        } catch (e) {
            console.error('Serial read loop disconnected:', e);
        }
    }

    _parseTelemetry(line) {
        // Expected ESP32 format: "IMU:ax,ay,az,gx,gy,gz"
        try {
            const parts = line.trim().split(',');
            if (parts.length >= 6) {
                this.latestReading = {
                    accelX: parseFloat(parts[0]),
                    accelY: parseFloat(parts[1]),
                    accelZ: parseFloat(parts[2]),
                    gyroX: parseFloat(parts[3]),
                    gyroY: parseFloat(parts[4]),
                    gyroZ: parseFloat(parts[5]),
                    timestamp: Date.now(),
                    isRealHardware: true
                };
            }
        } catch (e) {}
    }

    getLatestReading() {
        return this.latestReading;
    }
}
