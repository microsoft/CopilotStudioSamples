@echo off
setlocal enabledelayedexpansion

REM ─────────────────────────────────────────────────────────────────────────
REM setup.bat — Starts the HITL backend and creates a public tunnel (Windows)
REM
REM After running this script, import solution\customHIL_1_0_0_3.zip into
REM your Power Platform environment and set the HitlHostUrl environment
REM variable to the tunnel host URL printed below.
REM
REM Prerequisites:
REM   - Node.js 18+
REM   - devtunnel CLI (winget install Microsoft.devtunnel)
REM ─────────────────────────────────────────────────────────────────────────

set PORT=3978
set TUNNEL_NAME=hitl-sample

echo.
echo  Installing npm dependencies...
call npm install --silent
if errorlevel 1 (
    echo  ERROR: npm install failed
    exit /b 1
)
echo  Done.

echo.
echo  Setting up dev tunnel...

where devtunnel >nul 2>&1
if errorlevel 1 (
    echo  ERROR: devtunnel CLI not found.
    echo  Install with: winget install Microsoft.devtunnel
    exit /b 1
)

devtunnel user show >nul 2>&1
if errorlevel 1 (
    echo  You need to log in to devtunnel first.
    devtunnel user login
)

devtunnel delete %TUNNEL_NAME% >nul 2>&1
timeout /t 2 /nobreak >nul
devtunnel create %TUNNEL_NAME% --allow-anonymous
devtunnel port create %TUNNEL_NAME% --port-number %PORT% --protocol http
echo  Tunnel created.

REM Get tunnel URL from JSON output
for /f "delims=" %%i in ('devtunnel show %TUNNEL_NAME% --json 2^>nul ^| python -c "import json,sys; d=json.load(sys.stdin); tid=d.get('tunnel',d).get('tunnelId',''); parts=tid.rsplit('.',1); print(f'{parts[0]}-%PORT%.{parts[1]}.devtunnels.ms') if len(parts)==2 else print(f'{tid}-%PORT%.devtunnels.ms')" 2^>nul') do set TUNNEL_HOST=%%i

if "%TUNNEL_HOST%"=="" (
    REM Fallback: parse text output
    for /f "tokens=3" %%i in ('devtunnel show %TUNNEL_NAME% 2^>nul ^| findstr "Tunnel ID"') do (
        for /f "tokens=1,2 delims=." %%a in ("%%i") do (
            set TUNNEL_HOST=%%a-%PORT%.%%b.devtunnels.ms
        )
    )
)

if "%TUNNEL_HOST%"=="" (
    echo  ERROR: Could not extract tunnel URL.
    echo  Run: devtunnel show %TUNNEL_NAME%
    exit /b 1
)

set TUNNEL_URL=https://%TUNNEL_HOST%
echo  Tunnel URL: %TUNNEL_URL%

echo.
echo  Starting server...

start /b node server.js
timeout /t 2 /nobreak >nul

echo.
echo ════════════════════════════════════════════════════════
echo   HITL backend ready!
echo.
echo   Tunnel URL:   %TUNNEL_URL%
echo   Tunnel host:  %TUNNEL_HOST%
echo.
echo   Next steps:
echo     1. Import solution\customHIL_1_0_0_3.zip into your environment
echo     2. When prompted, set HitlHostUrl to:
echo.
echo        %TUNNEL_HOST%
echo.
echo     3. Create a flow or agent action using the connector
echo.
echo   Starting tunnel (Ctrl+C to stop everything)...
echo ════════════════════════════════════════════════════════
echo.

devtunnel host %TUNNEL_NAME%
