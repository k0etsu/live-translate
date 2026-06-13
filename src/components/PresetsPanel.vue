<template>
  <div class="presets-panel">
    <h3 class="section-title">Presets</h3>

    <!-- Save current config as preset -->
    <div class="save-row">
      <input
        v-model="newName"
        placeholder="Preset name…"
        class="preset-input"
        @keydown.enter="savePreset"
        maxlength="40"
      />
      <button class="btn-sm btn-primary" @click="savePreset" :disabled="!newName.trim()">
        Save
      </button>
    </div>

    <!-- Preset list -->
    <div v-if="presets.length === 0" class="empty-hint">
      No presets yet. Save the current settings above to create one.
    </div>

    <ul v-else class="preset-list">
      <li v-for="p in presets" :key="p.name" class="preset-item">
        <div class="preset-info">
          <span class="preset-name">{{ p.name }}</span>
          <span v-if="(p as any)._bundled" class="badge-bundled">default</span>
        </div>
        <div class="preset-actions">
          <button class="btn-sm btn-secondary" @click="loadPreset(p.name)">Load</button>
          <button
            v-if="!(p as any)._bundled"
            class="btn-sm btn-danger"
            @click="deletePreset(p.name)"
          >Delete</button>
        </div>
      </li>
    </ul>

    <p v-if="message" :class="['feedback', messageOk ? 'ok' : 'err']">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Config, Preset } from '../../shared/types'

const emit = defineEmits<{ load: [config: Partial<Config>] }>()

const presets  = ref<Preset[]>([])
const newName  = ref('')
const message  = ref('')
const messageOk= ref(true)

const el = (window as any).electron

async function refresh() {
  presets.value = await el.listPresets()
}

async function savePreset() {
  const name = newName.value.trim()
  if (!name) return
  const config: Config = await el.getConfig()
  await el.savePreset(name, config)
  newName.value = ''
  message.value = `Saved "${name}".`
  messageOk.value = true
  await refresh()
  setTimeout(() => { message.value = '' }, 2500)
}

async function loadPreset(name: string) {
  const preset = await el.loadPreset(name)
  if (!preset) { message.value = 'Preset not found.'; messageOk.value = false; return }
  const { name: _, _bundled: __, ...config } = preset as any
  el.setConfig(config)
  emit('load', config)
  message.value = `Loaded "${name}".`
  messageOk.value = true
  setTimeout(() => { message.value = '' }, 2500)
}

async function deletePreset(name: string) {
  if (!confirm(`Delete preset "${name}"?`)) return
  await el.deletePreset(name)
  message.value = `Deleted "${name}".`
  messageOk.value = true
  await refresh()
  setTimeout(() => { message.value = '' }, 2500)
}

onMounted(refresh)
</script>

<style scoped>
.presets-panel { display: flex; flex-direction: column; gap: 14px; }
.section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; opacity: .55; }
.save-row { display: flex; gap: 8px; }
.preset-input {
  flex: 1; padding: 8px 10px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--input-bg);
  color: var(--text); font-size: 14px;
}
.preset-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.preset-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 12px; background: var(--surface2); border-radius: 8px;
  border: 1px solid var(--border);
}
.preset-info { display: flex; align-items: center; gap: 8px; }
.preset-name { font-size: 14px; font-weight: 500; }
.badge-bundled {
  font-size: 10px; padding: 2px 6px; border-radius: 10px;
  background: rgba(120,120,200,0.3); color: #aaa; text-transform: uppercase;
}
.preset-actions { display: flex; gap: 6px; }
.empty-hint { font-size: 13px; opacity: .55; text-align: center; padding: 20px 0; }
.btn-sm {
  padding: 5px 12px; border-radius: 5px; border: none; font-size: 13px;
  cursor: pointer; font-weight: 500;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:disabled { opacity: .5; cursor: default; }
.btn-secondary { background: var(--surface2); border: 1px solid var(--border); color: var(--text); }
.btn-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
.feedback { font-size: 12px; padding: 6px 10px; border-radius: 6px; }
.feedback.ok { background: rgba(52,211,153,0.1); color: #34d399; }
.feedback.err { background: rgba(239,68,68,0.1); color: #f87171; }
</style>
