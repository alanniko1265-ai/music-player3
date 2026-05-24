#!/bin/bash
# Wrapper for 7za that handles symlink creation failures on Windows
REAL_7ZA="/c/Users/20858/Desktop/音乐播放器/node_modules/7zip-bin/win/x64/7za.exe"
"$REAL_7ZA" "$@"
for arg in "$@"; do
  if [ "$prev" = "-o" ]; then
    for lib in libcrypto libssl; do
      SYMLINK="$arg/darwin/10.12/lib/${lib}.dylib"
      REAL="$arg/darwin/10.12/lib/${lib}.1.0.0.dylib"
      if [ -f "$REAL" ] && [ ! -s "$SYMLINK" ]; then
        cp "$REAL" "$SYMLINK" 2>/dev/null
      fi
    done
  fi
  prev="$arg"
done
exit 0
