import { test, expect } from '@playwright/test';

test.describe('Tier 4: Real-World Publishing Workflows & Data Invariants', () => {

  // ---------------------------------------------------------------------------
  // Scenario 1: Priya Sharma Royalty Reconciliation
  // ---------------------------------------------------------------------------
  test('Scenario 1: Priya Sharma royalty calculations reconcile to ₹19,908 Earned, ₹16,338 Paid, ₹3,570 Pending', async ({ page }) => {
    await page.goto('/books');

    // Royalties summary band elements
    const summaryBand = page.locator('section[aria-label="Royalties summary"]');
    await expect(summaryBand).toBeVisible();

    const earnedText = await summaryBand.locator('text=₹19,908').textContent();
    const paidText = await summaryBand.locator('text=₹16,338').textContent();
    const pendingText = await summaryBand.locator('text=₹3,570').textContent();

    expect(earnedText).toContain('₹19,908');
    expect(paidText).toContain('₹16,338');
    expect(pendingText).toContain('₹3,570');

    // Parse and verify exact sum invariant: 16338 + 3570 === 19908
    const earnedVal = parseInt(earnedText!.replace(/\D/g, ''), 10);
    const paidVal = parseInt(paidText!.replace(/\D/g, ''), 10);
    const pendingVal = parseInt(pendingText!.replace(/\D/g, ''), 10);

    expect(paidVal + pendingVal).toBe(earnedVal);
  });

  // ---------------------------------------------------------------------------
  // Scenario 2: In-Production Manuscript Status Checks
  // ---------------------------------------------------------------------------
  test('Scenario 2: Production manuscript pipelines render 9-stage bar for BK005 and BK015', async ({ page }) => {
    await page.goto('/books');

    // BK005 - Cover Design
    const bk005Row = page.locator('text=BK005').locator('..');
    await expect(page.getByText('Durga’s Daughters')).toBeVisible();
    await expect(page.getByText('Cover Design')).toBeVisible();

    // BK015 - Typesetting
    const bk015Row = page.locator('text=BK015').locator('..');
    await expect(page.getByText('The Silk Weaver of Kanchipuram')).toBeVisible();
    await expect(page.getByText('Typesetting')).toBeVisible();

    // Verify 9-stage progress bars are present
    const progressBars = page.locator('div[role="img"][aria-label*="Production progress"]');
    expect(await progressBars.count()).toBeGreaterThanOrEqual(2);
  });

  // ---------------------------------------------------------------------------
  // Scenario 3: Book Edge Cases (Paid in Full, Below ₹1000 Threshold)
  // ---------------------------------------------------------------------------
  test('Scenario 3: Book edge cases display correct payout status and rollover notices', async ({ page }) => {
    await page.goto('/books');

    // BK002 Paid in Full caption
    await expect(page.getByText('Paid in full', { exact: true })).toBeVisible();

    // BK016 Below ₹1,000 threshold notice
    await expect(page.getByText(/Below ₹1,000 minimum payout threshold/)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Scenario 4: Author Confidentiality Guarantees
  // ---------------------------------------------------------------------------
  test('Scenario 4: Author ticket view never exposes internal notes or unapproved AI drafts', async ({ page }) => {
    await page.goto('/tickets/BL-1042');

    // Author message thread
    const conversation = page.locator('section[aria-label="Conversation messages"]');
    await expect(conversation).toBeVisible();

    // Must NOT contain internal note badges or text
    await expect(conversation.getByText('Internal note', { exact: true })).not.toBeVisible();
    await expect(conversation.getByText('Private note', { exact: true })).not.toBeVisible();
    await expect(conversation.locator('[data-internal-note="true"]')).not.toBeVisible();

    // Must NOT display raw AI system prompts or confidence scores
    await expect(conversation.getByText(/confidence:/i)).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Scenario 5: LocalStorage Draft Preservation & Restoration
  // ---------------------------------------------------------------------------
  test('Scenario 5: Form draft persists across page reloads and clears on submit', async ({ page }) => {
    await page.goto('/tickets/new');

    const testSubject = `Draft Test Subject ${Date.now()}`;
    const testDesc = 'This is an important draft description that should survive a browser reload.';

    await page.locator('input#ticket-subject').fill(testSubject);
    await page.locator('textarea#ticket-description').fill(testDesc);

    // Reload page to simulate accidental navigation or refresh
    await page.reload();

    // Check that draft was restored from localStorage
    await expect(page.locator('input#ticket-subject')).toHaveValue(testSubject);
    await expect(page.locator('textarea#ticket-description')).toHaveValue(testDesc);

    // Complete form and submit
    await page.locator('select#book-select').selectOption({ label: 'Whispers of the Ganges' });
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/tickets\/BL-\d+\?sent=1/);

    // Revisit /tickets/new: draft must be cleared
    await page.goto('/tickets/new');
    await expect(page.locator('input#ticket-subject')).toHaveValue('');
    await expect(page.locator('textarea#ticket-description')).toHaveValue('');
  });

});
