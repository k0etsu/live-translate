"""Hallucination detection and post-processing.

Adapted from hololivetl/src/modules/filters.py.
Changes: module-level translator and history; no external state arguments.
"""

import re
import string

_TRANSLATOR = str.maketrans('', '', string.punctuation)

SUBSTRING_BLOCKLIST = [
    'thank you for watching', 'thanks for watching', "don't forget",
    'to subscribe', 'subscribe', 'bell icon', 'see you next time',
    'in the next video', 'like and subscribe', 'hit the bell',
    'comment below', 'let me know', 'as a language model',
    'provide more context', "i'm an ai", 'i cannot', "i don't have access",
    'please provide', 'more information', 'context is needed',
    'in central tokyo, the temperature is likely to rise rapidly from morning',
    'in central tokyo', 'the temperature is likely to rise', 'this is a sound',
    'means in this context',
]

EXACT_BLOCKLIST = {
    'i see', 'i understand', 'i know', "i'm sorry", 'thank you', 'thanks',
    "you're welcome", 'okay', 'ok', 'all right', 'alright', 'got it', 'right',
    'of course', 'excuse me', 'please', 'the end', 'hello', 'hi', 'hey',
    'um', 'uh', 'hmm', 'well', 'so', 'like', 'you know', "that's right",
    'such as', 'i see, i see', 'alright i see', 'ah i see', 'sound good',
    'oh i see', 'heav-ho', 'mm-hmm', 'uh-huh', 'yeah', 'yep', 'nope', 'nah',
    '"i\'m not sure what "',
}

PRESERVE_SOUNDS = {
    'ah', 'oh', 'wow', 'no', 'yes', 'stop', 'help', 'wait', 'go', 'come',
    'aah', 'ooh', 'eeh', 'kyaa', 'waa', 'haa', 'yaa', 'noo', 'ahh', 'ohh',
    'nya', 'uwu', 'owo', 'ara', 'ehe', 'ehehe', 'hehe', 'hihi', 'hoho',
    'yay', 'yey', 'yup', 'nope', 'mhm', 'mmm', 'hmm', 'huh', 'eh',
    'gg', 'nice', 'good', 'bad', 'fail', 'win', 'lose', 'dead', 'alive',
    'hai', 'iie', 'sou', 'nani', 'mou', 'demo', 'kedo', 'desu', 'masu',
}

_QUALITY_PATTERNS = [
    re.compile(r'(.{1,10})\1{3,}'),
    re.compile(r'(\w+\s+)\1{2,}'),
    re.compile(r'[a-z]{15,}'),
    re.compile(r'\b\w{1}\s+\w{1}\s+\w{1}\b'),
    re.compile(r'\b(um|uh|ah|eh|mm)\b.*\b(um|uh|ah|eh|mm)\b.*\b(um|uh|ah|eh|mm)\b'),
]

_translation_history: list[str] = []
_MAX_HISTORY = 5


def post_process_translation(text: str) -> str:
    text = ' '.join(text.split())
    text = re.sub(r'\s+([,.!?;:])', r'\1', text)
    text = re.sub(r'([.!?])\s*([a-z])', r'\1 \2', text)
    text = re.sub(r'(^|[.!?]\s+)([a-z])', lambda m: m.group(1) + m.group(2).upper(), text)
    text = re.sub(r'([.!?]){2,}', r'\1', text)
    text = re.sub(r'\bi\b', 'I', text)
    text = re.sub(r'\bim\b', "I'm", text)
    text = re.sub(r'\bdont\b', "don't", text)
    text = re.sub(r'\bcant\b', "can't", text)
    text = re.sub(r'\bwont\b', "won't", text)
    if len(text.split()) == 1:
        text = text.rstrip('.')
    return text.strip()


def is_hallucination(text: str) -> bool:
    global _translation_history
    if not text or not text.strip():
        return True

    t = text.strip().lower()
    t_clean = text.translate(_TRANSLATOR).lower().strip()

    if t_clean in EXACT_BLOCKLIST and t_clean not in PRESERVE_SOUNDS:
        return True

    for phrase in SUBSTRING_BLOCKLIST:
        if re.search(r'\b' + re.escape(phrase) + r'\b', t):
            return True

    for pat in _QUALITY_PATTERNS:
        if pat.search(t):
            return True

    if t in [h.lower().strip() for h in _translation_history[-_MAX_HISTORY:]]:
        return True

    return False


def record_translation(text: str) -> None:
    global _translation_history
    _translation_history.append(text.strip())
    if len(_translation_history) > _MAX_HISTORY * 2:
        _translation_history = _translation_history[-_MAX_HISTORY:]


def reset_history() -> None:
    global _translation_history
    _translation_history = []
