"""Performance statistics — direct port from hololivetl/src/modules/stats.py."""

import time


class TranslatorStats:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.start_time           = time.time()
        self.chunks_processed     = 0
        self.translations_made    = 0
        self.hallucinations_filtered = 0
        self.total_processing_time = 0.0

    @property
    def avg_ms(self) -> float:
        if self.chunks_processed == 0:
            return 0.0
        return (self.total_processing_time / self.chunks_processed) * 1000

    def add_chunk(self, processing_time: float, had_translation: bool, was_hallucination: bool) -> None:
        self.chunks_processed     += 1
        self.total_processing_time += processing_time
        if had_translation:
            if was_hallucination:
                self.hallucinations_filtered += 1
            else:
                self.translations_made += 1

    def to_dict(self) -> dict:
        return {
            'chunks':       self.chunks_processed,
            'translations': self.translations_made,
            'filtered':     self.hallucinations_filtered,
            'avg_ms':       round(self.avg_ms, 1),
        }
