import subprocess
import os
import shutil
import socket
from fastapi import APIRouter

router = APIRouter()


def get_api_base_url():
    """Return LAN IP if available, otherwise fallback to localhost."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
        finally:
            s.close()

        if ip.startswith("127."):
            return "http://localhost:8000"
        return f"http://{ip}:8000"
    except Exception:
        return "http://localhost:8000"


@router.post("/update-app")
def update_app():
    """Rebuild the React frontend (npm run build) with LAN IP or localhost as fallback."""
    env = os.environ.copy()
    api_base_url = get_api_base_url()
    env["REACT_APP_API_BASE_URL"] = api_base_url

    build_dir = os.path.join("react-frontend", "build")
    index_file = os.path.join(build_dir, "index.html")

    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)

    npm_executable = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm_executable:
        return {
            "status": "error",
            "message": "npm not found. Please install Node.js and npm.",
        }

    try:
        # ✅ Don't capture all logs at once (prevents crashes)
        process = subprocess.Popen(
            [npm_executable, "run", "build"],
            cwd="react-frontend",
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=False,  # safer on Windows if you call npm.cmd directly
        )

        logs = []
        for line in process.stdout:
            logs.append(line.strip())

        process.wait()

        if process.returncode != 0:
            return {
                "status": "error",
                "message": "Rebuild failed",
                "logs": logs[-20:],  # ✅ return last 20 lines only
            }

        if not os.path.exists(index_file):
            return {
                "status": "error",
                "message": "Build finished but index.html not found.",
            }

        return {
            "status": "success",
            "message": f"Frontend update successful. Using API at {api_base_url}",
            "logs": logs[-20:],  # ✅ keep response small
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Unexpected error: {str(e)}",
        }
