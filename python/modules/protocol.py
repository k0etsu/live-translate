"""Shared stdout/stderr helpers for the JSON line protocol."""

import sys
import json
import threading

_stdout_lock = threading.Lock()


def emit(obj: dict) -> None:
    """Write a JSON line to stdout (thread-safe)."""
    with _stdout_lock:
        sys.stdout.write(json.dumps(obj) + '\n')
        sys.stdout.flush()


def log(msg: str) -> None:
    """Write a debug line to stderr."""
    sys.stderr.write(f'[backend] {msg}\n')
    sys.stderr.flush()
