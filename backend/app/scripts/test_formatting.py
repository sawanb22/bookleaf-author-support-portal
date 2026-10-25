import re
from typing import List

def enforce_structured_draft_format(body: str, author_name: str) -> str:
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
            "your book", "after reviewing", "for \"", "the last payout", "your last payout",
            "since q", "since the", "please note", "payouts require", "i have escalated",
            "our finance team", "we appreciate your", "if you have any", "rest assured",
            "thank you for your patience"
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

    # If it already had multiple paragraphs, ensure salutation and signoff formatting
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

sample = 'Dear Priya, I completely understand your concern about not receiving your Q3 royalties. Let me clarify the current status of your account. Your book "Whispers of the Ganges" has a pending royalty of ₹3,570, which is above our ₹1,000 threshold and eligible for payout. The last payout of ₹8,400 was processed on October 15, 2025. Since Q3 (July–September 2025) ended on September 30, our standard 45-day processing window extends to November 14, 2025. Your Q3 royalty may still be within the processing timeline. I have escalated this to our finance team for immediate verification. They will confirm the exact status of your Q3 payment within 24-48 business hours. Rest assured, your royalties are tracked accurately in our system, and you will receive every amount you have earned. Thank you for your patience and for being a valued creative partner with BookLeaf. BookLeaf Support Team'

print(enforce_structured_draft_format(sample, "Priya"))
