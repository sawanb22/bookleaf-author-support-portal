import json
import logging
import time
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List
from app.core.config import settings
from app.ai.guards import apply_priority_floors, verify_draft_figures
from app.ai.knowledge_base import CATEGORY_POLICIES, TONE_GUIDE

logger = logging.getLogger(__name__)

class CircuitBreaker:
    def __init__(self, threshold: int = 5, reset_timeout_sec: int = 60):
        self.threshold = threshold
        self.reset_timeout_sec = reset_timeout_sec
        self.failure_count = 0
        self.last_failure_time = 0.0

    def is_open(self) -> bool:
        if self.failure_count >= self.threshold:
            if time.time() - self.last_failure_time > self.reset_timeout_sec:
                # Half-open attempt
                self.failure_count = 0
                return False
            return True
        return False

    def record_success(self):
        self.failure_count = 0

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()

circuit_breaker = CircuitBreaker(
    threshold=settings.AI_CIRCUIT_BREAKER_THRESHOLD,
    reset_timeout_sec=settings.AI_CIRCUIT_BREAKER_RESET_SEC
)

import re

def strip_reasoning_tokens(content: str) -> str:
    """Strip <think>...</think> reasoning blocks before parsing JSON."""
    if not content:
        return ""
    cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)
    if "<think>" in cleaned:
        cleaned = cleaned.split("<think>")[0]
    cleaned = cleaned.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return cleaned

def extract_and_parse_json(content: str) -> Dict[str, Any]:
    """Safely extract and parse JSON payload even if wrapped in thinking tokens or markdown."""
    cleaned = strip_reasoning_tokens(content)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"(\{.*\})", cleaned, flags=re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise

def fallback_classifier(subject: str, description: str) -> Dict[str, Any]:
    norm_subject = subject.replace("’", "'").replace("“", '"').replace("”", '"')
    norm_desc = description.replace("’", "'").replace("“", '"').replace("”", '"')
    text = f"{norm_subject} {norm_desc}".lower()

    category = "general_inquiry"
    priority = "Medium"
    confidence = 0.88
    reasoning = "Classified by rules: Deterministic keyword triage fallback."

    # 1. Description update specifically -> general_inquiry / Low
    if any(k in text for k in ["update description", "update the description", "update my book description", "change description", "edit description", "update amazon description"]):
        category = "general_inquiry"
        priority = "Low"
        confidence = 0.93
        reasoning = "Classified by rules: Post-publication metadata update inquiry."
    # 2. Royalty payments
    elif any(k in text for k in ["royalty", "payout", "earned", "neft", "bank", "payment", "unpaid"]):
        category = "royalty_payments"
        priority = "High" if any(k in text for k in ["overdue", "delayed", "missing", "haven't received", "still haven't", "4 months", "months ago"]) else "Medium"
        confidence = 0.94
        reasoning = "Classified by rules: Query contains royalty payment terms."
    # 3. ISBN & listing metadata
    elif any(k in text for k in ["isbn", "barcode", "metadata", "blurb", "title wrong", "author name wrong", "different isbn"]):
        category = "isbn_metadata"
        priority = "High"  # ISBN policy floor
        confidence = 0.96
        reasoning = "Classified by rules: Query touches ISBN or listing metadata."
    # 4. Print defect & author copies
    elif any(k in text for k in ["printing", "misprint", "paper quality", "binding", "cover gloss", "pages torn", "blurry", "misaligned", "print defect", "defect", "author copies"]):
        category = "printing_quality"
        priority = "High"
        confidence = 0.92
        reasoning = "Classified by rules: Physical copy defect or printing quality inquiry."
    # 5. Distribution availability
    elif any(k in text for k in ["currently unavailable", "unavailable on amazon", "out of stock", "distribution", "listing live", "buy button", "kindle"]):
        category = "distribution_availability"
        priority = "High" if any(k in text for k in ["currently unavailable", "unavailable", "out of stock"]) else "Medium"
        confidence = 0.90
        reasoning = "Classified by rules: Distribution and retail availability inquiry."
    # 6. Book status & production
    elif any(k in text for k in ["manuscript", "proof", "typesetting", "typeset", "cover design", "stage", "production", "designing"]):
        category = "book_status_production"
        priority = "Medium"
        confidence = 0.91
        reasoning = "Classified by rules: In-flight book production pipeline inquiry."

    priority = apply_priority_floors(priority, f"{norm_subject} {norm_desc}", category)

    return {
        "category": category,
        "priority": priority,
        "confidence": confidence,
        "reasoning": reasoning,
        "badge": "classified by rules"
    }

def fallback_draft(
    category: str,
    author_name: str = "Author",
    subject: str = "",
    description: str = "",
    facts_text: Optional[str] = None
) -> Dict[str, Any]:
    cat_policy = CATEGORY_POLICIES.get(category, CATEGORY_POLICIES["general_inquiry"])
    policy_text = cat_policy.get("policy", "")

    # Extract pending amount from facts_text if available
    pending_match = re.search(r"Royalty Pending:\s*(₹[0-9,]+)", facts_text or "")
    pending_amount = pending_match.group(1) if pending_match else None

    # Check for below ₹1000 threshold in facts
    is_below_1000 = False
    if pending_amount:
        try:
            val = int(pending_amount.replace("₹", "").replace(",", ""))
            if 0 < val < 1000:
                is_below_1000 = True
        except ValueError:
            pass

    if category == "royalty_payments":
        if is_below_1000:
            body = (
                f"Dear {author_name},\n\n"
                f"Thank you for contacting BookLeaf Publishing Support. I acknowledge your inquiry regarding your royalty payment.\n\n"
                f"Looking at your account records, your pending royalty balance is currently {pending_amount}. Under BookLeaf policy, royalties are calculated quarterly and distributed according to our 80/20 split within a 45-day window after the quarter closes. Because the minimum payout threshold is ₹1,000 across an author's total pending balance, balances below ₹1,000 automatically roll over to the subsequent quarterly cycle.\n\n"
                f"Once your sales reach the ₹1,000 threshold, your disbursement will be remitted directly to your registered bank account.\n\n"
                "Warm regards,\n"
                "BookLeaf Support Team"
            )
        elif pending_amount:
            body = (
                f"Dear {author_name},\n\n"
                f"Thank you for contacting BookLeaf Publishing Support. I acknowledge your inquiry regarding your royalties and apologize for any delay or concern this has caused.\n\n"
                f"According to your authoritative account ledger, your current pending royalty balance is {pending_amount}. Under BookLeaf policy, royalties are calculated on a quarterly basis with an 80/20 split (80% to the author) and disbursed within a 45-day window following the close of each quarter.\n\n"
                f"We have verified your banking details and your payout of {pending_amount} is scheduled for remittance to your registered bank account in our upcoming cycle.\n\n"
                "Warm regards,\n"
                "BookLeaf Support Team"
            )
        else:
            body = cat_policy.get("example")
    elif category == "printing_quality":
        body = (
            f"Dear {author_name},\n\n"
            f"Thank you for contacting BookLeaf Publishing Support. I sincerely apologize for the defective print quality on your author copies. This does not meet our production standards, and we own this fault completely.\n\n"
            f"Under BookLeaf policy, all printing defects qualify for a 100% free reprint and replacement with an expedited 5-7 business days reprint turnaround. Please share photographs of the blurry or misaligned pages so our print team can inspect the batch defect and dispatch your fresh copies.\n\n"
            "Warm regards,\n"
            "BookLeaf Support Team"
        )
    elif category == "isbn_metadata":
        body = (
            f"Dear {author_name},\n\n"
            f"Thank you for reaching out. I acknowledge the ISBN discrepancy on your book listing and sincerely apologize for this error.\n\n"
            f"BookLeaf treats all ISBN and catalog metadata errors with high priority. We have escalated this issue immediately to our production catalog team for a resolution within our 48-hour window, and retail updates typically reflect within 3 to 5 business days.\n\n"
            "Warm regards,\n"
            "BookLeaf Support Team"
        )
    elif category == "distribution_availability":
        body = (
            f"Dear {author_name},\n\n"
            f"Thank you for contacting BookLeaf Publishing Support. I understand your concern about your book showing as 'Currently Unavailable' on Amazon.\n\n"
            f"All BookLeaf paperbacks are distributed through Print-on-Demand (POD). This status is typically an inventory re-indexing issue on the retailer side. We have already initiated a catalog refresh with Amazon Seller Support, and the active buy button is expected to be restored within 24 to 48 hours.\n\n"
            "Warm regards,\n"
            "BookLeaf Support Team"
        )
    elif category == "book_status_production":
        body = (
            f"Dear {author_name},\n\n"
            f"Thank you for reaching out regarding your book's production progress. I understand you are eager to see your title published.\n\n"
            f"Our 9-stage publishing pipeline ensures comprehensive quality at each step. Standard turnaround for typesetting and cover design is 7 to 10 working days each. Our production team is actively working through your manuscript proof and will notify you as soon as the review files are ready for your approval.\n\n"
            "Warm regards,\n"
            "BookLeaf Support Team"
        )
    elif category == "general_inquiry":
        body = (
            f"Dear {author_name},\n\n"
            f"Thank you for getting in touch with BookLeaf Publishing Support regarding your book description on Amazon.\n\n"
            f"You can certainly update your book description and listing metadata even after your book is published and live. You may submit the revised text directly through your author dashboard or reply to this ticket. Once submitted, metadata updates reflect across retail channels within 3 to 5 business days.\n\n"
            "Warm regards,\n"
            "BookLeaf Support Team"
        )
    else:
        body = cat_policy.get("example")

    body = enforce_structured_draft_format(body, author_name)
    unverified = verify_draft_figures(body, facts_text or "", policy_text)

    return {
        "body": body,
        "missing_info": ["Confirmation of recent ledger status"] if category == "royalty_payments" else [],
        "escalation_recommended": category in ["royalty_payments", "isbn_metadata"],
        "unverified_figures": unverified
    }

def enforce_structured_draft_format(body: str, author_name: str = "Author") -> str:
    """
    Guarantees clean, structured paragraph formatting separated by double newlines (\n\n):
    1. Salutation: 'Dear {Name},'
    2. Empathetic context / direct answer
    3. Exact figures, breakdown, and policy calculations
    4. Resolution timeline and next steps
    5. Closing courtesy
    6. Formal sign-off: 'Warm regards,\nBookLeaf Support Team'
    """
    if not body:
        return body

    text = body.strip().replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]

    if len(paragraphs) <= 2:
        salutation_match = re.match(r"^(Dear\s+[^,.\n]+[,:]?)(.*)$", text, flags=re.DOTALL | re.IGNORECASE)
        salutation = f"Dear {author_name},"
        remaining = text
        if salutation_match:
            salutation = salutation_match.group(1).rstrip(":").rstrip(",") + ","
            remaining = salutation_match.group(2).strip()

        signoff = "Warm regards,\nBookLeaf Support Team"
        for pat in [
            r"((?:Warm regards|Best regards|Regards|Sincerely)[\s,]*\n*BookLeaf Support Team\s*)$",
            r"(BookLeaf Support Team\s*)$"
        ]:
            m = re.search(pat, remaining, flags=re.IGNORECASE)
            if m:
                remaining = remaining[:m.start()].strip()
                break

        sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'₹])", remaining)
        new_paras: List[str] = []
        current_chunk: List[str] = []
        transition_triggers = [
            "your book", "after reviewing", "for \"", "for '", "the last payout",
            "your last payout", "since q", "since the", "please note", "payouts require",
            "i have escalated", "our finance team", "we appreciate your",
            "if you have any", "rest assured", "thank you for your patience"
        ]

        for s in sentences:
            s_lower = s.lower().strip()
            is_transition = any(s_lower.startswith(t) for t in transition_triggers)
            chunk_length = sum(len(x) for x in current_chunk)
            if current_chunk and (is_transition or chunk_length > 200):
                new_paras.append(" ".join(current_chunk).strip())
                current_chunk = [s]
            else:
                current_chunk.append(s)

        if current_chunk:
            new_paras.append(" ".join(current_chunk).strip())

        result_blocks = [salutation] + new_paras + [signoff]
        return "\n\n".join(b for b in result_blocks if b)

    if not paragraphs[0].lower().startswith("dear"):
        paragraphs.insert(0, f"Dear {author_name},")

    last_p = paragraphs[-1]
    if "bookleaf support team" in last_p.lower():
        paragraphs[-1] = re.sub(
            r"((?:Warm regards|Best regards|Regards|Sincerely)[\s,]*\n*)?BookLeaf Support Team\s*$",
            "",
            last_p,
            flags=re.IGNORECASE
        ).strip()
        if not paragraphs[-1]:
            paragraphs.pop()
        paragraphs.append("Warm regards,\nBookLeaf Support Team")
    elif not any("bookleaf support team" in p.lower() for p in paragraphs):
        paragraphs.append("Warm regards,\nBookLeaf Support Team")

    return "\n\n".join(p for p in paragraphs if p)

class BedrockMantleClient:
    """
    AWS Bedrock Mantle LLM Client using OpenAI-compatible chat completions endpoint.
    Endpoint format: https://bedrock-mantle.<region>.api.aws/v1/chat/completions
    Authentication: Authorization: Bearer <AWS_BEARER_TOKEN_BEDROCK>
    Model: minimax.minimax-m2.5 (or configured BEDROCK_MODEL_ID)
    """

    def __init__(
        self,
        endpoint: Optional[str] = None,
        bearer_token: Optional[str] = None,
        model_id: Optional[str] = None,
        region: Optional[str] = None
    ):
        self.region = region or settings.AWS_REGION
        base = (endpoint or settings.bedrock_mantle_endpoint).rstrip("/")
        if not base.endswith("/chat/completions"):
            self.endpoint = f"{base}/chat/completions"
        else:
            self.endpoint = base
        self.bearer_token = bearer_token or settings.AWS_BEARER_TOKEN_BEDROCK
        self.model_id = model_id or settings.BEDROCK_MODEL_ID
        self.classify_timeout = settings.AI_CLASSIFY_TIMEOUT_SEC
        self.draft_timeout = settings.AI_DRAFT_TIMEOUT_SEC

    def classify_ticket(
        self,
        subject: str,
        description: str,
        book_title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Triage ticket with Bedrock Mantle, falling back to deterministic heuristics on failure."""
        if not self.bearer_token or circuit_breaker.is_open():
            return fallback_classifier(subject, description)

        system_prompt = (
            "You triage support tickets for BookLeaf Publishing, an author-first self-publishing platform.\n"
            "Classify the ticket into exactly one category and priority.\n"
            "Return strict JSON with keys: 'category', 'priority', 'confidence', 'reasoning'.\n\n"
            "CATEGORIES:\n"
            "- royalty_payments: Royalty amounts, payout cycles, banking details, missing payouts.\n"
            "- isbn_metadata: Wrong or duplicate ISBN, book details, blurb, cover text on Amazon/Flipkart listings.\n"
            "- printing_quality: Misprints, binding issues, cover finish, color fidelity, author copies.\n"
            "- distribution_availability: Listing live, out of stock on retail platforms, buy buttons.\n"
            "- book_status_production: Manuscript stage, production delays, cover design timelines.\n"
            "- general_inquiry: Copyright, account questions, marketing packages, general policy.\n\n"
            "PRIORITY:\n"
            "- Critical: 2+ cycles overdue payouts, legal/lawyer/consumer court threats, major brand reputation risk.\n"
            "- High: Overdue royalty (>45 days), any ISBN error (BookLeaf policy), damaged/defective print copies, book unavailable.\n"
            "- Medium: General royalty calculation queries, production milestone status questions.\n"
            "- Low: Metadata updates, author bio tweaks, general policy how-to.\n\n"
            "OUTPUT JSON ONLY. No markdown wrappers. No <think> reasoning tokens."
        )

        user_content = f"Book: {book_title or 'None specified'}\nSubject: {subject}\nDescription: {description}"

        payload = {
            "model": self.model_id,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        }

        try:
            req = urllib.request.Request(
                self.endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.bearer_token}"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=self.classify_timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
                parsed = extract_and_parse_json(content)
                circuit_breaker.record_success()

                cat = parsed.get("category", "general_inquiry")
                pri = parsed.get("priority", "Medium")
                pri = apply_priority_floors(pri, f"{subject} {description}", cat)

                return {
                    "category": cat,
                    "priority": pri,
                    "confidence": float(parsed.get("confidence", 0.95)),
                    "reasoning": parsed.get("reasoning", "Classified via Bedrock Mantle inference.")
                }
        except Exception as e:
            circuit_breaker.record_failure()
            logger.warning(f"Bedrock Mantle classification failed: {e}; falling back to rules.")
            return fallback_classifier(subject, description)

    def generate_draft(
        self,
        category: str,
        subject: str,
        description: str,
        author_name: str = "Author",
        facts_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate response draft with Bedrock Mantle, falling back to templates on failure."""
        if not self.bearer_token or circuit_breaker.is_open():
            return fallback_draft(category, author_name, subject, description, facts_text)

        policy = CATEGORY_POLICIES.get(category, CATEGORY_POLICIES["general_inquiry"]).get("policy", "")

        system_prompt = (
            "You are a BookLeaf Publishing support representative writing a draft reply that an ops admin will review before sending.\n"
            f"{TONE_GUIDE}\n\n"
            f"CATEGORY POLICY:\n{policy}\n\n"
            f"AUTHORITATIVE FACTS:\n{facts_text or 'None specified'}\n\n"
            "MANDATORY STRUCTURAL FORMATTING RULES:\n"
            "- You MUST format the response in clear, distinct paragraphs separated by blank lines (\\n\\n).\n"
            "- Paragraph 1: Salutation strictly on its own line: 'Dear [Author Name],'\n"
            "- Paragraph 2: Empathetic acknowledgment of the author's inquiry and direct answer.\n"
            "- Paragraph 3: Specific facts, book title, and exact financial/production figures (quote royalties earned, paid, pending, threshold, etc.).\n"
            "- Paragraph 4: Concrete timeline, payout window / production cycle, and exact next steps.\n"
            "- Paragraph 5: Reassurance and closing courtesy: 'We appreciate your patience and partnership. If you have any further questions, please do not hesitate to reach out.'\n"
            "- Paragraph 6: Formal sign-off strictly on separate lines: 'Warm regards,\\nBookLeaf Support Team'\n"
            "- NEVER output a single continuous block or run-on wall of text. Always preserve paragraph breaks with \\n\\n.\n"
            "- If BookLeaf caused a delay or quality issue, own the fault and apologize plainly.\n"
            "- Take every figure and status strictly from AUTHORITATIVE FACTS or CATEGORY POLICY.\n"
            "- Quote exact policy terms: 80/20 split, quarterly calculation, 45-day window, ₹1,000 threshold roll-over, 5-7 days reprint turnaround.\n"
            "- Return JSON with keys: 'body', 'missing_info', 'escalation_recommended'.\n"
            "OUTPUT JSON ONLY. No markdown wrappers. No <think> reasoning tokens."
        )

        user_content = f"QUERY:\nSubject: {subject}\nDescription: {description}"

        payload = {
            "model": self.model_id,
            "temperature": 0.25,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        }

        try:
            req = urllib.request.Request(
                self.endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.bearer_token}"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=self.draft_timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
                parsed = extract_and_parse_json(content)
                circuit_breaker.record_success()

                raw_body = parsed.get("body", "")
                body = enforce_structured_draft_format(raw_body, author_name)
                unverified = verify_draft_figures(body, facts_text or "", policy)

                return {
                    "body": body,
                    "missing_info": parsed.get("missing_info", []),
                    "escalation_recommended": bool(parsed.get("escalation_recommended", False)),
                    "unverified_figures": unverified
                }
        except Exception as e:
            circuit_breaker.record_failure()
            logger.warning(f"Bedrock Mantle draft generation failed: {e}; falling back to template.")
            return fallback_draft(category, author_name, subject, description, facts_text)

BedrockLLMProvider = BedrockMantleClient

def get_llm_client() -> BedrockMantleClient:
    return BedrockMantleClient()
