#!/bin/bash

# Install git hooks for EMS project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

echo "📦 Installing git hooks..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Install pre-push hook
HOOK_SOURCE="tests/setup/hooks/pre-push"
HOOK_DEST=".git/hooks/pre-push"

if [ -f "$HOOK_SOURCE" ]; then
  cp "$HOOK_SOURCE" "$HOOK_DEST"
  chmod +x "$HOOK_DEST"
  echo "✅ Pre-push hook installed at .git/hooks/pre-push"
else
  echo "❌ Error: Hook source not found at $HOOK_SOURCE"
  exit 1
fi

echo ""
echo "🎉 Git hooks installation complete!"
echo ""
echo "The pre-push hook will now run:"
echo "  • TypeScript type checking (pnpm typecheck)"
echo "  • Code formatting check (pnpm format:check)"
echo ""
echo "Before every push to ensure code quality."

