import os
import sys
import subprocess
import time
import webbrowser
import psutil
import socket
from dotenv import set_key, load_dotenv

# Set timezone
os.environ["TZ"] = "Africa/Lagos"

# Determine base directory
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Paths
ENV_PATH = os.path.join(BASE_DIR, ".env")
REACT_ENV_PATH = os.path.join(BASE_DIR, "react-frontend", ".env")

# Load existing .env values
load_dotenv(ENV_PATH)

# Python executable paths
PYTHON_VENV = os.path.join(BASE_DIR, "env", "Scripts", "python.exe")
PYTHON_EMBED = os.path.join(BASE_DIR, "python", "python.exe")

# Choose correct Python executable
if os.path.exists(PYTHON_VENV):
    PYTHON_EXECUTABLE = PYTHON_VENV
elif os.path.exists(PYTHON_EMBED):
    PYTHON_EXECUTABLE = PYTHON_EMBED
else:
    print("Error: No valid Python environment found.")
    sys.exit(1)

def get_preferred_ip():
    """
    Prefer Ethernet > Wi-Fi > fallback to localhost
    """
    for interface, addrs in psutil.net_if_addrs().items():
        if_stats = psutil.net_if_stats().get(interface)
        if not if_stats or not if_stats.isup:
            continue

        for addr in addrs:
            if (
                addr.family == socket.AF_INET
                and not addr.address.startswith("169.254")
                and addr.address != "127.0.0.1"
            ):
                print(f"[INFO] Selected IP: {addr.address}")
                return addr.address

    print("[INFO] No active LAN detected, using localhost")
    return "127.0.0.1"

def update_env_server_ip(ip_address):
    """Update backend .env only"""
    set_key(ENV_PATH, "SERVER_IP", ip_address)
    load_dotenv(ENV_PATH, override=True)

    print(f"[INFO] SERVER_IP set to {ip_address}")



def start_backend():
    """Start FastAPI backend which serves both API and React UI"""
    command = [
        PYTHON_EXECUTABLE, "-m", "uvicorn", "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--log-level", "info",
        "--no-access-log"
    ]
    return subprocess.Popen(command, cwd=BASE_DIR)

def open_browser(ip):
    """Open browser to the preferred IP"""
    time.sleep(5)  # Wait for backend to start
    print(f"[INFO] Opening browser at http://{ip}:8000")
    webbrowser.open(f"http://{ip}:8000")

if __name__ == "__main__":
    try:
        ip = get_preferred_ip()
        update_env_server_ip(ip)

        print("[INFO] Starting backend...")
        backend_proc = start_backend()
        open_browser(ip)

        while True:
            time.sleep(1)

    except Exception as e:
        with open(os.path.join(BASE_DIR, "hems_error_log.txt"), "w") as f:
            f.write("Application startup failed:\n")
            f.write(str(e))
        raise