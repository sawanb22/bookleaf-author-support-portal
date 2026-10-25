from typing import List, Optional, Union
from pydantic import BaseModel, field_validator

class ClassificationResult(BaseModel):
    category: str
    priority: str
    confidence: float
    reasoning: str

class DraftResult(BaseModel):
    body: str
    missing_info: List[str] = []
    escalation_recommended: bool = False
    unverified_figures: List[str] = []
    cached: Optional[bool] = False

    @field_validator("missing_info", "unverified_figures", mode="before")
    @classmethod
    def ensure_list(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            v = v.strip()
            return [v] if v else []
        if isinstance(v, list):
            return [str(item) for item in v if item]
        return []

class LLMCallRecord(BaseModel):
    ticket_id: Optional[str] = None
    call_type: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0
    status: str
    error_message: Optional[str] = None
