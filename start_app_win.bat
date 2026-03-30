@echo off
setlocal

cd /d "%~dp0"

set "VENV_DIR=.venv312"
set "VENV_PYTHON=%VENV_DIR%\Scripts\python.exe"
set "SOCKET_PORT=3001"

where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher ^(`py`^) was not found. Please install Python 3.12 first.
  exit /b 1
)

if not exist "%VENV_PYTHON%" (
  echo Creating Python 3.12 virtual environment...
  py -3.12 -m venv "%VENV_DIR%"
  if errorlevel 1 (
    echo Failed to create the Python 3.12 virtual environment.
    echo Make sure Python 3.12 is installed and available as `py -3.12`.
    exit /b 1
  )
)

echo Ensuring Python dependencies are installed...
"%VENV_PYTHON%" -m pip install --upgrade pip
if errorlevel 1 exit /b 1

"%VENV_PYTHON%" -m pip install opencv-python mediapipe==0.10.14
if errorlevel 1 exit /b 1

if not exist "node_modules" (
  echo Installing Node dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

set "ROLE="
:promptRole
echo.
echo Room setup:
echo   Type host to create a room on this machine.
echo   Type join to connect to someone else's room.
set /p ROLE=Enter choice [host/join]: 
if /i "%ROLE%"=="host" goto roleHost
if /i "%ROLE%"=="join" goto roleJoin
echo Please type host or join.
goto promptRole

:roleHost
for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
  for /f "tokens=* delims= " %%J in ("%%I") do (
    set "HOST_IP=%%J"
    goto hostIpReady
  )
)
:hostIpReady
if not defined HOST_IP (
  echo Could not determine this machine's LAN IP automatically.
  set "HOST_IP=127.0.0.1"
)
set "SOCKET_URL=http://%HOST_IP%:%SOCKET_PORT%"
goto launch

:roleJoin
echo.
echo Join room:
echo   Ask the host for the printed room IP address.
set /p HOST_IP=Enter host IP address ^(example: 192.168.1.23^): 
if not defined HOST_IP (
  echo A host IP is required to join a room.
  exit /b 1
)
set "SOCKET_URL=http://%HOST_IP%:%SOCKET_PORT%"

:launch
echo Starting gesture bridge in a new window...
start "Gesture Bridge" cmd /k ""%VENV_PYTHON%" gesture_toggle_bridge.py"

if /i "%ROLE%"=="host" (
  echo Starting shared room server in a new window...
  start "Room Server" cmd /k "set PORT=%SOCKET_PORT% && npm run server"
  echo Room hosted at %SOCKET_URL%
  echo Share this IP with others: %HOST_IP%
) else (
  echo Joining shared room at %SOCKET_URL%
)

echo Starting Vite app...
set "VITE_SOCKET_URL=%SOCKET_URL%"
call npm run dev -- --host 0.0.0.0
