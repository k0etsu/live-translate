# Live Translate - Real-time Speech Translation Application

A cross-platform Electron application that provides real-time speech-to-text translation with an always-on-top overlay window.

## Features

✨ **Core Features**
- Real-time speech recognition (Web Speech API or OpenAI Whisper)
- Multiple translation engines (Google Translate, DeepL, Google Apps Script)
- Bidirectional translation: English ↔ Japanese
- **Advanced Audio Capture** with multiple source options:
  - 🎤 Microphone input with configurable sensitivity
  - 🔊 System audio capture (Windows/macOS/Linux)
  - 🪟 Application-specific audio capture
  - Real-time audio level monitoring and visualization
  - Automatic gain control, echo cancellation, noise suppression
  - Multiple audio device support with device switching
  - Configurable sample rates (16kHz, 44.1kHz, 48kHz)
  - Audio buffer size adjustment for performance tuning
- Semi-transparent, draggable overlay window for displaying translations
- Customizable overlay appearance (opacity, colors, font size)
- API key management with secure local storage
- Light and dark theme support

🎯 **Advanced Capabilities**
- Multi-source audio capture (microphone, system, application)
- Multiple speech recognition and translation backends
- Real-time audio level meters with peak detection
- Audio processing pipeline with professional features
- Settings persistence across sessions
- Cross-platform support (Windows, macOS, Linux)
- Modern, responsive UI

## Project Structure

```
live-translate/
├── electron/              # Electron main process
│   ├── main.ts           # App initialization & window management
│   └── preload.ts        # IPC bridge for security
├── src/
│   ├── components/       # Vue components
│   │   └── Overlay.vue   # Translation overlay window
│   ├── services/         # Business logic
│   │   ├── translationService.ts
│   │   ├── speechRecognitionService.ts
│   │   ├── audioCaptureService.ts
│   │   └── storageService.ts
│   ├── types/            # TypeScript interfaces
│   │   └── index.ts
│   ├── assets/           # CSS and static files
│   ├── App.vue           # Main application component
│   ├── main.ts           # Vue app entry
│   └── overlay-main.ts   # Overlay app entry
├── public/               # Static assets
├── index.html            # Main window HTML
├── overlay.html          # Overlay window HTML
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## Installation

### Prerequisites
- Node.js 16+ and npm/yarn
- Git

### Setup

1. Clone or navigate to the project directory:
```bash
cd live-translate
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file with your API keys:
```env
VITE_OPENAI_API_KEY=your_openai_key
VITE_DEEPL_API_KEY=your_deepl_key
VITE_GOOGLE_APPS_SCRIPT_URL=your_google_apps_script_url
```

## Usage

### Development Mode

Run both Vite dev server and Electron in parallel:
```bash
npm run dev:all
```

Or run them separately:
```bash
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Electron
npm run electron
```

### Production Build

Build the application:
```bash
npm run build
```

Run the built application:
```bash
npm start
```

## Configuration

### API Keys

The application supports three translation services:

1. **Google Translate (via Google Apps Script)**
   - Free tier available
   - Create a Google Apps Script that wraps the Google Translate API
   - Paste the deployment URL in settings

2. **DeepL API**
   - Sign up at https://www.deepl.com/pro
   - Free tier with 500,000 characters/month
   - Paste API key in settings

3. **OpenAI Whisper + GPT**
   - For speech recognition: OpenAI Whisper
   - For translation: GPT-3.5/GPT-4
   - Requires OpenAI API key with credits

## Configuration

### API Keys

The application supports three translation services:

1. **Google Translate (via Google Apps Script)**
   - Free tier available
   - Create a Google Apps Script that wraps the Google Translate API
   - Paste the deployment URL in settings

2. **DeepL API**
   - Sign up at https://www.deepl.com/pro
   - Free tier with 500,000 characters/month
   - Paste API key in settings

3. **OpenAI Whisper + GPT**
   - For speech recognition: OpenAI Whisper
   - For translation: GPT-3.5/GPT-4
   - Requires OpenAI API key with credits

### Audio Input Options

The application supports multiple audio sources:

#### 1. Microphone Input
- Direct capture from system microphone
- Configurable sensitivity and gain control
- Automatic echo cancellation
- Noise suppression
- Perfect for speech-to-speech translation

#### 2. System Audio Capture
- Capture audio from system speakers/output
- Monitor any audio playing on your system
- Translate music lyrics, dialog, notifications
- Supported on Windows, macOS, and Linux

#### 3. Application Audio Capture
- Select specific applications to capture
- Useful for translating game audio, video calls, etc.
- Mix microphone with application audio if needed

#### Advanced Audio Features
- **Real-time Level Monitoring**: Visual feedback of input levels
- **Automatic Gain Control**: Maintains consistent input levels
- **Echo Cancellation**: Removes speaker feedback
- **Noise Suppression**: Reduces background noise
- **Sample Rate Selection**: 16kHz (voice), 44.1kHz (CD), 48kHz (pro)
- **Buffer Size Tuning**: Adjust for latency vs CPU usage
- **Multiple Device Support**: Switch between audio devices on the fly
- **Audio Level Meters**: Peak and average level visualization

For detailed audio configuration information, see [AUDIO_CAPTURE_GUIDE.md](AUDIO_CAPTURE_GUIDE.md)

### Customizing the Overlay
- **Opacity**: 0-100% transparency
- **Background Color**: Any RGB color
- **Font Size**: 12-32px
- **Font Color**: Any RGB color

All settings persist automatically.

## Development Guide

### Adding a New Translation Engine

1. Update `AppSettings` in [src/types/index.ts](src/types/index.ts)
2. Add translation method in [src/services/translationService.ts](src/services/translationService.ts)
3. Add UI option in [src/App.vue](src/App.vue)

### Adding a New Speech Recognition Engine

1. Add method in [src/services/speechRecognitionService.ts](src/services/speechRecognitionService.ts)
2. Update the `startListening` method to handle the new engine
3. Add UI option in [src/App.vue](src/App.vue)

## Architecture

### Main Process (Electron)
- Handles window management (main window + overlay)
- Manages IPC communication
- Controls app lifecycle

### Renderer Process (Vue)
- Main application UI (settings, controls, output)
- Speech recognition and translation coordination
- Overlay window display

### Services
- **TranslationService**: Handles API communication with various translation backends
- **SpeechRecognitionService**: Manages speech input using Web Speech API or Whisper
- **AudioCaptureService**: Captures audio from system/application
- **StorageService**: Persists user settings to localStorage

## Security Considerations

- ✅ Context isolation enabled in Electron
- ✅ Preload script for secure IPC
- ✅ No node integration in renderer
- ✅ Sandbox enabled
- ✅ API keys stored locally only (never sent to servers)

## Troubleshooting

### Microphone not working
- Check browser permissions for microphone access
- Verify system audio settings
- Try "Web Speech API" engine first

### Translation fails
- Verify API keys are correct
- Check internet connection
- Ensure API key has remaining quota
- Check browser console for detailed errors

### Overlay not appearing
- Ensure overlay is toggled "on" in main window
- Check if application has focus
- Try restarting the application

## Future Enhancements

- 🎙️ Noise suppression for audio input
- 🌐 Support for more language pairs
- 📊 Translation history panel
- 🔤 Keyboard shortcut customization
- 🎨 More theme options
- 📱 Mobile app support
- ⚙️ Advanced audio processing options
- 🔊 Speaker output translation (hearing assistance)
- 🎮 Gaming subtitle overlay
- 💬 Real-time conversation translation (side-by-side)

## Documentation

Comprehensive documentation is available in the following files:

- **[README.md](README.md)** - Main feature documentation (this file)
- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute quick start guide
- **[BUILD.md](BUILD.md)** - Development & deployment guide
- **[ENV_SETUP.md](ENV_SETUP.md)** - API key configuration
- **[AUDIO_CAPTURE_GUIDE.md](AUDIO_CAPTURE_GUIDE.md)** - Audio source and processing details
- **[AUDIO_UI_INTEGRATION.md](AUDIO_UI_INTEGRATION.md)** - UI component implementation

## License

MIT License - Feel free to use and modify

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Note**: This project requires valid API keys for translation and speech recognition services. Free tiers are available for most services.
