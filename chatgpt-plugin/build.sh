#!/usr/bin/env bash
# Builds the ZIP uploaded to https://platform.openai.com/plugins
# Usage: ./build.sh   (run from chatgpt-plugin/)
set -euo pipefail
cd "$(dirname "$0")"

OUT="decodo-chatgpt-plugin.zip"
VERSION=$(python3 -c "import json;print(json.load(open('plugin.json'))['version'])")

python3 -I validate.py . || { echo "Validation failed - not building."; exit 1; }

rm -f "$OUT"
find . -name '.DS_Store' -delete

# -X drops macOS extended attributes; the plugin files sit at the archive root.
zip -r -X "$OUT" plugin.json mcp.json assets \
  -x '.*' -x '*/.*' -x '__MACOSX/*' >/dev/null

echo "Built $OUT (plugin version $VERSION)"
unzip -l "$OUT"
