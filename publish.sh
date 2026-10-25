#!/bin/bash
# Push your latest changes to the live website.
#
# Run it with:   ./publish.sh
#            or: ./publish.sh "added a new level"
#
# About a minute after this finishes, the live site has your changes.
# (If you don't see them, do a hard refresh: Cmd-Shift-R on Mac, Ctrl-F5 on Windows.)
set -e

cd "$(dirname "$0")"

MSG="${1:-Update the game}"

if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing has changed since your last publish."
  exit 0
fi

echo "Changes being published:"
git status --short
echo

git add -A
git commit -q -m "$MSG"
git push -q origin main

URL="$(git remote get-url origin 2>/dev/null \
  | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"
USER="${URL%%/*}"
REPO="${URL##*/}"

echo "Published!"
echo
echo "Your game is at:  https://${USER}.github.io/${REPO}/"
echo "Give it about a minute, then refresh."
