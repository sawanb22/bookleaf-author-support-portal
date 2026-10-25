import re
from typing import List, Dict, Any, Optional

def apply_priority_floors(priority: str, text: str, category: str) -> str:
    lower = text.lower()

    # 1. Legal or court or lawyer threats -> Critical
    legal_triggers = [
        r"\blawyer\b", r"\battorney\b", r"\blegal notice\b", r"\blegal action\b",
        r"\bconsumer forum\b", r"\bconsumer court\b", r"\bpolice\b", r"\bfraud\b",
        r"\bscam\b", r"\blawsuit\b", r"\bsue\b", r"\bsuing\b"
    ]
    if any(re.search(pat, lower) for pat in legal_triggers):
        return "Critical"

    # 2. 2+ quarters overdue with zero payout -> Critical
    if category == "royalty_payments":
        overdue_critical_triggers = [
            "2 quarters", "two quarters", "2+ quarters", "two cycles", "2 cycles",
            "never received", "no payout since", "zero payout", "no royalty received",
            "unpaid for months", "months overdue"
        ]
        if any(k in lower for k in overdue_critical_triggers):
            return "Critical"

    # 3. ISBN mismatch/error -> High (BookLeaf policy floor)
    isbn_triggers = [
        "wrong isbn", "duplicate isbn", "isbn error", "invalid isbn",
        "isbn mismatch", "barcode", "different isbn", "isbn differs"
    ]
    if category == "isbn_metadata" or any(k in lower for k in isbn_triggers):
        if priority in ["Low", "Medium"]:
            return "High"

    # 4. Print defect / author copies -> High
    defect_triggers = [
        "damaged", "misprint", "smudged", "binding broken", "pages torn",
        "blurry", "misaligned", "print defect", "defect", "author copies"
    ]
    if category == "printing_quality" or any(k in lower for k in defect_triggers):
        if category == "printing_quality" and priority in ["Low", "Medium"]:
            return "High"
        elif any(k in lower for k in ["blurry", "misaligned", "damaged", "print defect"]):
            if priority in ["Low", "Medium"]:
                return "High"

    # 5. Unavailable on retail platform -> High
    unavailable_triggers = [
        "currently unavailable", "unavailable on amazon", "unavailable on flipkart",
        "out of stock", "buy button missing", "unavailable"
    ]
    if category == "distribution_availability" and any(k in lower for k in unavailable_triggers):
        if priority in ["Low", "Medium"]:
            return "High"
    elif any(k in lower for k in ["currently unavailable", "unavailable on amazon"]):
        if priority in ["Low", "Medium"]:
            return "High"

    return priority

def verify_draft_figures(draft_text: str, facts_text: str, kb_text: str = "") -> List[str]:
    figure_regex = re.compile(r"₹\s*([0-9,]+)")
    unverified: List[str] = []
    combined_authority = f"{facts_text} {kb_text}"

    for match in figure_regex.finditer(draft_text):
        full_figure = match.group(0).replace(" ", "")
        num_with_commas = match.group(1)
        num_only = num_with_commas.replace(",", "")

        exists = (
            full_figure in combined_authority
            or num_with_commas in combined_authority
            or num_only in combined_authority
        )
        if not exists:
            unverified.append(full_figure)

    return list(dict.fromkeys(unverified))

def build_facts_block(
    author: Dict[str, Any],
    selected_book: Optional[Dict[str, Any]] = None,
    all_books: Optional[List[Dict[str, Any]]] = None
) -> str:
    lines = [
        f"Author Name: {author.get('name', 'Unknown')}",
        f"Author Email: {author.get('email', '')}",
        f"Registered Bank: {author.get('bank_name', 'HDFC Bank') or 'HDFC Bank'}",
        f"Account Last 4: {author.get('account_last4', '8821') or '8821'}"
    ]

    if selected_book:
        lines.append("\n--- Primary Book in Query ---")
        lines.append(f"Title: {selected_book.get('title')}")
        lines.append(f"External ID: {selected_book.get('external_id')}")
        lines.append(f"ISBN: {selected_book.get('isbn') or 'Pending Assignment'}")
        lines.append(f"Status: {selected_book.get('status')}")
        if selected_book.get("stage"):
            lines.append(f"Production Stage: {selected_book.get('stage')}")
        lines.append(f"Total Royalty Earned: ₹{int(float(selected_book.get('total_royalty_earned') or 0)):,}")
        lines.append(f"Royalty Paid: ₹{int(float(selected_book.get('royalty_paid') or 0)):,}")
        lines.append(f"Royalty Pending: ₹{int(float(selected_book.get('royalty_pending') or 0)):,}")
        if selected_book.get("last_royalty_payout_date"):
            lines.append(f"Last Payout Date: {selected_book.get('last_royalty_payout_date')}")

    if all_books:
        lines.append("\n--- All Author Books Summary ---")
        earned = sum(float(b.get("total_royalty_earned") or 0) for b in all_books)
        paid = sum(float(b.get("royalty_paid") or 0) for b in all_books)
        pending = sum(float(b.get("royalty_pending") or 0) for b in all_books)
        lines.append(f"Total Author Royalty Earned: ₹{int(earned):,}")
        lines.append(f"Total Author Royalty Paid: ₹{int(paid):,}")
        lines.append(f"Total Author Royalty Pending: ₹{int(pending):,}")
        lines.append("Books:")
        for b in all_books:
            lines.append(f"- {b.get('title')} ({b.get('external_id')}): Status={b.get('status')}, Pending=₹{int(float(b.get('royalty_pending') or 0)):,}")

    return "\n".join(lines)
