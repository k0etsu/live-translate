<template>
  <div class="input-display">
    <div class="input-header">
      <div class="language-badge">
        <span class="badge-label">{{ languageLabel }}</span>
        <span class="badge-flag">{{ languageEmoji }}</span>
      </div>
      <div class="recording-status" v-if="isRecording">
        <span class="recording-dot"></span>
        <span class="recording-text">Recording...</span>
      </div>
    </div>

    <div class="input-content">
      <div class="transcript-section">
        <!-- Interim results (grayed out while listening) -->
        <div v-if="interimText" class="interim-text">
          <span class="interim-label">Listening:</span>
          <p>{{ interimText }}</p>
        </div>

        <!-- Final results (bold, prominent) -->
        <div v-if="finalText" class="final-text">
          <span class="final-label">Recognized:</span>
          <p>{{ finalText }}</p>
        </div>

        <!-- Empty state -->
        <div v-if="!interimText && !finalText" class="empty-state">
          <p>Waiting for speech input...</p>
        </div>
      </div>

      <!-- Confidence score display -->
      <div v-if="confidence > 0" class="confidence-section">
        <div class="confidence-bar">
          <div
            class="confidence-fill"
            :style="{
              width: (confidence * 100) + '%',
              backgroundColor: getConfidenceColor(confidence)
            }"
          ></div>
        </div>
        <span class="confidence-text">Confidence: {{ (confidence * 100).toFixed(0) }}%</span>
      </div>

      <!-- Manual editing section -->
      <div class="manual-edit-section">
        <textarea
          v-model="editableText"
          placeholder="Edit recognized text here..."
          class="manual-input"
          @input="onTextEdited"
        ></textarea>
        <button @click="copyToClipboard" class="btn-copy" title="Copy to clipboard">
          📋 Copy
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { StreamingTranscription } from '@/types/index'

interface Props {
  transcription?: StreamingTranscription
  isRecording?: boolean
}

interface Emits {
  (e: 'textEdited', text: string): void
}

withDefaults(defineProps<Props>(), {
  isRecording: false
})

const emit = defineEmits<Emits>()

const interimText = ref('')
const finalText = ref('')
const editableText = ref('')
const confidence = ref(0)
const language = ref<'ja' | 'en'>('en')

const languageLabel = computed(() => {
  return language.value === 'ja' ? '日本語' : 'English'
})

const languageEmoji = computed(() => {
  return language.value === 'ja' ? '🇯🇵' : '🇺🇸'
})

watch(
  () => transcription,
  (transcription) => {
    if (transcription) {
      interimText.value = transcription.interim || ''
      finalText.value = transcription.final || ''
      confidence.value = transcription.confidence || 0
      language.value = transcription.language

      // Update editable text only if final text changed
      if (transcription.final && transcription.final !== editableText.value) {
        editableText.value = transcription.final
      }
    }
  },
  { immediate: true, deep: true }
)

const getConfidenceColor = (conf: number): string => {
  if (conf >= 0.8) return '#4CAF50' // green
  if (conf >= 0.6) return '#FFC107' // amber
  return '#F44336' // red
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(editableText.value)
    alert('Copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

const onTextEdited = () => {
  emit('textEdited', editableText.value)
}
</script>

<style scoped>
.input-display {
  background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
  border: 1px solid #404040;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #404040;
}

.language-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.badge-label {
  font-size: 12px;
  opacity: 0.9;
}

.badge-flag {
  font-size: 16px;
}

.recording-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #FF5252;
  font-size: 13px;
  font-weight: 600;
}

.recording-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background-color: #FF5252;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.input-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transcript-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 12px;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.interim-text,
.final-text {
  margin: 0;
}

.interim-label,
.final-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.interim-text p {
  color: #b0b0b0;
  font-style: italic;
  margin: 0;
  font-size: 14px;
  opacity: 0.7;
}

.final-text p {
  color: #ffffff;
  margin: 0;
  font-size: 15px;
  font-weight: 500;
}

.empty-state {
  color: #666;
  text-align: center;
  font-style: italic;
  font-size: 14px;
}

.confidence-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.confidence-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 3px;
}

.confidence-text {
  font-size: 12px;
  color: #999;
}

.manual-edit-section {
  display: flex;
  gap: 8px;
}

.manual-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #404040;
  border-radius: 4px;
  color: #ffffff;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  min-height: 50px;
  max-height: 120px;
}

.manual-input::placeholder {
  color: #666;
}

.manual-input:focus {
  outline: none;
  border-color: #2196F3;
  background: rgba(33, 150, 243, 0.1);
}

.btn-copy {
  padding: 8px 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-copy:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
}

.btn-copy:active {
  transform: translateY(0);
}
</style>
