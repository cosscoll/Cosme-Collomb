#!/usr/bin/env bash
set -euo pipefail

# Publish only a verified Vite build. GitHub Pages uses the root of main:
# never expose an uncompiled /src/main.jsx entrypoint.
test -s dist/index.html
test -d dist/assets
if grep -q '/src/main.jsx' dist/index.html; then
  echo 'Refusing to publish an uncompiled Vite entrypoint' >&2
  exit 1
fi

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

# A preview deploy or another Actions run can advance main after checkout.
# Refresh the root from the most recent remote commit and only copy the
# already-tested dist output on top. Never force-push or erase other work.
for attempt in 1 2 3 4 5 6; do
  git fetch origin main
  if ! git diff --quiet "${GITHUB_SHA:-HEAD}" origin/main -- \
    src/ site/ vite.config.js package.json package-lock.json \
    tests/ index.source.html prototype-3d/index.source.html \
    prototype-3d/v2/index.source.html prototype-3d/v3/index.source.html; then
    echo "A newer source version was committed while the build ran; skip stale publication."
    exit 0
  fi

  git reset --hard origin/main
  mkdir -p assets
  cp -a dist/. ./
  touch .nojekyll
  git add -f index.html prototype-3d/index.html \
    prototype-3d/v2/index.html prototype-3d/v3/index.html assets/ .nojekyll

  if git diff --cached --quiet; then
    echo 'Verified compiled files already match branch-root Pages output'
    exit 0
  fi

  git commit -m 'chore(pages): synchronize verified compiled assets [skip ci]'
  if git push origin HEAD:main; then
    echo "Verified compiled Pages output published successfully."
    exit 0
  fi
  echo "Main advanced during push (attempt ${attempt}/6); retrying without force."
  sleep 3
done

echo 'Publication failed after safe retries; leaving existing Pages release intact.' >&2
exit 1
