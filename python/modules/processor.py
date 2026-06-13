"""ASR inference thread — adapted from hololivetl/src/modules/processor.py.

Changes from source:
- gui_queue.put(...) → emit(...)
- print() → log()
- settings read from mutable settings_ref dict for live updates
- model progress reported via emit() during load
"""

import os
import time
import traceback
import numpy as np
import torch
from queue import Queue, Empty
import threading

from .protocol import emit, log
from .audio_utils import enhance_audio_quality
from .model_utils import ensure_model_downloaded, get_kotoba_generate_kwargs, get_kotoba_pipeline_kwargs
from .filters import post_process_translation, is_hallucination, record_translation, reset_history
from .stats import TranslatorStats
from .config import SAMPLE_RATE, MODEL_CACHE_DIR


def load_model(settings_ref: dict) -> 'object | None':
    """
    Download (if needed) and load the ASR pipeline.
    Emits model_progress messages during work; emits model_ready on success.
    Returns the pipeline object, or None on failure.
    """
    model_id       = settings_ref.get('model', 'kotoba-tech/kotoba-whisper-bilingual-v1.0')
    model_cache_dir= settings_ref.get('model_cache_dir', MODEL_CACHE_DIR)

    def on_progress(status: str, pct: int) -> None:
        emit({'type': 'model_progress', 'status': status, 'progress': pct})

    try:
        emit({'type': 'model_progress', 'status': 'Checking model cache…', 'progress': 5})
        model_dir, _ = ensure_model_downloaded(model_id, model_cache_dir, on_progress)
    except Exception as e:
        emit({'type': 'error', 'message': f'Model download failed: {e}'})
        return None

    device     = 'cuda:0' if torch.cuda.is_available() else 'cpu'
    dtype      = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    attn_impl  = 'sdpa' if torch.cuda.is_available() else 'eager'

    emit({'type': 'model_progress', 'status': 'Loading ASR model…', 'progress': 80})
    log(f'Loading model on {device}…')

    try:
        from transformers import pipeline as hf_pipeline, AutoModelForSpeechSeq2Seq, AutoProcessor

        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_dir,
            torch_dtype=dtype,
            low_cpu_mem_usage=True,
            use_safetensors=True,
            attn_implementation=attn_impl,
        )
        processor = AutoProcessor.from_pretrained(model_dir)

        pipe = hf_pipeline(
            'automatic-speech-recognition',
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            torch_dtype=dtype,
            device=device,
            **get_kotoba_pipeline_kwargs(),
        )
        log(f'Model ready on {device}')
        emit({'type': 'model_ready', 'device': device})
        return pipe

    except Exception as e:
        log(f'Local load failed ({e}), falling back to HF download…')
        try:
            from transformers import pipeline as hf_pipeline
            pipe = hf_pipeline(
                'automatic-speech-recognition',
                model=model_id,
                torch_dtype=dtype,
                device=device,
                trust_remote_code=True,
                **get_kotoba_pipeline_kwargs(),
            )
            log(f'Model ready on {device} (HF fallback)')
            emit({'type': 'model_ready', 'device': device})
            return pipe
        except Exception as e2:
            emit({'type': 'error', 'message': f'Model load failed: {e2}'})
            return None


def processor_thread(
    stop_event: threading.Event,
    audio_queue: Queue,
    settings_ref: dict,
    pipe,
) -> None:
    """
    Reads audio segments from audio_queue, runs ASR, emits results.
    Runs after load_model() has already been called and returned a pipeline.
    """
    log('Processor thread started.')
    stats = TranslatorStats()
    reset_history()

    try:
        while not stop_event.is_set():
            start = time.time()
            had_translation    = False
            was_hallucination  = False

            try:
                audio = audio_queue.get(timeout=1.0)
            except Empty:
                continue

            try:
                audio = enhance_audio_quality(audio.flatten(), sample_rate=SAMPLE_RATE)

                if len(audio) < int(SAMPLE_RATE * 0.5):
                    log(f'Skipped: too short ({len(audio)/SAMPLE_RATE:.2f}s)')
                    stats.add_chunk(time.time() - start, False, False)
                    continue

                task       = settings_ref.get('task', 'translate')
                target_lang= 'en' if task == 'translate' else settings_ref.get('language_code', 'en')

                gen_kwargs = get_kotoba_generate_kwargs(task, target_lang)
                gen_kwargs['temperature']          = float(settings_ref.get('temperature', 0.08))
                gen_kwargs['max_new_tokens']       = int(settings_ref.get('max_new_tokens', 224))
                gen_kwargs['no_repeat_ngram_size'] = int(settings_ref.get('no_repeat_ngram_size', 3))

                result = pipe({'sampling_rate': SAMPLE_RATE, 'raw': audio}, generate_kwargs=gen_kwargs)
                text   = result['text'].strip() if result else ''

                had_translation = bool(text)
                if text:
                    if is_hallucination(text):
                        was_hallucination = True
                        log(f'Filtered: {text[:60]!r}')
                    else:
                        text = post_process_translation(text)
                        record_translation(text)
                        log(f'Result: {text}')

                        if task == 'translate':
                            emit({'type': 'result', 'transcript': '', 'translation': text})
                        else:
                            emit({'type': 'result', 'transcript': text, 'translation': ''})

            except Exception as e:
                log(f'ASR error: {e}')
                traceback.print_exc()
                was_hallucination = False

            finally:
                elapsed = time.time() - start
                stats.add_chunk(elapsed, had_translation, was_hallucination)
                emit({'type': 'stats', **stats.to_dict()})

    except Exception as e:
        log(f'Processor fatal: {e}')
        traceback.print_exc()
        emit({'type': 'error', 'message': f'Processing error: {e}'})
    finally:
        log('Processor thread stopped.')
