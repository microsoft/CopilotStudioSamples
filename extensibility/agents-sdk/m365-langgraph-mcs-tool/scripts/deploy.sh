#!/usr/bin/env bash
#
# One-command deploy for the M365 LangGraph MCS Tool sample.
#
# It checks prerequisites, collects the handful of values the sample needs,
# writes them to env/.env.dev (+ secrets to env/.env.dev.user), then runs
# `atk provision` and `atk deploy` to stand up the Azure resources and push
# the bot. When it finishes it tells you how to install the app package.
#
# Usage:  scripts/deploy.sh            # interactive (prompts for anything missing)
#         ENV=dev scripts/deploy.sh    # target a different toolkit environment
#
# Any value already present (in the environment or in env/.env.dev) is reused,
# so re-running is idempotent and CI can pre-seed everything.

set -euo pipefail

ENV_NAME="${ENV:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/env/.env.${ENV_NAME}"
SECRET_FILE="${PROJECT_DIR}/env/.env.${ENV_NAME}.user"

cd "${PROJECT_DIR}"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
info() { printf '  %s\n' "$1"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$1" >&2; exit 1; }

bold "M365 LangGraph MCS Tool — deploy (env: ${ENV_NAME})"

# --- 1. Prerequisites -------------------------------------------------------
bold "1. Checking prerequisites"
need() { command -v "$1" >/dev/null 2>&1 || fail "$1 not found. $2"; }
need node "Install Node.js 22 or 24: https://nodejs.org"
need npm  "npm ships with Node.js: https://nodejs.org"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "${NODE_MAJOR}" -lt 22 ]; then
  fail "Node.js ${NODE_MAJOR} detected; this sample requires Node 22 or 24."
fi

# Resolve the Microsoft 365 Agents Toolkit CLI (`atk`). Prefer a global install;
# otherwise run it on demand with npx so no global install is required. (Note: the
# older `teamsapp` CLI reads teamsapp.yml, not m365agents.yml, so it is not used.)
if command -v atk >/dev/null 2>&1; then
  ATK=(atk)
  info "node $(node -v), npm $(npm -v), atk $(atk --version 2>/dev/null | head -n1)"
else
  need npx "npx ships with Node.js: https://nodejs.org"
  ATK=(npx -y -p @microsoft/m365agentstoolkit-cli atk)
  info "node $(node -v), npm $(npm -v); atk via npx (@microsoft/m365agentstoolkit-cli)"
fi

# --- helpers to read/write .env files --------------------------------------
read_env() { # read_env KEY FILE  -> prints value (may be empty)
  [ -f "$2" ] || { printf ''; return; }
  sed -n "s/^$1=//p" "$2" | head -n1
}
upsert_env() { # upsert_env KEY VALUE FILE
  local key="$1" val="$2" file="$3" tmp
  mkdir -p "$(dirname "${file}")"
  touch "${file}"
  if grep -q "^${key}=" "${file}"; then
    tmp="$(mktemp)"
    # replace the whole line; value is written literally
    awk -v k="${key}" -v v="${val}" 'BEGIN{FS=OFS="="}
      $1==k {print k "=" v; next} {print}' "${file}" >"${tmp}"
    mv "${tmp}" "${file}"
  else
    printf '%s=%s\n' "${key}" "${val}" >>"${file}"
  fi
}

# prompt_value KEY PROMPT DEFAULT [secret]
prompt_value() {
  local key="$1" prompt="$2" def="$3" secret="${4:-}"
  # precedence: existing shell env var > value already in the file > prompt
  local cur="${!key:-}"
  [ -n "${cur}" ] || cur="$(read_env "${key}" "${ENV_FILE}")"
  [ -n "${cur}" ] || cur="$(read_env "${key}" "${SECRET_FILE}")"
  if [ -z "${cur}" ]; then
    if [ ! -t 0 ]; then
      [ -n "${def}" ] && cur="${def}" || fail "${key} is required but no TTY is available to prompt."
    elif [ "${secret}" = "secret" ]; then
      read -r -s -p "  ${prompt}: " cur; echo
    else
      read -r -p "  ${prompt}${def:+ [${def}]}: " cur
      [ -n "${cur}" ] || cur="${def}"
    fi
  fi
  printf '%s' "${cur}"
}

# --- 2. Collect configuration ----------------------------------------------
bold "2. Collecting configuration (press Enter to accept a shown default)"

MCS_ENVIRONMENT_ID="$(prompt_value MCS_ENVIRONMENT_ID 'Copilot Studio environment ID (GUID)' '')"
[ -n "${MCS_ENVIRONMENT_ID}" ] || fail "MCS_ENVIRONMENT_ID is required."
MCS_SCHEMA_NAME="$(prompt_value MCS_SCHEMA_NAME 'Copilot Studio agent schema name (e.g. cr123_myAgent)' '')"
[ -n "${MCS_SCHEMA_NAME}" ] || fail "MCS_SCHEMA_NAME is required."
AZURE_OPENAI_ENDPOINT="$(prompt_value AZURE_OPENAI_ENDPOINT 'Azure OpenAI endpoint (https://<res>.openai.azure.com/)' '')"
[ -n "${AZURE_OPENAI_ENDPOINT}" ] || fail "AZURE_OPENAI_ENDPOINT is required."
AZURE_OPENAI_DEPLOYMENT="$(prompt_value AZURE_OPENAI_DEPLOYMENT 'Azure OpenAI deployment name' 'gpt-4o')"
SECRET_AZURE_OPENAI_API_KEY="$(prompt_value SECRET_AZURE_OPENAI_API_KEY 'Azure OpenAI API key' '' secret)"
[ -n "${SECRET_AZURE_OPENAI_API_KEY}" ] || fail "Azure OpenAI API key is required."

# Optional Azure targeting — leave empty to let atk prompt you.
AZURE_SUBSCRIPTION_ID="$(prompt_value AZURE_SUBSCRIPTION_ID 'Azure subscription ID (blank = choose during provision)' '')"
AZURE_RESOURCE_GROUP_NAME="$(prompt_value AZURE_RESOURCE_GROUP_NAME 'Azure resource group (blank = choose/create during provision)' '')"

# Globally-unique suffix for resource names — generate one if not set.
RESOURCE_SUFFIX="$(read_env RESOURCE_SUFFIX "${ENV_FILE}")"
if [ -z "${RESOURCE_SUFFIX}" ]; then
  RESOURCE_SUFFIX="$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 6 || true)"
  [ -n "${RESOURCE_SUFFIX}" ] || RESOURCE_SUFFIX="$(date +%s | tail -c 7)"
  info "Generated RESOURCE_SUFFIX=${RESOURCE_SUFFIX}"
fi

# --- 3. Persist to env files -----------------------------------------------
bold "3. Writing env/.env.${ENV_NAME} and env/.env.${ENV_NAME}.user"
upsert_env TEAMSFX_ENV               "${ENV_NAME}"                  "${ENV_FILE}"
upsert_env RESOURCE_SUFFIX           "${RESOURCE_SUFFIX}"           "${ENV_FILE}"
upsert_env AZURE_SUBSCRIPTION_ID     "${AZURE_SUBSCRIPTION_ID}"     "${ENV_FILE}"
upsert_env AZURE_RESOURCE_GROUP_NAME "${AZURE_RESOURCE_GROUP_NAME}" "${ENV_FILE}"
upsert_env MCS_CONNECTION_NAME       "mcs"                          "${ENV_FILE}"
upsert_env MCS_ENVIRONMENT_ID        "${MCS_ENVIRONMENT_ID}"        "${ENV_FILE}"
upsert_env MCS_SCHEMA_NAME           "${MCS_SCHEMA_NAME}"           "${ENV_FILE}"
upsert_env AZURE_OPENAI_ENDPOINT     "${AZURE_OPENAI_ENDPOINT}"     "${ENV_FILE}"
upsert_env AZURE_OPENAI_DEPLOYMENT   "${AZURE_OPENAI_DEPLOYMENT}"   "${ENV_FILE}"
upsert_env SECRET_AZURE_OPENAI_API_KEY "${SECRET_AZURE_OPENAI_API_KEY}" "${SECRET_FILE}"
info "Secrets written to env/.env.${ENV_NAME}.user (git-ignored)."

# --- 4. Build --------------------------------------------------------------
bold "4. Installing dependencies and building"
npm install
npm run build

# --- 5. Provision + deploy -------------------------------------------------
bold "5. Provisioning Azure resources (atk provision)"
info "You may be prompted to sign in to Azure and Microsoft 365."
"${ATK[@]}" provision --env "${ENV_NAME}"

bold "6. Deploying the bot (atk deploy)"
"${ATK[@]}" deploy --env "${ENV_NAME}"

# --- Done ------------------------------------------------------------------
PKG="appPackage/build/appPackage.${ENV_NAME}.zip"
bold "Done. Next steps"
info "1. Install the app package: ${PKG}"
info "   • Teams: Apps → Manage your apps → Upload an app → Upload a custom app"
info "   • Or run: ${ATK[*]} install --file-path ${PKG} --env ${ENV_NAME}"
info "2. Open the agent in Teams / Microsoft 365 Copilot and say hello."
info "3. First message triggers a one-time sign-in (delegated Copilot Studio access)."
