// about.js - UI controller for Project Documentation, Privacy Notice, and Demonstration Guide

let containerEl = null;

export function initAboutUI(container) {
    containerEl = container;
}

export function renderAboutView() {
    if (!containerEl) return;

    containerEl.innerHTML = `
        <div class="panel-section-header">
            <div>
                <h2>Project Information & Technical Documentation</h2>
                <p class="section-subtitle">Architecture, detection principles, privacy disclosures, and demonstration guide</p>
            </div>
        </div>

        <div class="about-grid">
            <div class="about-card">
                <h3>🚗 Problem Statement & Engineering Context</h3>
                <p>
                    Driver drowsiness, micro-sleep episodes, and cognitive distraction account for over 20% of fatal vehicle collisions worldwide according to NHTSA and WHO studies. At highway speeds (100 km/h / 62 mph), a driver whose eyes close for just <strong>2.5 seconds travels over 70 meters (230 feet) completely unguided</strong>.
                </p>
                <p>
                    This project delivers an edge-computed, privacy-conscious driver safety assistance system that operates locally in real time using computer vision.
                </p>
            </div>

            <div class="about-card">
                <h3>🧠 Multi-Factor Fatigue Detection Architecture</h3>
                <ul class="about-feature-list">
                    <li>
                        <strong>Eye Aspect Ratio (EAR) & Blendshapes:</strong> Calculates continuous vertical-to-horizontal eyelid aperture across 6 facial landmarks per eye, paired with MediaPipe neural blink blendshapes.
                    </li>
                    <li>
                        <strong>Blink State Machine:</strong> Distinguishes normal physiological blinks (100–350ms) from long blinks (>400ms) and tracks rolling blinks per minute (BPM).
                    </li>
                    <li>
                        <strong>3D Head Orientation & Nodding:</strong> Approximates pitch, yaw, and roll angles to detect chin-drop nodding behavior sustained over 1.6s.
                    </li>
                    <li>
                        <strong>Explainable 4-Tier Warning Escalation:</strong> Maps real-time indicators into Normal (Level 0), Caution (Level 1), High Concern (Level 2), and Persistent Concern (Level 3).
                    </li>
                </ul>
            </div>

            <div class="about-card">
                <h3>📹 OpenCV.js Motion Analysis vs. Vehicle Vibration</h3>
                <p>
                    The system integrates OpenCV.js dense optical flow and spatial gradient analysis to monitor camera stability:
                </p>
                <ul class="about-feature-list">
                    <li><strong>Apparent Camera Motion:</strong> Tracks feature displacement vectors between consecutive video frames with illumination spike suppression.</li>
                    <li><strong>Engineering Clarification:</strong> Optical flow detects camera vibration and external mount movement. It does <em>not</em> claim to measure physical chassis G-forces or vehicle suspension roughness without dedicated IMU hardware.</li>
                </ul>
            </div>

            <div class="about-card">
                <h3>🔒 Privacy & Local Processing Disclosures</h3>
                <ul class="about-feature-list">
                    <li><strong>Zero Cloud Computer Vision:</strong> MediaPipe and OpenCV execute 100% inside your browser WebAssembly and WebGL context. No video frames leave your device.</li>
                    <li><strong>No Biometric Templates Saved:</strong> Neither facial images nor facial mesh coordinates are ever written to disk or recorded.</li>
                    <li><strong>Local Metadata Only:</strong> Monitoring logs and incident timestamps are stored exclusively in your browser's private IndexedDB store.</li>
                </ul>
            </div>

            <div class="about-card">
                <h3>📧 Free Automated Email Escalations (Gmail SMTP)</h3>
                <p>
                    Automated email notifications provide an off-vehicle safety net when high-risk drowsiness persists continuously for the configured <strong>30-second escalation threshold</strong>:
                </p>
                <ul class="about-feature-list">
                    <li><strong>Free Delivery:</strong> Uses standard Gmail SMTP (port 465 SSL) requiring no paid SMS APIs, paid email gateways, or credit card subscriptions.</li>
                    <li><strong>Security & Credential Isolation:</strong> Passwords are stored exclusively on the backend in <code>.env</code>. The frontend browser runtime never receives or displays secrets.</li>
                    <li><strong>Observation Integrity:</strong> Escalation relies strictly on verified facial landmarks and timestamps. Missing face tracking is never interpreted as closed eyes.</li>
                    <li><strong>Delivery Truthfulness:</strong> System acknowledges <em>SMTP Queue Acceptance</em> (<code>250 OK</code>) without falsely guaranteeing recipient inbox arrival.</li>
                </ul>
            </div>

            <div class="about-card">
                <h3>🔌 Future Hardware Roadmap: ESP32 + MPU6050</h3>
                <p>
                    A modular Web Serial API interface is built into <code>motionAnalysis.js</code> for optional direct micro-controller integration:
                </p>
                <pre class="code-snippet">
[ESP32 / Arduino] --(I2C)--> [MPU-6050 IMU]
      | (USB Serial @ 115200 baud)
      v
[Web Serial API] --> [motionAnalysis.HardwareIMUInterface]
Format: "IMU:ax,ay,az,gx,gy,gz\\n"
                </pre>
            </div>

            <div class="about-card">
                <h3>🎓 Step-by-Step College Demonstration Procedure</h3>
                <ol class="about-steps-list">
                    <li><strong>Normal Monitoring:</strong> Click <em>Start Monitoring</em>. Show normal green badge ("Monitoring Normally") with live EAR telemetry (~0.28).</li>
                    <li><strong>Normal Blinking:</strong> Blink naturally; show blink counter increasing while closure timer stays at 0.0s.</li>
                    <li><strong>Early Caution:</strong> Close eyes for 1.5 seconds; show yellow Caution badge and gentle chime.</li>
                    <li><strong>Micro-Sleep Alarm:</strong> Hold eyes closed past 3.0 seconds; demonstrate emergency siren and red High Concern alert.</li>
                    <li><strong>Head Nodding:</strong> Tilt head forward/down for 1.6s; observe Head Nodding alert trigger.</li>
                    <li><strong>Camera Movement:</strong> Gently shake camera; show OpenCV motion intensity gauge rising without false drowsiness classification.</li>
                    <li><strong>Audit Trail:</strong> Click <em>Stop Monitoring</em>, navigate to <em>Session History</em>, view event timeline, and download CSV / PDF report.</li>
                </ol>
            </div>
        </div>

        <div class="disclaimer-banner">
            <strong>Prototype Disclaimer:</strong>
            This is an academic research prototype intended for evaluation and educational demonstration. It is not an automotive certified safety device and must not be used as a primary collision-prevention system in real vehicles.
        </div>
    `;
}
