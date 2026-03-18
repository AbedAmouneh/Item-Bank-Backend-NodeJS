#!/bin/bash

# Build script for EMS
# Ensures pre-push hook is installed and runs the TypeScript build

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

echo "🔧 Checking git hooks installation..."

# Remove pre-commit hook if it exists (we use pre-push instead)
if [ -f ".git/hooks/pre-commit" ]; then
  echo "🗑️  Removing old pre-commit hook..."
  rm ".git/hooks/pre-commit"
  echo "✅ Pre-commit hook removed"
fi

# Install pre-push hook if not present or if it's different
HOOK_SOURCE="tests/setup/hooks/pre-push"
HOOK_DEST=".git/hooks/pre-push"

if [ ! -f "$HOOK_DEST" ] || ! cmp -s "$HOOK_SOURCE" "$HOOK_DEST"; then
  echo "📦 Installing pre-push hook..."
  
  # Create hooks directory if it doesn't exist
  mkdir -p .git/hooks
  
  # Copy the hook
  cp "$HOOK_SOURCE" "$HOOK_DEST"
  
  # Make it executable
  chmod +x "$HOOK_DEST"
  
  echo "✅ Pre-push hook installed!"
else
  echo "✅ Pre-push hook already up to date"
fi

echo ""
echo "🏗️  Building TypeScript project..."

# Run TypeScript compiler
if pnpm exec tsc; then
  echo "✅ Build completed successfully!"
else
  echo "❌ Build failed!"
  exit 1
fi
