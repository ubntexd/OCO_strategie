@echo off
set VPS_IP=176.97.70.254
set VPS_USER=dev
set LOCAL_PORT=5011
set REMOTE_PORT=5011

echo Tunnel SSH vers %VPS_USER%@%VPS_IP%...
echo Local: http://localhost:%LOCAL_PORT%

:loop
ssh -N -L %LOCAL_PORT%:localhost:%REMOTE_PORT% ^
    -o ServerAliveInterval=30 ^
    -o ServerAliveCountMax=3 ^
    %VPS_USER%@%VPS_IP%
echo Tunnel ferme - reconnexion dans 5s...
timeout /t 5 >nul
goto loop
