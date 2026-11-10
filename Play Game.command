#!/bin/bash
# Double-click this file to play. It starts the local game server and opens
# the game in your browser. Close this Terminal window to stop the server.
cd "$(dirname "$0")"
PORT=8100
if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 serve.py $PORT &
  sleep 1
fi
open "http://localhost:$PORT"
wait
