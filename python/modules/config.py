"""Default configuration values — mirrors hololivetl/src/modules/config.py.

Electron owns persistent config; these are the runtime defaults used when
a setting is not supplied by the Electron main process.
"""

import os

MODEL_ID    = 'kotoba-tech/kotoba-whisper-bilingual-v1.0'
SAMPLE_RATE = 16000

MODEL_CACHE_DIR = os.path.join(os.path.expanduser('~'), '.cache', 'translator_models')

DEFAULT_CONFIG: dict = {
    # Audio capture
    'volume_threshold':         0.006,
    'use_vad_filter':           True,
    'vad_threshold':            0.12,
    'use_dynamic_chunking':     True,
    'dynamic_max_chunk_duration': 6.0,
    'dynamic_silence_timeout':  0.7,
    'dynamic_min_speech_duration': 0.3,

    # ASR
    'model':                MODEL_ID,
    'task':                 'translate',   # 'translate' | 'transcribe'
    'temperature':          0.08,
    'max_new_tokens':       224,
    'no_repeat_ngram_size': 3,

    # Overlay appearance (used by Electron/renderer, not Python backend)
    'font_size':        20,
    'font_weight':      'bold',
    'window_opacity':   0.85,
    'subtitle_bg_mode': 'transparent',
    'subtitle_bg_color':   '#282828',
    'subtitle_font_color': '#ff8080',
    'text_shadow':      True,
    'border_width':     2,
    'border_color':     '#000000',

    # Paths
    'model_cache_dir': MODEL_CACHE_DIR,
}
