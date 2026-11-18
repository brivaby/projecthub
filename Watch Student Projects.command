#!/bin/sh
CDPATH='' cd -P "$(dirname "$0")" || exit 1

# Finder may launch this without the interactive shell's Homebrew PATH.
PATH="$PATH:/opt/homebrew/bin:/opt/homebrew/opt/node@22/bin:/opt/homebrew/opt/node@20/bin:/usr/local/bin:/usr/local/opt/node@22/bin:/usr/local/opt/node@20/bin"
export PATH

exec python3 scripts/watch-preview.py "$@"
