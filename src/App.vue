<template>
  <div :class="['app-container', `theme-${theme}`]">
    <header class="app-header">
      <h1>Live Translate</h1>
      <button @click="toggleTheme" class="theme-toggle" title="Toggle dark/light mode">
        {{ theme === 'dark' ? '☀️' : '🌙' }}
      </button>
    </header>

    <main class="app-main">
      <section class="settings-section">
        <h2>Settings</h2>
        
        <div class="control-group">
          <label>Translation Direction:</label>
          <select v-model="settings.translationDirection" @change="saveSettings">
            <option value="en-to-ja">English → Japanese</option>
            <option value="ja-to-en">Japanese → English</option>
          </select>
        </div>

        <div class="control-group">
          <label>Speech Recognition Engine:</label>
          <select v-model="settings.recognitionEngine" @change="saveSettings">
            <option value="webSpeech">Web Speech API</option>
            <option value="whisper">OpenAI Whisper</option>
          </select>
        </div>

        <div class="control-group">
          <label>Translation Engine:</label>
          <select v-model="settings.translationEngine" @change="saveSettings">
            <option value="google">Google Translate</option>
            <option value="deepl">DeepL</option>
            <option value="openai">OpenAI GPT</option>
          </select>
        </div>

        <div class="control-group">
          <label>Audio Input Device:</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <select v-model="settings.selectedAudioDevice" @change="saveSettings" style="flex: 1;">
              <option value="">Default Device</option>
              <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
                {{ device.label }}
              </option>
            </select>
            <button @click="refreshAudioDevices" class="btn-refresh" title="Refresh device list">
              🔄
            </button>
            <button @click="selectSystemAudio" class="btn-refresh" title="Select system audio or application">
              🎵
            </button>
          </div>
          <small v-if="audioDevices.length <= 1" style="color: #999; margin-top: 4px;">
            Found {{ audioDevices.length }} device(s). Click 🎵 to capture application/system audio.
          </small>
          <small v-if="systemAudioActive" style="color: #10b981; margin-top: 4px;">
            ✓ System audio capture active
          </small>
        </div>
      </section>

      <section class="api-section">
        <h2>API Configuration</h2>
        
        <div class="control-group">
          <label>OpenAI API Key:</label>
          <div class="api-key-input-group">
            <input
              v-model="apiKeys.openaiKey"
              :type="showApiKeys.openai ? 'text' : 'password'"
              placeholder="sk-..."
              @change="saveApiKeys"
            />
            <button @click="toggleApiKeyVisibility('openai')" class="btn-toggle-visibility" title="Show/hide key">
              {{ showApiKeys.openai ? '👁️' : '👁️‍🗨️' }}
            </button>
            <button @click="testOpenAIConnection" :disabled="!apiKeys.openaiKey" class="btn-test">
              {{ testingOpenAI ? 'Testing...' : 'Test' }}
            </button>
          </div>
          <span v-if="apiConnectionStatus.openai" :class="['status-text', apiConnectionStatus.openai.success ? 'success' : 'error']">
            {{ apiConnectionStatus.openai.message }}
          </span>
        </div>

        <div class="control-group">
          <label>DeepL API Key:</label>
          <div class="api-key-input-group">
            <input
              v-model="apiKeys.deeplKey"
              :type="showApiKeys.deepl ? 'text' : 'password'"
              placeholder="Your DeepL API key"
              @change="saveApiKeys"
            />
            <button @click="toggleApiKeyVisibility('deepl')" class="btn-toggle-visibility" title="Show/hide key">
              {{ showApiKeys.deepl ? '👁️' : '👁️‍🗨️' }}
            </button>
            <button @click="testDeepLConnection" :disabled="!apiKeys.deeplKey" class="btn-test">
              {{ testingDeepL ? 'Testing...' : 'Test' }}
            </button>
          </div>
          <span v-if="apiConnectionStatus.deepl" :class="['status-text', apiConnectionStatus.deepl.success ? 'success' : 'error']">
            {{ apiConnectionStatus.deepl.message }}
          </span>
        </div>

        <div class="control-group">
          <label>Google Apps Script URL:</label>
          <input
            v-model="apiKeys.googleAppsScriptUrl"
            type="text"
            placeholder="https://script.google.com/..."
            @change="saveApiKeys"
          />
        </div>
      </section>

      <section class="overlay-section">
        <h2>Overlay Customization</h2>
        
        <div class="control-group">
          <label>Opacity: {{ (settings.overlayOpacity * 100).toFixed(0) }}%</label>
          <input
            v-model.number="settings.overlayOpacity"
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            @change="saveSettings"
          />
        </div>

        <div class="control-group">
          <label>Background Color:</label>
          <input
            v-model="settings.overlayBackgroundColor"
            type="color"
            @change="saveSettings"
          />
        </div>

        <div class="control-group">
          <label>Font Size: {{ settings.overlayFontSize }}px</label>
          <input
            v-model.number="settings.overlayFontSize"
            type="range"
            min="12"
            max="32"
            step="1"
            @change="saveSettings"
          />
        </div>

        <div class="control-group">
          <label>Font Color:</label>
          <input
            v-model="settings.overlayFontColor"
            type="color"
            @change="saveSettings"
          />
        </div>
      </section>

      <section class="control-section">
        <button 
          @click="startListening"
          :disabled="isListening"
          class="btn btn-primary"
        >
          {{ isListening ? 'Listening...' : 'Start Listening' }}
        </button>
        
        <button 
          @click="stopListening"
          :disabled="!isListening"
          class="btn btn-secondary"
        >
          Stop Listening
        </button>

        <button 
          @click="toggleOverlay"
          class="btn btn-tertiary"
        >
          {{ overlayVisible ? 'Hide Overlay' : 'Show Overlay' }}
        </button>
      </section>

      <!-- Input Display Component -->
      <InputDisplay 
        :transcription="currentStreamingTranscription"
        :is-recording="isListening"
        @text-edited="onInputTextEdited"
      />

      <section class="output-section">
        <h2>Translation Output</h2>
        <div class="output-box">
          <p v-if="currentTranscript" class="transcript">
            <strong>Original:</strong> {{ currentTranscript }}
          </p>
          <p v-if="currentTranslation" class="translation">
            <strong>Translation:</strong> {{ currentTranslation }}
          </p>
          <p v-if="!currentTranscript && !currentTranslation" class="empty">
            No translation yet...
          </p>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { AppSettings, StreamingTranscription } from '@/types/index'
import { StorageService } from '@/services/storageService'
import { speechRecognitionService } from '@/services/speechRecognitionService'
import { translationService } from '@/services/translationService'
import { audioCaptureService } from '@/services/audioCaptureService'
import InputDisplay from '@/components/InputDisplay.vue'

const settings = ref<AppSettings>(StorageService.getSettings())
const apiKeys = ref(settings.value.apiKeys)
const theme = ref<'light' | 'dark'>(settings.value.theme)
const isListening = ref(false)
const overlayVisible = ref(false)
const currentTranscript = ref('')
const currentTranslation = ref('')
const currentStreamingTranscription = ref<StreamingTranscription | undefined>()
const audioDevices = ref<Array<{ deviceId: string; label: string }>>([])
const systemAudioActive = ref(false)
const systemAudioStream = ref<MediaStream | null>(null)

const showApiKeys = ref({
  openai: false,
  deepl: false
})

const testingOpenAI = ref(false)
const testingDeepL = ref(false)

const apiConnectionStatus = ref<Record<string, { success: boolean; message: string }>>({})

// Get source and target languages based on translation direction
const sourceLanguage = computed(() => {
  return settings.value.translationDirection === 'ja-to-en' ? 'ja' : 'en'
})

const targetLanguage = computed(() => {
  return settings.value.translationDirection === 'ja-to-en' ? 'en' : 'ja'
})

onMounted(async () => {
  try {
    await speechRecognitionService.initialize()
    // Load available audio devices
    await loadAudioDevices()
  } catch (error) {
    console.error('Failed to initialize speech recognition:', error)
  }

  // Set API keys
  translationService.setApiKeys(apiKeys.value)
  speechRecognitionService.setApiKeys(apiKeys.value)
})

const loadAudioDevices = async () => {
  console.log('Loading audio devices...')
  audioDevices.value = await audioCaptureService.getAudioInputDevices()
  console.log('Loaded audio devices:', audioDevices.value)
}

const refreshAudioDevices = async () => {
  console.log('Refreshing audio devices...')
  await loadAudioDevices()
  console.log('Audio devices refreshed')
}

const selectSystemAudio = async () => {
  try {
    const result = await audioCaptureService.selectSystemAudioSource()
    if (result) {
      systemAudioStream.value = result.stream
      systemAudioActive.value = true
      
      // Stop the stream when user stops the selection (click stop button in browser)
      result.stream.getTracks().forEach(track => {
        track.onended = () => {
          systemAudioActive.value = false
          systemAudioStream.value = null
        }
      })
      
      console.log('System audio capture started:', result.label)
    }
  } catch (error) {
    console.error('Failed to select system audio:', error)
    systemAudioActive.value = false
  }
}

const saveSettings = () => {
  settings.value.theme = theme.value
  StorageService.saveSettings(settings.value)
}

const saveApiKeys = () => {
  settings.value.apiKeys = apiKeys.value
  StorageService.saveApiKeys(apiKeys.value)
  translationService.setApiKeys(apiKeys.value)
  speechRecognitionService.setApiKeys(apiKeys.value)
}

const toggleApiKeyVisibility = (provider: 'openai' | 'deepl') => {
  showApiKeys.value[provider] = !showApiKeys.value[provider]
}

const testOpenAIConnection = async () => {
  if (!apiKeys.value.openaiKey) {
    apiConnectionStatus.value.openai = { success: false, message: 'API key is empty' }
    return
  }

  testingOpenAI.value = true
  try {
    // Test with a simple Whisper API call (for speech recognition)
    const formData = new FormData()
    const audioBlob = new Blob(['test'], { type: 'audio/wav' })
    formData.append('file', audioBlob, 'test.wav')
    formData.append('model', 'whisper-1')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeys.value.openaiKey}`
      },
      body: formData
    })

    if (response.status === 401) {
      apiConnectionStatus.value.openai = { success: false, message: 'Invalid API key' }
    } else if (response.ok || response.status === 400) {
      // 400 is OK for invalid audio, means key is valid
      apiConnectionStatus.value.openai = { success: true, message: 'Connection successful ✓' }
    } else {
      apiConnectionStatus.value.openai = { success: false, message: `Error: ${response.statusText}` }
    }
  } catch (error) {
    apiConnectionStatus.value.openai = { success: false, message: `Error: ${error}` }
  } finally {
    testingOpenAI.value = false
  }
}

const testDeepLConnection = async () => {
  if (!apiKeys.value.deeplKey) {
    apiConnectionStatus.value.deepl = { success: false, message: 'API key is empty' }
    return
  }

  testingDeepL.value = true
  try {
    const response = await fetch('https://api-free.deepl.com/v1/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKeys.value.deeplKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        texts: ['test'],
        target_lang: 'EN'
      })
    })

    if (response.status === 403 || response.status === 401) {
      apiConnectionStatus.value.deepl = { success: false, message: 'Invalid API key' }
    } else if (response.ok) {
      apiConnectionStatus.value.deepl = { success: true, message: 'Connection successful ✓' }
    } else {
      apiConnectionStatus.value.deepl = { success: false, message: `Error: ${response.statusText}` }
    }
  } catch (error) {
    apiConnectionStatus.value.deepl = { success: false, message: `Error: ${error}` }
  } finally {
    testingDeepL.value = false
  }
}

const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  saveSettings()
}

const startListening = () => {
  isListening.value = true
  currentTranscript.value = ''
  currentTranslation.value = ''

  console.log('🎤 Starting listening with device:', settings.value.selectedAudioDevice || 'default')
  speechRecognitionService.startListening(
    sourceLanguage.value,
    settings.value.recognitionEngine,
    async (event) => {
      // Check if it's StreamingTranscription or SpeechRecognitionEvent
      if ('interim' in event) {
        currentStreamingTranscription.value = event as StreamingTranscription
        currentTranscript.value = event.final
      } else {
        currentTranscript.value = event.transcript
      }

      // Only translate on final results
      const isFinal = 'isFinal' in event ? event.isFinal : event.isFinal
      if (isFinal && currentTranscript.value) {
        try {
          const result = await translationService.translate(
            currentTranscript.value,
            settings.value.translationEngine,
            targetLanguage.value
          )
          currentTranslation.value = result.translated

          // Update overlay
          const electronApi = (window as any).electron?.api
          if (electronApi && overlayVisible.value) {
            await electronApi.updateOverlayText(result.translated)
          }
        } catch (error) {
          console.error('Translation failed:', error)
          currentTranslation.value = 'Translation failed. Check API keys.'
        }
      }
    },
    (error) => {
      console.error('Speech recognition error:', error)
      isListening.value = false
    },
    settings.value.selectedAudioDevice
  )
}

const stopListening = () => {
  isListening.value = false
  speechRecognitionService.stopListening()
}

const toggleOverlay = async () => {
  const electronApi = (window as any).electron?.api
  if (!electronApi) {
    alert('This feature only works in Electron environment')
    return
  }

  overlayVisible.value = !overlayVisible.value

  if (overlayVisible.value) {
    await electronApi.createOverlay()
    await electronApi.updateOverlaySettings({
      opacity: settings.value.overlayOpacity,
      backgroundColor: settings.value.overlayBackgroundColor,
      fontSize: settings.value.overlayFontSize,
      fontColor: settings.value.overlayFontColor
    })
  } else {
    await electronApi.closeOverlay()
  }
}

const onInputTextEdited = (text: string) => {
  currentTranscript.value = text
}
</script>

<style scoped>
:root {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --color-tertiary: #6366f1;
  --color-text: #1f2937;
  --color-text-light: #6b7280;
  --color-bg: #ffffff;
  --color-bg-secondary: #f3f4f6;
  --color-border: #e5e7eb;
}

.theme-light {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --color-text: #1f2937;
  --color-text-light: #6b7280;
  --color-bg: #ffffff;
  --color-bg-secondary: #f3f4f6;
  --color-border: #e5e7eb;
}

.theme-dark {
  --color-primary: #60a5fa;
  --color-secondary: #cbd5e1;
  --color-text: #f9fafb;
  --color-text-light: #d1d5db;
  --color-bg: #1f2937;
  --color-bg-secondary: #111827;
  --color-border: #374151;
}

.app-container {
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-secondary);
}

.app-header h1 {
  margin: 0;
  font-size: 1.875rem;
  font-weight: 700;
}

.theme-toggle {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: background-color 0.2s ease;
}

.theme-toggle:hover {
  background-color: var(--color-border);
}

.app-main {
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background-color: var(--color-bg-secondary);
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
}

h2 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.control-group {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-group label {
  display: block;
  font-weight: 500;
  color: var(--color-text);
  font-size: 0.95rem;
}

.control-group input,
.control-group select {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: 1rem;
}

.control-group input[type='range'] {
  cursor: pointer;
}

.control-group input:focus,
.control-group select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.api-key-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.api-key-input-group input {
  flex: 1;
}

.btn-toggle-visibility,
.btn-test,
.btn-refresh {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background-color: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-toggle-visibility:hover,
.btn-test:hover:not(:disabled),
.btn-refresh:hover {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.btn-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-text {
  font-size: 0.85rem;
  margin-top: 0.25rem;
  display: block;
}

.status-text.success {
  color: #10b981;
}

.status-text.error {
  color: #ef4444;
}

.control-section {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: var(--color-secondary);
  color: white;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-tertiary {
  background-color: var(--color-tertiary);
  color: white;
}

.output-box {
  padding: 1rem;
  background-color: var(--color-bg);
  border-radius: 0.375rem;
  min-height: 100px;
  border: 1px solid var(--color-border);
}

.transcript,
.translation {
  margin: 0.5rem 0;
  line-height: 1.6;
}

.empty {
  color: var(--color-text-light);
  font-style: italic;
  margin: 0;
}

@media (max-width: 640px) {
  .control-group {
    flex-direction: column;
    align-items: flex-start;
  }

  .control-section {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }

  .app-main {
    padding: 1rem;
  }

  section {
    padding: 1rem;
  }

  .api-key-input-group {
    flex-wrap: wrap;
  }

  .api-key-input-group input {
    flex-basis: 100%;
  }

  .btn-toggle-visibility,
  .btn-test,
  .btn-refresh {
    flex: 1;
  }
}
</style>
