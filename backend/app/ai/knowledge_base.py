TONE_GUIDE = """
TONE: Empathetic, respectful, and transparent. Authors are creative partners.
1. Acknowledge and validate the author's concern in the opening sentence.
2. Be specific: cite verified numbers, dates, ISBNs, and production stages from FACTS.
3. If BookLeaf caused a delay or issue, apologize plainly and outline corrective action.
4. If escalating to printing or finance teams, give a concrete turnaround timeframe (e.g., 24-48 business hours).
5. Always close with a supportive statement and sign off as "BookLeaf Support Team".
6. Keep replies concise: 120 to 220 words.
""".strip()

CATEGORY_POLICIES = {
    "royalty_payments": {
        "title": "Royalty Calculations & Payout Cycles",
        "policy": """
- Net profit is calculated as MRP minus printing cost, platform commission, and shipping. The author receives 80% and BookLeaf retains 20% (80/20 royalty split).
- Royalty calculations operate quarterly (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec).
- Payouts are remitted within a 45-day window following the close of each quarter (e.g. Q3 payout by Nov 15).
- Minimum payout threshold is ₹1,000 across an author's total pending balance.
- If total pending royalties are below the ₹1,000 threshold, the amount rolls over automatically to the subsequent quarterly cycle.
- Payout statements are generated automatically in the author dashboard once processed.
""".strip(),
        "example": """Dear Author,

Thank you for reaching out regarding your royalty disbursement. I understand your concern about the payment timing and apologize for any confusion.

Looking at your account records, royalties are calculated quarterly and distributed according to our 80/20 split within a 45-day window after the quarter closes. Balances below the ₹1,000 threshold automatically roll over to the subsequent cycle. Your account ledger has been reviewed and your pending royalties will be disbursed to your registered bank account in accordance with our quarterly cycle.

Warm regards,
BookLeaf Support Team"""
    },
    "isbn_metadata": {
        "title": "ISBN Assignment & Listing Metadata",
        "policy": """
- Every published title receives an official, unique 13-digit ISBN registered with Raja Rammohun Roy National Agency.
- Metadata updates (blurb, genre, author bio, description) take 3-5 business days to propagate across Amazon, Flipkart, and retail channels.
- ISBN errors (e.g. mismatch between printed copy and online listing) are classified as HIGH priority, escalated immediately to the production catalog team, and handled within a 48-hour resolution window.
""".strip(),
        "example": """Dear Author,

Thank you for notifying us regarding the ISBN discrepancy on your book listing. We take catalog data discrepancies very seriously and apologize for this error.

We have escalated this directly to our production catalog team as a high-priority ticket. We will coordinate with Amazon to correct the listing details within our 48-hour resolution window, and metadata updates typically reflect within 3 to 5 business days.

Warm regards,
BookLeaf Support Team"""
    },
    "printing_quality": {
        "title": "Print Quality, Binding & Damaged Copies",
        "policy": """
- BookLeaf guarantees 70-80 GSM interior book paper and 300 GSM matte/gloss laminated covers.
- Any printing defects (misalignment, blurry images, smudged ink, binding separation) on author copies qualify for a 100% free reprint and replacement.
- Turnaround time for complimentary priority reprints is 5 to 7 business days dispatched via expedited courier.
- Authors must provide photographs or details of the batch defect to initiate the free reprint.
""".strip(),
        "example": """Dear Author,

I sincerely apologize for the poor print quality and defective copies you received. That certainly does not meet BookLeaf's publication standards, and we own this fault completely.

We have initiated a complimentary replacement order under our 5-7 business days reprint turnaround policy. Please share photos of the blurry or misaligned pages so our print team can inspect the batch defect and dispatch the fresh copies.

Warm regards,
BookLeaf Support Team"""
    },
    "distribution_availability": {
        "title": "Retail Distribution & Stock Availability",
        "policy": """
- Paperbacks are listed on Amazon India, Flipkart, and the BookLeaf Store via Print-on-Demand (POD).
- A temporary "Out of Stock" or "Currently Unavailable" status on Amazon is usually due to automated marketplace crawling or inventory indexing; POD books are printed upon order placement.
- Catalog team can trigger an inventory refresh with Amazon Seller Support within 24 hours.
""".strip(),
        "example": """Dear Author,

Thank you for checking in regarding your book's availability on Amazon. Your title is on our Print-on-Demand system. We have requested a catalog refresh with Amazon Seller Services to restore the active buy button within 24 hours.

Warm regards,
BookLeaf Support Team"""
    },
    "book_status_production": {
        "title": "Publishing Pipeline & Production Milestones",
        "policy": """
- Standard production pipeline comprises 9 stages: Manuscript Submission -> Editorial Review -> Proofreading -> Typesetting -> Cover Design -> Author Review -> ISBN Assignment -> Print Test -> Published & Live.
- Production books have no MRP or publication date set until the print test stage is approved.
- Turnaround time for Cover Design and Typesetting is 7 to 10 working days each.
""".strip(),
        "example": """Dear Author,

Thank you for inquiring about the production progress of your upcoming book. Our production team is actively working through the milestone schedule and will notify you as soon as the next review proof is ready.

Warm regards,
BookLeaf Support Team"""
    },
    "general_inquiry": {
        "title": "General Support & Portal Assistance",
        "policy": """
- General questions on author rights, copyright registration, royalty reporting portal, and marketing packages.
- Authors retain 100% copyright of their creative work.
""".strip(),
        "example": """Dear Author,

Thank you for getting in touch with BookLeaf Publishing Support. You retain complete 100% intellectual property rights and copyright to your manuscript. Please let us know if there is anything specific we can assist you with.

Warm regards,
BookLeaf Support Team"""
    }
}
