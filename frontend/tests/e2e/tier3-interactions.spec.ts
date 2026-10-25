import { test, expect } from '@playwright/test';

test.describe('Tier 3: Complex Multi-Step Interactions & State Transitions', () => {

  test('Full E2E Lifecycle: Author sign in -> Create ticket -> Admin triage & self-assign -> Status advance', async ({ page }) => {
    // -------------------------------------------------------------------------
    // Step 1: Sign in as Priya Sharma using Demo Account Switcher
    // -------------------------------------------------------------------------
    await page.goto('/login');
    const useAuthorBtn = page.locator('button', { hasText: '[ Use ]' }).first();
    await useAuthorBtn.click();
    await page.locator('button[type="submit"]').click();

    // Should redirect to /books
    await page.waitForURL('**/books');
    await expect(page.locator('h1')).toContainText('My Books');

    // -------------------------------------------------------------------------
    // Step 2: Navigate to /tickets/new and submit a query
    // -------------------------------------------------------------------------
    await page.goto('/tickets/new');
    await page.locator('select#book-select').selectOption({ label: 'Whispers of the Ganges' });

    const uniqueSubject = `Royalty Dispute E2E ${Date.now()}`;
    await page.locator('input#ticket-subject').fill(uniqueSubject);
    await page.locator('textarea#ticket-description').fill(
      'We noticed discrepancy between sales count on Amazon and reported Q3 royalty payout. Please verify statement.'
    );

    // Submit ticket
    await page.locator('button[type="submit"]').click();

    // Verify redirect to details with ?sent=1 banner
    await page.waitForURL(/\/tickets\/BL-\d+\?sent=1/);
    const successBanner = page.locator('[role="status"]');
    await expect(successBanner).toBeVisible();
    await expect(successBanner).toContainText('We aim to reply within 48 hours');

    // Extract ticket ID
    const ticketIdHeader = await page.locator('header .tabular-nums').first().textContent();
    expect(ticketIdHeader).toMatch(/BL-\d+/);
    const createdTicketId = ticketIdHeader!.trim();

    // -------------------------------------------------------------------------
    // Step 3: Check Tickets List (/tickets) has created ticket
    // -------------------------------------------------------------------------
    await page.goto('/tickets');
    await expect(page.locator('#ticket-list-region')).toContainText(createdTicketId);
    await expect(page.locator('#ticket-list-region')).toContainText(uniqueSubject);

    // -------------------------------------------------------------------------
    // Step 4: Admin Queue Triage (/admin/tickets)
    // -------------------------------------------------------------------------
    await page.goto('/admin/tickets');
    await expect(page.locator('table')).toBeVisible();

    // Search for created ticket
    const searchInput = page.locator('input[placeholder*="Search by ticket ID"]');
    await searchInput.fill(createdTicketId);

    const ticketRow = page.locator(`tr:has-text("${createdTicketId}")`);
    await expect(ticketRow).toBeVisible();

    // Quick Self-Assign
    const assignBtn = ticketRow.locator('button', { hasText: 'Assign to me' });
    if (await assignBtn.isVisible()) {
      await assignBtn.click();
      // Should now display assigned avatar and name (Rahul / RS)
      await expect(ticketRow).toContainText('Rahul');
    }

    // Open ticket preview drawer by clicking the row
    await ticketRow.click();
    const previewDrawer = page.locator('[role="dialog"]');
    await expect(previewDrawer).toBeVisible();
    await expect(previewDrawer.locator('h2')).toContainText(uniqueSubject);

    // Mark Resolved or send official reply
    const markResolvedBtn = previewDrawer.locator('button', { hasText: 'Mark Resolved' });
    if (await markResolvedBtn.isVisible()) {
      await markResolvedBtn.click();
      await expect(previewDrawer.locator('.bg-primary-tint')).toBeVisible();
    }

    // -------------------------------------------------------------------------
    // Step 5: Author Views Status Stepper Advance on /tickets/[id]
    // -------------------------------------------------------------------------
    await page.goto(`/tickets/${createdTicketId}`);
    const statusLine = page.locator('section[aria-label="Ticket progress status"]');
    await expect(statusLine).toBeVisible();

    // Verify current node is now Resolved
    const resolvedStep = statusLine.locator('li[aria-current="step"]');
    await expect(resolvedStep).toContainText('Resolved');

    // Author appends follow-up reply
    const replyTextarea = page.locator('form textarea');
    await replyTextarea.fill('Thank you for resolving this promptly.');
    await page.locator('button', { hasText: 'Send reply' }).click();

    // Follow-up message appears in conversation thread
    const conversation = page.locator('section[aria-label="Conversation messages"]');
    await expect(conversation).toContainText('Thank you for resolving this promptly.');
  });

});
