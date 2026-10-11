// camera.js - Robust WebRTC getUserMedia management and resource lifecycle

export const cameraState = {
    isActive: false,
    stream: null,
    videoElement: null,
    error: null
};

export function initCamera(videoEl) {
    cameraState.videoElement = videoEl;
    cameraState.isActive = false;
    cameraState.stream = null;
    cameraState.error = null;
}

/**
 * Requests camera access and sets up video stream
 */
export async function startCamera() {
    if (cameraState.isActive && cameraState.stream) {
        return true;
    }

    cameraState.error = null;

    try {
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    facingMode: 'user',
                    frameRate: { ideal: 30 }
                },
                audio: false
            });
        } catch (constraintErr) {
            // Fallback for older or constrained webcams
            stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
        }

        cameraState.stream = stream;
        cameraState.videoElement.srcObject = stream;

        // Ensure video is playing and metadata is fully loaded
        await new Promise((resolve) => {
            let resolved = false;
            const cleanup = () => {
                if (cameraState.videoElement) {
                    cameraState.videoElement.onloadedmetadata = null;
                }
            };

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve();
                }
            }, 3000);

            cameraState.videoElement.onloadedmetadata = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    cleanup();
                    cameraState.videoElement.play()
                        .then(resolve)
                        .catch(resolve);
                }
            };
        });

        cameraState.isActive = true;
        return true;
    } catch (error) {
        cameraState.isActive = false;
        cameraState.stream = null;
        cameraState.error = formatCameraError(error);
        console.error("Camera access error:", error);
        throw new Error(cameraState.error);
    }
}

/**
 * Stops camera and completely releases hardware tracks
 */
export function stopCamera() {
    if (cameraState.stream) {
        cameraState.stream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (e) {}
        });
    }
    if (cameraState.videoElement) {
        if (typeof cameraState.videoElement.pause === 'function') {
            try {
                cameraState.videoElement.pause();
            } catch (e) {}
        }
        cameraState.videoElement.srcObject = null;
    }
    cameraState.isActive = false;
    cameraState.stream = null;
}

function formatCameraError(err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return 'Camera permission was denied. Please allow camera access in your browser settings.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return 'No webcam device was found on this system.';
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        return 'Webcam is currently in use by another application or operating system process.';
    }
    return err.message || 'Unable to access webcam.';
}
