import pytest
from app.ai.llm import fallback_classifier, fallback_draft, CircuitBreaker
from app.ai.guards import apply_priority_floors, verify_draft_figures

def test_fallback_classifier_heuristics():
    # Royalty payments
    res_royalty = fallback_classifier("Delayed royalty payout", "I haven't received my quarterly payment yet.")
    assert res_royalty["category"] == "royalty_payments"
    assert res_royalty["priority"] in ["High", "Medium"]

    # ISBN metadata (Priority floor: High)
    res_isbn = fallback_classifier("Barcode issue", "The barcode and ISBN printed on the back cover is wrong.")
    assert res_isbn["category"] == "isbn_metadata"
    assert res_isbn["priority"] == "High"

    # Printing defects
    res_print = fallback_classifier("Misprint on cover", "The cover gloss is smudged and pages are torn.")
    assert res_print["category"] == "printing_quality"
    assert res_print["priority"] == "High"

    # Distribution
    res_dist = fallback_classifier("Amazon availability", "My book is listed as out of stock on Amazon.")
    assert res_dist["category"] == "distribution_availability"

    # Production
    res_prod = fallback_classifier("Cover design timeline", "When will my manuscript typeset proof be ready?")
    assert res_prod["category"] == "book_status_production"

def test_priority_floors():
    # Legal notice trigger -> Critical
    p1 = apply_priority_floors("Low", "I will send a legal notice from my lawyer if this is not resolved.", "royalty_payments")
    assert p1 == "Critical"

    # Severely overdue royalties -> Critical
    p2 = apply_priority_floors("Medium", "It has been 2 cycles and months overdue since any royalty arrived.", "royalty_payments")
    assert p2 == "Critical"

    # ISBN error -> Minimum High
    p3 = apply_priority_floors("Low", "There is a wrong isbn on Flipkart listing.", "isbn_metadata")
    assert p3 == "High"

    # Physical damage -> Minimum High
    p4 = apply_priority_floors("Low", "All received author copies were damaged and binding broken.", "printing_quality")
    assert p4 == "High"

def test_circuit_breaker():
    cb = CircuitBreaker(threshold=5, reset_timeout_sec=60)
    assert not cb.is_open()
    for _ in range(4):
        cb.record_failure()
        assert not cb.is_open()
    cb.record_failure()
    assert cb.is_open(), "Circuit breaker must open after 5 consecutive failures"

    # Success resets breaker
    cb.record_success()
    assert not cb.is_open()

def test_numeric_fact_checking_guard():
    facts = "Total Royalty Earned: ₹11,970. Royalty Paid: ₹8,400. Royalty Pending: ₹3,570."
    policy = "Minimum threshold is ₹1,000."

    # Draft with only verified figures
    draft_valid = "Your pending royalty of ₹3,570 will be remitted as it exceeds ₹1,000."
    unverified_none = verify_draft_figures(draft_valid, facts, policy)
    assert unverified_none == []

    # Draft with hallucinated figure ₹99,999
    draft_hallucinated = "We have processed ₹99,999 to your account and the remaining ₹3,570 will follow."
    unverified = verify_draft_figures(draft_hallucinated, facts, policy)
    assert "₹99,999" in unverified

def test_seven_canonical_sample_queries_accuracy():
    """Gate 3: Verify that the 7 canonical sample queries achieve >= 6/7 category and >= 5/7 priority accuracy."""
    canonical_queries = [
        {
            "id": "Q1",
            "query": "I published my book 4 months ago and still haven’t received any royalty. What’s going on?",
            "expected_category": "royalty_payments",
            "expected_priority": "High"
        },
        {
            "id": "Q2",
            "query": "My royalty amount seems too low. I sold 200 copies but only received ₹3,000.",
            "expected_category": "royalty_payments",
            "expected_priority": "Medium"
        },
        {
            "id": "Q3",
            "query": "My book is showing a different ISBN on Amazon than what’s on the physical copy.",
            "expected_category": "isbn_metadata",
            "expected_priority": "High"
        },
        {
            "id": "Q4",
            "query": "I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.",
            "expected_category": "printing_quality",
            "expected_priority": "High"
        },
        {
            "id": "Q5",
            "query": "My book is published but it’s showing as “Currently Unavailable” on Amazon.",
            "expected_category": "distribution_availability",
            "expected_priority": "High"
        },
        {
            "id": "Q6",
            "query": "It’s been 3 weeks and my book is still in typesetting. When will it be done?",
            "expected_category": "book_status_production",
            "expected_priority": "Medium"
        },
        {
            "id": "Q7",
            "query": "Can I update the description of my book on Amazon after it’s already live?",
            "expected_category": "general_inquiry",
            "expected_priority": "Low"
        }
    ]

    cat_matches = 0
    pri_matches = 0

    for item in canonical_queries:
        res = fallback_classifier(item["query"], item["query"])
        if res["category"] == item["expected_category"]:
            cat_matches += 1
        if res["priority"] == item["expected_priority"]:
            pri_matches += 1

    # Spec mandates >= 6/7 category and >= 5/7 priority
    assert cat_matches >= 6, f"Category accuracy {cat_matches}/7 is below required 6/7"
    assert pri_matches >= 5, f"Priority accuracy {pri_matches}/7 is below required 5/7"

def test_strip_reasoning_tokens():
    """Gate 3: Ensure <think>...</think> reasoning token stripping before parsing JSON."""
    from app.ai.llm import strip_reasoning_tokens, extract_and_parse_json

    raw_response = (
        "<think>\n"
        "The author published 4 months ago and hasn't received any royalty payout.\n"
        "Category should be royalty_payments and priority High.\n"
        "</think>\n"
        "{\n"
        '  "category": "royalty_payments",\n'
        '  "priority": "High",\n'
        '  "confidence": 0.95,\n'
        '  "reasoning": "Overdue quarterly payout."\n'
        "}"
    )

    cleaned = strip_reasoning_tokens(raw_response)
    assert "<think>" not in cleaned
    assert "</think>" not in cleaned

    parsed = extract_and_parse_json(raw_response)
    assert parsed["category"] == "royalty_payments"
    assert parsed["priority"] == "High"

def test_deterministic_priority_floors():
    """Gate 3: Test deterministic priority floors in guards.py."""
    # 1. Legal escalation -> Critical
    assert apply_priority_floors("Low", "I will consult my lawyer and file in consumer court", "general_inquiry") == "Critical"
    assert apply_priority_floors("Medium", "Sending legal notice for fraud", "royalty_payments") == "Critical"

    # 2. 2+ quarters overdue with zero payout -> Critical
    assert apply_priority_floors("Medium", "It has been 2 quarters with zero payout", "royalty_payments") == "Critical"
    assert apply_priority_floors("High", "Never received any royalty since book launched two cycles ago", "royalty_payments") == "Critical"

    # 3. ISBN mismatch/error -> High
    assert apply_priority_floors("Low", "The printed copy has different isbn than Amazon", "isbn_metadata") == "High"
    assert apply_priority_floors("Medium", "Duplicate isbn error on store", "isbn_metadata") == "High"

    # 4. Print defect / author copies -> High
    assert apply_priority_floors("Low", "The author copies are blurry and misaligned", "printing_quality") == "High"
    assert apply_priority_floors("Medium", "Received damaged batch of books with pages torn", "printing_quality") == "High"

    # 5. Unavailable on platform -> High
    assert apply_priority_floors("Low", "My book is currently unavailable on Amazon", "distribution_availability") == "High"
    assert apply_priority_floors("Medium", "The book is out of stock on Flipkart", "distribution_availability") == "High"

def test_draft_generation_policy_adherence():
    """Gate 3: Verify draft generation adheres to author facts block and BookLeaf policies."""
    # Royalty above threshold
    facts_priya = (
        "Author Name: Priya Sharma\n"
        "Title: Whispers of the Ganges\n"
        "Royalty Earned: ₹11,970\n"
        "Royalty Paid: ₹8,400\n"
        "Royalty Pending: ₹3,570"
    )
    draft_priya = fallback_draft("royalty_payments", "Priya Sharma", "Royalty inquiry", "When is payout?", facts_priya)
    body_priya = draft_priya["body"]

    assert "Dear Priya Sharma" in body_priya
    assert "80/20 split" in body_priya
    assert "quarterly" in body_priya.lower()
    assert "45-day window" in body_priya
    assert "₹3,570" in body_priya
    assert body_priya.endswith("BookLeaf Support Team")

    # Royalty below ₹1000 threshold (Kavita Deshmukh)
    facts_kavita = (
        "Author Name: Kavita Deshmukh\n"
        "Title: The Nagpur Notebooks\n"
        "Royalty Earned: ₹850\n"
        "Royalty Paid: ₹0\n"
        "Royalty Pending: ₹850"
    )
    draft_kavita = fallback_draft("royalty_payments", "Kavita Deshmukh", "Why has nothing been paid?", "No payout", facts_kavita)
    body_kavita = draft_kavita["body"]

    assert "Dear Kavita Deshmukh" in body_kavita
    assert "₹1,000 threshold" in body_kavita or "threshold of ₹1,000" in body_kavita
    assert "roll over" in body_kavita.lower()
    assert body_kavita.endswith("BookLeaf Support Team")

    # Print quality defect: owns fault, cites 5-7 days reprint
    draft_print = fallback_draft("printing_quality", "Sneha Kulkarni", "Defective prints", "Blurry copies", "")
    body_print = draft_print["body"]

    assert "apologize" in body_print.lower()
    assert "own this fault" in body_print.lower()
    assert "5-7 business days reprint" in body_print
    assert body_print.endswith("BookLeaf Support Team")
