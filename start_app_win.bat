@echo off
setlocal

cd /d "%~dp0"

set "VENV_DIR=.venv312"
set "VENV_PYTHON=%VENV_DIR%\Scripts\python.exe"

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

"%VENV_PYTHON%" -m pip install opencv-python mediapipe
if errorlevel 1 exit /b 1

if not exist "node_modules" (
  echo Installing Node dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting gesture bridge in a new window...
start "Gesture Bridge" cmd /k ""%VENV_PYTHON%" gesture_toggle_bridge.py"

echo Starting Vite app...
call npm run dev
