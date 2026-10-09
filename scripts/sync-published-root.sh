#!/usr/bin/env bash
set -euo pipefail

# Root files are intentionally the built Pages output because this repository
# has also been publishing the branch root via GitHub Pages (legacy source).
test -s dist/index.html
test -d dist/assets
if grep -q '/src/main.jsx' dist/index.html; then
  echo 'Refusing to publish an uncompiled Vite entrypoint' >&2
  exit 1
fi

mkdir -p assets
cp -a dist/. ./
touch .nojekyll

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -f index.html prototype-3d/index.html prototype-3d/v2/index.html assets/ .nojekyll
if git diff --cached --quiet; then
  echo 'Published branch files already match the compiled build'
else
  git commit -m 'chore(pages): synchronize compiled site with branch root [skip ci]'
  git push origin HEAD:main
fi
