<template>
  <div class="device-selector">
    <label class="field-label">Audio Input</label>
    <div class="row">
      <select v-model="selected" @change="emit('change', selected)" :disabled="disabled">
        <option value="">— System default —</option>
        <optgroup v-if="loopbacks.length" label="System / Loopback">
          <option v-for="d in loopbacks" :key="d.name" :value="d.name">{{ d.name }}</option>
        </optgroup>
        <optgroup v-if="mics.length" label="Microphone / Virtual Input">
          <option v-for="d in mics" :key="d.name" :value="d.name">{{ d.name }}</option>
        </optgroup>
      </select>
      <button class="icon-btn" @click="emit('refresh')" :disabled="loading" title="Refresh devices">
        <span :class="{ spin: loading }">↻</span>
      </button>
    </div>
    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-if="!loading && devices.length === 0 && !error" class="hint">
      Click ↻ to load devices (Python backend must be running).
    </p>
    <p v-if="loopbacks.length === 0 && devices.length > 0" class="hint">
      No loopback devices found. Enable <em>Stereo Mix</em> in Windows Sound settings for system audio.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

export interface PyAudioDevice {
  name: string
  is_loopback: boolean
}

const props = defineProps<{
  modelValue: string
  disabled?: boolean
  devices: PyAudioDevice[]
  loading: boolean
  error: string
}>()

const emit = defineEmits<{
  change: [name: string]
  refresh: []
}>()

const selected = ref(props.modelValue ?? '')

watch(() => props.modelValue, (v) => { selected.value = v })

const sort = (arr: PyAudioDevice[]) => [...arr].sort((a, b) => a.name.localeCompare(b.name))
const loopbacks = computed(() => sort(props.devices.filter(d =>  d.is_loopback)))
const mics      = computed(() => sort(props.devices.filter(d => !d.is_loopback)))
</script>

<style scoped>
.device-selector { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; opacity: .7; }
.row { display: flex; gap: 6px; }
select {
  flex: 1; padding: 7px 10px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--input-bg);
  color: var(--text); font-size: 14px;
}
.icon-btn {
  width: 36px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--input-bg); color: var(--text); font-size: 18px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.spin { display: inline-block; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-text { color: #f87171; font-size: 12px; }
.hint { font-size: 11px; opacity: .6; }
</style>
