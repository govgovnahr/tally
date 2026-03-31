@echo off
powershell -Command "Unblock-File -Path '%~dp0BudgetTracker.exe'"
start "" "%~dp0BudgetTracker.exe"
