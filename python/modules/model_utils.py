"""Model downloading and loading utilities.

Adapted from hololivetl/src/modules/model_utils.py.
Changes:
- print() replaced with log() and optional progress_fn callback
- progress_fn signature: (status: str, progress: int) -> None
"""

import os
import shutil
from typing import Callable
from .protocol import log

ProgressFn = Callable[[str, int], None]


def _noop(status: str, progress: int) -> None:
    pass


def ensure_model_downloaded(
    model_id: str,
    model_cache_dir: str,
    progress_fn: ProgressFn = _noop,
) -> tuple[str, str]:
    """
    Ensure the Whisper model and Silero VAD model are cached locally.
    Returns (model_dir, vad_dir).
    """
    os.makedirs(model_cache_dir, exist_ok=True)
    model_dir = os.path.join(model_cache_dir, 'whisper_model')
    vad_dir   = os.path.join(model_cache_dir, 'vad_model')

    # ── Whisper model ──────────────────────────────────────────────────────────
    required = ['model.safetensors', 'config.json', 'preprocessor_config.json']
    model_ok = os.path.isdir(model_dir) and all(
        os.path.exists(os.path.join(model_dir, f)) for f in required
    )

    if not model_ok:
        progress_fn('Downloading Whisper model…', 10)
        log(f'Downloading Whisper model: {model_id}')

        if os.path.isdir(model_dir):
            try:
                shutil.rmtree(model_dir)
            except Exception as e:
                log(f'Could not remove incomplete model dir: {e}')

        try:
            from huggingface_hub import snapshot_download
            progress_fn('Downloading Whisper model (HuggingFace)…', 20)
            model_dir = snapshot_download(
                repo_id=model_id,
                cache_dir=model_cache_dir,
                local_dir=os.path.join(model_cache_dir, 'whisper_model'),
                resume_download=True,
            )
            progress_fn('Whisper model downloaded.', 70)
            log(f'Whisper model saved to {model_dir}')
        except Exception as e:
            log(f'snapshot_download failed: {e}. Trying manual download…')
            progress_fn('Downloading Whisper model (manual)…', 20)
            _manual_download_model(model_id, model_dir, progress_fn)

    # ── Silero VAD model ───────────────────────────────────────────────────────
    os.makedirs(vad_dir, exist_ok=True)
    vad_path        = os.path.join(vad_dir, 'silero_vad.jit')
    vad_failed_path = vad_path + '.failed'

    if not os.path.exists(vad_path) and not os.path.exists(vad_failed_path):
        progress_fn('Downloading VAD model…', 75)
        log('Downloading Silero VAD model…')

        vad_urls = [
            'https://github.com/snakers4/silero-vad/raw/master/src/silero_vad/data/silero_vad.jit',
            'https://github.com/snakers4/silero-vad/raw/main/src/silero_vad/data/silero_vad.jit',
            'https://models.silero.ai/models/vad/silero_vad.jit',
            'https://github.com/snakers4/silero-vad/releases/download/v3.1/silero_vad.jit',
        ]

        downloaded = False
        for url in vad_urls:
            try:
                _download_file(url, vad_path, f'VAD model')
                downloaded = True
                log('Silero VAD model downloaded.')
                break
            except Exception as ex:
                log(f'VAD download from {url} failed: {ex}')
                if os.path.exists(vad_path):
                    os.remove(vad_path)

        if not downloaded:
            log('All VAD download URLs failed. VAD disabled.')
            with open(vad_failed_path, 'w') as f:
                f.write('VAD model download failed')

    progress_fn('Models ready.', 95)
    return model_dir, vad_dir


def _manual_download_model(model_id: str, model_dir: str, progress_fn: ProgressFn) -> None:
    os.makedirs(model_dir, exist_ok=True)
    base = f'https://huggingface.co/{model_id}/resolve/main'
    files = [
        'model.safetensors', 'config.json', 'preprocessor_config.json',
        'tokenizer.json', 'tokenizer_config.json', 'generation_config.json',
        'special_tokens_map.json', 'vocab.json',
    ]
    for i, fname in enumerate(files):
        dest = os.path.join(model_dir, fname)
        if not os.path.exists(dest):
            try:
                pct = 20 + int((i / len(files)) * 50)
                progress_fn(f'Downloading {fname}…', pct)
                _download_file(f'{base}/{fname}', dest, fname)
            except Exception as e:
                log(f'Failed to download {fname}: {e}')


def _download_file(url: str, dest: str, desc: str) -> None:
    import requests
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'wb') as f:
        for chunk in r.iter_content(chunk_size=65536):
            if chunk:
                f.write(chunk)
    log(f'{desc} → {dest}')


def get_kotoba_generate_kwargs(task: str = 'translate', target_language: str = 'en') -> dict:
    return {
        'language':             target_language,
        'task':                 task,
        'temperature':          0.08,
        'max_new_tokens':       224,
        'no_repeat_ngram_size': 3,
        'suppress_tokens':      [-1],
    }


def get_kotoba_pipeline_kwargs() -> dict:
    return {
        'chunk_length_s':   15,
        'batch_size':       16,
        'return_timestamps': True,
    }
