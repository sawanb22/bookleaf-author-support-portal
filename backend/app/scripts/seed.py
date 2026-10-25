"""
Wrapper for seeding canonical dataset via `python -m app.scripts.seed`.
"""
import asyncio
from scripts.seed_canonical import main

if __name__ == "__main__":
    asyncio.run(main())
