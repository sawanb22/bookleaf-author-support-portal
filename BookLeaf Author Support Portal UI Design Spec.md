# BookLeaf Author Support Portal: UI Design Spec

Prepared for Sawan. Version 1, 25 October 2026. Covers every screen of the author portal and the admin portal, with tokens, components, states, copy and accessibility notes.

## How to use this document

- Build one page at a time. Each page spec in section 5 gives its route, role, data, layout, states, copy and accessibility notes. Combine it with sections 2 to 4 (tokens, components, copy).
- Use tokens, never raw values. Every colour, size and radius comes from section 2.
- Every screen needs a loading state, an empty state and an error state. Section 9 lists the sample records that exercise the edge cases.
- Keep the brief’s page names exactly: My Books, Submit a Support Query, My Tickets.
- Routes and fields named here are proposals that match the database schema. The API spec is the final authority on endpoint names.

## 1. Design direction

**Who it is for.** Authors, mostly first-time writers in India and the US, many of them on phones, who worry about two things: their money and their book. And an operations team that works in a queue all day. Both want a straight answer quickly and nothing decorative in the way.

**The direction.** A quiet working tool with a publishing sensibility. Book titles and page titles are set in a book typeface; everything operational is set in a clear sans. White surfaces sit on a very light green-grey page, there is one deep leaf-green accent, and structure comes from dividers and spacing rather than boxes and shadows.

**The one memorable element.** The status line on an author’s ticket, which shows where the query stands and when to expect a reply. Everything else stays quiet so this can do its job.

**Principles**

1. Answer “where does this stand?” on every screen. Status, dates, amounts and the next step are visible without a click.
2. Numbers are the content. Money and counts use tabular figures, are right-aligned, and always carry their unit.
3. Structure is information. Dividers separate rows. A border appears only when it means something: a form field, a private note, an AI draft awaiting review.
4. Never colour alone. Status, priority and errors always carry a text label or a shape.
5. Fail calmly. If the server or the AI is slow, say what is happening and let people carry on.

**Deliberately avoided** (these read as generated templates): a cream background with a terracotta accent, gradient washes, rows of identical rounded cards with soft shadows, tracked all-caps labels above headings, strings of items joined by middle dots, arrows added to link text, sparkle icons for AI, emoji, entrance animations on every section, and a monospace face for small labels.

## 2. Design tokens

Define these as CSS variables on `:root` and map them into the Tailwind theme (shadcn/ui reads the same names). Every text and background pair below meets WCAG AA (4.5:1 or better). BookLeaf’s own brand colours were not available, so the accent is a single token; swap `color-primary` and its three variants to re-theme the whole app.

### 2.1 Colour

| Token | Value | Use |
| --- | --- | --- |
| color-page | #F5F7F6 | App background |
| color-surface | #FFFFFF | Panels, table body, inputs |
| color-surface-sunken | #EDF1EF | Table header, internal notes, disabled fields |
| color-border | #DDE2DF | Dividers, input borders |
| color-border-strong | #C3CBC6 | Hover borders, checkbox outline, dropzone |
| color-text | #18211D | Primary text (ink with a green undertone, never pure black) |
| color-text-muted | #55625B | Secondary text and captions (6.4:1 on white) |
| color-text-subtle | #66726B | Placeholders and disabled labels (5.0:1 on white) |
| color-primary | #1B6B4F | Primary buttons, links, focus ring (6.4:1 on white) |
| color-primary-hover | #145740 | Primary hover |
| color-primary-pressed | #0F4733 | Primary pressed |
| color-primary-tint | #E6F1EC | Selected row, BookLeaf reply background, ghost hover |
| color-on-primary | #FFFFFF | Text on primary |
| color-danger | #B42318 | Errors, destructive button |
| color-danger-tint | #FDECEA | Error banner background |
| color-ai | #1E4F8C | AI draft border and label (steel blue on purpose, not purple) |
| color-ai-tint | #E7EFFA | AI draft and info banner background |

**Status, priority and book-status pairs** (text on background)

| Name | Text | Background | Extra cue |
| --- | --- | --- | --- |
| Ticket: Open | #1E4F8C | #E7EFFA | Text label |
| Ticket: In progress | #7A4B00 | #FBF0D9 | Text label |
| Ticket: Resolved | #1B6B4F | #E6F1EC | Text label |
| Ticket: Closed | #4A5550 | #E8ECEA | Text label |
| Priority: Critical | #9B1C1C | #FBE9E7 | 4 filled bars |
| Priority: High | #A5420A | #FDEBDD | 3 filled bars |
| Priority: Medium | #18211D | #E8ECEA | 2 filled bars |
| Priority: Low | #55625B | none, 1px border | 1 filled bar, rest outlined |
| Book: Published & Live | #1B6B4F | #E6F1EC | Text label |
| Book: In production | #7A4B00 | #FBF0D9 | Stage name in the label |

Categories (six values) use one neutral style for all: 1px `color-border-strong` outline, `color-text`, no fill. Colour is reserved for status and priority.

### 2.2 Typography

- **Literata** for page titles, section titles and book titles. It was designed for reading books on screens, which suits the subject.
- **IBM Plex Sans** for everything operational: body, forms, tables, buttons, numbers. Its numerals are tabular and it includes the ₹ glyph.
- Load both with `next/font/google` (subset latin, `display: swap`). Fallbacks: Literata then Georgia then serif; Plex then system-ui then sans-serif. Check that ₹ renders in both; if either lacks it, fall back to the system font for that glyph only.
- Authors may type Devanagari or other scripts in their messages. Do not force a font on user-written text; let the system fall back.

| Token | Font | Size / line | Weight | Use |
| --- | --- | --- | --- | --- |
| title-page | Literata | 28/36 (24/32 on mobile) | 600 | Page title |
| title-section | Literata | 20/28 | 600 | Section and dialog titles |
| title-book | Literata | 18/26 | 600 | Book titles anywhere |
| body-lg | Plex Sans | 16/26 | 400 | Author messages, form inputs |
| body | Plex Sans | 14/22 | 400 | Admin tables and panels |
| label | Plex Sans | 14/20 | 500 | Form labels, column headers |
| caption | Plex Sans | 13/18 | 400, muted | Meta text, helper text |
| figure | Plex Sans | 15/22 | 500, tabular | Money and counts |
| figure-lg | Plex Sans | 20/28 | 500, tabular | Royalty totals |

Rules: sentence case everywhere, never all caps. Message text lines stay under 68 characters. Apply `font-variant-numeric: tabular-nums` to every number that sits in a column.

### 2.3 Space, shape, elevation, motion

- **Spacing** (4px base): space-1 4, space-2 8, space-3 12, space-4 16, space-5 24, space-6 32, space-7 48, space-8 64.
- **Gutters:** 16 on mobile, 24 on tablet, 32 on desktop. Content max width 1040 for the author portal, 1320 for admin.
- **Radius:** radius-sm 4 (badges, chips), radius-md 6 (inputs, buttons, panels), radius-lg 10 (dialogs, popovers, toasts only).
- **Borders:** 1px `color-border`. No shadows on page content. Overlays only: `0 8px 24px rgba(24,33,29,0.14)`.
- **Focus:** 2px solid `color-primary` with 2px offset on every interactive element. Never remove it.
- **Motion:** 120ms (fast) and 160ms (base), easing `cubic-bezier(0.2, 0, 0, 1)`. Allowed: toast in and out, dialog fade, menu open, the new-reply highlight (`color-primary-tint` fading to transparent over 1200ms), button pressed state. Not allowed: section entrance animations, hover lifts, parallax. With `prefers-reduced-motion`, drop all durations to near zero and hold the new-reply highlight static for 3 seconds.
- **Breakpoints:** sm 640, md 768, lg 1024, xl 1280.
- **Icons:** Lucide, 16px inline and 20px standalone, stroke 1.5, `currentColor`. Every icon-only button has an aria-label and a tooltip.
- **Touch targets:** at least 44 by 44 below 768px.

## 3. Global patterns and components

### 3.1 App shells

**Author shell.** Top bar, 56px, white, 1px bottom border. Left: wordmark “BookLeaf” in Literata 600 at 18px. Next to it, text links: My Books, My Tickets. The current page has a 2px `color-primary` underline on the bar edge, weight 600 and `aria-current=page`. Right: a small primary button “New support query” and the user menu (name with chevron; menu shows the signed-in email and “Sign out”).

Below 768px the nav moves to a bottom tab bar (56px plus safe-area padding) with three items: My Books, New query, My Tickets. The top bar keeps only the wordmark and the user menu.

**Admin shell.** Same structure, but the top bar is dark (`color-text` background, white text, white underline for the current item) with the label “Admin” beside the wordmark. The colour change is functional: nobody should mistake the admin view for the author view. Nav: Queue, Insights (optional). No sidebar. On mobile the nav collapses into the user menu.

Both shells include a “Skip to content” link as the first focusable element, and a `main` landmark.

### 3.2 Buttons and links

| Variant | Look | Use |
| --- | --- | --- |
| Primary | `color-primary` fill, white text | One per screen: the main action |
| Secondary | White fill, 1px `color-border-strong`, `color-text` | Alternative actions |
| Ghost | No border, `color-primary` text, `color-primary-tint` on hover | Low-emphasis actions |
| Danger | `color-danger` fill, white text | Destructive actions only |

Sizes: sm 32px, md 40px, lg 48px (use lg for the main action on mobile). Horizontal padding 16px, radius-md, label 14px weight 500. States: hover and pressed use the variant tokens; disabled uses `color-text-subtle` on `color-surface-sunken`; loading replaces the leading icon with a 16px spinner, changes the label to its progressive form (“Sending…”), keeps the width fixed and sets `aria-busy`.

Links use `color-primary`, underline with 3px offset and 1px thickness (2px on hover). No arrows after link text.

### 3.3 Form fields

- Label above the field (label token). Helper text below (caption). Mark optional fields with “(optional)” in muted text; do not use asterisks.
- Input height 40px (48px on mobile), 1px `color-border`, radius-md, white fill. Hover: `color-border-strong`. Focus: `color-primary` border plus focus ring. Error: `color-danger` border with the message below, starting with a 16px alert icon. Disabled: sunken fill.
- Selects: use the native `select` on touch devices; the styled Radix select on desktop.
- Textareas auto-grow from a 128px minimum height.
- Character counters appear at 80% of the limit, right-aligned in the caption style, and turn `color-danger` over the limit.
- Validate a field on blur and everything on submit. On a failed submit show a summary at the top of the form with links to each field, and move focus to it.

### 3.4 Badges and indicators

- **Status badge:** 24px high, radius-sm, 13px weight 500, 8px horizontal padding, text label only (no dot).
- **Priority indicator:** four vertical bars 3px wide (heights 6, 8, 10, 12px) followed by the text label. Filled bars equal the level; unfilled bars are outlined in `color-border-strong`.
- **Category tag:** neutral outline style from 2.1.
- **Unread marker (author lists):** an 8px `color-primary` dot before the subject, subject weight 600, and screen-reader text “New reply”.
- **Changed-by-admin marker:** when an admin overrides category or priority, show a small pencil icon with a tooltip “Changed from AI suggestion: Royalty & Payments”.

### 3.5 Tables and lists

- **Admin table:** header row on `color-surface-sunken` using the label token. Sortable headers contain a button with a chevron and `aria-sort`. Row height 56px, 1px dividers, hover fill `color-surface-sunken` at 60%. Numeric columns are right-aligned and tabular. The header sticks to the top of the viewport while scrolling.
- **Rows are links.** Put an anchor in the first cell and stretch it over the row with an `::after` pseudo-element so the whole row is clickable and keyboard accessible.
- **Author lists:** plain divided lists, no card chrome.

### 3.6 Message blocks (ticket thread)

Each message has a header row (sender name weight 600, role in caption, timestamp in caption on the right) and a body in body-lg with line breaks preserved, maximum 68 characters wide.

| Type | Style |
| --- | --- |
| Author message | White background, 1px `color-border` |
| BookLeaf reply | `color-primary-tint` background, 3px `color-primary` left border |
| Internal note (admin only) | `color-surface-sunken`, 1px dashed `color-border-strong`, lock icon and the words “Only visible to the BookLeaf team” |
| AI draft (admin only) | `color-ai-tint` background, 3px `color-ai` left border, label “AI draft. Review before sending.” |

Messages are separated by 16px. Timestamps are relative within 24 hours (“2 hours ago”) and absolute after that (“20 Oct 2026, 4:15 pm”). The exact time is always in the `title` attribute.

### 3.7 Banners, toasts, dialogs

- **Banner** (inline, full container width, 3px left border, icon, text, optional action on the right): info (AI tint and blue), warning (`#FBF0D9` and `#7A4B00`), error (danger tint), success (primary tint). Errors use `role=alert`; the rest use `role=status`.
- **Toast:** bottom-left on desktop, bottom-centre above the tab bar on mobile. Radius-lg with the overlay shadow. Success toasts dismiss after 4 seconds; errors stay until closed. Maximum three stacked.
- **Dialog:** Radix. Radius-lg, 440px wide, title in title-section, buttons right-aligned and named by their action (“Discard reply” and “Keep editing”, never OK and Cancel). Focus trap, Esc closes, backdrop `rgba(24,33,29,0.4)`.

### 3.8 States every screen needs

- **Loading:** skeleton blocks that match the final layout, drawn in `color-surface-sunken`. Show them only after 200ms to avoid flashes. No shimmer under reduced motion.
- **Empty:** one sentence saying what the screen is, why it is empty and how to start, plus one button.
- **Error:** a banner at the top of the content with a “Try again” button. Keep any stale data visible beneath it.
- **Cold start:** the free backend host sleeps when idle. If any request takes longer than 4 seconds, show under the spinner: “The server is waking up. The first request after a quiet period can take up to a minute.” Remove it when the response arrives.
- **Offline:** banner “You’re offline. We’ll refresh when you’re back.” and pause polling.

### 3.9 Live updates

- A single hook (for example `useLiveTicket`) updates data in place with no page reload. Start with polling every 10 seconds while the tab is visible; swap to SSE later without changing components.
- Show “Updated just now” (or “Updated 12 seconds ago”) in the caption style near the status line.
- New thread messages get the highlight from 2.3, an `aria-live=polite` announcement (“New reply from BookLeaf”) and, if the person has scrolled up, a “New reply” pill at the bottom of the thread that scrolls to it. Never jump the scroll position.
- When the tab is hidden and a reply arrives, prefix the document title with “(1)”.
- In the admin queue, new tickets never insert under the cursor. Show a pill under the filters, “2 new tickets. Show”, and merge them on click.

### 3.10 Formatting rules

| Item | Rule |
| --- | --- |
| Money | `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`, giving ₹57,744. Show paise only when non-zero. Always show ₹. |
| Counts | en-IN grouping, tabular: 1,203 |
| Dates | “20 Jun 2023”; with time “20 Jun 2023, 4:15 pm”. Timezone Asia/Kolkata everywhere. |
| Missing date | Muted words, never blank or null: “Not published yet”, “No payout yet” |
| Missing money | “Not set yet” (MRP of a book in production) |
| ISBN | Exactly as stored, never reformatted, never wrapped |
| Ticket ID | “BL-” plus the number, caption style, tabular |
| Truncation | Single-line ellipsis with the full text in `title`. Author list subjects may wrap to two lines on mobile. |
| Age | “Opened 3 days ago”, exact time in `title` |

## 4. Copy

**Voice.** Plain, direct and warm; sentence case; verbs on buttons; no apologies in error messages and no jargon. One naming rule: the form is a **query**, the record is a **ticket** (BL-1042). Replies show the admin’s first name with “BookLeaf support”, for example “Rahul, BookLeaf support”.

**Response target.** One config value, `FIRST_RESPONSE_TARGET_HOURS = 48`, feeds the author copy (“We aim to reply within 48 hours”) and the admin overdue flag. Note it in the README as an assumption.

**Status helper text (author ticket page)**

| Status | Text |
| --- | --- |
| Open | We’ve received your query. We aim to reply within 48 hours. |
| In progress | Our team is working on this. We’ll update you here. |
| Resolved | We think this is resolved. If it isn’t, raise a new query and mention the ticket number. |
| Closed | This ticket is closed. Raise a new query if you need more help. |

**Buttons:** Sign in, New support query, Send query, Cancel, Raise a query (per book), Send reply, Send and mark resolved, Regenerate draft, Discard draft, Use AI suggestion, Assign to me, Save note, Try again, Show more, Clear filters, Sign out.

**Messages**

| Situation | Text |
| --- | --- |
| Wrong login | Email or password is incorrect. |
| Too many attempts | Too many sign-in attempts. Try again in a minute. |
| Session expired | Your session expired. Sign in again to continue. |
| Network failure | Couldn’t reach the server. Check your connection and try again. |
| Query not sent | Your query wasn’t sent. Your text is still here. Try again. |
| Too many queries | You’ve sent several queries in a short time. Wait a minute and try again. |
| Ticket not found | We couldn’t find that ticket. It may have been removed, or the link may be wrong. |
| AI drafting failed (admin) | AI drafting is unavailable right now. Write a reply yourself, or try again. |
| AI classification failed (admin) | AI couldn’t classify this ticket, so defaults were applied (General inquiry, Medium). Review them. |

## 5. Page specs

Each spec lists route and role, purpose, data, layout, states, interactions, copy and accessibility. Wireframes are schematic; the tokens in section 2 decide spacing and colour.

### 5.1 Sign in

**Route and role:** `/login`, public. People who are already signed in are redirected to their home. After sign-in, authors go to `/books`, admins go to `/admin/tickets`, or both go to the stored `next` path if there is one.

**Purpose:** one entry point for authors and admins; the role in the token decides where they land.

**Data:** `POST /auth/login` with email and password returns a token, the role and a display name.

**Layout:** one column, 400px wide, left-aligned within the column, starting about 15vh from the top, directly on the page background (no card).

```
BookLeaf                                   wordmark, Literata 600, 20px

Sign in                                    title-page
Use the email address on your BookLeaf account.     body, muted

Email
[ _______________________________ ]
Password
[ ______________________ ] [ Show ]
[             Sign in             ]      primary, full width, 48px

Demo accounts                              only when NEXT_PUBLIC_DEMO_MODE is true
Author   priya.sharma@email.com     [ Use ]
Admin    admin@bookleaf.test        [ Use ]
```

The demo panel has a sunken background, radius-md and 16px padding. “Use” fills the form but does not submit. The passwords come from the seed script and are listed in the README. Keep the panel on the live demo so reviewers can sign in immediately.

| State | Behaviour |
| --- | --- |
| Default | Email field focused on load |
| Submitting | Button loading (“Signing in…”), fields read-only |
| Wrong credentials | Error banner above the form. Same text whether the email is unknown or the password is wrong. |
| Rate limited (429) | Error banner with the “Too many attempts” text |
| Session expired | Info banner when arriving with `?reason=expired`; after sign-in return to the stored path |
| Slow server | Cold-start note after 4 seconds |
| Validation | “Enter your email address.”, “Enter a valid email address.”, “Enter your password.” shown on submit |

**Interactions:** Enter submits. Show and Hide is a button with `aria-pressed`. Use `autocomplete` values `email` and `current-password`. Pasting is allowed.

**Accessibility:** page title “Sign in | BookLeaf”, labels linked to inputs, errors tied with `aria-describedby`, focus moves to the error banner after a failed attempt.

### 5.2 My Books

**Route and role:** `/books`, author. The default landing page for authors.

**Purpose:** show every book with its status, price, sales and royalties so the author sees where they stand without having to ask.

**Data:** `GET /me/books`. Per book: external id, title, isbn, genre, publication\_date, status, mrp, total\_copies\_sold, total\_royalty\_earned, royalty\_paid, royalty\_pending, last\_royalty\_payout\_date, print\_partner, platforms\[\]. The royalty totals are summed on the client.

**Layout (1024px and wider)**

```
My Books                                                       title-page

---------------------------------------------------------------------------
Earned            |  Paid              |  Pending                           caption labels
₹19,908           |  ₹16,338           |  ₹3,570                              figure-lg
---------------------------------------------------------------------------
Royalties are calculated quarterly and paid within 45 days of the quarter
ending. Amounts below ₹1,000 roll over to the next quarter.        caption

Book                       Status             MRP    Sold   Earned    Paid     Pending
---------------------------------------------------------------------------------------
Whispers of the Ganges     Published & Live   ₹399   342    ₹11,970   ₹8,400   ₹3,570
Literary Fiction           Published 20 Jun 2023                      Last payout 15 Oct 2025
ISBN 978-93-5XXXX-01-1
Available on Amazon India, Flipkart, BookLeaf Store. Printed in-house.   [ Raise a query ]
---------------------------------------------------------------------------------------
The Saffron Diaries        Published & Live   ₹450   189    ₹7,938   ₹7,938   ₹0
...
```

- **Summary band:** one band with 1px top and bottom borders and three columns separated by 1px vertical dividers. Caption label above a figure-lg number. It is not a set of cards. The helper sentence under it is a caption.
- **Book column:** title in title-book, genre in caption, ISBN in caption on its own line, `white-space: nowrap`. The title is plain text, not a link.
- **Status column:** book-status badge, with the publication date in caption beneath (“Published 20 Jun 2023” or “Not published yet”).
- **Numeric columns** (MRP, Sold, Earned, Paid, Pending): right-aligned, tabular. Pending is weight 600 when above zero. The Paid cell carries the last-payout caption.
- **Second line of each row:** platforms and print partner in caption on the left; a ghost button “Raise a query” on the right that opens `/tickets/new?book=<external id>`.

**Edge cases the page must handle** (all exist in the sample data)

| Condition | Sample records | Display |
| --- | --- | --- |
| Published, never paid out | BK005, BK010, BK016, BK018 | Paid shows ₹0 with the caption “No payout yet” |
| Fully paid (pending is 0) | BK002, BK007, BK008, BK014 | Pending shows ₹0 in muted text with the caption “Paid in full” |
| Pending below the minimum payout | BK016 (₹850) | Caption under Pending: “Below the ₹1,000 minimum. Rolls over to the next quarter.” Use a constant, `MIN_PAYOUT_INR = 1000` |
| In production | BK013 (Cover Design), BK015 (Typesetting) | MRP “Not set yet”, date “Not published yet”, Sold “—”, the four royalty cells merge into one: “Royalties start after publication.”, plus the stage line below |
| No platforms | BK013, BK015 | “Not listed on any platform yet.” |
| Long title | Letters from Lakshadweep | Wraps to two lines; the ISBN never wraps |
| Typographic apostrophe | Durga’s Daughters | Rendered exactly as stored (UTF-8 end to end) |

**Stage line (production books only).** Nine thin segments for the nine stages in the knowledge base: Manuscript Received, Editing, Cover Design, Typesetting, Proofreading, ISBN Assignment, Printing, Distribution Setup, Published & Live. Segments up to and including the current stage are filled `color-primary`; the rest are `color-border`. Beside it, the current stage in the body style: “Now in Cover Design”. Read the stage from the status text after “In Production - ”. Do not print stage numbers, because Editing is optional and the count would mislead. Use `role=img` with the label “Production progress. Current stage: Cover Design.”

**Responsive.** Below 1024px each book becomes a stacked item: title and status badge on the first row; genre and ISBN in caption; a three-column definition list (MRP, Sold, Published); a second three-column list on a sunken block (Earned, Paid, Pending); the captions; then the button. Below 640px the lists drop to two columns and Pending takes the full width. The summary band stacks its three figures when narrower than 400px.

**States:** loading (summary skeleton and three row skeletons); empty (“No books yet. Once your manuscript is accepted, your books appear here with their status and royalties.”); error banner with Try again. If every book is still in production, replace the summary figures with “No royalties yet. They start once a book is published.”

**Accessibility:** a table with a visually hidden caption “Your books and royalties” and `th scope`. The stacked layout uses `dl`, `dt`, `dd`. Status is always text.

### 5.3 Submit a Support Query

**Route and role:** `/tickets/new`, author.

**Purpose:** let an author raise a ticket with enough context for accurate classification and a specific answer.

**Data:** `GET /me/books` fills the dropdown. `POST /tickets` with `book_id` (or null), `subject`, `description` returns the new ticket id.

**Layout:** one column, 640px wide, left-aligned.

```
Submit a Support Query                                    title-page
Tell us what’s happening. A member of our team will reply here.      body, muted

Which book is this about?
[ Choose a book or General / account level          v ]
Published & Live. ₹3,570 royalty pending.            caption, after a book is chosen

Subject
[ ____________________________________________ ]       0 / 120 at 80% of limit
A short summary, for example: Royalty for Q3 not received.

Description
[                                                    ]
[                                                    ]   0 / 3000 at 80% of limit
Include dates, amounts and anything else that helps us check this.

Attachments (optional)
[ Choose files ]  or drop them here
JPG, PNG or PDF, up to 5 MB each, maximum 3.

[ Send query ]   Cancel
```

| Field | Control | Rules | Error text |
| --- | --- | --- | --- |
| Book | Select, required | Options: General / account level first, then the author’s books A to Z. Books in production get the suffix “In production”. Preselect from `?book=`. | Choose a book, or General / account level. |
| Subject | Text | 5 to 120 characters | Add a short subject so we can route your query. |
| Description | Textarea | 20 to 3000 characters | Describe the issue in at least 20 characters so we can help faster. |
| Attachments | Dropzone, optional | JPG, PNG, PDF; 5 MB each; maximum 3 | photo.bmp isn’t supported. Use JPG, PNG or PDF. / report.pdf is larger than 5 MB. / You can attach up to 3 files. |

**Attachments.** The brief asks for UI only. The dropzone has a 1px dashed `color-border-strong` outline (the one dashed border besides internal notes, because dropzones are conventionally dashed), radius-md and a 96px minimum height. Selected files appear as rows: filename, size, and a Remove icon button labelled “Remove photo.jpg”. Controlled by `NEXT_PUBLIC_ATTACHMENTS_ENABLED`. While it is false, keep the control but show the caption “File upload isn’t switched on in this demo. Mention any files in your description.” Never imply a file was uploaded when it was not.

**Behaviour**

- Validate on blur and on submit. The summary at the top of the form links to each invalid field.
- Submit sends an idempotency key so a double tap creates one ticket. The button shows “Sending…”.
- Success goes to `/tickets/<id>?sent=1`, where a success banner reads “Query sent as BL-1042. We aim to reply within 48 hours.” Ticket creation never waits for AI, and the author never sees AI mentioned.
- Failure shows an error banner and keeps every input. A 422 maps the API’s field errors onto the fields. A 429 shows the “Too many queries” text.
- Keep field values in localStorage under `draft:new-ticket` so a reload or a dropped connection does not lose text. Clear it on success. Leaving with text opens the dialog “Discard this query?” with buttons “Discard query” and “Keep editing”.
- When a book is chosen, show its status and pending royalty in caption beneath the select, so the author sees we know the book.

**Accessibility:** error summary receives focus; counters are not announced until the limit is near; the native select is used on touch devices.

### 5.4 My Tickets

**Route and role:** `/tickets`, author.

**Purpose:** follow every ticket and notice new replies without refreshing.

**Data:** `GET /tickets?status=&cursor=` returns, per ticket: id, subject, status, book title or null, updated\_at, last message (sender role, sender first name, created\_at) and `has_unread`. Poll every 10 seconds while the tab is visible.

```
My Tickets                                           [ New support query ]

[ All 5 ] [ Open 2 ] [ In progress 1 ] [ Resolved 1 ] [ Closed 1 ]     segmented filter

• Royalty for Whispers of the Ganges not received              [ In progress ]
  BL-1042      About Whispers of the Ganges        Reply from Rahul 2 hours ago
-----------------------------------------------------------------------------
  Can I update my book description after publishing?               [ Resolved ]
  BL-1031      General / account level             Reply from Rahul 3 days ago
```

- Filter buttons use `aria-pressed`, show server counts, and default to All. Sort by latest activity, newest first.
- Each row is one link. Line 1: subject in body-lg weight 500 (one line with an ellipsis; two lines on mobile) and the status badge on the right. Line 2 in caption: ticket id, then “About \<book title>” or “General / account level” (separate spans with a 16px gap, no dot separators), and on the right the last activity: “Reply from Rahul 2 hours ago”, or “You sent this 3 days ago” when nobody has replied.
- Unread: the dot and weight 600 subject when a BookLeaf reply is newer than the author’s last read.
- Hover fills the row with `color-surface-sunken` at 60%.

**States:** empty (“No tickets yet. When you raise a support query, you can follow it here.” with the button “New support query”); empty filter (“No resolved tickets.” with “Show all”); loading (four row skeletons); error banner; “Show more” button after 20 rows.

**Live behaviour:** rows reorder silently when activity changes; a row with a new reply gets the 1200ms highlight and the unread dot; counts on the filters update.

### 5.5 Ticket (author view)

**Route and role:** `/tickets/[id]`, author. A ticket that does not exist and a ticket that belongs to someone else return the same not-found page.

**Purpose:** show the original query, the replies, and exactly where the ticket stands.

**Data:** `GET /tickets/{id}` returns id, subject, status, book title or null, created\_at, updated\_at and `messages[]` (sender display name, role, body, created\_at; the original query is the first message). It never includes priority, category, AI fields, assignee or internal notes.

**Layout:** one column, 760px wide, left-aligned.

```
Back to My Tickets

BL-1042                                                          caption
Royalty for Whispers of the Ganges not received                  title-page
Book   Whispers of the Ganges            Sent   20 Oct 2026, 4:15 pm

(o)-----------( )-----------( )-----------( )          status line
Open         In progress    Resolved      Closed
We’ve received your query. We aim to reply within 48 hours.     Updated just now

Priya Sharma (you)                               20 Oct 2026, 4:15 pm
I published my book four months ago and have not received any royalty.

Rahul, BookLeaf support                          21 Oct 2026, 10:12 am
Thank you for flagging this, Priya. ...
```

**Status line (the memorable element).** An ordered list of four nodes joined by a 2px line. Past nodes are filled `color-primary`; the current node is a larger filled node with a 3px `color-primary-tint` ring; future nodes are outlined in `color-border-strong`. The connector is `color-primary` up to the current node and `color-border` after it. Labels sit under the nodes in 13px; the current label is weight 600 in `color-text`, the others are muted. It stays horizontal on mobile (four short labels fit at 320px). Markup: `ol` with `aria-current=step` on the current item and visually hidden text “Current status: In progress”. Beneath it, the helper text for the status from section 4, with “Updated just now” aligned to the right in caption.

**Thread:** message blocks from 3.6. The sender shows as “Your name (you)” for the author and “First name, BookLeaf support” for admins. If there is no reply yet, add a muted block under the original message: “No reply yet. We’ll post it here, and you’ll see it without refreshing.”

**Variants and states**

| Case | Behaviour |
| --- | --- |
| Just sent (`?sent=1`) | Success banner at the top, dismissible |
| New reply while open | Highlight, “New reply” pill if scrolled up, live-region announcement, status line and helper text update in place |
| Resolved | Helper text from section 4; the thread stays readable |
| Closed | Helper text from section 4 with the button “Raise a new query” |
| Not found | Page from 5.10 using the “Ticket not found” text |
| Loading | Skeleton for the title, the status line and two message blocks |
| Error | Banner with Try again; keep the last known thread visible |

**Optional, after the core flow works:** author follow-ups. A textarea labelled “Add a message” with a “Send message” button under the thread. The schema already supports it; it needs `POST /tickets/{id}/messages` for the author role. Skip it if time is short.

**Mobile:** the header stacks, thread padding is 16px, and the page leaves room above the bottom tab bar.
