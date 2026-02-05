#!/bin/bash

# Exit on error
set -e

echo "📦 Packaging Extension..."

# Define paths
ROOT_DIR=$(pwd)
EXTENSION_DIR="$ROOT_DIR/apps/extension"
WEB_PUBLIC_DIR="$ROOT_DIR/apps/web/public"
ZIP_FILE_NAME="lia360-extension.zip"

# Build extension
echo "🏗️  Building extension..."
cd "$EXTENSION_DIR"
npm run build

# Verify dist directory exists
if [ ! -d "dist" ]; then
    echo "❌ Error: dist directory not found after build"
    exit 1
fi

# Create zip file from dist content
echo "🤐 Zipping extension..."
cd dist
# Check if zip command exists
if ! command -v zip &> /dev/null; then
    echo "❌ Error: zip command not found"
    exit 1
fi

zip -r "../$ZIP_FILE_NAME" ./*

# Move zip to web public directory
echo "🚚 Moving zip to web public directory..."
cd ..
mkdir -p "$WEB_PUBLIC_DIR"
mv "$ZIP_FILE_NAME" "$WEB_PUBLIC_DIR/$ZIP_FILE_NAME"

echo "✅ Extension packaged successfully at: $WEB_PUBLIC_DIR/$ZIP_FILE_NAME"
