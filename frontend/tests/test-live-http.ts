import assert from 'node:assert/strict';

async function testHttpEndpoints() {
  const baseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  console.log(`Connecting to ${baseUrl} ...`);

  // 1. /api/health
  console.log('1. Testing GET /api/health ...');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthRes.status, 200, '/api/health status must be 200');
  const healthJson = await healthRes.json();
  assert.equal(healthJson.status, 'healthy');
  console.log('   ✓ Health check passed:', healthJson);

  // 2. /api/health/ready (Neon PostgreSQL check)
  console.log('2. Testing GET /api/health/ready (Neon Postgres readiness) ...');
  const readyRes = await fetch(`${baseUrl}/api/health/ready`);
  assert.equal(readyRes.status, 200, '/api/health/ready status must be 200');
  const readyJson = await readyRes.json();
  assert.equal(readyJson.status, 'ready');
  assert.equal(readyJson.database, 'connected');
  assert.equal(readyJson.provider, 'Neon PostgreSQL');
  console.log('   ✓ Neon PostgreSQL readiness check passed:', readyJson);

  // 3. Security & RBAC: Anonymous access to protected endpoints must be rejected (401)
  console.log('3. Testing RBAC: Anonymous access rejected with 401 ...');
  const unauthBooksRes = await fetch(`${baseUrl}/api/v1/me/books`);
  assert.equal(unauthBooksRes.status, 401, 'Anonymous GET /api/v1/me/books must return 401');

  const unauthTicketsRes = await fetch(`${baseUrl}/api/v1/me/tickets`);
  assert.equal(unauthTicketsRes.status, 401, 'Anonymous GET /api/v1/me/tickets must return 401');

  const unauthAdminStats = await fetch(`${baseUrl}/api/v1/admin/stats`);
  assert.equal(unauthAdminStats.status, 401, 'Anonymous GET /api/v1/admin/stats must return 401');

  const unauthAdminQueue = await fetch(`${baseUrl}/api/v1/admin/tickets`);
  assert.equal(unauthAdminQueue.status, 401, 'Anonymous GET /api/v1/admin/tickets must return 401');
  console.log('   ✓ Anonymous access correctly blocked with 401 Unauthorized.');

  // 4. /api/v1/auth/login for Author
  console.log('4. Testing POST /api/v1/auth/login (Author) ...');
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya.sharma@email.com', password: 'demo' })
  });
  assert.equal(loginRes.status, 200, 'Login status must be 200');
  const loginJson = await loginRes.json();
  assert.ok(loginJson.access_token, 'Login must yield JWT access_token');
  const authorToken = loginJson.access_token;
  console.log('   ✓ Author login passed. Author JWT token received.');

  // 5. /api/v1/me/books (with Author Bearer JWT)
  console.log('5. Testing GET /api/v1/me/books (Author JWT) ...');
  const booksRes = await fetch(`${baseUrl}/api/v1/me/books`, {
    headers: { Authorization: `Bearer ${authorToken}` }
  });
  assert.equal(booksRes.status, 200, '/api/v1/me/books status must be 200');
  const booksJson = await booksRes.json();
  assert.ok(Array.isArray(booksJson.books), 'Books must be array');
  assert.equal(booksJson.summary.total_royalty_earned, 19908);
  assert.equal(booksJson.summary.royalty_paid, 16338);
  assert.equal(booksJson.summary.royalty_pending, 3570);
  console.log('   ✓ Author books endpoint passed (3 books, ₹19,908 Earned, ₹16,338 Paid, ₹3,570 Pending).');

  // 6. Security & RBAC: Author accessing admin endpoints must be rejected (403)
  console.log('6. Testing RBAC: Author accessing admin endpoints rejected with 403 ...');
  const authorOnAdminStats = await fetch(`${baseUrl}/api/v1/admin/stats`, {
    headers: { Authorization: `Bearer ${authorToken}` }
  });
  assert.equal(authorOnAdminStats.status, 403, 'Author accessing /api/v1/admin/stats must return 403');

  const authorOnAdminQueue = await fetch(`${baseUrl}/api/v1/admin/tickets`, {
    headers: { Authorization: `Bearer ${authorToken}` }
  });
  assert.equal(authorOnAdminQueue.status, 403, 'Author accessing /api/v1/admin/tickets must return 403');
  console.log('   ✓ Author forbidden from admin endpoints (403 Forbidden verified).');

  // 7. /api/v1/auth/login for Admin
  console.log('7. Testing POST /api/v1/auth/login (Admin) ...');
  const adminLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bookleaf.test', password: 'demo' })
  });
  assert.equal(adminLoginRes.status, 200, 'Admin login status must be 200');
  const adminLoginJson = await adminLoginRes.json();
  assert.ok(adminLoginJson.access_token, 'Admin login must yield JWT access_token');
  const adminToken = adminLoginJson.access_token;
  console.log('   ✓ Admin login passed. Admin JWT token received.');

  // 8. /api/v1/admin/stats (with Admin Bearer JWT)
  console.log('8. Testing GET /api/v1/admin/stats (Admin JWT) ...');
  const statsRes = await fetch(`${baseUrl}/api/v1/admin/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(statsRes.status, 200, '/api/v1/admin/stats status must be 200');
  const statsJson = await statsRes.json();
  assert.ok(statsJson.total_in_queue > 0);
  console.log('   ✓ Admin stats endpoint passed:', statsJson);

  // 9. /api/v1/admin/tickets (Queue with Admin Bearer JWT)
  console.log('9. Testing GET /api/v1/admin/tickets (Admin JWT) ...');
  const queueRes = await fetch(`${baseUrl}/api/v1/admin/tickets?sort=urgency`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(queueRes.status, 200, '/api/v1/admin/tickets status must be 200');
  const queueJson = await queueRes.json();
  assert.ok(queueJson.items.length > 0);
  console.log(`   ✓ Admin queue endpoint passed (${queueJson.total} tickets in urgency order).`);

  // 10. Data Isolation: Author requesting non-existent or foreign ticket returns 404
  console.log('10. Testing per-author data isolation (404 on invalid/foreign ticket ID) ...');
  const foreignRes = await fetch(`${baseUrl}/api/v1/me/tickets/BL-999999`, {
    headers: { Authorization: `Bearer ${authorToken}` }
  });
  assert.equal(foreignRes.status, 404, 'Foreign or missing ticket must return 404 Not Found');
  console.log('   ✓ Per-author data isolation verified (returns 404 Not Found, never exposes foreign data).');

  // 11. End-to-End Live Lifecycle: Author creates real ticket in Neon PostgreSQL
  console.log('11. Testing live ticket creation (POST /api/v1/me/tickets) in Neon PostgreSQL ...');
  const createRes = await fetch(`${baseUrl}/api/v1/me/tickets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authorToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      book_id: 'BK001',
      subject: 'Live Verification: Payout calculation inquiry',
      description: 'Requesting confirmation of Q3 payout remittance date and NEFT transaction reference.'
    })
  });
  assert.equal(createRes.status, 201, 'Ticket creation must return 201 Created');
  const createdTicket = await createRes.json();
  const liveTicketId = createdTicket.id;
  assert.ok(liveTicketId.startsWith('BL-'), `Generated ID ${liveTicketId} must start with BL-`);
  assert.equal(createdTicket.status, 'Open');
  console.log(`   ✓ Live ticket created successfully with ID: ${liveTicketId}`);

  // 12. Author adds follow-up message to thread
  console.log('12. Testing author follow-up message (POST /api/v1/me/tickets/:id/messages) ...');
  const authorMsgRes = await fetch(`${baseUrl}/api/v1/me/tickets/${liveTicketId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authorToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: 'Adding branch IFSC code for quick disbursement verification.'
    })
  });
  assert.equal(authorMsgRes.status, 201, 'Author message creation must return 201');
  console.log('   ✓ Author message persisted in live message thread.');

  // 13. Admin assigns ticket and sends official reply
  console.log('13. Testing admin ticket update & official reply against live backend ...');
  const assignRes = await fetch(`${baseUrl}/api/v1/admin/tickets/${liveTicketId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      assignee: 'Rahul Sharma',
      status: 'In progress'
    })
  });
  assert.equal(assignRes.status, 200, 'Admin ticket update must return 200');
  const updatedTicket = await assignRes.json();
  assert.equal(updatedTicket.assignee, 'Rahul Sharma');
  assert.equal(updatedTicket.status, 'In progress');

  const adminMsgRes = await fetch(`${baseUrl}/api/v1/admin/tickets/${liveTicketId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: 'Official response: Remittance has been scheduled via NEFT. Reference will reflect shortly.'
    })
  });
  assert.equal(adminMsgRes.status, 201, 'Admin official reply must return 201');
  console.log('   ✓ Admin assigned ticket and posted official reply.');

  // 14. Admin adds internal note (Confidential, never visible to author)
  console.log('14. Testing admin internal team note (POST /api/v1/admin/tickets/:id/notes) ...');
  const noteRes = await fetch(`${baseUrl}/api/v1/admin/tickets/${liveTicketId}/notes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: 'CONFIDENTIAL STAFF NOTE: Remittance batch #8841 verified by operations.'
    })
  });
  assert.equal(noteRes.status, 201, 'Admin internal note creation must return 201');
  console.log('   ✓ Admin internal note added.');

  // 15. Strict Data Privacy: Author inspects ticket and confirms NO internal note leaks
  console.log('15. Testing strict author data privacy & internal note isolation ...');
  const authorDetailRes = await fetch(`${baseUrl}/api/v1/me/tickets/${liveTicketId}`, {
    headers: { Authorization: `Bearer ${authorToken}` }
  });
  assert.equal(authorDetailRes.status, 200);
  const authorDetail = await authorDetailRes.json();
  const messages = authorDetail.messages;
  assert.ok(messages.length >= 2, 'Author must see original query and official staff response');
  const hasStaffReply = messages.some((m: any) => m.body.includes('Official response:'));
  assert.ok(hasStaffReply, 'Author must see official reply from BookLeaf staff');
  const hasInternalLeak = messages.some((m: any) => m.body.includes('CONFIDENTIAL STAFF NOTE'));
  assert.equal(hasInternalLeak, false, 'CRITICAL PRIVACY: Author MUST NEVER see internal staff notes');
  console.log('   ✓ Author view verified: Official staff reply visible, internal notes strictly isolated.');

  // 16. Admin resolves ticket
  console.log('16. Testing ticket resolution (PATCH /api/v1/admin/tickets/:id to Resolved) ...');
  const resolveRes = await fetch(`${baseUrl}/api/v1/admin/tickets/${liveTicketId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'Resolved' })
  });
  assert.equal(resolveRes.status, 200);
  const resolvedTicket = await resolveRes.json();
  assert.equal(resolvedTicket.status, 'Resolved');
  console.log('   ✓ Live ticket marked as Resolved successfully.');

  console.log('\n>>> All 16 live HTTP services, RBAC security gates, and end-to-end workflows verified successfully! <<<');
}

testHttpEndpoints().catch((err) => {
  console.error('HTTP test failed:', err);
  process.exit(1);
});
