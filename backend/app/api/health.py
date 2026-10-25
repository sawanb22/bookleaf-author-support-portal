import time
from datetime import datetime, timezone
from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
from app.db.session import db

router = APIRouter()
START_TIME = time.time()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "uptime": round(time.time() - START_TIME, 2),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/health/ready")
async def readiness_check():
    try:
        ready = await db.is_ready()
        if ready:
            return {
                "status": "ready",
                "database": "connected",
                "provider": "Neon PostgreSQL",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        return JSONResponse(
            status_code=503,
            content={"status": "unready", "error": "Database returned no rows"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unready", "error": str(e) or "Database connection failure"}
        )
