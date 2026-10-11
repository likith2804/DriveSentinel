// faceLandmarker.js - MediaPipe FaceLandmarker loader and canvas overlay rendering
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let landmarkerInstance = null;
let isLoaded = false;
let currentDelegate = 'GPU';

/**
 * Initializes FaceLandmarker with GPU and CPU fallback
 */
export async function initFaceLandmarker() {
    if (landmarkerInstance && isLoaded) {
        return landmarkerInstance;
    }

    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        // Try GPU delegate first for smooth performance
        try {
            landmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "./src/assets/models/face_landmarker.task",
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });
            currentDelegate = 'GPU';
        } catch (gpuError) {
            console.warn("GPU delegate failed, attempting CPU fallback:", gpuError);
            landmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "./src/assets/models/face_landmarker.task",
                    delegate: "CPU"
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });
            currentDelegate = 'CPU';
        }

        isLoaded = true;
        return landmarkerInstance;
    } catch (error) {
        console.error("Critical error initializing MediaPipe FaceLandmarker:", error);
        isLoaded = false;
        throw error;
    }
}

export function isLandmarkerReady() {
    return isLoaded && !!landmarkerInstance;
}

export function getActiveDelegate() {
    return currentDelegate;
}

/**
 * Detects face landmarks and blendshapes for a video element
 */
export function detectFace(videoEl, timestamp) {
    if (!isLoaded || !landmarkerInstance) {
        return null;
    }
    try {
        return landmarkerInstance.detectForVideo(videoEl, timestamp);
    } catch (err) {
        console.error("Inference execution error:", err);
        return null;
    }
}

/**
 * Draws lightweight facial landmark mesh and eye contours onto overlay canvas
 */
export function renderLandmarkOverlay(canvasEl, detectionResult) {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (!detectionResult || !detectionResult.faceLandmarks || detectionResult.faceLandmarks.length === 0) {
        return;
    }

    const landmarks = detectionResult.faceLandmarks[0];
    const w = canvasEl.width;
    const h = canvasEl.height;

    // Draw eye contours with a high-contrast automotive cyan color
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#00f3ff';
    ctx.fillStyle = '#00f3ff';

    // Left eye indices
    const leftEyeIdx = [33, 160, 158, 133, 153, 144];
    // Right eye indices
    const rightEyeIdx = [263, 387, 385, 362, 380, 373];

    drawPolygon(ctx, leftEyeIdx, landmarks, w, h);
    drawPolygon(ctx, rightEyeIdx, landmarks, w, h);

    // Draw nose bridge and orientation cross
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    const nose = landmarks[1];
    const chin = landmarks[152];
    const forehead = landmarks[10];
    if (nose && chin && forehead) {
        ctx.moveTo(forehead.x * w, forehead.y * h);
        ctx.lineTo(chin.x * w, chin.y * h);
        ctx.stroke();

        // Target dot at nose tip
        ctx.beginPath();
        ctx.arc(nose.x * w, nose.y * h, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
    }
}

function drawPolygon(ctx, indices, landmarks, w, h) {
    if (!indices || indices.length === 0) return;
    ctx.beginPath();
    const first = landmarks[indices[0]];
    if (!first) return;
    ctx.moveTo(first.x * w, first.y * h);
    for (let i = 1; i < indices.length; i++) {
        const pt = landmarks[indices[i]];
        if (pt) ctx.lineTo(pt.x * w, pt.y * h);
    }
    ctx.closePath();
    ctx.stroke();

    for (let i = 0; i < indices.length; i++) {
        const pt = landmarks[indices[i]];
        if (pt) {
            ctx.beginPath();
            ctx.arc(pt.x * w, pt.y * h, 1.5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

export function disposeFaceLandmarker() {
    if (landmarkerInstance) {
        try {
            landmarkerInstance.close();
        } catch (e) {}
        landmarkerInstance = null;
        isLoaded = false;
    }
}
