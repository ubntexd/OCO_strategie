@echo off
echo === SETUP CLAUDE DESKTOP MCP — BotTrader v1.0 ===
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0setup-claude-desktop-windows.ps1" %*
echo.
echo Termine. Verifier bottrader dans Claude Desktop ^> Parametres ^> MCP.
