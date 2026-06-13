"""Audio utility functions — adapted from hololivetl/src/modules/audio_utils.py.

Changes from source:
- find_audio_device prints replaced with log()
- scipy.signal.butter used for high-pass (same as hololivetl)
"""

import numpy as np
from scipy.signal import butter, lfilter
from .protocol import log


def find_audio_device(selected_device_name: str | None = None):
    """Return the best soundcard microphone/loopback device."""
    import soundcard as sc

    all_mics = sc.all_microphones(include_loopback=True)
    if not all_mics:
        log('No audio devices found.')
        return None

    if selected_device_name:
        for mic in all_mics:
            if selected_device_name in mic.name:
                log(f'Using selected device: {mic.name!r}')
                return mic
        log(f'Device {selected_device_name!r} not found, falling back.')

    preferred_kws = ['cable', 'stereo mix', 'what u hear', 'loopback', 'virtual', 'voicemeeter']
    for kw in preferred_kws:
        for mic in all_mics:
            if kw in mic.name.lower():
                log(f'Using preferred capture device: {mic.name!r}')
                return mic

    try:
        default = sc.default_microphone(include_loopback=True)
        log(f'Using default loopback device: {default.name!r}')
        return default
    except Exception:
        log(f'Falling back to first device: {all_mics[0].name!r}')
        return all_mics[0]


def highpass_filter(data: np.ndarray, cutoff: float = 60.0, fs: int = 16000, order: int = 3) -> np.ndarray:
    """Butterworth high-pass filter — removes low-frequency rumble."""
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='high', analog=False)
    return lfilter(b, a, data)


def normalize_audio(audio_data: np.ndarray) -> np.ndarray:
    """Normalize to RMS 0.3 with soft-clip ceiling at 0.95."""
    audio_data = audio_data - np.mean(audio_data)
    rms = np.sqrt(np.mean(audio_data ** 2))
    if rms > 0:
        audio_data = audio_data * (0.3 / rms)
    # Soft clip
    audio_data = np.where(
        np.abs(audio_data) > 0.95,
        np.sign(audio_data) * (0.95 + 0.05 * np.tanh((np.abs(audio_data) - 0.95) * 10)),
        audio_data,
    )
    return audio_data


def enhance_audio_quality(audio_data: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
    """High-pass → normalize → suppress near-silence."""
    audio_data = highpass_filter(audio_data, cutoff=60.0, fs=sample_rate, order=3)
    audio_data = normalize_audio(audio_data)
    threshold = 0.005
    audio_data = np.where(np.abs(audio_data) < threshold, audio_data * 0.3, audio_data)
    return audio_data.astype(np.float32)
