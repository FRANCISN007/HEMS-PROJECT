import os
import shutil
import socket
import subprocess
from fastapi import APIRouter

router = APIRouter()


def get_api_base_url() -> str:
    """Return LAN IP if available, otherwise fallback to localhost."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
        finally:
            s.close()
        return f"http://{ip}:8000" if not ip.startswith("127.") else "http://localhost:8000"
    except Exception:
        return "http://localhost:8000"


@router.post("/update-app")
def update_app():
    """Rebuild the React frontend (npm run build) with LAN IP or localhost fallback."""
    env = os.environ.copy()
    env["REACT_APP_API_BASE_URL"] = get_api_base_url()

    build_dir = os.path.join("react-frontend", "build")
    index_file = os.path.join(build_dir, "index.html")

    # Clear old build
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)

    npm_executable = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm_executable:
        return {"status": "error", "message": "npm not found. Please install Node.js and npm."}

    try:
        result = subprocess.run(
            [npm_executable, "run", "build"],
            cwd="react-frontend",
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        # Check for build success
        if result.returncode != 0:
            return {
                "status": "error",
                "message": "Rebuild failed",
                "logs": result.stdout.splitlines()[-10:],  # last 10 lines only
            }

        if not os.path.exists(index_file):
            return {"status": "error", "message": "Build finished but index.html not found."}

        return {
            "status": "success",
            "message": f"Frontend update successful. Using API at {env['REACT_APP_API_BASE_URL']}",
        }

    except Exception as e:
        return {"status": "error", "message": f"Unexpected error: {str(e)}"}
