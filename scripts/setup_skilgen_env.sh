#!/usr/bin/env bash
set -euo pipefail

PY=${PYTHON:-python3}
VENV_DIR=${VENV_DIR:-.venv}

echo "[1/4] Using Python: $($PY -V 2>/dev/null || echo 'not found')"
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "Python not found. Please install Python 3.11+ and retry." >&2
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "[2/4] Creating venv at $VENV_DIR"
  "$PY" -m venv "$VENV_DIR"
fi

echo "[3/4] Activating venv"
# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

echo "[4/4] Upgrading packaging tools"
python -m pip install -U pip wheel setuptools

if [ -f requirements-skilgen.txt ]; then
  echo "Installing from pinned requirements (requirements-skilgen.txt)"
  python -m pip install -r requirements-skilgen.txt
else
  echo "Installing skilgen (fresh resolve)"
  python -m pip install skilgen
fi

echo "Done. Activate with: source $VENV_DIR/bin/activate"

