#!/usr/bin/env bash
set -euo pipefail

EXAMPLES_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$EXAMPLES_ROOT/.." && pwd)"
EXAMPLE="${1:-all}"
if [[ "$EXAMPLE" == --help || "$EXAMPLE" == --list ]]; then
  printf 'Usage: bash examples/run.sh [all|example-name]\nAvailable examples:\n'
  for config in "$EXAMPLES_ROOT"/*/routes.json; do basename "$(dirname "$config")"; done
  exit 0
fi
if [[ "$EXAMPLE" != all && ( "$EXAMPLE" == *[^a-z0-9-]* || ! -f "$EXAMPLES_ROOT/$EXAMPLE/routes.json" ) ]]; then
  printf 'Unknown example: %s. Use --list.\n' "$EXAMPLE" >&2
  exit 1
fi
command -v node >/dev/null
cd "$PROJECT_ROOT"
node node_modules/typescript/bin/tsc -p tsconfig.prod.json
exec node "$EXAMPLES_ROOT/shared/runner.js" "$EXAMPLE"
