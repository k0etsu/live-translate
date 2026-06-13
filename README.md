# Live Translate

Real-time Japanese-to-English speech translation with an always-on-top overlay. Powered by [kotoba-whisper](https://huggingface.co/kotoba-tech/kotoba-whisper-bilingual-v1.0) running locally — no API keys or internet connection required after initial model download.

## Features

- Real-time transcription and translation via a local Whisper model
- Always-on-top overlay window with configurable appearance
- GPU acceleration via CUDA (optional, falls back to CPU)
- Captures any audio source: microphone, system audio, virtual cables (VoiceMeeter, VB-Audio, etc.)
- Voice activity detection (VAD) with dynamic audio chunking
- Preset system for saving and loading configurations
- Light and dark theme
- No API keys required

## Requirements

- Windows, macOS, or Linux
- No Python installation required — the app manages its own isolated environment via [uv](https://github.com/astral-sh/uv)
- For GPU acceleration: an NVIDIA GPU with CUDA-compatible drivers

## Installation

Download the latest release for your platform from the [Releases](../../releases) page:

| Platform | File |
|---|---|
| Windows | `Live.Translate.0.0.1.exe` — run directly, no install needed |
| macOS (Intel) | `Live.Translate-0.0.1-mac.zip` — unzip and run |
| macOS (Apple Silicon) | `Live.Translate-0.0.1-arm64-mac.zip` — unzip and run |
| Linux | `Live.Translate-0.0.1.AppImage` — `chmod +x` then run |

On first launch, go to the **Setup** tab and click **Set Up Environment**. The app will download Python 3.11 and install all required packages (~2 GB including PyTorch).

## First-time setup

1. Launch the app
2. Open the **Setup** tab
3. Click **Set Up Environment** — this downloads Python 3.11 and installs all packages
4. Optionally click **Install CUDA PyTorch** if you have an NVIDIA GPU
5. Switch to the **Capture** tab, select your audio device, and click **Start Listening**
6. The model downloads automatically on first start (~1.6 GB, cached to `~/.cache/translator_models/`)

## Building from source

### Prerequisites

- Node.js 20+
- Git
- Windows Developer Mode enabled (required for symlink creation during packaging)

### Setup

```bash
git clone https://github.com/k0etsu/live-translate.git
cd live-translate
npm install
```

`npm install` automatically downloads the `uv` binary for your platform.

### Development

```bash
npm run dev:all
```

### Production build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Output is placed in `release/`.

## Project structure

```
live-translate/
├── electron/
│   ├── config/         # electron-store config persistence
│   ├── ipc/            # IPC channel definitions and handlers
│   ├── python/         # Python process management and uv venv setup
│   ├── main.ts         # Window management, app lifecycle
│   └── preload.ts      # Secure IPC bridge
├── overlay/            # Overlay window (separate HTML entry point)
├── python/
│   ├── modules/        # Audio capture, VAD, model inference, filters
│   ├── presets/        # Bundled default presets
│   ├── backend.py      # JSON line protocol entry point
│   └── requirements.txt
├── scripts/
│   └── download-uv.js  # Postinstall: downloads uv binary
├── shared/
│   └── types.ts        # Shared TypeScript types (Config, OverlayStyle, etc.)
├── src/
│   ├── components/     # Vue components (DeviceSelector, OverlayControls, PresetsPanel, CudaSetup)
│   └── App.vue         # Main UI (5-tab layout)
└── .github/workflows/
    └── release.yml     # CI: builds for all platforms on version tag push
```

## How it works

The Electron main process spawns a Python subprocess (`python/backend.py`) and communicates over stdin/stdout using a JSON line protocol. The Python backend handles audio capture via `soundcard`, voice activity detection via Silero VAD, and transcription/translation via the kotoba-whisper model loaded through HuggingFace Transformers.

The overlay is a separate frameless transparent Electron window that stays on top of other applications and receives text updates via IPC.

## Troubleshooting

**Python environment not detected after setup**
Delete `%APPDATA%\live-translate\venv` and run Set Up Environment again.

**CUDA not detected after installing CUDA PyTorch**
Restart the app after installation completes.

**Overlay not appearing**
Click Show Overlay on the Capture tab. The overlay may be positioned off-screen — check the Overlay tab and adjust position by dragging after it appears.

**SmartScreen warning on Windows / Gatekeeper warning on macOS**
The app is unsigned. On Windows: click "More info" then "Run anyway". On macOS: right-click the app, select Open, then click Open.

## License

GNU General Public License v3.0
