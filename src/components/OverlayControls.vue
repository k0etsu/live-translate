<template>
  <div class="overlay-controls">
    <h3 class="section-title">Overlay Appearance</h3>

    <!-- Text -->
    <section>
      <h4 class="sub-title">Text</h4>
      <div class="grid">
        <div class="field-group">
          <label class="field-label">Color</label>
          <input type="color" v-model="l.overlayFontColor" @input="push" />
        </div>
        <div class="field-group">
          <label class="field-label">Font Size <span class="value">{{ l.overlayFontSize }}px</span></label>
          <input type="range" min="12" max="52" step="1" v-model.number="l.overlayFontSize" @input="push" />
        </div>
        <div class="field-group">
          <label class="field-label">Font Weight</label>
          <select v-model="l.overlayFontWeight" @change="push">
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Text Shadow</label>
          <label class="toggle">
            <input type="checkbox" v-model="l.overlayTextShadow" @change="push" />
            <span class="toggle-label">{{ l.overlayTextShadow ? 'On' : 'Off' }}</span>
          </label>
        </div>
        <div class="field-group">
          <label class="field-label">Horizontal Align</label>
          <div class="seg-row">
            <button v-for="a in ['left','center','right']" :key="a"
              :class="['seg-btn', { active: l.overlayTextAlign === a }]"
              @click="l.overlayTextAlign = a as any; push()">
              {{ a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡' }}
            </button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Vertical Position</label>
          <div class="seg-row">
            <button v-for="a in ['top','center','bottom']" :key="a"
              :class="['seg-btn', { active: l.overlayVertAlign === a }]"
              @click="l.overlayVertAlign = a as any; push()">
              {{ a === 'top' ? '⬆' : a === 'center' ? '↕' : '⬇' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Background -->
    <section>
      <h4 class="sub-title">Background</h4>
      <div class="grid">
        <div class="field-group">
          <label class="field-label">Color</label>
          <input type="color" v-model="l.overlayBgColor" @input="push" />
        </div>
        <div class="field-group">
          <label class="field-label">Opacity <span class="value">{{ l.overlayOpacity.toFixed(2) }}</span></label>
          <input type="range" min="0" max="1" step="0.05" v-model.number="l.overlayOpacity" @input="push" />
        </div>
      </div>
    </section>

    <!-- Window -->
    <section>
      <h4 class="sub-title">Window</h4>
      <div class="grid">
        <div class="field-group" style="grid-column: 1 / -1">
          <label class="field-label">Width <span class="value">{{ l.overlayWidth }}px</span></label>
          <input type="range" min="300" max="1920" step="10" v-model.number="l.overlayWidth" @input="push" />
        </div>
        <div class="field-group" style="grid-column: 1 / -1">
          <label class="field-label">Height <span class="value">{{ l.overlayHeight }}px</span></label>
          <input type="range" min="60" max="600" step="10" v-model.number="l.overlayHeight" @input="push" />
        </div>
      </div>
    </section>

    <!-- Live preview -->
    <div class="preview" :style="[previewBg, { alignItems: l.overlayVertAlign === 'top' ? 'flex-start' : l.overlayVertAlign === 'center' ? 'center' : 'flex-end' }]">
      <div class="preview-inner"
        :style="{
          color: l.overlayFontColor,
          fontWeight: l.overlayFontWeight,
          textAlign: l.overlayTextAlign,
          textShadow: l.overlayTextShadow ? '1px 1px 3px #000' : 'none',
          width: '100%',
        }"
      >
        <div class="preview-small">日本語テキスト例</div>
        <div :style="{ fontSize: l.overlayFontSize + 'px' }">Example English translation text</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Config, OverlayStyle } from '../../shared/types'

const props = defineProps<{ config: Partial<Config> }>()
const emit = defineEmits<{ update: [style: OverlayStyle & Partial<Config>] }>()

const l = ref({
  overlayFontSize:   props.config.overlayFontSize   ?? 20,
  overlayFontWeight: props.config.overlayFontWeight ?? 'bold',
  overlayFontColor:  props.config.overlayFontColor  ?? '#ff8080',
  overlayTextShadow: props.config.overlayTextShadow ?? true,
  overlayTextAlign:  (props.config.overlayTextAlign ?? 'left') as 'left' | 'center' | 'right',
  overlayVertAlign:  (props.config.overlayVertAlign ?? 'bottom') as 'top' | 'center' | 'bottom',
  overlayOpacity:    props.config.overlayOpacity    ?? 0,
  overlayBgColor:    props.config.overlayBgColor    ?? '#282828',
  overlayWidth:      props.config.overlayWidth      ?? 1000,
  overlayHeight:     props.config.overlayHeight     ?? 140,
})

watch(() => props.config, (c) => {
  if (c.overlayFontSize   != null) l.value.overlayFontSize   = c.overlayFontSize
  if (c.overlayFontWeight != null) l.value.overlayFontWeight = c.overlayFontWeight
  if (c.overlayFontColor  != null) l.value.overlayFontColor  = c.overlayFontColor
  if (c.overlayTextShadow != null) l.value.overlayTextShadow = c.overlayTextShadow
  if (c.overlayTextAlign  != null) l.value.overlayTextAlign  = c.overlayTextAlign
  if (c.overlayVertAlign  != null) l.value.overlayVertAlign  = c.overlayVertAlign
  if (c.overlayOpacity    != null) l.value.overlayOpacity    = c.overlayOpacity
  if (c.overlayBgColor    != null) l.value.overlayBgColor    = c.overlayBgColor
  if (c.overlayWidth      != null) l.value.overlayWidth      = c.overlayWidth
  if (c.overlayHeight     != null) l.value.overlayHeight     = c.overlayHeight
}, { deep: true })

const previewBg = computed(() => {
  const hex = l.value.overlayBgColor
  const n   = parseInt(hex.replace('#', ''), 16)
  const bg  = `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${l.value.overlayOpacity})`
  return l.value.overlayOpacity === 0
    ? { background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)' }
    : { background: bg }
})

function push() {
  emit('update', {
    fontSize:   l.value.overlayFontSize,
    fontWeight: l.value.overlayFontWeight,
    fontColor:  l.value.overlayFontColor,
    textShadow: l.value.overlayTextShadow,
    textAlign:  l.value.overlayTextAlign,
    vertAlign:  l.value.overlayVertAlign,
    opacity:    l.value.overlayOpacity,
    bgColor:    l.value.overlayBgColor,
    width:      l.value.overlayWidth,
    height:     l.value.overlayHeight,
    ...l.value,
  })
}
</script>

<style scoped>
.overlay-controls { display: flex; flex-direction: column; gap: 14px; }
.section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; opacity: .55; }
.sub-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; opacity: .45; margin-bottom: 6px; }
section { padding: 10px 12px; background: var(--surface2); border-radius: 8px; border: 1px solid var(--border); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.field-group { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; opacity: .7; display: flex; justify-content: space-between; }
.value { font-weight: 400; opacity: .8; text-transform: none; }
input[type="range"] { width: 100%; accent-color: var(--accent); }
input[type="color"] { width: 48px; height: 32px; border: none; cursor: pointer; border-radius: 4px; padding: 0; }
select { padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text); font-size: 13px; }
.toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.toggle input { width: 16px; height: 16px; accent-color: var(--accent); }
.toggle-label { font-size: 13px; }
.seg-row { display: flex; gap: 4px; }
.seg-btn {
  flex: 1; padding: 5px; border-radius: 5px; border: 1px solid var(--border);
  background: var(--surface2); color: var(--text); cursor: pointer; font-size: 14px;
  transition: background .1s;
}
.seg-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.preview {
  border-radius: 8px; padding: 12px 16px; min-height: 90px;
  display: flex; transition: all .15s;
}
.preview-inner { display: flex; flex-direction: column; gap: 4px; line-height: 1.35; width: 100%; }
.preview-small { font-size: 12px; opacity: .75; }
</style>
