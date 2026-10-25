from typing import Optional, Dict, Any
from app.db.session import db
from app.core.security import verify_password, create_access_token

class AuthService:
    @staticmethod
    async def login(email: str, password: str) -> Optional[Dict[str, Any]]:
        normalized = email.strip().lower()
        user = await db.fetch_one(
            "SELECT id, email, name, role, password_hash, avatar_initials, title FROM users WHERE LOWER(email) = $1 LIMIT 1",
            normalized
        )
        if not user:
            return None

        if not verify_password(password, user.get("password_hash")):
            return None

        payload = {
            "sub": user["id"],
            "role": user["role"],
            "email": user["email"],
            "name": user["name"]
        }
        token = create_access_token(payload)

        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": 3600,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "avatar_initials": user.get("avatar_initials"),
                "title": user.get("title")
            }
        }

    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        return await db.fetch_one(
            "SELECT id, email, name, role, avatar_initials, title, bank_name, account_last4 FROM users WHERE id = $1 LIMIT 1",
            user_id
        )
