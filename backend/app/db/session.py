import asyncio
import logging
import urllib.parse
from typing import List, Dict, Any, Optional
import asyncpg
from app.core.config import settings

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    def get_clean_dsn(self) -> str:
        raw_url = settings.DATABASE_URL or settings.DATABASE_URL_UNPOOLED
        if not raw_url:
            raise ValueError("DATABASE_URL is not set.")
        parsed = urllib.parse.urlsplit(raw_url)
        # asyncpg prefers clean DSN with ssl passed explicitly
        clean_url = f"{parsed.scheme}://{parsed.username}:{parsed.password}@{parsed.hostname}:{parsed.port or 5432}{parsed.path}"
        return clean_url

    async def get_pool(self) -> asyncpg.Pool:
        current_loop = asyncio.get_running_loop()
        if self.pool is not None:
            pool_loop = getattr(self.pool, "_loop", None)
            if pool_loop is not None and (pool_loop != current_loop or pool_loop.is_closed()):
                try:
                    await self.pool.close()
                except Exception:
                    pass
                self.pool = None

        if self.pool is None:
            await self.connect()
        return self.pool

    async def connect(self):
        current_loop = asyncio.get_running_loop()
        if self.pool is not None:
            pool_loop = getattr(self.pool, "_loop", None)
            if pool_loop == current_loop and not pool_loop.is_closed():
                return
            self.pool = None
        try:
            dsn = self.get_clean_dsn()
            self.pool = await asyncpg.create_pool(
                dsn,
                ssl="require",
                min_size=1,
                max_size=10,
                max_inactive_connection_lifetime=300.0,
                timeout=15.0
            )
            logger.info("Connected to Neon PostgreSQL connection pool.")
        except Exception as e:
            logger.error(f"Failed to initialize Neon PostgreSQL connection pool: {e}")
            raise

    async def disconnect(self):
        if self.pool is not None:
            try:
                await self.pool.close()
            except Exception:
                pass
            self.pool = None
            logger.info("Closed Neon PostgreSQL connection pool.")

    async def fetch_all(self, query: str, *args) -> List[Dict[str, Any]]:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            records = await conn.fetch(query, *args)
            return [dict(r) for r in records]

    async def fetch_one(self, query: str, *args) -> Optional[Dict[str, Any]]:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            record = await conn.fetchrow(query, *args)
            return dict(record) if record else None

    async def fetch_val(self, query: str, *args) -> Any:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    async def execute(self, query: str, *args) -> str:
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.execute(query, *args)

    async def is_ready(self) -> bool:
        try:
            val = await self.fetch_val("SELECT 1")
            return val == 1
        except Exception as e:
            logger.warning(f"Database readiness probe failed: {e}")
            return False

db = DatabaseManager()
