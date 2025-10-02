"""
Safe password hash / verify helper using Argon2 (passlib).

Usage:
  # Interactive (recommended)
  python passwords.py

  # Non-interactive (single arg)
  python passwords.py "MyPlainPassword"

  # Generate hash and write to .env (BE CAREFUL: will append/replace key)
  python passwords.py --write-env C:\path\to\.env

Note: Do NOT store plaintext anywhere. Use the printed hash to update your .env:
ADMIN_LICENSE_PASSWORD_HASH=<the-hash>
"""

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
    # Read current .env (if exists)
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
    # Replace or append
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
    # Write back
    with open(env_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines) + "\n")

def main():
    parser = argparse.ArgumentParser(description="Generate Argon2 hash for an admin password.")
    parser.add_argument("password", nargs="?", help="Plain password (if omitted script will prompt)")
    parser.add_argument("--write-env", dest="env", help="Path to .env file to write ADMIN_LICENSE_PASSWORD_HASH (optional)")
    parser.add_argument("--key", default="ADMIN_LICENSE_PASSWORD_HASH", help="Env key to write (default: ADMIN_LICENSE_PASSWORD_HASH)")
    args = parser.parse_args()

    if args.password:
        plain = args.password
    else:
        # prompt securely
        try:
            import getpass
            plain = getpass.getpass("Enter admin license password (hidden): ")
            if not plain:
                print("No password entered. Exiting.")
                sys.exit(1)
        except Exception:
            # fallback
            plain = input("Enter admin license password: ").strip()
            if not plain:
                print("No password entered. Exiting.")
                sys.exit(1)

    h = hash_password(plain)
    print("\n=== DO NOT STORE PLAIN PASSWORD ANYWHERE ===")
    print("Copy this full hash and store it in your .env as:")
    print(f'{args.key}={h}\n')  # not quoted so it's raw; next to user we will suggest quoting
    # Offer to write to .env file if requested (be cautious)
    if args.env:
        env_path = args.env
        try:
            write_env(env_path, args.key, h)
            print(f"[OK] Written {args.key} into {env_path}")
            # Optionally set restrictive permissions (see README)
        except Exception as exc:
            print(f"[ERROR] Could not write to {env_path}: {exc}")

if __name__ == "__main__":
    main()
