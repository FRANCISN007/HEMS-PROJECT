import os
import subprocess
from fastapi import APIRouter

router = APIRouter()

@router.post("/update-app")
def update_app():
    """Run the PowerShell script to copy build folder into Program Files."""
    try:
        # Full path to powershell.exe (safe even if PATH is broken)
        POWERSHELL_PATH = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

        # Path to your script
        script_path = r"C:\Users\KLOUNGE\Documents\HEMS-PROJECT\update-react-build.ps1"

        # Run the script
        result = subprocess.run(
            [POWERSHELL_PATH, "-ExecutionPolicy", "Bypass", "-File", script_path],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            return {
                "status": "error",
                "message": "Update failed",
                "stderr": result.stderr,
                "stdout": result.stdout
            }


        return {
            "status": "success",
            "message": "✅ Update successful!",
            "stdout": result.stdout
        }

    except Exception as e:
        return {"status": "error", "message": f"Unexpected error: {str(e)}"}
