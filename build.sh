#!/bin/bash
set -e

echo "==> Building React frontend..."
cd client
npm install
npm run build
cd ..

echo "==> Copying frontend build to server/static..."
rm -rf server/static
cp -r client/dist server/static

echo "==> Packaging with PyInstaller..."
cd server
pyinstaller \
  --onedir \
  --name "BudgetTracker" \
  --add-data "static:static" \
  --add-data "routers:routers" \
  --hidden-import "routers.expenses_router" \
  --noconfirm \
  server.py
cd ..

echo ""
echo "Done! Distributable is at: server/dist/BudgetTracker/"
echo "On macOS/Linux: run server/dist/BudgetTracker/BudgetTracker"
echo "Share the entire BudgetTracker/ folder with friends."
