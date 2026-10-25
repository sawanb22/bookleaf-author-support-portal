import { test, expect } from '@playwright/test';

test.describe('Tier 1: Core Screen Rendering & Features', () => {

  // ---------------------------------------------------------------------------
  // Screen 1: Sign in (/login)
  // ---------------------------------------------------------------------------
  test('Screen 1 (/login): renders 400px column, demo account cards, and password toggle', async ({ page }) => {
    await page.goto('/login');

    // Page title and wordmark
    await expect(page.locator('h1')).toContainText('Sign in');
    await expect(page.getByText('BookLeaf', { exact: true })).toBeVisible();

    // 400px centered column verification
    const formContainer = page.locator('.max-w-\\[400px\\]');
    await expect(formContainer).toBeVisible();

    // Inputs and labels
    const emailInput = page.locator('input#email');
    const passwordInput = page.locator('input#password');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Password visibility toggle
    const toggleBtn = page.locator('#togglePassword');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveText('Show');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(toggleBtn).toHaveText('Hide');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Demo account cards in sunken panel
    await expect(page.locator('#demo-accounts-heading')).toContainText('Demo accounts');
    const authorDemoCard = page.getByText('priya.sharma@email.com');
    const adminDemoCard = page.getByText('admin@bookleaf.test');
    await expect(authorDemoCard).toBeVisible();
    await expect(adminDemoCard).toBeVisible();

    // Click [ Use ] on Priya Sharma to populate credentials
    const useAuthorBtn = page.locator('button', { hasText: '[ Use ]' }).first();
    await useAuthorBtn.click();
    await expect(emailInput).toHaveValue('priya.sharma@email.com');
    await expect(passwordInput).toHaveValue('AuthorPass2026!');
  });

  // ---------------------------------------------------------------------------
  // Screen 2: My Books (/books)
  // ---------------------------------------------------------------------------
  test('Screen 2 (/books): renders royalty summary band, tabular numerals, and 9-stage progress', async ({ page }) => {
    await page.goto('/books');

    // Editorial Page Title
    await expect(page.locator('h1')).toContainText('My Books');
    await expect(page.locator('h1')).toHaveClass(/font-title-page/);

    // Summary Band with 3 columns and tabular figures
    const summaryBand = page.locator('section[aria-label="Royalties summary"]');
    await expect(summaryBand).toBeVisible();
    await expect(summaryBand).toContainText('₹19,908');
    await expect(summaryBand).toContainText('₹16,338');
    await expect(summaryBand).toContainText('₹3,570');

    // Tabular numerals verification
    const figures = summaryBand.locator('.tabular-nums');
    const count = await figures.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Table view with book records
    await expect(page.getByText('Whispers of the Ganges')).toBeVisible();

    // In-production 9-stage progress bar
    const stageBars = page.locator('div[role="img"][aria-label*="Production progress"]');
    await expect(stageBars.first()).toBeVisible();

    // "Raise a query" deep-link button
    const queryBtn = page.locator('a', { hasText: 'Raise a query' }).first();
    await expect(queryBtn).toBeVisible();
    const href = await queryBtn.getAttribute('href');
    expect(href).toMatch(/\/tickets\/new\?book=/);
  });

  // ---------------------------------------------------------------------------
  // Screen 3: Submit Support Query (/tickets/new)
  // ---------------------------------------------------------------------------
  test('Screen 3 (/tickets/new): renders 640px form, book context pill, and dropzone', async ({ page }) => {
    await page.goto('/tickets/new');

    // Title and back navigation
    await expect(page.locator('h1')).toContainText('Submit a Support Query');
    await expect(page.getByText('Back to My Tickets')).toBeVisible();

    // Book selector
    const bookSelect = page.locator('select#book-select');
    await expect(bookSelect).toBeVisible();
    await bookSelect.selectOption({ label: 'Whispers of the Ganges' });

    // Context pill appears after selection
    const contextPill = page.locator('#book-context-pill');
    await expect(contextPill).toBeVisible();
    await expect(contextPill).toContainText('Published & Live');

    // Subject input and Description textarea
    const subjectInput = page.locator('input#ticket-subject');
    const descTextarea = page.locator('textarea#ticket-description');
    await expect(subjectInput).toBeVisible();
    await expect(descTextarea).toBeVisible();

    // Mock dropzone area
    const dropzone = page.locator('[aria-label="Upload attachments dropzone"]');
    await expect(dropzone).toBeVisible();
    await expect(dropzone).toContainText('Choose files');

    // Submit button
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Send query');
  });

  // ---------------------------------------------------------------------------
  // Screen 4: My Tickets (/tickets)
  // ---------------------------------------------------------------------------
  test('Screen 4 (/tickets): renders segmented status tabs, unread indicator, and ticket list', async ({ page }) => {
    await page.goto('/tickets');

    // Page title and CTA button
    await expect(page.locator('h1')).toContainText('My Tickets');
    await expect(page.locator('a', { hasText: 'New support query' })).toBeVisible();

    // Segmented status filter tabs
    const tabList = page.locator('[role="tablist"]');
    await expect(tabList).toBeVisible();
    await expect(tabList.locator('button', { hasText: 'All' })).toBeVisible();
    await expect(tabList.locator('button', { hasText: 'Open' })).toBeVisible();
    await expect(tabList.locator('button', { hasText: 'In progress' })).toBeVisible();
    await expect(tabList.locator('button', { hasText: 'Resolved' })).toBeVisible();
    await expect(tabList.locator('button', { hasText: 'Closed' })).toBeVisible();

    // Ticket list container
    const ticketList = page.locator('#ticket-list-region');
    await expect(ticketList).toBeVisible();

    // Verify ticket item BL-1042 presence
    await expect(page.getByText('BL-1042')).toBeVisible();

    // Live update polling indicator
    await expect(page.getByText(/Live updates enabled/)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Screen 5: Ticket Details (/tickets/BL-1042)
  // ---------------------------------------------------------------------------
  test('Screen 5 (/tickets/[id]): renders 4-node status line, message thread, and reply box', async ({ page }) => {
    await page.goto('/tickets/BL-1042');

    // Ticket header
    await expect(page.getByText('BL-1042', { exact: true })).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();

    // 4-Node Status Progress Line
    const statusLine = page.locator('section[aria-label="Ticket progress status"]');
    await expect(statusLine).toBeVisible();
    await expect(statusLine.locator('ol li')).toHaveCount(4);
    await expect(statusLine.getByText('Open')).toBeVisible();
    await expect(statusLine.getByText('In progress')).toBeVisible();
    await expect(statusLine.getByText('Resolved')).toBeVisible();
    await expect(statusLine.getByText('Closed')).toBeVisible();

    // Conversation thread
    const conversation = page.locator('section[aria-label="Conversation messages"]');
    await expect(conversation).toBeVisible();
    const messageBlocks = conversation.locator('article');
    const msgCount = await messageBlocks.count();
    expect(msgCount).toBeGreaterThanOrEqual(1);

    // Follow-up reply form
    const replyForm = page.locator('form', { hasText: 'Send reply' });
    await expect(replyForm).toBeVisible();
    await expect(replyForm.locator('textarea')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Screen 6: Admin Queue (/admin/tickets)
  // ---------------------------------------------------------------------------
  test('Screen 6 (/admin/tickets): renders dark shell, 5 KPI cards, operational table, and glyphs', async ({ page }) => {
    await page.goto('/admin/tickets');

    // Admin Dark Shell Navigation
    const adminNav = page.locator('header');
    await expect(adminNav).toHaveClass(/bg-\[#18211D\]|bg-text/);
    await expect(adminNav.getByText('Admin', { exact: true })).toBeVisible();

    // 5 KPI Metric Cards
    const kpiSection = page.locator('section[aria-label="Operational metrics summary"]');
    await expect(kpiSection).toBeVisible();
    await expect(kpiSection.getByText('Total in Queue')).toBeVisible();
    await expect(kpiSection.getByText('Needs First Reply')).toBeVisible();
    await expect(kpiSection.getByText('Awaiting Author')).toBeVisible();
    await expect(kpiSection.getByText('AI Draft Ready')).toBeVisible();
    await expect(kpiSection.getByText('Resolved Today')).toBeVisible();

    // High density table and columns
    const table = page.locator('table');
    await expect(table).toBeVisible();
    await expect(table.locator('th', { hasText: 'Ticket' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Author & Book' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Priority' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Status' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Assignee' })).toBeVisible();

    // 4-bar Priority glyphs
    const glyphs = table.locator('div[role="img"][aria-label*="Priority"]');
    expect(await glyphs.count()).toBeGreaterThan(0);

    // Self-assignment buttons exist for unassigned tickets
    const assignButtons = table.locator('button', { hasText: 'Assign to me' });
    expect(await assignButtons.count()).toBeGreaterThan(0);
  });

});
