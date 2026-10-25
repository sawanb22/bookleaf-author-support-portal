import asyncio
from typing import Dict, Any, Callable, List

class EventBus:
    def __init__(self):
        self._subscribers: List[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self._subscribers:
            self._subscribers.remove(q)

    async def publish(self, event_type: str, data: Dict[str, Any]):
        for q in list(self._subscribers):
            try:
                await q.put({"event": event_type, "data": data})
            except Exception:
                pass

event_bus = EventBus()
