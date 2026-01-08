import os
import sys
import subprocess
import time
import webbrowser
from dotenv import load_dotenv

os.environ["TZ"] = "Africa/Lagos"

# Detect base path
if getattr(sys, "frozen", False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Backend env
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH, override=True)

# Python executable
PYTHON_VENV = os.path.join(BASE_DIR, "env", "Scripts", "python.exe")
PYTHON_EMBED = os.path.join(BASE_DIR, "python", "python.exe")

if os.path.exists(PYTHON_VENV):
    PYTHON_EXECUTABLE = PYTHON_VENV
elif os.path.exists(PYTHON_EMBED):
    PYTHON_EXECUTABLE = PYTHON_EMBED
else:
    print("❌ No valid Python environment found.")
    sys.exit(1)

def start_backend():
    env = os.environ.copy()
    env.update({
        "PYTHONUNBUFFERED": "1",
        "TZ": "Africa/Lagos"
    })

    command = [
        PYTHON_EXECUTABLE,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--log-level", "info",
        "--no-access-log",
    ]

    return subprocess.Popen(command, cwd=BASE_DIR, env=env)

def open_browser():
    time.sleep(3)
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    print("[INFO] Starting backend...")
    backend_proc = start_backend()
    open_browser()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        backend_proc.terminate()
