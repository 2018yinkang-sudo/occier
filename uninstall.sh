#!/usr/bin/env bash
set -euo pipefail

readonly BIN_DIR="${HOME}/.local/bin"

rm -f \
  "${BIN_DIR}/cc-common" \
  "${BIN_DIR}/cc-deepseek" \
  "${BIN_DIR}/cc-kimi" \
  "${BIN_DIR}/cc-anthropic" \
  "${BIN_DIR}/cc-which" \
  "${BIN_DIR}/cc-remove-all" \
  "${BIN_DIR}/cc"

printf 'Removed launcher commands.\n'
printf 'Credential file was preserved at ~/.config/claude-code/providers.env\n'
