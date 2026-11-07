@echo off
chcp 65001 > nul
title TeamTask Local Server
echo Starting TeamTask Local Server...
echo Open http://localhost:8080 in your browser.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
