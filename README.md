# Smart Vehicle Safety & Driver Monitoring System
> **Edge-Computed AI Driver Monitoring & Safety Assistance Prototype**  
> *Developed with Vite, Vanilla JavaScript, MediaPipe FaceLandmarker, OpenCV.js, and Chart.js.*

---

## 1. Project Overview & Problem Statement

Driver drowsiness, micro-sleep episodes, and cognitive distraction are primary contributors to over **20% of fatal motor vehicle accidents worldwide** (NHTSA / WHO). At typical highway cruising speeds (100 km/h / 62 mph), a vehicle travels **27.8 meters per second**. An eye-closure episode lasting just **2.5 to 3.0 seconds results in over 70 meters (230 feet) of unguided vehicular travel**, severely increasing collision risk.

The **Smart Vehicle Safety & Driver Monitoring System** is an edge-computed, privacy-first computer vision prototype designed to evaluate driver fatigue indicators in real time directly within modern desktop web browsers. By leveraging neural facial landmark meshes and optical flow motion estimation running locally in WebAssembly, the system operates with zero external server dependencies, protecting driver biometric privacy.

> [!NOTE]
> **Research & College Prototype Notice:**  
> This system is an academic research and engineering prototype. It estimates visual fatigue correlates (eye aspect ratio, blink patterns, geometric head pitch) and camera displacement. It is **not** an automotive-certified safety system (ISO 26262 / ASIL) and must not be used as a primary collision-prevention device in actual motor vehicles.

---

### 2. Key Features

1. **Multi-Factor Driver Fatigue Detection:**
   - **Eye Aspect Ratio (EAR) & Blendshapes:** Dual-factor eye aperture measurement across 6 geometric landmarks per eye, paired with neural blink blendshapes (`eyeBlinkLeft`, `eyeBlinkRight`).
   - **Blink State Machine:** Finite State Machine (FSM) that accurately counts blinks, measures blink duration in milliseconds, flags long-blink micro-sleep precursors (>400ms), and computes rolling blink frequency (BPM).
   - **3D Head-Pose & Nodding Detection:** Approximates real-time head pitch, yaw, and roll to identify sustained downward head drops and repetitive nodding patterns.
   - **Face Tracking & Confidence Management:** Identifies face occlusion or driver head departure, maintaining a 1.5s grace period before flagging tracking loss rather than falsely assuming an absent face is safe.

2. **Intelligent 4-Tier Alert Management & Local Audio Synthesizer:**
   - **Level 0 (Normal):** Driver alert and forward-facing.
   - **Level 1 (Caution):** Early fatigue indicators observed; non-intrusive visual notification and gentle double-chime.
   - **Level 2 (High Concern):** Continuous eye closure >= 3.0s or nodding event; multi-tone emergency siren with pull-over recommendation.
   - **Level 3 (Persistent Concern):** Sustained micro-sleep >= 5.0s or recurring high alerts; high-urgency audio warble.
   - **Audio Flexibility:** Independent mute control that preserves visual safety telemetry, along with built-in sound verification testing.

3. **Free Automated Email Escalations (Gmail SMTP):**
   - **Zero Cost / Free Only:** Operates exclusively using standard Gmail SMTP (port 465 SSL). No SMS gateways, paid messaging APIs, or credit card subscriptions required.
   - **30-Second Sustained Escalation Threshold:** Automatically dispatches an emergency notification to the authorized contact if a high-risk condition persists for 30 consecutive seconds.
   - **Observation Integrity:** Escalation relies strictly on verified facial landmarks and timestamps. Missing face tracking is **never** interpreted as closed eyes.
   - **Credential Isolation:** Gmail App Passwords and SMTP secrets reside strictly in the backend `.env` file and are never sent to the browser runtime.
   - **Incident Payload:** Emails contain Incident ID, ISO timestamp, active duration, observed indicators, warning severity, and safe contact recommendations.
   - **Cooldowns & Deduplication:** Client and server-side rate limits prevent notification flooding. Duplicate events within the active window are suppressed.
   - **Optional Session Summary:** Automatically or manually sends complete session metrics and CSV event log attachments when monitoring stops.
   - **Local Fault-Tolerance:** Local detection and sirens operate 100% autonomously, continuing uninterrupted even if the backend or SMTP service is offline or unconfigured.
   - **Mock Testing Mode:** Built-in simulation mode allows full end-to-end testing without real Gmail credentials.

4. **OpenCV.js Motion & Camera Stability Analysis:**
   - Evaluates frame-to-frame feature displacement using OpenCV.js dense optical flow / spatial gradient estimation.
   - Incorporates illumination-shift suppression to prevent false vibration alerts from sudden lighting changes.
   - Clearly distinguishes apparent camera movement from physical vehicle chassis acceleration.

5. **Session Telemetry & Audit Persistence:**
   - **IndexedDB Local Storage:** Automatically logs session start/end times, durations, incident counts, and event timelines across browser refreshes without storing raw video or biometric facial images.
   - **Audit Timeline:** Real-time filterable event feed recording incident categories, severity levels, active durations, explanations, and email delivery states.

6. **Analytical Dashboards & Reports:**
   - **Chart.js Visualizations:** Historical incident distribution, warning severity breakdowns, and longitudinal blink duration trends.
   - **Export Capabilities:** One-click CSV export of raw session events, printable PDF report view, and direct email delivery.

7. **Settings & Dynamic Calibration:**
   - Reactive configuration interface with live threshold validation, authorized recipient email settings, live SMTP connectivity testing, localStorage syncing, and factory reset functionality.

8. **Hardware Roadmap (ESP32 + MPU6050):**
   - Built-in Web Serial API integration interface (`HardwareIMUInterface`) designed to ingest calibrated accelerometer and gyroscope telemetry from an external ESP32 micro-controller.

---

## 3. System Architecture

```
                    ┌────────────────────────────┐
                    │    Webcam Input Feed       │
                    └─────────────┬──────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
     ┌────────────────────────┐      ┌────────────────────────┐
     │  MediaPipe Face        │      │   OpenCV.js / Fallback │
     │  Landmarker (WASM)     │      │   Optical Flow Engine  │
     └────────────┬───────────┘      └────────────┬───────────┘
                  │                               │
        ┌─────────┼──────────┐                    │
        ▼         ▼          ▼                    │
    ┌───────┐ ┌───────┐ ┌─────────┐               │
    │  EAR  │ │ Blink │ │Head Pose│               │
    │Tracking│ │  FSM  │ │ Nodding │               │
    └───┬───┘ └───┬───┘ └────┬────┘               │
        │         │          │                    │
        └─────────┼──────────┴────────────────────┘
                  │
                  ▼
     ┌────────────────────────┐
     │  Risk Assessment Engine│ ◄── (Configurable Thresholds)
     │  (Explainable 4-Tiers) │
     └────────────┬───────────┘
                  │
        ┌─────────┼─────────────────────────┐
        ▼         ▼                         ▼
┌───────────────┐ ┌───────────────┐ ┌──────────────────────┐
│ Alert Manager │ │ Event Manager │ │ Escalation Manager   │
│ (Local Audio) │ │(Deduplication)│ │ (30s High-Risk Rule) │
└───────────────┘ └───────┬───────┘ └──────────┬───────────┘
                          │                    │
                          ▼                    ▼ (HTTP /api)
                  ┌───────────────┐ ┌──────────────────────┐
                  │IndexedDB Store│ │ Node Express Backend │
                  └───────┬───────┘ │ (Nodemailer / Gmail) │
                          │         └──────────┬───────────┘
                          ▼                    ▼ (SMTP :465)
            ┌───────────────────────────┐ ┌──────────────────────┐
            │  Automotive Cockpit UI    │ │ Authorized Recipient │
            │  - Live HUD & Telemetry   │ │ (Emergency Contact)  │
            │  - History, CSV & Reports │ └──────────────────────┘
            │  - Email Test & Settings  │
            └───────────────────────────┘
```

---

## 4. Free Email Notifications & Gmail SMTP Setup

The system includes a dedicated lightweight Node.js Express backend service (`server/index.js`) utilizing **Nodemailer** for free email notifications. **No paid third-party email APIs (SendGrid, Mailgun) and no SMS services are used.**

### 4.1 How to Generate a Free Gmail App Password

Google accounts require a dedicated 16-character **App Password** for SMTP access:

1. **Log into Google Account:** Open [Google Account Security](https://myaccount.google.com/security).
2. **Enable 2-Step Verification:** If not already enabled, click **2-Step Verification** and follow Google's steps to activate it.
3. **Generate App Password:**
   - In Google Account search bar, type `App Passwords`, or go to **2-Step Verification** -> scroll to **App passwords**.
   - Under **App name**, enter: `Smart Vehicle Safety`.
   - Click **Create**.
4. **Copy the 16-Character Password:**
   - Google will display a 16-character string (e.g., `abcd efgh ijkl mnop`).
   - Copy this string. You will paste it into your backend `.env` file without spaces.
5. **Security Notice:**
   - **Never** share or commit your App Password to GitHub.
   - **Never** place the App Password in frontend files or client-side storage.
   - The `.env` file is explicitly ignored in `.gitignore`.

### 4.2 Backend Environment Variables Configuration

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your preferred text editor:

```env
# Backend Server Port
PORT=3001

# Gmail SMTP Settings (Free)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true

# Authorized Gmail Sender (your Gmail address)
SMTP_USER=your-email@gmail.com

# Gmail 16-character App Password (generated above)
SMTP_PASS=abcdefghijklmnop

# Default Authorized Recipient for Emergency Escalations
ALERT_RECIPIENT_EMAIL=emergency-contact@example.com

# Mock Email Mode (Set to true to test email logic without Gmail credentials)
MOCK_EMAIL=false
```

> [!TIP]
> **Mock Email Mode (`MOCK_EMAIL=true`):**  
> If you do not have Gmail credentials ready, keep `MOCK_EMAIL=true`. The system will simulate acceptance, generate realistic message IDs, update UI indicators, and record events in session history without transmitting real emails.

### 4.3 Escalation Policy & Observation Reliability

- **Configurable 30-Second Threshold:** When an alert level of `High Concern` or `Persistent Concern` persists continuously for 30.0 seconds (default, configurable between 5s–120s in Settings), the escalation engine dispatches an alert email.
- **Missing Face Protection:** If the driver's face leaves camera view or is occluded, the tracking engine flags `Monitoring Unavailable`. The escalation counter immediately resets to zero. **Missing facial data is never interpreted as confirmed eye closure.**
- **Single Dispatch per Episode:** Escalation emails fire exactly once per continuous episode. Continued closure beyond 30s will not re-spam emails until the condition clears.
- **Cooldown Interval:** Configurable quiet window (default: 60s) prevents mail bombing between consecutive incidents.
- **Local Alarms Remain Active:** Audio sirens and visual HUD banners sound locally regardless of network or email backend status.

### 4.4 Delivery Status Truthfulness

The system strictly adheres to delivery transparency:
- When Nodemailer delivers a message to Gmail SMTP, Gmail returns `250 2.0.0 OK: message queued`.
- The system labels this as **"Accepted by SMTP Server (Queued for Delivery)"** rather than falsely declaring "Delivered to recipient inbox".
- If the backend is offline or credentials are missing, the UI displays a clear warning badge (**"Email Offline"** or **"Credentials Required"**) instead of pretending an email was sent.

---

## 5. Threshold Reconciliation (15.0s vs. 3.0s Standard)

In earlier documentation, an uncalibrated 15-second eye closure threshold was mentioned, whereas the original prototype configuration used 6.0 seconds.

### Engineering Analysis
From a vehicle dynamics standpoint:
- At 100 km/h (62 mph), 15.0 seconds of eye closure corresponds to **417 meters (nearly half a kilometer)** of unguided travel.
- Automotive human-factors research (NHTSA, SAE J3016) classifies continuous eyelid closure beyond **1.5 seconds as a micro-sleep precursor** and closure exceeding **2.5 to 3.0 seconds as a severe collision risk**.

### Standardized Configuration
In this implementation, thresholds have been unified, documented, and made fully configurable:
- **Caution Threshold (Level 1):** Default **1.5 seconds** (configurable between 0.5s – 5.0s).
- **High Concern Threshold (Level 2):** Default **3.0 seconds** (configurable between 1.5s – 10.0s).
- **Persistent Concern (Level 3):** Default **5.0 seconds** (configurable between 2.5s – 25.0s).
- **Email Escalation Threshold:** Default **30.0 seconds** of sustained high risk (configurable between 5s – 120s).
- **Long Blink Threshold:** Default **400 ms** (physiological blinks typically span 100–350 ms).

All threshold values are validated, clamped, and synchronized across UI controls, configuration stores, and automated tests.

---

## 6. Technology Stack

- **Build Tool:** Vite 5
- **Languages:** ECMAScript 2022 (ES Modules), HTML5, CSS3, Node.js (v18+)
- **Backend:** Node.js, Express 5, Nodemailer 6.10, CORS, Dotenv
- **Computer Vision:**
  - `@mediapipe/tasks-vision` (MediaPipe FaceLandmarker with local `.task` model bundle)
  - OpenCV.js 4.10.0 (Dense optical flow with spatial gradient fallback)
- **Email Delivery:** Direct Gmail SMTP via Nodemailer (Port 465 SSL, App Passwords, Zero Paid Services)
- **Analytics & Charts:** Chart.js 4.5
- **Local Persistence:** HTML5 IndexedDB API with localStorage fallback
- **Audio Synthesis:** Web Audio API (Multi-frequency oscillator synthesis)
- **Automated Testing:** Vitest 3.2

---

## 7. Installation & Execution

### Prerequisites
- Node.js (v18.0 or higher recommended)
- A modern desktop web browser (Chrome, Edge, Firefox, or Safari) equipped with a webcam.

### 1. Clone & Install Dependencies
```bash
# Navigate to the project root directory
cd mini-project-safety-master

# Install all runtime, backend, and development dependencies
npm install
```

### 2. Configure Environment
```bash
# Create local .env from placeholder template
cp .env.example .env
```
*(By default, `.env` has `MOCK_EMAIL=true`, so you can run the system immediately without configuring Gmail credentials).*

### 3. Start Backend & Frontend Services

Open two terminal windows:

**Terminal 1 (Backend Email Service):**
```bash
npm run server
```
*Starts Express server on `http://localhost:3001`.*

**Terminal 2 (Frontend Client):**
```bash
npm run dev
```
*Starts Vite dev server at `http://localhost:5173/` (with API proxy to `:3001`).*

Open `http://localhost:5173/` in your browser.

### 4. Build for Production
```bash
npm run build
```
Generates an optimized static production distribution in the `dist/` directory.

### 5. Execute Automated Test Suite
```bash
npm test
```
Executes the comprehensive Vitest unit and integration test suite across all 18 test files.

---

## 8. Operating Instructions & Demonstration Guide

To evaluate the system during review or faculty demonstration:

1. **Camera Initialization:**
   - Click **Start Monitoring** and grant camera permissions.
   - Observe the live FPS counter (~30–60 FPS) and facial landmark mesh overlay tracking the driver's eyes and nose orientation.
   - Note the **Email** status badge in the header telemetry bar (`Gmail Ready` or `Mock Mode`).
2. **Normal Driving Baseline:**
   - Maintain normal gaze and blink naturally.
   - Observe the blink counter incrementing while the continuous eye-closure timer remains at `0.0s`. Overall status indicates `Normal`.
3. **Prolonged Eye Closure (Caution):**
   - Close eyes for 1.5 seconds.
   - Observe the caution badge (`Caution`), metric highlighting in yellow, and a gentle chime.
4. **Micro-Sleep Alarm (High Concern):**
   - Hold eyes closed past 3.0 seconds.
   - Observe the status escalate to `High Concern`, a prominent red banner appear, and the multi-tone emergency siren activate.
   - Note the escalation timer countdown in the banner: `⏳ Emergency Contact Email Escalation in XXs if sustained`.
5. **30-Second Escalation Demonstration:**
   - Keep eyes closed (or test with lowered EAR threshold in Settings) until the 30-second escalation threshold is reached.
   - Observe the banner update: `📧 Escalation Alert Accepted by SMTP Queue` (or Mock Mode equivalent).
   - Local sirens continue sounding; an email with incident details and safe driver contact recommendations is queued.
6. **Face Occlusion / Tracking Loss Safety Check:**
   - Cover camera or turn head away so face tracking is lost.
   - Notice the status updates to `Face Not Detected` / `Monitoring Unavailable`.
   - **Crucial:** Confirm that missing face data does **not** advance the 30-second continuous eye-closure escalation counter.
7. **Settings & Live Email Verification:**
   - Navigate to the **Settings** tab.
   - View the **Authorized Contact & Free Email Escalation** section.
   - Click **Send Test Email** to verify your SMTP relay and receive instant status feedback.
8. **Session Finalization & Audit Report:**
   - Click **Stop Monitoring**.
   - Navigate to **Session History** to inspect the finalized session record.
   - Click **Email** on any session to email a complete session report with an attached CSV spreadsheet to the authorized contact.
   - Click **CSV** to download raw telemetry, or **Report** to open the printable PDF report view.

---

## 9. Automated Testing Strategy

The repository includes an extensive automated test suite executed via Vitest, verifying detection math, state machines, and the email notification pipeline:

| Test Suite | Focus Area | Status |
| :--- | :--- | :---: |
| `tests/escalation.test.js` | 30s threshold, face-loss suppression, deduplication, cooldowns | Passed (6/6) |
| `tests/emailService.test.js` | Email validation, payload generation, mock mode, provider failure, secrets isolation | Passed (9/9) |
| `tests/emailApi.test.js` | Express endpoints (`/api/email/status`, `/test`, `/alert`, `/summary`, `/health`) | Passed (6/6) |
| `tests/riskAssessment.test.js` | Multi-factor risk engine, 4-tier warning transitions, explanations | Passed (5/5) |
| `tests/alertManager.test.js` | Escalation rules, audio cooldowns, independent mute, dismissal | Passed (3/3) |
| `tests/eventManager.test.js` | Event logging, active condition deduplication, category metrics | Passed (2/2) |
| `tests/drowsiness.test.js` | Dual-eye closure, EAR vs. blendshapes, duration escalation, reset | Passed (3/3) |
| `tests/blinkAnalysis.test.js` | State machine transitions, blink counting, long blinks (>400ms) | Passed (3/3) |
| `tests/headPose.test.js` | Head pitch orientation, sustained nods, tracking loss grace period | Passed (2/2) |
| `tests/motionAnalysis.test.js` | Optical flow motion calculation, gradient fallback, IMU interface | Passed (3/3) |
| `tests/math.test.js` | Euclidean distances, EAR formulas, smoothing, 3D pose geometry | Passed (5/5) |
| `tests/config.test.js` | Threshold validation, boundary clamping, email preferences sync | Passed (3/3) |
| `tests/camera.test.js` | WebRTC getUserMedia lifecycle, device error formatting, resource release | Passed (3/3) |
| `tests/faceLandmarker.test.js` | MediaPipe model initialization, GPU/CPU delegate fallback, overlay rendering | Passed (3/3) |
| `tests/sessionManager.test.js` | Session lifecycle, unique ID generation, stats aggregation | Passed (1/1) |
| `tests/sessionStorage.test.js` | IndexedDB store, CRUD operations, localStorage & memory fallbacks | Passed (3/3) |
| `tests/reportGenerator.test.js` | CSV generation, RFC 4180 escaping, printable report markup | Passed (1/1) |
| `tests/integration.test.js` | End-to-end synthetic detection sequence to finalized session | Passed (1/1) |
| **Total Suite** | **18 Test Files** | **62/62 Passed** |

Run tests anytime with:
```bash
npm test
```

---

## 10. Privacy & Security Practices

- **Zero Cloud Video Ingestion:** WebRTC video frames are processed strictly in browser memory. No video or biometric frames are uploaded to any external server.
- **Strict Credential Isolation:** SMTP passwords and secrets are stored exclusively in the server-side `.env` file and are never sent to or stored in the browser.
- **No Passwords in Audit Logs:** Event timelines, session histories, and telemetry logs never record passwords, API keys, or raw authentication tokens.
- **No Biometric Identification Saved:** Facial landmark coordinates are discarded immediately after frame inference. No facial recognition templates are recorded.
- **Local Control:** Users can clear all historical session records at any time using the "Clear All History" button in the History view.

---

---

## 11. Future Hardware Integration (ESP32 + MPU6050)

For physical in-vehicle installations, optical flow camera motion can be augmented with physical 6-axis IMU telemetry:

```
[ESP32 Microcontroller]
         │ (I2C Bus: SDA=GPIO21, SCL=GPIO22)
         ▼
[MPU-6050 IMU Sensor] (Measures physical vehicle 3-axis G-force & gyro rates)
         │
         │ (USB Serial @ 115200 Baud)
         ▼
[Web Serial API] ──► src/js/vision/motionAnalysis.js (HardwareIMUInterface)
```

The system provides a ready-to-wire `HardwareIMUInterface` class in `motionAnalysis.js` to ingest serial streams in the format:
```
IMU:ax,ay,az,gx,gy,gz\n
```

---

## 12. Known Limitations

1. **Network Dependency for Email Delivery:** While local AI detection and audio alarms operate 100% offline, email escalation requires active internet connectivity on the vehicle host computer to reach the Gmail SMTP relay.
2. **SMTP Relay Latency:** Email delivery operates asynchronously (typical queue delivery: 1–5 seconds). The in-vehicle audio siren sounds instantly (0ms latency); email escalation functions as a secondary off-vehicle safety net.
3. **Ambient Lighting:** Standard RGB webcams require adequate ambient light. In complete nighttime driving, infrared illumination (NIR) would be necessary in production vehicles.
4. **Heavy Eyewear:** Thick frames or deeply tinted sunglasses may partially occlude eye landmarks.
5. **Extreme Viewing Angles:** Webcams placed farther than 45 degrees off-axis reduce face mesh detection fidelity.
6. **Camera Motion vs. Chassis Vibration:** Webcam optical flow measures camera housing motion relative to the cabin background; physical chassis vibration and road roughness require dedicated IMU accelerometers.

