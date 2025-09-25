import subprocess
import os
import shutil
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.post("/update-app")
def update_app():
    """
    Trigger frontend rebuild (npm run build) that works offline.
    Cleans old build and verifies the new build is ready.
    """
    try:
        env = os.environ.copy()

        # ✅ Force REACT_APP_API_BASE_URL to localhost if not provided
        env["REACT_APP_API_BASE_URL"] = env.get(
            "REACT_APP_API_BASE_URL",
            "http://localhost:8000"
        )

        build_dir = os.path.join("react-frontend", "build")
        index_file = os.path.join(build_dir, "index.html")

        # Remove old build if it exists
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)

        npm_executable = "npm.cmd" if os.name == "nt" else "npm"

        result = subprocess.run(
            [npm_executable, "run", "build"],
            cwd="react-frontend",
            capture_output=True,
            text=True,
            check=True,
            env=env,
        )


        # Verify build output
        if not os.path.exists(index_file):
            raise HTTPException(
                status_code=500,
                detail="Build process finished but index.html not found in build directory.",
            )

        return {
            "status": "success",
            "message": "Frontend update successful and ready (offline safe).",
            "stdout": result.stdout.strip(),
        }

    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Rebuild failed: {e.stderr or e.stdout}",
        )
