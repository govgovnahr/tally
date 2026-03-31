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
  --collect-all "uvicorn" \
  --collect-all "fastapi" \
  --noconfirm \
  server.py
cd ..

echo "==> Adding launcher script..."
cp "launchers/Launch BudgetTracker.command" "server/dist/BudgetTracker/Launch BudgetTracker.command"
chmod +x "server/dist/BudgetTracker/Launch BudgetTracker.command"

echo ""
echo "Done! Distributable is at: server/dist/BudgetTracker/"
echo "Friends should double-click 'Launch BudgetTracker.command' to open the app."
echo "Share the entire BudgetTracker/ folder with friends."
