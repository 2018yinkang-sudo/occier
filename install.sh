#!/usr/bin/env bash
set -euo pipefail

readonly KIT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly BIN_DIR="${HOME}/.local/bin"
readonly CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/claude-code"
readonly ENV_FILE="${CONFIG_DIR}/providers.env"

readonly BIN_FILES=(
  cc-common
  cc-deepseek
  cc-kimi
  cc-anthropic
  cc-which
  cc-remove-all
  cc
)

readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_CYAN='\033[0;36m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_RESET='\033[0m'

# ---------------------------------------------------------------------------
# helper
# ---------------------------------------------------------------------------

section()  { printf "${COLOR_CYAN}── %s${COLOR_RESET}\n\n" "$*"; }
ok()       { printf "  ${COLOR_GREEN}[✓]${COLOR_RESET} %s\n" "$*"; }
warn()     { printf "  ${COLOR_YELLOW}[!]${COLOR_RESET} %s\n" "$*"; }
fail()     { printf "  ${COLOR_RED}[✗]${COLOR_RESET} %s\n" "$*" >&2; }

read_secret() {
  local prompt="$1"
  local var_name="$2"
  local val
  while true; do
    read -r -s -p "  $prompt" val
    printf '\n'
    [[ -n "$val" ]] && break
    warn "Value must not be empty. Please try again."
  done
  printf -v "$var_name" '%s' "$val"
}

# ---------------------------------------------------------------------------
# welcome
# ---------------------------------------------------------------------------

clear
cat <<'BANNER'

  ╔══════════════════════════════════════════╗
  ║  Claude Code WSL  Multi-Provider Setup   ║
  ╚══════════════════════════════════════════╝

BANNER

# ---------------------------------------------------------------------------
# prerequisites
# ---------------------------------------------------------------------------

section "Checking prerequisites"

if command -v claude >/dev/null 2>&1; then
  ok "claude found: $(claude --version 2>/dev/null || echo '<installed>')"
else
  warn "claude is not installed."
  printf '    Install Claude Code first, then re-run this script.\n'
  printf '    Press Enter to continue anyway (launchers will still be installed).\n'
  read -r _
fi

mkdir -p "$BIN_DIR" "$CONFIG_DIR"
ok "Target directories ready"

# ---------------------------------------------------------------------------
# provider selection
# ---------------------------------------------------------------------------

section "Select providers to configure"

printf "  Which AI providers do you want to set up?\n\n"
printf "    1) DeepSeek  only\n"
printf "    2) Kimi      only\n"
printf "    3) Anthropic only\n"
printf "    a) All       (DeepSeek + Kimi + Anthropic)\n"
printf "    n) None      (install binaries only, configure later)\n"
printf "\n"

read -r -p "  Choose [1/2/3/a/n]: " PROVIDER_SELECTION

USE_DEEPSEEK=false
USE_KIMI=false
USE_ANTHROPIC=false

case "$PROVIDER_SELECTION" in
  1) USE_DEEPSEEK=true ;;
  2) USE_KIMI=true ;;
  3) USE_ANTHROPIC=true ;;
  a|A) USE_DEEPSEEK=true; USE_KIMI=true; USE_ANTHROPIC=true ;;
  n|N) ;;
  *) warn "Invalid selection, defaulting to 'n' (none).";;
esac

# ---------------------------------------------------------------------------
# handle existing providers.env
# ---------------------------------------------------------------------------

OVERWRITE_ENV=false
if [[ -f "$ENV_FILE" ]]; then
  section "Existing credential file found"
  warn "$ENV_FILE already exists."
  printf "\n  Overwrite it with new values?\n"
  printf "    y) Yes   (existing file will be backed up)\n"
  printf "    n) No    (keep existing, skip all key prompts)\n"
  printf "\n"
  read -r -p "  Choose [y/n]: " OVERWRITE_CHOICE
  case "$OVERWRITE_CHOICE" in
    y|Y) OVERWRITE_ENV=true
         cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"
         ok "Backed up to ${ENV_FILE}.bak.$(date +%s)" ;;
    *)   ok "Keeping existing credential file";;
  esac
fi

# ---------------------------------------------------------------------------
# collect API keys
# ---------------------------------------------------------------------------

DS_KEY=""
KIMI_KEY=""
ANTHROPIC_KEY=""

if $OVERWRITE_ENV || [[ ! -f "$ENV_FILE" ]]; then
  if $USE_DEEPSEEK; then
    printf '\n'
    read_secret "DeepSeek API Key: " DS_KEY
    ok "DeepSeek key recorded"
  fi

  if $USE_KIMI; then
    printf '\n'
    printf "  Note: This is a Kimi API Open Platform key,\n"
    printf "        NOT a Kimi Code subscription key.\n"
    printf '\n'
    read_secret "Kimi API Key: " KIMI_KEY
    ok "Kimi key recorded"
  fi

  if $USE_ANTHROPIC; then
    printf '\n'
    printf "  Leave empty to use claude.ai login instead of API key.\n"
    printf '\n'
    read -r -p "  Anthropic API Key (optional): " ANTHROPIC_KEY
    if [[ -n "$ANTHROPIC_KEY" ]]; then
      ok "Anthropic key recorded"
    else
      ok "Anthropic will use claude.ai login"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# write providers.env
# ---------------------------------------------------------------------------

if $OVERWRITE_ENV || [[ ! -f "$ENV_FILE" ]]; then
  section "Writing credential file"

  cat > "$ENV_FILE" <<'HEADER'
# Claude Code provider credentials
# Managed by install.sh (interactive)
# Never commit this file.
# Permissions: 600

HEADER

  if $USE_DEEPSEEK && [[ -n "$DS_KEY" ]]; then
    printf 'DEEPSEEK_API_KEY="%s"\n' "$DS_KEY" >> "$ENV_FILE"
    ok "DEEPSEEK_API_KEY written"
  else
    printf 'DEEPSEEK_API_KEY="replace_with_your_deepseek_api_key"\n' >> "$ENV_FILE"
  fi

  if $USE_KIMI && [[ -n "$KIMI_KEY" ]]; then
    printf 'KIMI_API_KEY="%s"\n' "$KIMI_KEY" >> "$ENV_FILE"
    ok "KIMI_API_KEY written"
  else
    printf 'KIMI_API_KEY="replace_with_your_kimi_open_platform_api_key"\n' >> "$ENV_FILE"
  fi

  if $USE_ANTHROPIC && [[ -n "$ANTHROPIC_KEY" ]]; then
    printf 'ANTHROPIC_API_KEY_OFFICIAL="%s"\n' "$ANTHROPIC_KEY" >> "$ENV_FILE"
    ok "ANTHROPIC_API_KEY_OFFICIAL written"
  else
    printf 'ANTHROPIC_API_KEY_OFFICIAL=""\n' >> "$ENV_FILE"
  fi

  chmod 600 "$ENV_FILE"
  ok "Permissions set to 600 on $ENV_FILE"
fi

# ---------------------------------------------------------------------------
# install binaries
# ---------------------------------------------------------------------------

section "Installing launcher commands"

for bin in "${BIN_FILES[@]}"; do
  src="${KIT_DIR}/bin/${bin}"
  dst="${BIN_DIR}/${bin}"
  if [[ -f "$src" ]]; then
    install -m 0755 "$src" "$dst"
    ok "installed: $bin"
  else
    warn "skipped (source not found): $bin"
  fi
done

# ---------------------------------------------------------------------------
# ensure PATH
# ---------------------------------------------------------------------------

section "Checking PATH"

case ":$PATH:" in
  *":${BIN_DIR}:"*)
    ok "~/.local/bin already in PATH"
    ;;
  *)
    printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "${HOME}/.bashrc"
    ok "Added ~/.local/bin to ~/.bashrc"
    ;;
esac

# ---------------------------------------------------------------------------
# done
# ---------------------------------------------------------------------------

printf '\n'
printf '  ╔══════════════════════════════════════════╗\n'
printf '  ║           Installation Complete          ║\n'
printf '  ╚══════════════════════════════════════════╝\n'
printf '\n'
printf "  Commands installed in ${BIN_DIR}/:\n"
printf '\n'
printf '  %-20s %s\n' 'cc'            'Interactive provider selector'
printf '  %-20s %s\n' 'cc-deepseek'  'DeepSeek (direct launch)'
printf '  %-20s %s\n' 'cc-kimi'      'Kimi (direct launch)'
printf '  %-20s %s\n' 'cc-anthropic' 'Anthropic official (direct launch)'
printf '  %-20s %s\n' 'cc-which'     'Show current provider config'
printf '  %-20s %s\n' 'cc-remove-all' 'Remove all config and binaries'
printf '\n'
printf "  Credential file: %s\n" "$ENV_FILE"
printf '\n'
printf "  Run:  source ~/.bashrc\n"
printf "  Then: cc\n"
printf '\n'
