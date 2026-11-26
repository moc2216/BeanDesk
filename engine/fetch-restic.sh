#!/usr/bin/env bash
# Fetch the pinned restic release for one Rust target triple and check it
# against hashes taken from the release's GPG-signed SHA256SUMS
# (key CF8F18F2844575973F79D4E191A6868BD3F7A907). Output:
# src-tauri/binaries/restic/{restic[.exe],LICENSE}
set -euo pipefail

VERSION=0.19.1
LICENSE_SHA=6f08a01a9fab5b24e139a09f15cc24a73087c7bc09e3bacf099fdf2d767bf897
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/src-tauri/binaries/restic"

TARGET="${1:-${TARGET:-}}"
if [ -z "$TARGET" ]; then
    case "$(uname -s)-$(uname -m)" in
        Darwin-arm64) TARGET=aarch64-apple-darwin ;;
        Darwin-x86_64) TARGET=x86_64-apple-darwin ;;
        Linux-x86_64) TARGET=x86_64-unknown-linux-gnu ;;
        Linux-aarch64 | Linux-arm64) TARGET=aarch64-unknown-linux-gnu ;;
        MINGW*-x86_64 | MSYS*-x86_64 | CYGWIN*-x86_64) TARGET=x86_64-pc-windows-msvc ;;
        *) echo "no restic build for $(uname -s) $(uname -m)" >&2; exit 1 ;;
    esac
fi

ASSET=
while read -r triple asset digest; do
    if [ "$triple" = "$TARGET" ]; then
        ASSET="$asset"
        SHA="$digest"
        break
    fi
done < "$ROOT/engine/restic-assets.txt"
if [ -z "$ASSET" ]; then
    echo "no restic build for target $TARGET" >&2
    exit 1
fi

case "$TARGET" in
    *-windows-*) PYTHON="${PYTHON:-$(command -v python || command -v python3 || true)}" ;;
    *) PYTHON="${PYTHON:-$(command -v python3 || command -v python || true)}" ;;
esac
if [ -z "$PYTHON" ]; then
    echo "python3 is needed to check and unpack restic" >&2
    exit 1
fi

case "$(uname -s)" in
    MINGW* | MSYS* | CYGWIN*) PYTHON="$(cygpath -u "$PYTHON")" ;;
esac

NAME="restic_${VERSION}_${ASSET}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
curl -fsSL --retry 3 -o "$WORK/$NAME" "https://github.com/restic/restic/releases/download/v${VERSION}/${NAME}"
curl -fsSL --retry 3 -o "$WORK/LICENSE" "https://raw.githubusercontent.com/restic/restic/v${VERSION}/LICENSE"

rm -rf "$DEST"
mkdir -p "$DEST"
"$PYTHON" - "$WORK/$NAME" "$SHA" "$WORK/LICENSE" "$LICENSE_SHA" "$DEST" <<'PY'
import bz2, hashlib, os, shutil, stat, sys, zipfile

archive, archive_sha, license_path, license_sha, dest = sys.argv[1:]

def check(path, expected):
    with open(path, "rb") as handle:
        actual = hashlib.sha256(handle.read()).hexdigest()
    if actual != expected:
        sys.exit(f"sha256 mismatch for {os.path.basename(path)}: {actual}")

check(archive, archive_sha)
check(license_path, license_sha)
if archive.endswith(".zip"):
    exe = os.path.join(dest, "restic.exe")
    with zipfile.ZipFile(archive) as bundle:
        members = [name for name in bundle.namelist() if name.endswith(".exe")]
        if len(members) != 1:
            sys.exit("expected one restic executable in the zip")
        with bundle.open(members[0]) as source, open(exe, "wb") as target:
            shutil.copyfileobj(source, target)
else:
    exe = os.path.join(dest, "restic")
    with bz2.open(archive, "rb") as source, open(exe, "wb") as target:
        shutil.copyfileobj(source, target)
    os.chmod(exe, os.stat(exe).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
shutil.copyfile(license_path, os.path.join(dest, "LICENSE"))
PY
echo "wrote $DEST ($NAME)"
