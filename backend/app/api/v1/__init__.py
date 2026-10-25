from fastapi import APIRouter
from .auth import router as auth_router
from .me import router as me_router
from .admin import router as admin_router

v1_router = APIRouter(prefix="/v1")
v1_router.include_router(auth_router)
v1_router.include_router(me_router)
v1_router.include_router(admin_router)

__all__ = ["v1_router"]
