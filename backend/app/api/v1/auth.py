from fastapi import APIRouter, HTTPException, Depends
from app.schemas.auth import LoginRequest, TokenResponse, UserMeResponse, UserOut
from app.services.auth_service import AuthService
from app.api.deps import get_current_user, create_error_dict

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    if not req.email or not req.password:
        raise HTTPException(
            status_code=422,
            detail=create_error_dict(
                "validation_error",
                "Email and password are required.",
                [
                    {"field": "email", "message": "Email is required"} if not req.email else {},
                    {"field": "password", "message": "Password is required"} if not req.password else {}
                ]
            )
        )

    auth_res = await AuthService.login(req.email, req.password)
    if not auth_res:
        raise HTTPException(
            status_code=401,
            detail=create_error_dict("invalid_credentials", "Invalid email or password.")
        )

    return auth_res

@router.get("/me", response_model=UserMeResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "user": UserOut(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            avatar_initials=user.get("avatar_initials"),
            title=user.get("title"),
            bank_name=user.get("bank_name"),
            account_last4=user.get("account_last4")
        )
    }
