# SilenceCutter AI 🎙️✂️
### Intelligent Audio Silence Remover & Studio Master for AI-Generated Voice

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38b2ac.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)

**SilenceCutter AI** is a client-side audio analysis and silence removal tool designed specifically for AI-generated speech, podcast voiceovers, TTS (Text-to-Speech) generations, and voice clones.

AI voice models frequently introduce unnatural dead air, hesitant breath pauses, or long gap transitions between paragraphs. SilenceCutter AI analyzes the waveform, detects all silences exceeding your threshold (default **0.5 seconds**, adjustable from **0.1s to 5.0s**), seamlessly splices the audio with anti-click micro-crossfades, and exports the final file in **WAV (lossless)**, **FLAC (lossless)**, or **MP3 (320 kbps)**.

---

## ✨ Features

- **⚡ User-Adjustable Silence Threshold**:
  - Default: **0.5 seconds** (optimized for AI narration and speech pacing).
  - Fully customizable between **0.1s and 5.0s** via continuous slider, numeric input, or quick preset buttons (`0.2s`, `0.5s*`, `1.0s`, `2.0s`, `3.0s`, `5.0s`).
- **🛡️ Plosive & Vocal Margin Protection**:
  - Configurable safety padding (default 40ms) preserves initial plosive consonants (`p`, `t`, `k`, `b`) and soft vocal release tails so words are never truncated.
- **✨ Anti-Click Micro Crossfades**:
  - Spliced speech segments are blended using smooth 5ms cosine crossfades, eliminating audio pops, clicks, or DC offset glitches.
- **📊 Real-Time Interactive Waveform & Timeline**:
  - High-resolution HTML5 canvas waveform renderer.
  - Detected silence gaps are visually highlighted with red diagonal striping and duration badges (e.g., `CUT 1.2s`).
  - Zoom in, zoom out, fit to screen, and click-to-seek playhead.
- **🎚️ A/B Comparison Player**:
  - Instant toggle between **Processed (Clean)** and **Original (Raw)** with synchronized playhead position.
  - Real-time left/right stereo VU meters.
  - Variable playback speed (0.75x, 1x, 1.25x, 1.5x) and segment loop playback.
- **📋 Granular Silence Gap Manager**:
  - Review every detected pause with its start/end timestamp, duration, and dB energy level.
  - Audition individual gaps with 1-click preview.
  - Toggle specific pauses to keep or cut individually.
- **💽 Multi-Format High-Quality Export**:
  - **WAV (Lossless)**: 24-bit PCM (Studio Pro), 32-bit Float (True Lossless), or 16-bit PCM (Broadcast CD).
  - **FLAC (Lossless)**: 16-bit Free Lossless Audio Codec (RFC 9582 compliant).
  - **MP3 (High Quality)**: Broadcast-grade 320 kbps CBR (Constant Bitrate) MP3 encoded client-side via LAME.
  - **Peak Normalization**: Optional -0.1 dBFS true-peak loudness optimization.
  - **EDL Cut Report**: Download an Edit Decision List text file for importing cuts directly into Adobe Premiere, DaVinci Resolve, or Final Cut Pro.
- **🔒 100% Client-Side & Private**:
  - All decoding, analysis, splicing, and encoding take place entirely in your browser using the Web Audio API and WebAssembly/JS. No audio files are ever sent to remote servers.

---

## 🛠️ How It Works Under the Hood

```
[ Input Audio File / Sample ]
            │
            ▼
[ Web Audio API Decoding ] ───> Extract Float32Array PCM Channels
            │
            ▼
[ Energy & RMS Analysis ]
   • Analyze 20ms frames with 10ms hop
   • Measure RMS level vs. Threshold (dB)
   • Identify contiguous quiet frames
            │
            ▼
[ Boundary Calculation & Padding ]
   • Filter silences lasting > Threshold Duration (0.1s - 5.0s, default 0.5s)
   • Apply pre-roll and post-roll voice margin padding
   • Compute inverse speech segments
            │
            ▼
[ Audio Splicing Engine ]
   • Concatenate speech regions
   • Apply 5ms cosine micro-crossfade at each boundary
   • Optional: shorten long silences to natural breathing pauses (200ms)
   • Optional: peak normalize to -0.1 dBFS
            │
            ▼
[ Multi-Format Encoding ]
   ├──> RIFF WAV (16 / 24 / 32-bit Float PCM)
   ├──> FLAC (Lossless RFC 9582 Frames with CRC8 & CRC16)
   └──> MP3 (320 kbps CBR via LAME)
```

---

## 🚀 Quick Start & Development

### Prerequisites
- Node.js 18+ (Node 20 or 22 recommended)
- npm or bun

### 1. Clone the repository
```bash
git clone https://github.com/your-username/silence-cutter-ai.git
cd silence-cutter-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run automated unit tests
All core silence detection math, threshold range validations (0.1s - 5.0s), and WAV/FLAC/MP3 encoders are covered by unit tests using Node's test runner:
```bash
npx tsx --test src/utils/audioSilence.test.ts src/utils/audioExport.test.ts
```

### 5. Build for production
```bash
npm run build
```
The compiled static assets will be in the `dist/` directory, ready to be deployed to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, Firebase Hosting).

---

## 📂 Project Structure

```
├── src/
│   ├── components/
│   │   ├── Header.tsx              # App bar, audio metadata, quick actions
│   │   ├── AudioUploader.tsx       # Drag-and-drop zone & AI speech presets
│   │   ├── WaveformViewer.tsx      # Canvas waveform, scrub head, cut overlays
│   │   ├── AudioPlayerControls.tsx # Transport controls, A/B toggle, VU meters
│   │   ├── AnalysisStatsCard.tsx   # Silence cut metrics and pacing statistics
│   │   ├── SilenceSettingsPanel.tsx# Adjustable threshold (0.1s-5.0s), dB sensitivity, margin
│   │   ├── SilenceSegmentList.tsx  # Granular table of detected silence gaps
│   │   ├── ExportModal.tsx         # Multi-format export dialog (WAV, FLAC, MP3 320k)
│   │   └── SyntheticPresets.ts     # In-memory realistic AI speech samples
│   ├── utils/
│   │   ├── audioSilence.ts         # Silence detection algorithms & crossfading
│   │   ├── audioSilence.test.ts    # Unit tests for silence detection
│   │   ├── audioExport.ts          # WAV, FLAC, and MP3 320kbps encoders
│   │   └── audioExport.test.ts     # Unit tests for format exporters & thresholds
│   ├── App.tsx                     # Main application layout & audio graph pipeline
│   ├── main.tsx                    # React entrypoint
│   └── index.css                   # Tailwind CSS imports
├── index.html                      # HTML entrypoint with metadata
├── package.json                    # Dependencies and scripts
└── vite.config.ts                  # Vite build configuration
```

---

## 🎧 Supported Audio Formats

| Format | File Extension | Input Support | Export Support |
| :--- | :--- | :---: | :---: |
| **WAV** | `.wav` | ✅ | ✅ (16, 24, 32-bit Float) |
| **FLAC** | `.flac` | ✅ | ✅ (Lossless RFC 9582) |
| **MP3** | `.mp3` | ✅ | ✅ (320 kbps CBR) |
| **M4A / AAC** | `.m4a`, `.aac` | ✅ | — |
| **OGG / Vorbis** | `.ogg` | ✅ | — |
| **WebM Audio** | `.webm` | ✅ | — |
| **EDL Cut List** | `.txt` | — | ✅ (Premiere / DaVinci) |

---

## 📄 License

This project is licensed under the Apache 2.0 License.
