#!/usr/bin/env python3
"""
live-translate Python backend — HoloLiveTL-compatible pipeline.
Communicates with Electron via stdin/stdout JSON lines.

Protocol (in):
  {"type": "list_devices"}
  {"type": "start",    "device_name": "...", "settings": {...}}
  {"type": "stop"}
  {"type": "settings", "settings": {...}}
  {"type": "quit"}

Protocol (out):
  {"type": "ready",          "cuda": bool, "cuda_device": str|null}
  {"type": "devices",        "devices": [{"name": str, "is_loopback": bool}]}
  {"type": "model_progress", "status": str, "progress": int}
  {"type": "model_ready",    "device": str}
  {"type": "vad_active",     "speaking": bool}
  {"type": "result",         "transcript": str, "translation": str}
  {"type": "stats",          "chunks": int, "translations": int,
                              "filtered": int, "avg_ms": float}
  {"type": "stopped"}
  {"type": "error",          "message": str}
"""

import os
import sys
import json
import threading
from queue import Queue

# ── CUDA memory hint (must be set before torch import) ────────────────────────
os.environ.setdefault('PYTORCH_CUDA_ALLOC_CONF', 'max_split_size_mb:128')
os.environ.setdefault('TRANSFORMERS_VERBOSITY', 'warning')
os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS', '1')

import torch

from modules.protocol import emit, log
from modules.config    import DEFAULT_CONFIG, MODEL_CACHE_DIR
from modules.recorder  import recorder_thread
from modules.processor import load_model, processor_thread


# ── Shared mutable state ───────────────────────────────────────────────────────
_settings_ref:   dict                       = dict(DEFAULT_CONFIG)
_stop_event:     threading.Event            = threading.Event()
_audio_queue:    Queue                      = Queue(maxsize=8)
_vad_model                                  = None
_pipe                                       = None
_rec_thread:     threading.Thread | None    = None
_proc_thread:    threading.Thread | None    = None


def _load_vad_model():
    """Load Silero VAD (small, CPU-only). Falls back gracefully."""
    global _vad_model
    torch.set_num_threads(1)

    cache_dir = _settings_ref.get('model_cache_dir', MODEL_CACHE_DIR)
    vad_path  = os.path.join(cache_dir, 'vad_model', 'silero_vad.jit')

    if os.path.exists(vad_path):
        try:
            _vad_model = torch.jit.load(vad_path, map_location='cpu')
            _vad_model.eval()
            log('Silero VAD loaded from cache.')
            return
        except Exception as e:
            log(f'VAD cache load failed: {e}')

    log('Loading Silero VAD via torch.hub…')
    try:
        model, _ = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False,
            verbose=False,
            trust_repo=True,
        )
        model.eval()
        _vad_model = model
        log('Silero VAD ready (torch.hub).')
    except Exception as e:
        log(f'Silero VAD unavailable ({e}); using energy fallback.')
        _vad_model = None


def _is_loopback(name: str) -> bool:
    """True for devices that capture system playback audio (outputs used as loopback sources)."""
    n = name.lower()
    return (
        'output' in n or
        'stereo mix' in n or
        'loopback'   in n or
        'what u hear' in n or
        'wave out'   in n or
        ' out '      in n or
        n.endswith(' out')
    )


def _list_devices() -> list[dict]:
    try:
        import soundcard as sc
        mics = sc.all_microphones(include_loopback=True)
        return [
            {'name': m.name, 'is_loopback': _is_loopback(m.name)}
            for m in mics
        ]
    except ImportError:
        emit({'type': 'error', 'message': 'soundcard not installed'})
        return []
    except Exception as e:
        emit({'type': 'error', 'message': f'Device list error: {e}'})
        return []


def _start(device_name: str, settings: dict) -> None:
    global _settings_ref, _stop_event, _audio_queue, _pipe
    global _rec_thread, _proc_thread

    _settings_ref.update(settings)
    _settings_ref['device_name'] = device_name
    _stop_event.clear()
    # Drain old queue
    while not _audio_queue.empty():
        try:
            _audio_queue.get_nowait()
        except Exception:
            break

    # Load model (blocks; emits progress messages)
    _pipe = load_model(_settings_ref)
    if _pipe is None:
        return  # error already emitted by load_model

    # Start recorder and processor threads
    _rec_thread = threading.Thread(
        target=recorder_thread,
        args=(_stop_event, _audio_queue, _settings_ref, _vad_model),
        daemon=True,
        name='recorder',
    )
    _proc_thread = threading.Thread(
        target=processor_thread,
        args=(_stop_event, _audio_queue, _settings_ref, _pipe),
        daemon=True,
        name='processor',
    )
    _rec_thread.start()
    _proc_thread.start()


def _stop() -> None:
    global _rec_thread, _proc_thread
    _stop_event.set()
    for t in (_rec_thread, _proc_thread):
        if t and t.is_alive():
            t.join(timeout=5)
    _rec_thread  = None
    _proc_thread = None
    emit({'type': 'stopped'})


def main():
    _load_vad_model()

    cuda_available = torch.cuda.is_available()
    cuda_device    = torch.cuda.get_device_name(0) if cuda_available else None
    emit({'type': 'ready', 'cuda': cuda_available, 'cuda_device': cuda_device})
    log(f'CUDA: {cuda_available} ({cuda_device or "N/A"})')

    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            log(f'Bad JSON: {line[:80]}')
            continue

        t = msg.get('type')

        if t == 'list_devices':
            emit({'type': 'devices', 'devices': _list_devices()})

        elif t == 'start':
            if _rec_thread and _rec_thread.is_alive():
                # Already running — just update settings live
                _settings_ref.update(msg.get('settings', {}))
                _settings_ref['device_name'] = msg.get('device_name', _settings_ref.get('device_name', ''))
            else:
                settings    = msg.get('settings', {})
                device_name = msg.get('device_name', '')
                # Run in a thread so the command loop stays responsive
                threading.Thread(
                    target=_start,
                    args=(device_name, settings),
                    daemon=True,
                    name='start-worker',
                ).start()

        elif t == 'stop':
            _stop()

        elif t == 'settings':
            _settings_ref.update(msg.get('settings', {}))

        elif t == 'quit':
            _stop_event.set()
            break


if __name__ == '__main__':
    main()
