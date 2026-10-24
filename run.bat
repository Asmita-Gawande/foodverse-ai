@echo off
cd /d "%~dp0backend"
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
echo Installing packages (first run takes a minute)...
pip install -r requirements.txt
start "" cmd /c "timeout /t 5 >nul && start http://127.0.0.1:8000"
uvicorn main:app --port 8000
pause
