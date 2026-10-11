# Local Machine Learning Models

This directory contains the AI model blobs necessary to conduct face and landmark detection directly on the user's local machine using WebAssembly.

## `face_landmarker.task`

- **Source**: Google MediaPipe Official Models
- **URL**: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
- **Description**: Evaluates facial structure producing 478 3D landmarks as well as 52 blendshape scores (which includes `eyeBlinkLeft` and `eyeBlinkRight` used by this project).
- **Format**: Flatbuffer `.task` payload.

> **Note**: This file is downloaded locally so the application doesn't rely entirely upon a CDN URL which can sometimes be blocked by strict ad-blockers or corporate intranet policies.
