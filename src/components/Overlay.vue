<template>
  <div
    class="overlay-window"
    :style="overlayStyle"
    :class="{ dragging: isDragging, pinned: isPinned }"
    @mousedown="startDrag"
    @touchstart="startDrag"
  >
    <div class="overlay-border"></div>
    
    <div class="overlay-controls">
      <button @click="togglePin" class="control-btn pin-btn" :title="isPinned ? 'Unpin' : 'Pin overlay'">
        {{ isPinned ? '📌' : '📍' }}
      </button>
      <button @click="toggleMinimize" class="control-btn minimize-btn" :title="isMinimized ? 'Show' : 'Hide'">
        {{ isMinimized ? '⬆️' : '⬇️' }}
      </button>
      <button @click="openSettings" class="control-btn settings-btn" title="Settings">⚙️</button>
      <button @click="closeOverlay" class="control-btn close-btn" title="Close overlay">✕</button>
    </div>

    <div v-if="!isMinimized" class="overlay-content">
      <div class="language-badges">
        <span class="badge source-lang">{{ sourceLanguageLabel }}</span>
        <span class="badge arrow">→</span>
        <span class="badge target-lang">{{ targetLanguageLabel }}</span>
      </div>
      
      <p class="translation-text">{{ translationText }}</p>
      
      <div v-if="showTimestamp" class="timestamp">
        {{ lastUpdateTime }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const translationText = ref('Translation will appear here...')
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const position = ref({ x: 100, y: 100 })
const isPinned = ref(false)
const isMinimized = ref(false)
const lastUpdateTime = ref('')

const overlaySettings = ref({
  opacity: 0.9,
  backgroundColor: '#1a1a1a',
  borderColor: '#ffffff',
  borderWidth: 2,
  fontSize: 16,
  fontColor: '#FFFFFF',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  textAlign: 'left' as const,
  padding: 16,
  enableBlur: false,
  showTimestamp: true,
  translationDirection: 'ja-to-en'
})

const overlayStyle = computed(() => ({
  position: 'fixed' as const,
  top: `${position.value.y}px`,
  left: `${position.value.x}px`,
  backgroundColor: overlaySettings.value.backgroundColor,
  opacity: overlaySettings.value.opacity,
  color: overlaySettings.value.fontColor,
  zIndex: 999999,
  borderRadius: '8px',
  padding: `${overlaySettings.value.padding}px`,
  minWidth: '300px',
  maxWidth: '500px',
  cursor: isDragging.value ? 'grabbing' : isPinned.value ? 'default' : 'grab',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
  backdropFilter: overlaySettings.value.enableBlur ? 'blur(10px)' : 'none',
  border: `${overlaySettings.value.borderWidth}px solid ${overlaySettings.value.borderColor}`,
  transition: isDragging.value ? 'none' : 'all 0.3s ease',
  userSelect: 'none' as const,
  fontFamily: overlaySettings.value.fontFamily,
  fontSize: `${overlaySettings.value.fontSize}px`
}))

const sourceLanguageLabel = computed(() => {
  return overlaySettings.value.translationDirection === 'ja-to-en' ? '日本語' : 'English'
})

const targetLanguageLabel = computed(() => {
  return overlaySettings.value.translationDirection === 'ja-to-en' ? 'English' : '日本語'
})

const showTimestamp = computed(() => overlaySettings.value.showTimestamp)

onMounted(() => {
  // Load saved position and settings
  const saved = localStorage.getItem('overlayState')
  if (saved) {
    const state = JSON.parse(saved)
    position.value = state.position || position.value
    isPinned.value = state.isPinned || false
    isMinimized.value = state.isMinimized || false
  }

  // Load overlay settings
  const savedSettings = localStorage.getItem('overlaySettings')
  if (savedSettings) {
    overlaySettings.value = { ...overlaySettings.value, ...JSON.parse(savedSettings) }
  }

  // Listen for text updates from main window
  const electronApi = (window as any).electron?.ipcRenderer
  if (electronApi) {
    electronApi.on('text-updated', (text: string) => {
      translationText.value = text
      lastUpdateTime.value = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      saveState()
    })

    electronApi.on('settings-updated', (settings: any) => {
      overlaySettings.value = { ...overlaySettings.value, ...settings }
      localStorage.setItem('overlaySettings', JSON.stringify(overlaySettings.value))
    })
  }
})

const saveState = () => {
  const state = {
    position: position.value,
    isPinned: isPinned.value,
    isMinimized: isMinimized.value
  }
  localStorage.setItem('overlayState', JSON.stringify(state))
}

const startDrag = (event: MouseEvent | TouchEvent) => {
  if (isPinned.value) return

  isDragging.value = true

  const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX
  const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY

  dragOffset.value = {
    x: clientX - position.value.x,
    y: clientY - position.value.y
  }

  const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
    const moveClientX = moveEvent instanceof MouseEvent ? moveEvent.clientX : moveEvent.touches[0].clientX
    const moveClientY = moveEvent instanceof MouseEvent ? moveEvent.clientY : moveEvent.touches[0].clientY

    position.value = {
      x: moveClientX - dragOffset.value.x,
      y: moveClientY - dragOffset.value.y
    }
  }

  const handleMouseUp = () => {
    isDragging.value = false
    saveState()
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('touchmove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('touchend', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('touchmove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('touchend', handleMouseUp)
}

const togglePin = () => {
  isPinned.value = !isPinned.value
  saveState()
}

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value
  saveState()
}

const openSettings = () => {
  const electronApi = (window as any).electron?.api
  if (electronApi && electronApi.openOverlaySettings) {
    electronApi.openOverlaySettings()
  }
}

const closeOverlay = () => {
  const electronApi = (window as any).electron?.api
  if (electronApi && electronApi.closeOverlay) {
    electronApi.closeOverlay()
  }
}

</script>

<style scoped>
.overlay-window {
  display: flex;
  flex-direction: column;
  gap: 8px;
  outline: 2px solid rgba(255, 255, 255, 0.1);
  outline-offset: -2px;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.overlay-window:hover .overlay-border {
  opacity: 1;
}

.overlay-window.dragging {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
}

.overlay-window.pinned {
  outline: 2px dashed rgba(255, 200, 0, 0.5);
}

.overlay-border {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: v-bind('`${overlaySettings.borderWidth}px solid ${overlaySettings.borderColor}`');
  border-radius: 8px;
  pointer-events: none;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.overlay-controls {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  position: relative;
  z-index: 1;
  margin-bottom: 4px;
}

.control-btn {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 14px;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
  line-height: 1;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.3);
}

.control-btn:active {
  background: rgba(255, 255, 255, 0.35);
}

.pin-btn {
  flex-shrink: 0;
}

.minimize-btn {
  flex-shrink: 0;
}

.settings-btn {
  flex-shrink: 0;
}

.close-btn {
  flex-shrink: 0;
  background: rgba(255, 100, 100, 0.2);
  border-color: rgba(255, 100, 100, 0.3);
}

.close-btn:hover {
  background: rgba(255, 100, 100, 0.3);
  border-color: rgba(255, 100, 100, 0.4);
}

.overlay-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.language-badges {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 11px;
  opacity: 0.7;
}

.badge {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.source-lang {
  color: #87ceeb;
}

.target-lang {
  color: #90ee90;
}

.arrow {
  color: #ffffff;
  padding: 2px 4px;
  font-weight: bold;
}

.translation-text {
  margin: 0;
  color: v-bind('overlaySettings.fontColor');
  font-size: v-bind('`${overlaySettings.fontSize}px`');
  line-height: 1.5;
  flex: 1;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  text-align: v-bind('overlaySettings.textAlign');
}

.timestamp {
  font-size: 11px;
  opacity: 0.5;
  text-align: right;
  margin-top: 4px;
}
</style>
