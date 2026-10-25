import uuid
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends
from app.core.security import decode_access_token, TokenPayload
from app.services.auth_service import AuthService

def create_error_dict(code: str, message: str, details: Any = None) -> Dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": uuid.uuid4().hex[:6]
        }
    }

async def get_current_user(request: Request) -> Dict[str, Any]:
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    token: Optional[str] = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    else:
        query_token = request.query_params.get("token")
        if query_token:
            token = query_token.strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail=create_error_dict("unauthorized", "Authentication required.")
        )

    payload: Optional[TokenPayload] = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail=create_error_dict("unauthorized", "Invalid or expired token.")
        )

    user = await AuthService.get_user_by_id(payload.sub)
    if not user:
        raise HTTPException(
            status_code=401,
            detail=create_error_dict("user_not_found", "User not found.")
        )

    return user

async def require_author(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") not in ["author", "admin"]:
        raise HTTPException(
            status_code=403,
            detail=create_error_dict("forbidden", "Author access required.")
        )
    return user

async def require_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail=create_error_dict("forbidden", "Admin access required.")
        )
    return user
