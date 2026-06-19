import Store from 'electron-store'
import { Config, DEFAULT_CONFIG } from '../../shared/types'

const schema: Store.Schema<Config> = {
  audioDeviceName:           { type: 'string',  default: DEFAULT_CONFIG.audioDeviceName },
  volumeThreshold:           { type: 'number',  default: DEFAULT_CONFIG.volumeThreshold },
  useVadFilter:              { type: 'boolean', default: DEFAULT_CONFIG.useVadFilter },
  vadThreshold:              { type: 'number',  default: DEFAULT_CONFIG.vadThreshold },
  useDynamicChunking:        { type: 'boolean', default: DEFAULT_CONFIG.useDynamicChunking },
  dynamicMaxChunkSec:        { type: 'number',  default: DEFAULT_CONFIG.dynamicMaxChunkSec },
  dynamicSilenceTimeoutSec:  { type: 'number',  default: DEFAULT_CONFIG.dynamicSilenceTimeoutSec },
  dynamicMinSpeechSec:       { type: 'number',  default: DEFAULT_CONFIG.dynamicMinSpeechSec },
  model:                     { type: 'string',  default: DEFAULT_CONFIG.model },
  task:                      { type: 'string',  default: DEFAULT_CONFIG.task },
  temperature:               { type: 'number',  default: DEFAULT_CONFIG.temperature },
  maxNewTokens:              { type: 'number',  default: DEFAULT_CONFIG.maxNewTokens },
  noRepeatNgramSize:         { type: 'number',  default: DEFAULT_CONFIG.noRepeatNgramSize },
  overlayFontSize:   { type: 'number',  default: DEFAULT_CONFIG.overlayFontSize },
  overlayFontWeight: { type: 'string',  default: DEFAULT_CONFIG.overlayFontWeight },
  overlayOpacity:    { type: 'number',  default: DEFAULT_CONFIG.overlayOpacity },
  overlayBgColor:    { type: 'string',  default: DEFAULT_CONFIG.overlayBgColor },
  overlayFontColor:  { type: 'string',  default: DEFAULT_CONFIG.overlayFontColor },
  overlayTextShadow: { type: 'boolean', default: DEFAULT_CONFIG.overlayTextShadow },
  overlayTextAlign:  { type: 'string',  default: DEFAULT_CONFIG.overlayTextAlign },
  overlayVertAlign:  { type: 'string',  default: DEFAULT_CONFIG.overlayVertAlign },
  overlayWidth:      { type: 'number',  default: DEFAULT_CONFIG.overlayWidth },
  overlayHeight:     { type: 'number',  default: DEFAULT_CONFIG.overlayHeight },
  overlayX:          { type: 'number',  default: DEFAULT_CONFIG.overlayX },
  overlayY:          { type: 'number',  default: DEFAULT_CONFIG.overlayY },
  mainWindowWidth:   { type: 'number',  default: DEFAULT_CONFIG.mainWindowWidth },
  mainWindowHeight:  { type: 'number',  default: DEFAULT_CONFIG.mainWindowHeight },
  mainWindowX:       { type: 'number',  default: DEFAULT_CONFIG.mainWindowX },
  mainWindowY:       { type: 'number',  default: DEFAULT_CONFIG.mainWindowY },
  theme:             { type: 'string',  default: DEFAULT_CONFIG.theme },
}

export const store = new Store<Config>({ schema })

export function getConfig(): Config {
  return store.store as Config
}

export function setConfig(partial: Partial<Config>): void {
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) {
      store.set(key as keyof Config, value)
    }
  }
}
