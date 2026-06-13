// Shared types — Python-backend-only, mirrors hololivetl config structure.

export interface Config {
  // Audio device
  audioDeviceName: string

  // Audio / VAD
  volumeThreshold:           number   // RMS gate (0.001–0.05)
  useVadFilter:              boolean
  vadThreshold:              number   // Silero confidence (0–1)
  useDynamicChunking:        boolean
  dynamicMaxChunkSec:        number   // max segment length (s)
  dynamicSilenceTimeoutSec:  number   // silence before flush (s)
  dynamicMinSpeechSec:       number   // minimum speech to transcribe (s)

  // ASR model
  model:               string   // HuggingFace model ID
  task:                'translate' | 'transcribe'
  temperature:         number
  maxNewTokens:        number
  noRepeatNgramSize:   number

  // Overlay appearance
  overlayFontSize:   number
  overlayFontWeight: 'normal' | 'bold'
  overlayOpacity:    number   // background opacity 0–1
  overlayBgColor:    string   // CSS hex
  overlayFontColor:  string   // CSS hex
  overlayTextShadow: boolean
  overlayTextAlign:  'left' | 'center' | 'right'
  overlayVertAlign:  'top' | 'center' | 'bottom'
  overlayWidth:      number   // px
  overlayHeight:     number   // px
  overlayX:          number
  overlayY:          number

  // Main window geometry
  mainWindowWidth:   number
  mainWindowHeight:  number
  mainWindowX:       number   // -1 = not yet saved (let OS center)
  mainWindowY:       number
}

export const DEFAULT_CONFIG: Config = {
  audioDeviceName: '',

  volumeThreshold:          0.006,
  useVadFilter:             true,
  vadThreshold:             0.12,
  useDynamicChunking:       true,
  dynamicMaxChunkSec:       6.0,
  dynamicSilenceTimeoutSec: 0.7,
  dynamicMinSpeechSec:      0.3,

  model:             'kotoba-tech/kotoba-whisper-bilingual-v1.0',
  task:              'translate',
  temperature:       0.08,
  maxNewTokens:      224,
  noRepeatNgramSize: 3,

  overlayFontSize:   20,
  overlayFontWeight: 'bold',
  overlayOpacity:    0,
  overlayBgColor:    '#282828',
  overlayFontColor:  '#ff8080',
  overlayTextShadow: true,
  overlayTextAlign:  'left',
  overlayVertAlign:  'bottom',
  overlayWidth:      1000,
  overlayHeight:     140,
  overlayX:          100,
  overlayY:          80,

  mainWindowWidth:   820,
  mainWindowHeight:  760,
  mainWindowX:       -1,
  mainWindowY:       -1,
}

// Sent to overlay window
export interface OverlayStyle {
  fontSize:   number
  fontWeight: string
  fontColor:  string
  bgColor:    string
  opacity:    number
  textShadow: boolean
  textAlign:  'left' | 'center' | 'right'
  vertAlign:  'top' | 'center' | 'bottom'
  width:      number
  height:     number
}

// Preset stored as a named subset of Config
export interface Preset extends Partial<Config> {
  name: string
}

export interface PythonStats {
  chunks:       number
  translations: number
  filtered:     number
  avg_ms:       number
}
