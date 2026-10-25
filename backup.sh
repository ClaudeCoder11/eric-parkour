#!/bin/bash
# Save a timestamped zip of this project to ~/Backups (outside Dropbox).
# Run it with:   ./backup.sh
set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
NAME="$(basename "$SRC")"
DEST="$HOME/Backups/$NAME"
STAMP="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$DEST"
cd "$(dirname "$SRC")"
zip -qr "$DEST/${NAME}_${STAMP}.zip" "$NAME" -x "*.DS_Store"

echo "Backed up to: $DEST/${NAME}_${STAMP}.zip"
echo
echo "All backups you have:"
ls -lht "$DEST" | tail -n +2 | awk '{print "  " $9 "   " $5}'
