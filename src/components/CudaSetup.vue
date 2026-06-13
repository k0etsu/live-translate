<template>
  <div class="cuda-setup">
    <!-- CUDA status -->
    <div class="status-row">
      <span class="label">GPU (CUDA)</span>
      <span v-if="cudaDevice" class="badge badge-gpu">⚡ {{ cudaDevice }}</span>
      <span v-else-if="cudaChecked" class="badge badge-cpu">🖥 Not detected</span>
      <span v-else class="badge badge-pending">Checking…</span>
    </div>

    <template v-if="!cudaDevice && cudaChecked">
      <p class="hint">
        GPU acceleration requires PyTorch compiled with CUDA support. Install it below, then restart the app.
      </p>

      <button class="btn-install" @click="installCuda" :disabled="installing">
        {{ installing ? 'Installing…' : 'Install CUDA PyTorch' }}
      </button>

      <!-- Install log output -->
      <div v-if="logLines.length > 0" class="log-box" ref="logEl">
        <div v-for="(line, i) in logLines" :key="i" class="log-line">{{ line }}</div>
      </div>

      <p v-if="installDone" class="feedback ok">
        Installation complete. Restart the app to activate GPU acceleration.
      </p>
      <p v-if="installError" class="feedback err">{{ installError }}</p>

      <button v-if="installDone" class="btn-restart" @click="el.restartApp()">
        Restart Now
      </button>
    </template>

    <template v-if="cudaDevice">
      <p class="hint ok">
        CUDA is active. The model will run on your GPU for faster transcription.
      </p>
      <p class="hint-small">
        To switch back to CPU, uninstall the CUDA torch:
        <code>pip install torch torchaudio</code>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'

const props = defineProps<{ cudaDevice: string | null; cudaChecked: boolean }>()

const installing   = ref(false)
const installDone  = ref(false)
const installError = ref('')
const logLines     = ref<string[]>([])
const logEl        = ref<HTMLDivElement | null>(null)

const el = (window as any).electron

let unsubLog: (() => void) | null = null

async function installCuda() {
  installing.value   = true
  installDone.value  = false
  installError.value = ''
  logLines.value     = []

  unsubLog?.()
  unsubLog = el.onInstallLog((line: string) => {
    logLines.value.push(line)
    nextTick(() => {
      if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
    })
  })

  const result = await el.installCudaPyTorch()
  installing.value = false
  unsubLog?.()
  unsubLog = null

  if (result.ok) {
    installDone.value = true
  } else {
    installError.value = result.error ?? 'Installation failed. Check the output above.'
  }
}
</script>

<style scoped>
.cuda-setup { display: flex; flex-direction: column; gap: 12px; }
.status-row { display: flex; align-items: center; gap: 10px; }
.label { font-size: 13px; font-weight: 600; min-width: 80px; }
.badge {
  font-size: 12px; padding: 3px 10px; border-radius: 12px;
  font-weight: 600;
}
.badge-gpu  { background: var(--ok-bg); color: var(--ok); }
.badge-cpu  { background: rgba(120,120,140,0.15); color: #aaa; }
.badge-pending { background: rgba(251,191,36,0.15); color: #fbbf24; }
.hint {
  font-size: 13px; opacity: .75; line-height: 1.5;
  padding: 10px 12px; background: var(--surface2);
  border-radius: 8px; border: 1px solid var(--border);
}
.hint.ok { color: var(--ok); background: var(--ok-bg); border-color: var(--ok-border); opacity: 1; }
.hint-small { font-size: 12px; opacity: .6; }
.cmd-box {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 14px;
}
.cmd-box code { font-family: monospace; font-size: 13px; }
.btn-install {
  padding: 9px 18px; border-radius: 8px; border: none; font-size: 14px;
  font-weight: 600; cursor: pointer; background: var(--accent); color: #fff;
}
.btn-install:disabled { opacity: .55; cursor: default; }
.btn-restart {
  padding: 8px 16px; border-radius: 8px; border: none; font-size: 13px;
  font-weight: 600; cursor: pointer; background: var(--ok-bg); color: var(--ok);
}
.log-box {
  background: #111; border: 1px solid #333; border-radius: 8px;
  padding: 10px 12px; max-height: 200px; overflow-y: auto;
  font-family: monospace; font-size: 11px;
}
.log-line { color: #bbb; white-space: pre-wrap; word-break: break-all; }
.feedback { font-size: 12px; padding: 8px 12px; border-radius: 6px; }
.feedback.ok { background: var(--ok-bg); color: var(--ok); }
.feedback.err { background: rgba(239,68,68,0.1); color: #f87171; }
</style>
