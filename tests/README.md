# Testing & Quantitative Evaluation Guide

This document describes the testing strategy and repeatable evaluation procedures for the **Smart Vehicle Safety & Driver Monitoring System**.

---

## 1. Automated Test Suite (Vitest)

Automated testing is configured and executed via Vitest. The test suite covers unit logic, mathematical algorithms, state machines, storage persistence, and end-to-end integration.

### Running Automated Tests
```bash
# Run all test suites once
npm test

# Run tests in interactive watch mode
npm run test:watch
```

### Test Suite Structure
| File | Scope | Key Assertions |
| :--- | :--- | :--- |
| `tests/math.test.js` | Algorithms & Geometry | 2D/3D Euclidean distance, EAR eyelid aperture formula, EMA smoothing, 3D pose vector estimation. |
| `tests/config.test.js` | Settings Validation | Boundary clamping, out-of-order threshold reconciliation, factory reset behavior. |
| `tests/drowsiness.test.js` | Fatigue Detection | EAR & blendshape combination, continuous closure timing, duration escalation, timer zeroing. |
| `tests/blinkAnalysis.test.js` | Blink Dynamics | Finite state machine (Open/Closed/Open), blink duration measurement, long-blink detection (>400ms), glitch rejection (<70ms). |
| `tests/headPose.test.js` | Orientation & Nodding | Downward pitch drop (< -14°), sustained nodding pattern (>1.6s), face absence grace period (1.5s). |
| `tests/riskAssessment.test.js` | Risk Assessment Engine | Multi-factor composite score calculation, 4-tier warning transitions, factor explanations. |
| `tests/alertManager.test.js` | Alert Engine | Audio synthesizer routing, cooldown enforcement, independent mute handling, banner dismissal without detector masking. |
| `tests/eventManager.test.js` | Event Logging | Ongoing condition deduplication, event clearing, metrics aggregation by category and severity. |
| `tests/sessionManager.test.js` | Session Lifecycle | Unique session ID formatting, live counter increments, finalization summaries. |
| `tests/reportGenerator.test.js` | Data Reporting | RFC 4180 CSV formatting, special character escaping, printable report DOM generation. |
| `tests/integration.test.js` | End-to-End Pipeline | Full sequence: Awake state -> eye closure -> FSM -> risk escalation -> alarm -> event log -> session storage. |

---

## 2. Quantitative Evaluation Protocol

To benchmark system performance with quantitative metrics (Precision, Recall, F1-Score, and Latency), use the following standardized evaluation procedure:

### A. Evaluation Scenarios
1. **Scenario 1 — Normal Driving (Baseline):**
   - 3 minutes of natural blinking and looking forward under standard ambient illumination (300–500 lux).
   - Expected: 0 false positive fatigue warnings. Blink rate ~ 12–22 BPM.
2. **Scenario 2 — Controlled Eye Closure (Micro-Sleep):**
   - 10 distinct eye closure events lasting between 3.5s and 5.0s, spaced 30 seconds apart.
   - Expected: 10/10 Level 2 High Concern alerts triggered within 3.0s ± 0.2s of closure onset.
3. **Scenario 3 — Head Nodding:**
   - 5 deliberate downward head nods (pitch < -15°) held for 2.0s each.
   - Expected: Head-nodding detected for each cycle.
4. **Scenario 4 — Camera Shake / Road Vibration Simulation:**
   - 5 cycles of gentle camera mount shaking for 3 seconds each.
   - Expected: Motion gauge indicates camera movement without false classification as driver drowsiness.
5. **Scenario 5 — Head Occlusion / Looking Away:**
   - Turn head away or cover camera for 5 seconds.
   - Expected: Grace period (1.5s) followed by "Face Not Detected" status without false "Normal" reading.

### B. Metric Calculation Formulas
- **Precision:** $\text{Precision} = \frac{TP}{TP + FP}$
- **Recall (Sensitivity):** $\text{Recall} = \frac{TP}{TP + FN}$
- **F1-Score:** $\text{F1} = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$
- **Detection Latency:** Time elapsed between threshold fulfillment and visual/audio alert generation (Target: $< 100 \text{ ms}$).
- **Inference Frame Rate:** Measured via live FPS counter (Target: $\ge 30 \text{ FPS}$ on standard laptop).

---

## 3. Manual Verification Checklist
- [x] Application launches via `npm run dev`.
- [x] Camera permissions prompt appears on Start Monitoring.
- [x] MediaPipe loads and renders facial landmarks on canvas overlay.
- [x] Continuous eye closure timer increments and resets cleanly upon reopening.
- [x] Audio alarm sounds on High Concern when unmuted, and remains silent when muted.
- [x] Stopping monitoring finalizes session and saves record to IndexedDB.
- [x] Session history view displays completed sessions across browser refreshes.
- [x] CSV export downloads a valid `.csv` file.
- [x] PDF report view opens clean printable report with summary tables.
- [x] Settings form updates thresholds and stores preferences in localStorage.
