<template>
  <div :class="['app', theme]">
    <!-- Header -->
    <header class="header">
      <span class="logo">Live Translate</span>
      <div class="header-right">
        <span v-if="isListening" class="listening-pill">
          <span :class="['vad-dot', vadActive ? 'speaking' : '']"></span>
          Listening
        </span>
        <button class="icon-btn no-drag" @click="theme = theme === 'dark' ? 'light' : 'dark'" title="Toggle theme">
          {{ theme === 'dark' ? '☀' : '☾' }}
        </button>
        <div class="win-controls no-drag">
          <button class="wc-btn" title="Minimize" @click="el.minimizeWindow()">&#x2013;</button>
          <button class="wc-btn" title="Maximize" @click="el.maximizeWindow()">&#x25A1;</button>
          <button class="wc-btn wc-close" title="Close" @click="el.closeWindow()">&#x2715;</button>
        </div>
      </div>
    </header>

    <!-- Tabs -->
    <nav class="tabs">
      <button v-for="t in TABS" :key="t.id"
        :class="['tab', { active: activeTab === t.id }]"
        @click="activeTab = t.id"
      >{{ t.label }}</button>
    </nav>

    <main class="main">

      <!-- ══ CAPTURE TAB ══════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'capture'" class="tab-content">

        <DeviceSelector
          :model-value="config.audioDeviceName"
          :disabled="isListening"
          :devices="audioDevices"
          :loading="devicesLoading"
          :error="devicesError"
          @change="config.audioDeviceName = $event"
          @refresh="refreshDevices"
        />

        <!-- Controls -->
        <div class="controls">
          <button
            :class="['btn-primary', isListening ? 'btn-stop' : 'btn-start']"
            @click="toggleListening"
            :disabled="modelStatus.downloading"
          >{{ isListening ? '■ Stop' : '▶ Start Listening' }}</button>
          <button class="btn-secondary" @click="toggleOverlay">
            {{ overlayVisible ? 'Hide Overlay' : 'Show Overlay' }}
          </button>
        </div>

        <!-- Python status -->
        <div class="py-status-row">
          <template v-if="pythonStatus === null">
            <span class="badge badge-pending">Checking Python…</span>
          </template>
          <template v-else-if="!pythonStatus.found">
            <span class="badge badge-warn">Environment not set up</span>
            <button class="btn-sm btn-secondary" @click="activeTab = 'setup'">Go to Setup →</button>
          </template>
          <template v-else-if="pythonStatus.missingPackages?.length">
            <span class="badge badge-warn">Python {{ pythonStatus.version }} — missing: {{ pythonStatus.missingPackages.join(', ') }}</span>
            <button class="btn-sm btn-secondary" @click="installPackages">Install packages</button>
          </template>
          <template v-else>
            <span class="badge badge-ok">Python {{ pythonStatus.version }} ready</span>
            <span v-if="cudaDevice" class="badge badge-gpu">⚡ {{ cudaDevice }}</span>
            <span v-else-if="cudaChecked" class="badge badge-cpu">🖥 CPU</span>
          </template>
        </div>

        <!-- Model progress -->
        <div v-if="modelStatus.downloading" class="model-progress">
          <div class="progress-bar" :style="{ width: modelStatus.progress + '%' }"></div>
          <span class="progress-label">{{ modelStatus.status }}</span>
        </div>
        <div v-else-if="modelStatus.loaded" class="badge badge-ok model-ready-badge">
          Model ready
          <span v-if="modelStatus.device?.startsWith('cuda')" class="badge badge-gpu">⚡ CUDA</span>
          <span v-else-if="modelStatus.device" class="badge badge-cpu">🖥 CPU</span>
        </div>

        <!-- Output mode -->
        <div class="field-group">
          <label class="field-label">Output Mode</label>
          <div class="radio-row">
            <label class="radio-opt">
              <input type="radio" value="translate" v-model="config.task" @change="saveConfig" />
              Translate (JP→EN)
            </label>
            <label class="radio-opt">
              <input type="radio" value="transcribe" v-model="config.task" @change="saveConfig" />
              Transcribe (JP only)
            </label>
          </div>
        </div>

        <!-- Output area -->
        <div class="output-area">
          <div v-if="lastTranscript" class="output-transcript">{{ lastTranscript }}</div>
          <div v-if="lastTranslation" class="output-translation">{{ lastTranslation }}</div>
          <div v-if="!lastTranscript && !lastTranslation" class="output-placeholder">
            Output will appear here when listening…
          </div>
          <button v-if="lastTranslation || lastTranscript" class="copy-btn"
            @click="copyOutput" title="Copy to clipboard">
            {{ copied ? '✓ Copied' : 'Copy' }}
          </button>
        </div>
      </div>

      <!-- ══ AUDIO TAB ════════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'audio'" class="tab-content">
        <h3 class="section-title">Audio Filters</h3>
        <div class="settings-grid">
          <div class="field-group">
            <label class="field-label">Volume Threshold <span class="value">{{ config.volumeThreshold }}</span></label>
            <input type="range" min="0.001" max="0.05" step="0.001" v-model.number="config.volumeThreshold" @change="saveConfig" />
          </div>
          <div class="field-group">
            <label class="field-label">VAD Filter</label>
            <label class="toggle">
              <input type="checkbox" v-model="config.useVadFilter" @change="saveConfig" />
              <span>{{ config.useVadFilter ? 'Enabled' : 'Disabled' }}</span>
            </label>
          </div>
          <div class="field-group" v-if="config.useVadFilter">
            <label class="field-label">VAD Threshold <span class="value">{{ config.vadThreshold }}</span></label>
            <input type="range" min="0.05" max="0.9" step="0.01" v-model.number="config.vadThreshold" @change="saveConfig" />
          </div>
        </div>

        <h3 class="section-title" style="margin-top: 16px">Dynamic Chunking</h3>
        <div class="settings-grid">
          <div class="field-group">
            <label class="field-label">Dynamic Chunking</label>
            <label class="toggle">
              <input type="checkbox" v-model="config.useDynamicChunking" @change="saveConfig" />
              <span>{{ config.useDynamicChunking ? 'Enabled' : 'Disabled' }}</span>
            </label>
          </div>
          <template v-if="config.useDynamicChunking">
            <div class="field-group">
              <label class="field-label">Max Chunk Duration <span class="value">{{ config.dynamicMaxChunkSec }}s</span></label>
              <input type="range" min="2" max="30" step="0.5" v-model.number="config.dynamicMaxChunkSec" @change="saveConfig" />
            </div>
            <div class="field-group">
              <label class="field-label">Silence Timeout <span class="value">{{ config.dynamicSilenceTimeoutSec }}s</span></label>
              <input type="range" min="0.1" max="3.0" step="0.05" v-model.number="config.dynamicSilenceTimeoutSec" @change="saveConfig" />
            </div>
            <div class="field-group">
              <label class="field-label">Min Speech Duration <span class="value">{{ config.dynamicMinSpeechSec }}s</span></label>
              <input type="range" min="0.1" max="3.0" step="0.05" v-model.number="config.dynamicMinSpeechSec" @change="saveConfig" />
            </div>
          </template>
          <template v-else>
            <div class="field-group">
              <label class="field-label">Chunk Duration <span class="value">{{ config.dynamicMaxChunkSec }}s</span></label>
              <input type="range" min="1" max="15" step="0.5" v-model.number="config.dynamicMaxChunkSec" @change="saveConfig" />
            </div>
          </template>
        </div>

        <h3 class="section-title" style="margin-top: 16px">ASR Advanced</h3>
        <div class="settings-grid">
          <div class="field-group">
            <label class="field-label">Model</label>
            <input type="text" v-model="config.model" @change="saveConfig" class="text-input" />
          </div>
          <div class="field-group">
            <label class="field-label">Temperature <span class="value">{{ config.temperature }}</span></label>
            <input type="range" min="0" max="1" step="0.01" v-model.number="config.temperature" @change="saveConfig" />
          </div>
          <div class="field-group">
            <label class="field-label">Max Tokens <span class="value">{{ config.maxNewTokens }}</span></label>
            <input type="range" min="50" max="448" step="1" v-model.number="config.maxNewTokens" @change="saveConfig" />
          </div>
          <div class="field-group">
            <label class="field-label">No-repeat N-gram <span class="value">{{ config.noRepeatNgramSize }}</span></label>
            <input type="range" min="0" max="6" step="1" v-model.number="config.noRepeatNgramSize" @change="saveConfig" />
          </div>
        </div>
      </div>

      <!-- ══ OVERLAY TAB ══════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'overlay'" class="tab-content">
        <OverlayControls :config="config" @update="onOverlayUpdate" />
      </div>

      <!-- ══ PRESETS TAB ══════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'presets'" class="tab-content">
        <PresetsPanel @load="onPresetLoad" />
      </div>

      <!-- ══ SETUP TAB ════════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'setup'" class="tab-content">

        <!-- Python packages -->
        <section class="setup-section">
          <h3 class="section-title">Python Environment</h3>
          <template v-if="pythonStatus === null">
            <span class="badge badge-pending">Checking…</span>
          </template>
          <template v-else-if="!pythonStatus.found">
            <p class="setup-hint">No Python environment found. Click below to create one automatically — no Python install required.</p>
            <button class="btn-action" @click="installPackages" :disabled="pkgInstalling">
              {{ pkgInstalling ? 'Setting up…' : 'Set Up Environment' }}
            </button>
          </template>
          <template v-else-if="pythonStatus.missingPackages?.length">
            <p class="setup-hint warn">
              Python {{ pythonStatus.version }} — missing packages: <code>{{ pythonStatus.missingPackages.join(', ') }}</code>
            </p>
            <button class="btn-action" @click="installPackages" :disabled="pkgInstalling">
              {{ pkgInstalling ? 'Installing…' : 'Install Missing Packages' }}
            </button>
          </template>
          <template v-else>
            <p class="setup-hint ok">Python {{ pythonStatus.version }} — all packages installed.</p>
          </template>

          <!-- Install log (shown during setup) -->
          <div v-if="setupLog.length > 0" class="install-log" ref="setupLogEl">
            <div v-for="(line, i) in setupLog" :key="i" class="log-line">{{ line }}</div>
          </div>
        </section>

        <!-- CUDA -->
        <section class="setup-section">
          <h3 class="section-title">GPU Acceleration (CUDA)</h3>
          <CudaSetup :cuda-device="cudaDevice" :cuda-checked="cudaChecked" />
        </section>

        <!-- Model -->
        <section class="setup-section">
          <h3 class="section-title">ASR Model</h3>
          <p class="setup-hint">
            Model: <code>{{ config.model }}</code><br/>
            Cache: <code>~/.cache/translator_models/</code>
          </p>
          <p v-if="modelStatus.loaded" class="setup-hint ok">Model cached and ready.</p>
          <p v-else-if="!modelStatus.loaded && !modelStatus.downloading" class="setup-hint">
            Model will be downloaded automatically on first Start.
          </p>
          <div v-if="modelStatus.downloading" class="model-progress">
            <div class="progress-bar" :style="{ width: modelStatus.progress + '%' }"></div>
            <span class="progress-label">{{ modelStatus.status }}</span>
          </div>
        </section>

        <!-- Stats -->
        <section class="setup-section">
          <h3 class="section-title">Session Stats</h3>
          <div class="stats-grid">
            <div class="stat-cell">
              <div class="stat-value">{{ stats.chunks }}</div>
              <div class="stat-label">Segments processed</div>
            </div>
            <div class="stat-cell">
              <div class="stat-value">{{ stats.translations }}</div>
              <div class="stat-label">Translations</div>
            </div>
            <div class="stat-cell">
              <div class="stat-value">{{ stats.filtered }}</div>
              <div class="stat-label">Filtered (hallucinations)</div>
            </div>
            <div class="stat-cell">
              <div class="stat-value">{{ stats.avg_ms > 0 ? stats.avg_ms.toFixed(0) + 'ms' : '—' }}</div>
              <div class="stat-label">Avg processing time</div>
            </div>
          </div>
        </section>
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick, onMounted, onUnmounted, watch } from 'vue'
import DeviceSelector, { type PyAudioDevice } from './components/DeviceSelector.vue'
import OverlayControls from './components/OverlayControls.vue'
import PresetsPanel from './components/PresetsPanel.vue'
import CudaSetup from './components/CudaSetup.vue'
import type { Config, OverlayStyle, PythonStats } from '../shared/types'
import { DEFAULT_CONFIG } from '../shared/types'

const TABS = [
  { id: 'capture',  label: 'Capture'  },
  { id: 'audio',    label: 'Audio'    },
  { id: 'overlay',  label: 'Overlay'  },
  { id: 'presets',  label: 'Presets'  },
  { id: 'setup',    label: 'Setup'    },
]

const el = (window as any).electron

// ── State ──────────────────────────────────────────────────────────────────────
const theme      = ref<'dark' | 'light'>('dark')
const activeTab  = ref('capture')
const config     = reactive<Config>({ ...DEFAULT_CONFIG })

const isListening   = ref(false)
const overlayVisible= ref(false)
const vadActive     = ref(false)
const copied        = ref(false)

const audioDevices  = ref<PyAudioDevice[]>([])
const devicesLoading= ref(false)
const devicesError  = ref('')

const lastTranscript = ref('')
const lastTranslation= ref('')

const pythonStatus = ref<{ found: boolean; version?: string; missingPackages?: string[] } | null>(null)
const pkgInstalling= ref(false)

const cudaDevice   = ref<string | null>(null)
const cudaChecked  = ref(false)

const modelStatus  = reactive({ downloading: false, progress: 0, status: '', loaded: false, device: '' })

const stats = reactive<PythonStats>({ chunks: 0, translations: 0, filtered: 0, avg_ms: 0 })

const setupLog    = ref<string[]>([])
const setupLogEl  = ref<HTMLDivElement | null>(null)

let unsubPython: (() => void) | null = null

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  const saved = await el.getConfig()
  Object.assign(config, saved)

  pythonStatus.value = await el.checkPython()

  unsubPython = el.onPythonMessage(handlePythonMessage)

  // Spawn Python to get CUDA info + device list (no model load yet).
  // Spread config to plain object — Vue reactive proxies can't cross IPC.
  if (pythonStatus.value?.found && !pythonStatus.value?.missingPackages?.length) {
    try {
      const devices = await el.listPythonDevices({ ...config })
      audioDevices.value = devices
    } catch {
      // Not fatal — user can click refresh
    }
  }
})

onUnmounted(() => {
  unsubPython?.()
})

function handlePythonMessage(msg: any) {
  if (msg.type === 'ready') {
    cudaDevice.value  = msg.cuda_device ?? null
    cudaChecked.value = true
    // Devices already populated by the listPythonDevices call in onMounted
  } else if (msg.type === 'model_progress') {
    modelStatus.downloading = true
    modelStatus.progress    = msg.progress ?? 0
    modelStatus.status      = msg.status ?? ''
    modelStatus.loaded      = false
  } else if (msg.type === 'model_ready') {
    modelStatus.downloading = false
    modelStatus.loaded      = true
    modelStatus.device      = msg.device ?? ''
  } else if (msg.type === 'vad_active') {
    vadActive.value = msg.speaking ?? false
  } else if (msg.type === 'result') {
    lastTranscript.value  = msg.transcript  ?? ''
    lastTranslation.value = msg.translation ?? ''
  } else if (msg.type === 'stats') {
    Object.assign(stats, msg)
  } else if (msg.type === 'stopped') {
    isListening.value = false
  } else if (msg.type === 'error') {
    console.error('[python error]', msg.message)
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────
async function toggleListening() {
  if (isListening.value) {
    await el.stopPython()
    isListening.value = false
  } else {
    lastTranscript.value  = ''
    lastTranslation.value = ''
    modelStatus.loaded    = false
    saveConfig()
    await el.startPython({ ...config }, config.audioDeviceName)
    isListening.value = true
  }
}

function toggleOverlay() {
  if (overlayVisible.value) {
    el.hideOverlay()
    overlayVisible.value = false
  } else {
    el.showOverlay()
    overlayVisible.value = true
    pushOverlayStyle()
  }
}

async function refreshDevices() {
  devicesLoading.value = true
  devicesError.value   = ''
  try {
    const devices = await el.listPythonDevices({ ...config })
    audioDevices.value = devices
  } catch (e: any) {
    devicesError.value = e?.message ?? 'Failed to list devices'
  } finally {
    devicesLoading.value = false
  }
}

async function installPackages() {
  pkgInstalling.value = true
  setupLog.value      = []

  const unsub = el.onInstallLog((line: string) => {
    setupLog.value.push(line)
    nextTick(() => {
      if (setupLogEl.value) setupLogEl.value.scrollTop = setupLogEl.value.scrollHeight
    })
  })

  await el.installPythonPackages()
  unsub()
  pkgInstalling.value = false
  pythonStatus.value  = await el.checkPython()

  // Re-spawn Python with the new venv so CUDA info populates
  if (pythonStatus.value?.found && !pythonStatus.value?.missingPackages?.length) {
    try {
      const devices = await el.listPythonDevices({ ...config })
      audioDevices.value = devices
    } catch { /* non-fatal */ }
  }
}

// ── Config ─────────────────────────────────────────────────────────────────────
function saveConfig() {
  el.setConfig({ ...config })
  if (isListening.value) {
    // Live-update settings without restarting/reloading the model
    el.updatePythonSettings({ ...config })
  }
}

// ── Overlay ────────────────────────────────────────────────────────────────────
function onOverlayUpdate(style: OverlayStyle & Partial<Config>) {
  // Apply overlay config fields
  const keys: (keyof Config)[] = [
    'overlayFontSize', 'overlayFontWeight', 'overlayFontColor', 'overlayTextShadow',
    'overlayTextAlign', 'overlayVertAlign',
    'overlayOpacity', 'overlayBgColor', 'overlayWidth', 'overlayHeight',
  ]
  for (const k of keys) {
    if ((style as any)[k] !== undefined) (config as any)[k] = (style as any)[k]
  }
  saveConfig()
  pushOverlayStyle()
}

function pushOverlayStyle() {
  el.setOverlayStyle({
    fontSize:   config.overlayFontSize,
    fontWeight: config.overlayFontWeight,
    fontColor:  config.overlayFontColor,
    textShadow: config.overlayTextShadow,
    textAlign:  config.overlayTextAlign,
    vertAlign:  config.overlayVertAlign,
    opacity:    config.overlayOpacity,
    bgColor:    config.overlayBgColor,
    width:      config.overlayWidth,
    height:     config.overlayHeight,
  })
}

// ── Presets ────────────────────────────────────────────────────────────────────
function onPresetLoad(partial: Partial<Config>) {
  Object.assign(config, partial)
  saveConfig()
  pushOverlayStyle()
}

// ── Clipboard ─────────────────────────────────────────────────────────────────
async function copyOutput() {
  const text = [lastTranscript.value, lastTranslation.value].filter(Boolean).join('\n')
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style>
/* ── CSS variables ──────────────────────────────────────────────────────────── */
:root {
  --bg:       #111114;
  --surface:  #1c1c20;
  --surface2: #242428;
  --border:   #2e2e34;
  --text:     #e8e8ec;
  --text-dim: #888;
  --accent:   #7c6bf5;
  --input-bg: #1c1c20;
  --ok:       #34d399;
  --ok-bg:    rgba(52,211,153,0.12);
  --ok-border:rgba(52,211,153,0.25);
}
.light {
  --bg:       #f5f5f7;
  --surface:  #ffffff;
  --surface2: #f0f0f2;
  --border:   #d8d8dc;
  --text:     #111114;
  --text-dim: #666;
  --accent:   #4338ca;
  --input-bg: #ffffff;
  --ok:       #047857;
  --ok-bg:    rgba(4,120,87,0.08);
  --ok-border:rgba(4,120,87,0.20);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; }

.app { display: flex; flex-direction: column; height: 100vh; background: var(--bg); color: var(--text); }

/* ── Header ──────────────────────────────────────────────────────────────────── */
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 0 0 16px; background: var(--surface); border-bottom: 1px solid var(--border);
  flex-shrink: 0; height: 42px;
  -webkit-app-region: drag;
  user-select: none;
}
.logo { font-size: 16px; font-weight: 700; letter-spacing: .03em; }
.header-right { display: flex; align-items: center; gap: 8px; padding-right: 4px; }
.no-drag { -webkit-app-region: no-drag; }

/* ── Window controls ─────────────────────────────────────────────────────────── */
.win-controls { display: flex; }
.wc-btn {
  width: 42px; height: 42px; border: none; background: transparent;
  color: var(--text-dim); cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: background .1s, color .1s;
}
.wc-btn:hover { background: var(--surface2); color: var(--text); }
.wc-close:hover { background: #c42b1c; color: #fff; }
.listening-pill {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; padding: 3px 10px; border-radius: 12px;
  background: rgba(124,107,245,0.15); color: var(--accent); font-weight: 600;
}
.vad-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #555; transition: background .15s;
}
.vad-dot.speaking { background: #34d399; box-shadow: 0 0 6px #34d399; }

/* ── Tabs ────────────────────────────────────────────────────────────────────── */
.tabs {
  display: flex; gap: 2px; padding: 8px 12px 0;
  background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.tab {
  padding: 7px 14px; font-size: 13px; font-weight: 500;
  background: none; border: none; color: var(--text-dim); cursor: pointer;
  border-radius: 6px 6px 0 0; border-bottom: 2px solid transparent;
  transition: color .15s, border-color .15s;
}
.tab:hover { color: var(--text); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }

/* ── Main ────────────────────────────────────────────────────────────────────── */
.main { flex: 1; overflow-y: auto; padding: 16px; }
.tab-content { display: flex; flex-direction: column; gap: 14px; }

/* ── Buttons ─────────────────────────────────────────────────────────────────── */
.controls { display: flex; gap: 8px; }
.btn-primary, .btn-secondary, .btn-sm, .btn-action {
  padding: 9px 18px; border-radius: 8px; border: none; font-size: 14px;
  font-weight: 600; cursor: pointer; transition: opacity .15s;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-stop    { background: #ef4444; }
.btn-secondary { background: var(--surface2); border: 1px solid var(--border); color: var(--text); }
.btn-sm { padding: 5px 12px; font-size: 13px; }
.btn-action { background: var(--accent); color: #fff; align-self: flex-start; }
button:disabled { opacity: .5; cursor: default; }

/* ── Fields ──────────────────────────────────────────────────────────────────── */
.field-group { display: flex; flex-direction: column; gap: 5px; }
.field-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .06em; opacity: .6; display: flex; justify-content: space-between;
}
.value { font-weight: 400; text-transform: none; }
input[type="range"] { width: 100%; accent-color: var(--accent); }
.text-input {
  padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--input-bg); color: var(--text); font-size: 13px; width: 100%;
}
.settings-grid { display: flex; flex-direction: column; gap: 12px; }
.radio-row { display: flex; gap: 20px; }
.radio-opt { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; }
.toggle input { accent-color: var(--accent); width: 16px; height: 16px; }

/* ── Badges ──────────────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px;
}
.badge-ok      { background: var(--ok-bg); color: var(--ok); }
.badge-err     { background: rgba(239,68,68,0.12);  color: #f87171; }
.badge-warn    { background: rgba(251,191,36,0.12); color: #fbbf24; }
.badge-pending { background: rgba(120,120,140,0.12);color: #aaa; }
.badge-gpu     { background: var(--ok-bg); color: var(--ok); }
.badge-cpu     { background: rgba(120,120,140,0.12);color: #aaa; }

.py-status-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.model-ready-badge { display: flex; align-items: center; gap: 6px; }

/* ── Model progress ──────────────────────────────────────────────────────────── */
.model-progress {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 12px; position: relative; overflow: hidden;
}
.progress-bar {
  position: absolute; top: 0; left: 0; height: 100%;
  background: rgba(124,107,245,0.18); transition: width .3s;
}
.progress-label { position: relative; font-size: 13px; }

/* ── Output ──────────────────────────────────────────────────────────────────── */
.output-area {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 16px; min-height: 90px;
  display: flex; flex-direction: column; gap: 6px; position: relative;
}
.output-transcript { font-size: 13px; opacity: .65; }
.output-translation { font-size: 18px; font-weight: 600; line-height: 1.4; }
.output-placeholder { font-size: 13px; opacity: .35; font-style: italic; }
.copy-btn {
  align-self: flex-end; padding: 4px 10px; font-size: 11px;
  border-radius: 5px; border: 1px solid var(--border); background: var(--surface);
  color: var(--text-dim); cursor: pointer;
}

/* ── Section titles ──────────────────────────────────────────────────────────── */
.section-title {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .07em; opacity: .5;
}

/* ── Setup ───────────────────────────────────────────────────────────────────── */
.setup-section {
  padding: 14px 16px; background: var(--surface2);
  border: 1px solid var(--border); border-radius: 10px;
  display: flex; flex-direction: column; gap: 10px;
}
.setup-hint {
  font-size: 13px; line-height: 1.6; opacity: .75;
}
.setup-hint.ok   { color: var(--ok); }
.setup-hint.warn { color: #fbbf24; }
.setup-hint.err  { color: #f87171; }
.setup-hint code { opacity: .9; background: rgba(255,255,255,0.07); padding: 1px 5px; border-radius: 4px; }

/* ── Stats ───────────────────────────────────────────────────────────────────── */
.stats-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.stat-cell {
  padding: 10px 12px; background: var(--surface); border-radius: 8px;
  border: 1px solid var(--border); text-align: center;
}
.stat-value { font-size: 24px; font-weight: 700; }
.stat-label { font-size: 11px; opacity: .55; margin-top: 2px; }

/* ── Install log ─────────────────────────────────────────────────────────────── */
.install-log {
  background: #111; border: 1px solid #333; border-radius: 8px;
  padding: 10px 12px; max-height: 200px; overflow-y: auto;
  font-family: monospace; font-size: 11px;
}
.log-line { color: #bbb; white-space: pre-wrap; word-break: break-all; }

/* ── Icon button ─────────────────────────────────────────────────────────────── */
.icon-btn {
  background: none; border: none; cursor: pointer; color: var(--text);
  font-size: 18px; padding: 4px 6px; border-radius: 5px; opacity: .7;
}
.icon-btn:hover { opacity: 1; }
</style>
