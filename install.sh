#!/usr/bin/env bash
set -euo pipefail

readonly KIT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly BIN_DIR="${HOME}/.local/bin"
readonly CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/claude-code"
readonly ENV_FILE="${CONFIG_DIR}/providers.env"

mkdir -p "$BIN_DIR" "$CONFIG_DIR"

install -m 0755 "${KIT_DIR}/bin/cc-common" "${BIN_DIR}/cc-common"
install -m 0755 "${KIT_DIR}/bin/cc-deepseek" "${BIN_DIR}/cc-deepseek"
install -m 0755 "${KIT_DIR}/bin/cc-kimi" "${BIN_DIR}/cc-kimi"
install -m 0755 "${KIT_DIR}/bin/cc-anthropic" "${BIN_DIR}/cc-anthropic"
install -m 0755 "${KIT_DIR}/bin/cc-which" "${BIN_DIR}/cc-which"

if [[ ! -f "$ENV_FILE" ]]; then
  install -m 0600 "${KIT_DIR}/config/providers.env.example" "$ENV_FILE"
  printf 'Created private credential file: %s\n' "$ENV_FILE"
else
  printf 'Kept existing credential file: %s\n' "$ENV_FILE"
fi

case ":$PATH:" in
  *":${BIN_DIR}:"*) ;;
  *)
    printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "${HOME}/.bashrc"
    printf 'Added ~/.local/bin to ~/.bashrc\n'
    ;;
esac

printf '\nInstalled commands:\n'
printf '  cc-deepseek\n'
printf '  cc-kimi\n'
printf '  cc-anthropic\n'
printf '  cc-which\n'
printf '\nNext steps:\n'
printf '  1. Edit %s\n' "$ENV_FILE"
printf '  2. Run: source ~/.bashrc\n'
printf '  3. Enter a project and run cc-deepseek or cc-kimi\n'
printf '  4. Inside Claude Code, use /status to verify the active endpoint/model\n'
