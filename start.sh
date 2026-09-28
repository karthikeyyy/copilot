#!/usr/bin/env bash
# ========================================================
# Conversation Copilot - Quick Start Script
# ========================================================

set -e
cd "$(dirname "$0")/server" || exit 1

echo "=========================================="
echo "🚀 Conversation Copilot Server Launcher"
echo "=========================================="

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed."
  echo "Please install Node.js (LTS version) from https://nodejs.org, then rerun this script."
  exit 1
fi

HAS_GEMINI_KEY=false
HAS_ANTHROPIC_KEY=false

if [ -f .env ]; then
  if grep -q '^GEMINI_API_KEY=AIza' .env || (grep -q '^GEMINI_API_KEY=' .env && ! grep -q 'your_gemini_api_key_here\|paste-' .env); then
    HAS_GEMINI_KEY=true
  fi
  if grep -q '^ANTHROPIC_API_KEY=sk-' .env; then
    HAS_ANTHROPIC_KEY=true
  fi
fi

CONFIGURE=false
if [ ! -f .env ] || [ "$HAS_GEMINI_KEY" = false -a "$HAS_ANTHROPIC_KEY" = false ]; then
  CONFIGURE=true
else
  echo "✓ Existing configuration detected in server/.env"
  read -r -p "Do you want to reconfigure your AI Provider / API Key? (y/N): " RECONF
  if [[ "$RECONF" =~ ^[Yy]$ ]]; then
    CONFIGURE=true
  fi
fi

if [ "$CONFIGURE" = true ]; then
  echo ""
  echo "Select your AI Provider:"
  echo "  1) Google Gemini (Free / Recommended - https://aistudio.google.com/apikey)"
  echo "  2) Anthropic Claude (Paid - https://console.anthropic.com/)"
  read -r -p "Enter choice [1 or 2, default: 1]: " PROVIDER_CHOICE
  PROVIDER_CHOICE=${PROVIDER_CHOICE:-1}

  if [ "$PROVIDER_CHOICE" = "2" ]; then
    echo "Paste your Anthropic API Key (sk-ant-...):"
    read -rs KEY
    echo ""
    if [ -z "$KEY" ]; then
      echo "❌ No key entered. Aborting."
      exit 1
    fi
    cat <<EOF > .env
PORT=3000
PROVIDER=anthropic
ANTHROPIC_API_KEY=$KEY
ANTHROPIC_MODEL=claude-3-5-haiku-latest
EOF
  else
    echo "Paste your Google Gemini API Key:"
    read -rs KEY
    echo ""
    if [ -z "$KEY" ]; then
      echo "❌ No key entered. Aborting."
      exit 1
    fi
    cat <<EOF > .env
PORT=3000
PROVIDER=gemini
GEMINI_API_KEY=$KEY
GEMINI_MODEL=gemini-flash-lite-latest
EOF
  fi

  chmod 600 .env
  echo "✓ Saved configuration to server/.env"
fi

if [ ! -d node_modules ]; then
  echo "📦 Installing server dependencies..."
  npm install
fi

echo "Starting server..."
npm start
