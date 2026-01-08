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
    Prefer Ethernet > Wi-Fi > otherwise first active non-loopback IPv4
    """
    ip_priority = {"ethernet": None, "wifi": None}
    fallback_ip = None

    for interface, addrs in psutil.net_if_addrs().items():
        if_stats = psutil.net_if_stats().get(interface)
        if not if_stats or not if_stats.isup:
            continue

        for addr in addrs:
            if addr.family == socket.AF_INET and not addr.address.startswith("169.254"):
                name = interface.lower()
                if "ethernet" in name and not ip_priority["ethernet"]:
                    ip_priority["ethernet"] = addr.address
                elif ("wi-fi" in name or "wifi" in name or "wlan" in name) and not ip_priority["wifi"]:
                    ip_priority["wifi"] = addr.address
                elif not fallback_ip:
                    fallback_ip = addr.address

    selected_ip = ip_priority["ethernet"] or ip_priority["wifi"] or fallback_ip or "127.0.0.1"
    print(f"[INFO] Selected IP: {selected_ip}")
    return selected_ip

def update_env_server_ip(ip_address):
    """Update backend and frontend .env with SERVER_IP"""
    set_key(ENV_PATH, "SERVER_IP", ip_address)
    set_key(REACT_ENV_PATH, "REACT_APP_API_BASE_URL", f"http://{ip_address}:8000")

    # Reload envs to ensure consistency
    load_dotenv(ENV_PATH, override=True)
    load_dotenv(REACT_ENV_PATH, override=True)

    print(f"[INFO] SERVER_IP set to {ip_address} in backend .env")
    print(f"[INFO] REACT_APP_API_BASE_URL set in frontend .env")

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