// Overlay renderer — receives updates from the main process via contextBridge.
// Supports: text shadow, text/vertical alignment, solid bg with opacity, draggable.

interface OverlayStyle {
  fontSize:   number
  fontWeight: string
  fontColor:  string
  textShadow: boolean
  textAlign:  'left' | 'center' | 'right'
  vertAlign:  'top' | 'center' | 'bottom'
  opacity:    number
  bgColor:    string
  width:      number
  height:     number
}

const rootEl        = document.getElementById('root')        as HTMLDivElement
const transcriptEl  = document.getElementById('transcript')  as HTMLDivElement
const translationEl = document.getElementById('translation') as HTMLDivElement

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

function applyStyle(s: OverlayStyle): void {
  // Background — solid color with opacity (opacity 0 = transparent)
  document.body.style.background = s.opacity === 0
    ? 'transparent'
    : hexToRgba(s.bgColor, s.opacity)

  // Text colour & font
  document.body.style.color        = s.fontColor
  translationEl.style.fontSize     = `${s.fontSize}px`
  translationEl.style.fontWeight   = s.fontWeight
  translationEl.style.textShadow   = s.textShadow ? '1px 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)' : 'none'
  transcriptEl.style.textShadow    = s.textShadow ? '1px 1px 3px rgba(0,0,0,0.8)' : 'none'

  // Horizontal text alignment
  const align = s.textAlign ?? 'left'
  translationEl.style.textAlign = align
  transcriptEl.style.textAlign  = align

  // Vertical position
  const vert = s.vertAlign ?? 'bottom'
  rootEl.style.justifyContent = vert === 'top' ? 'flex-start' : vert === 'center' ? 'center' : 'flex-end'
}

function setText(transcript: string, translation: string): void {
  transcriptEl.textContent  = transcript
  translationEl.textContent = translation

  if (translation) {
    translationEl.classList.remove('fade-in')
    void translationEl.offsetWidth
    translationEl.classList.add('fade-in')
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────
const electron = (window as any).electron

if (electron) {
  electron.onOverlayUpdate(({ transcript, translation }: { transcript: string; translation: string }) => {
    setText(transcript, translation)
  })

  electron.onOverlayStyle((style: OverlayStyle) => {
    applyStyle(style)
  })
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close()
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    const text = [transcriptEl.textContent, translationEl.textContent].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }
})
