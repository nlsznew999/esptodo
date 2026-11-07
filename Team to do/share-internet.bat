@echo off
chcp 65001 > nul
title TeamTask Cloudflare Tunnel
echo ========================================================
echo   ระบบแชร์ TeamTask ออกสู่อินเทอร์เน็ต (Cloudflare Tunnel)
echo ========================================================
echo.

if not exist "%~dp0cloudflared.exe" (
    echo [1/2] กำลังดาวน์โหลด Cloudflare Tunnel (cloudflared.exe) ฟรีจาก GitHub...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%~dp0cloudflared.exe'"
    if exist "%~dp0cloudflared.exe" (
        echo ดาวน์โหลดสำเร็จเรียบร้อย!
    ) else (
        echo ไม่สามารถดาวน์โหลดอัตโนมัติได้ กรุณาดาวน์โหลด cloudflared.exe มาวางในโฟลเดอร์นี้
        pause
        exit /b
    )
)

echo.
echo [2/2] กำลังเปิดสัญญาณแชร์ไปยังอินเทอร์เน็ต...
echo โปรดตรวจสอบให้แน่ใจว่าได้เปิด start-server.bat ไว้แล้ว!
echo.
echo เลือกลิงก์ที่มี .trycloudflare.com ด้านล่าง แล้วส่งให้เพื่อนทดลองใช้งานได้เลย:
echo --------------------------------------------------------
"%~dp0cloudflared.exe" tunnel --url http://localhost:8080
pause
