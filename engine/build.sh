#!/usr/bin/env bash
# Freeze beandesk-engine as an onedir tree. Output:
# src-tauri/binaries/engine/{beandesk-engine[.exe],_internal/}
set -euo pipefail

HOST_OS="$(uname -s)"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Actions passes python-path. `python3` on PATH may be a different arch.
if [ -n "${PYTHON:-}" ]; then
    HOST_PYTHON="$PYTHON"
elif [[ "$HOST_OS" == MINGW* || "$HOST_OS" == MSYS* ]] && command -v python >/dev/null 2>&1; then
    HOST_PYTHON="$(command -v python)"
elif command -v python3 >/dev/null 2>&1; then
    HOST_PYTHON="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
    HOST_PYTHON="$(command -v python)"
else
    echo "python is needed to freeze the engine" >&2
    exit 1
fi

EXE_NAME=beandesk-engine
case "$HOST_OS" in
    MINGW* | MSYS* | CYGWIN*)
        HOST_PYTHON="$(cygpath -u "$HOST_PYTHON")"
        EXE_NAME=beandesk-engine.exe
        ;;
esac

CHECK_ARCH=
if [ "$HOST_OS" = Darwin ] && [ -n "${ENGINE_ARCH:-}" ]; then
    CHECK_ARCH=1
fi

require_arch() {
    local arch
    arch="$("$1" -c 'import platform; print(platform.machine())')"
    if [ "$arch" != "$ENGINE_ARCH" ]; then
        echo "interpreter $1 is $arch, expected ${ENGINE_ARCH}" >&2
        exit 1
    fi
}

if [ -n "$CHECK_ARCH" ] && [ -n "${PYTHON:-}" ]; then
    require_arch "$HOST_PYTHON"
fi

VENV="$ROOT/.engine-venv"
if [ -n "${PYTHON:-}" ]; then
    rm -rf "$VENV"
fi
if [ ! -x "$VENV/bin/python" ] && [ ! -x "$VENV/Scripts/python.exe" ]; then
    "$HOST_PYTHON" -m venv "$VENV"
fi
if [ -x "$VENV/bin/python" ]; then
    VENV_PYTHON="$VENV/bin/python"
else
    VENV_PYTHON="$VENV/Scripts/python.exe"
fi

if [ -n "$CHECK_ARCH" ] && [ -z "${PYTHON:-}" ]; then
    require_arch "$VENV_PYTHON"
fi

"$VENV_PYTHON" -m pip install -q --require-hashes -r "$ROOT/engine/requirements.lock"
mkdir -p "$ROOT/src-tauri/binaries"
(
    cd "$ROOT/engine"
    "$VENV_PYTHON" -m PyInstaller --noconfirm --clean beandesk_engine.spec
)
SRC="$ROOT/engine/dist/beandesk-engine"
DEST="$ROOT/src-tauri/binaries/engine"
if [ ! -f "$SRC/$EXE_NAME" ] || [ ! -d "$SRC/_internal" ]; then
    echo "onedir freeze missing $SRC/$EXE_NAME or $SRC/_internal" >&2
    exit 1
fi
rm -rf "$DEST"
mv "$SRC" "$DEST"
EXE="$DEST/$EXE_NAME"
chmod +x "$EXE" 2>/dev/null || true
if [ -n "$CHECK_ARCH" ]; then
    arches="$(lipo -archs "$EXE" 2>/dev/null || true)"
    case " $arches " in
        *" ${ENGINE_ARCH} "*) ;;
        *)
            echo "bundled engine is [$arches], expected ${ENGINE_ARCH}" >&2
            exit 1
            ;;
    esac
fi
echo "wrote $DEST"
