import sys
import os
import argparse
from passlib.hash import argon2

def hash_password(plain_password: str) -> str:
    """Return Argon2 hash for plain_password."""
    return argon2.hash(plain_password)

def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify a candidate password against a stored Argon2 hash."""
    try:
        return argon2.verify(plain_password, stored_hash)
    except Exception:
        return False

def write_env(env_path: str, key: str, value: str):
    """Safely write or replace KEY=VALUE in .env file (simple parser)."""
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()

    key_found = False
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
            continue
        if "=" in line:
            k = line.split("=", 1)[0].strip()
            if k == key:
                new_lines.append(f'{key}="{value}"')
                key_found = True
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)

    if not key_found:
        new_lines.append(f'{key}="{value}"')

    with open(env_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines) + "\n")

def main():
    parser = argparse.ArgumentParser(description="Generate Argon2 hash for an admin password and write to .env.")
    parser.add_argument("password", nargs="?", help="Plain password (if omitted script will prompt)")
    parser.add_argument("--env", default=".env", help="Path to .env file (default: .env in current directory)")
    parser.add_argument("--key", default="ADMIN_LICENSE_PASSWORD_HASH", help="Env key to write (default: ADMIN_LICENSE_PASSWORD_HASH)")
    args = parser.parse_args()

    if args.password:
        plain = args.password
    else:
        try:
            import getpass
            plain = getpass.getpass("Enter admin license password (hidden): ")
            if not plain:
                print("No password entered. Exiting.")
                sys.exit(1)
        except Exception:
            plain = input("Enter admin license password: ").strip()
            if not plain:
                print("No password entered. Exiting.")
                sys.exit(1)

    h = hash_password(plain)

    # Always write to .env automatically
    try:
        write_env(args.env, args.key, h)
        print(f"[OK] Hashed password written as {args.key} into {args.env}")
    except Exception as exc:
        print(f"[ERROR] Could not write to {args.env}: {exc}")

if __name__ == "__main__":
    main()
