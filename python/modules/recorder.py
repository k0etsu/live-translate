"""Audio capture — adapted from hololivetl/src/modules/recorder.py.

Changes from source:
- gui_queue.put(("error", ...)) → emit({"type": "error", ...})
- print() → log()
- vad_active state emitted as JSON
- settings read from a mutable dict (settings_ref) for live updates
"""

import os
import threading
import traceback
import numpy as np
import torch
from queue import Queue

from .protocol import emit, log
from .audio_utils import find_audio_device, enhance_audio_quality
from .config import SAMPLE_RATE


def recorder_thread(
    stop_event: threading.Event,
    audio_queue: Queue,
    settings_ref: dict,
    vad_model,
) -> None:
    """Entry point — dispatches to dynamic or fixed mode."""
    if settings_ref.get('use_dynamic_chunking', True):
        log('Recorder thread started (Dynamic Chunking Mode).')
        _dynamic_recorder(stop_event, audio_queue, settings_ref, vad_model)
    else:
        log('Recorder thread started (Fixed Chunk Mode).')
        _fixed_recorder(stop_event, audio_queue, settings_ref)


# ── Fixed chunking ─────────────────────────────────────────────────────────────

def _fixed_recorder(
    stop_event: threading.Event,
    audio_queue: Queue,
    settings_ref: dict,
) -> None:
    device_name = settings_ref.get('device_name', '')
    try:
        mic = find_audio_device(device_name)
        if mic is None:
            emit({'type': 'error', 'message': 'No audio device found'})
            return
        chunk_sec = float(settings_ref.get('dynamic_max_chunk_duration', 5.0))
        with mic.recorder(samplerate=SAMPLE_RATE, channels=1) as rec:
            while not stop_event.is_set():
                chunk_sec = float(settings_ref.get('dynamic_max_chunk_duration', 5.0))
                data = rec.record(numframes=int(SAMPLE_RATE * chunk_sec))
                if not stop_event.is_set():
                    audio_queue.put(data.flatten().astype(np.float32))
    except Exception as e:
        log(f'Recorder error (fixed): {e}')
        traceback.print_exc()
        emit({'type': 'error', 'message': f'Audio device error: {e}'})
    finally:
        log('Recorder thread stopped (fixed).')


# ── Dynamic chunking ───────────────────────────────────────────────────────────

_VAD_FRAME_SIZE = 512                                          # minimum Silero VAD frame at 16 kHz
_VAD_FRAME_MS   = _VAD_FRAME_SIZE * 1000 // SAMPLE_RATE       # 32 ms


def _dynamic_recorder(
    stop_event: threading.Event,
    audio_queue: Queue,
    settings_ref: dict,
    vad_model,
) -> None:
    device_name = settings_ref.get('device_name', '')
    try:
        mic = find_audio_device(device_name)
        if mic is None:
            emit({'type': 'error', 'message': 'No audio device found'})
            return

        is_speaking           = False
        speech_buffer: list   = []
        silence_frames        = 0

        with mic.recorder(samplerate=SAMPLE_RATE, channels=1) as rec:
            log('Dynamic recorder now listening…')
            while not stop_event.is_set():
                frame = rec.record(numframes=_VAD_FRAME_SIZE).flatten().astype(np.float32)

                # Read live settings
                vol_threshold  = float(settings_ref.get('volume_threshold', 0.006))
                vad_threshold  = float(settings_ref.get('vad_threshold', 0.12))
                max_dur        = float(settings_ref.get('dynamic_max_chunk_duration', 6.0))
                silence_timeout= float(settings_ref.get('dynamic_silence_timeout', 0.7))
                min_speech     = float(settings_ref.get('dynamic_min_speech_duration', 0.3))

                max_frames      = int(max_dur * 1000 / _VAD_FRAME_MS)
                silence_limit   = int(silence_timeout * 1000 / _VAD_FRAME_MS)
                min_samples     = int(min_speech * SAMPLE_RATE)

                rms        = float(np.sqrt(np.mean(frame ** 2)))
                peak       = float(np.max(np.abs(frame)))
                is_loud    = peak > 0.1

                if rms < vol_threshold and not is_loud:
                    is_speech = False
                else:
                    if vad_model is not None:
                        t = torch.from_numpy(frame).unsqueeze(0)
                        with torch.no_grad():
                            conf = vad_model(t, SAMPLE_RATE).item()
                        thresh = vad_threshold * 0.5 if is_loud else vad_threshold
                        is_speech = conf >= thresh or is_loud
                        emit({'type': 'vad_active', 'speaking': is_speech})
                    else:
                        is_speech = rms >= vol_threshold or is_loud

                if is_speaking:
                    speech_buffer.append(frame)
                    if is_speech:
                        silence_frames = 0
                    else:
                        silence_frames += 1

                    chunk_done = silence_frames > silence_limit or len(speech_buffer) > max_frames
                    if chunk_done:
                        audio = np.concatenate(speech_buffer)
                        is_loud_chunk = np.max(np.abs(audio)) > 0.1
                        effective_min = min_samples // 2 if is_loud_chunk else min_samples
                        if len(audio) >= effective_min:
                            audio_queue.put(audio)
                            log(f'Queued {len(audio)/SAMPLE_RATE:.2f}s segment')
                        else:
                            log(f'Skipped short segment: {len(audio)/SAMPLE_RATE:.2f}s')
                        is_speaking   = False
                        speech_buffer = []
                        silence_frames = 0

                elif is_speech:
                    is_speaking    = True
                    speech_buffer  = [frame]
                    silence_frames = 0

    except Exception as e:
        log(f'Recorder error (dynamic): {e}')
        traceback.print_exc()
        emit({'type': 'error', 'message': f'Audio device error: {e}'})
    finally:
        log('Recorder thread stopped (dynamic).')
