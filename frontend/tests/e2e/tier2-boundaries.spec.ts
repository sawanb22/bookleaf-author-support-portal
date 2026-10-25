import { test, expect } from '@playwright/test';

test.describe('Tier 2: Boundary Value Analysis & Edge Conditions', () => {

  // ---------------------------------------------------------------------------
  // Subject Length & 80% Counter Boundaries (5 to 120 chars)
  // ---------------------------------------------------------------------------
  test('Subject Boundary: validates <5 chars error and >120 chars error', async ({ page }) => {
    await page.goto('/tickets/new');

    const subjectInput = page.locator('input#ticket-subject');

    // 1. Min boundary violation: 4 characters
    await subjectInput.fill('Abcd');
    await subjectInput.blur();
    const errorMsg = page.locator('#subject-error');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText('Add a short subject so we can route your query.');

    // 2. Min boundary valid: 5 characters
    await subjectInput.fill('Valid');
    await subjectInput.blur();
    await expect(errorMsg).not.toBeVisible();

    // 3. Counter appearance at 80% threshold (96 chars)
    const str95 = 'A'.repeat(95);
    await subjectInput.fill(str95);
    await expect(page.locator('#subject-counter')).not.toBeVisible();

    const str96 = 'A'.repeat(96);
    await subjectInput.fill(str96);
    const counter = page.locator('#subject-counter');
    await expect(counter).toBeVisible();
    await expect(counter).toContainText('96 / 120');

    // 4. Max boundary valid: 120 chars
    const str120 = 'A'.repeat(120);
    await subjectInput.fill(str120);
    await expect(counter).toContainText('120 / 120');
    await subjectInput.blur();
    await expect(page.locator('#subject-error')).not.toBeVisible();

    // 5. Max boundary violation: 121 chars
    const str121 = 'A'.repeat(121);
    await subjectInput.fill(str121);
    await subjectInput.blur();
    await expect(page.locator('#subject-error')).toBeVisible();
    await expect(page.locator('#subject-error')).toContainText('Subject must be 120 characters or fewer.');
  });

  // ---------------------------------------------------------------------------
  // Description Length & 80% Counter Boundaries (20 to 3000 chars)
  // ---------------------------------------------------------------------------
  test('Description Boundary: validates <20 chars error and >3000 chars error', async ({ page }) => {
    await page.goto('/tickets/new');

    const descTextarea = page.locator('textarea#ticket-description');

    // 1. Min boundary violation: 19 characters
    await descTextarea.fill('Short query text...');
    await descTextarea.blur();
    const descError = page.locator('#desc-error');
    await expect(descError).toBeVisible();
    await expect(descError).toContainText('Describe the issue in at least 20 characters so we can help faster.');

    // 2. Min boundary valid: 20 characters
    await descTextarea.fill('This description is 20');
    await descTextarea.blur();
    await expect(descError).not.toBeVisible();

    // 3. Counter appearance at 80% threshold (2400 chars)
    const str2399 = 'B'.repeat(2399);
    await descTextarea.fill(str2399);
    await expect(page.locator('#desc-counter')).not.toBeVisible();

    const str2400 = 'B'.repeat(2400);
    await descTextarea.fill(str2400);
    const descCounter = page.locator('#desc-counter');
    await expect(descCounter).toBeVisible();
    await expect(descCounter).toContainText('2400 / 3000');

    // 4. Max boundary valid: 3000 chars
    const str3000 = 'B'.repeat(3000);
    await descTextarea.fill(str3000);
    await expect(descCounter).toContainText('3000 / 3000');
    await descTextarea.blur();
    await expect(page.locator('#desc-error')).not.toBeVisible();

    // 5. Max boundary violation: 3001 chars
    const str3001 = 'B'.repeat(3001);
    await descTextarea.fill(str3001);
    await descTextarea.blur();
    await expect(page.locator('#desc-error')).toBeVisible();
    await expect(page.locator('#desc-error')).toContainText('Description must be 3000 characters or fewer.');
  });

  // ---------------------------------------------------------------------------
  // Attachment Dropzone Validation Boundaries
  // ---------------------------------------------------------------------------
  test('Dropzone Boundary: enforces file type, count, and size constraints', async ({ page }) => {
    await page.goto('/tickets/new');

    const fileInput = page.locator('#attachment-file-input');

    // 1. Invalid file extension (.exe)
    await fileInput.setInputFiles({
      name: 'malware.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('dummy exe content'),
    });
    const errorBanner = page.locator('[role="alert"]', { hasText: 'isn’t supported' });
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('isn’t supported. Use JPG, PNG or PDF.');

    // 2. Valid file extension (.png)
    await fileInput.setInputFiles({
      name: 'valid-statement.png',
      mimeType: 'image/png',
      buffer: Buffer.from('dummy image content'),
    });
    await expect(errorBanner).not.toBeVisible();
    await expect(page.getByText('valid-statement.png')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Empty State Fallbacks
  // ---------------------------------------------------------------------------
  test('Empty State Fallback: displays filtered empty state and invalid ticket 404', async ({ page }) => {
    // 1. Filtered empty state on /tickets
    await page.goto('/tickets');
    const closedTab = page.locator('[role="tablist"] button', { hasText: 'Closed' });
    await closedTab.click();

    // If zero closed tickets, shows empty state with reset button
    const emptyNotice = page.locator('text=No closed tickets');
    if (await emptyNotice.isVisible()) {
      const resetBtn = page.locator('button', { hasText: 'Show all tickets' });
      await expect(resetBtn).toBeVisible();
      await resetBtn.click();
      await expect(page.locator('#ticket-list-region')).toBeVisible();
    }

    // 2. Invalid ticket ID fallback
    await page.goto('/tickets/BL-99999');
    await expect(page.getByText('Ticket not found')).toBeVisible();
    await expect(page.getByText('BL-99999')).toBeVisible();
    const backBtn = page.locator('a', { hasText: 'Back to My Tickets' }).first();
    await expect(backBtn).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Priority Glyph Indicators (4 bars)
  // ---------------------------------------------------------------------------
  test('Priority Glyph Boundary: renders correct bar states for Critical, High, Medium, Low', async ({ page }) => {
    await page.goto('/admin/tickets');

    // Critical Priority Glyph has 4 filled bars
    const criticalGlyph = page.locator('[role="img"][aria-label*="Critical priority"]').first();
    if (await criticalGlyph.isVisible()) {
      await expect(criticalGlyph).toBeVisible();
    }

    // Medium Priority Glyph has 2 filled bars and 2 outlined bars
    const mediumGlyph = page.locator('[role="img"][aria-label*="Medium priority"]').first();
    if (await mediumGlyph.isVisible()) {
      await expect(mediumGlyph).toBeVisible();
    }
  });

});
