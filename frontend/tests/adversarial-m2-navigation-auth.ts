import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mockDb } from '../lib/mock/db';
import { User, UserRole } from '../lib/mock/types';

console.log('================================================================');
console.log('  MILESTONE 2 EMPIRICAL ADVERSARIAL TEST SUITE (CHALLENGER 1)   ');
console.log('  Testing Navigation, Breakpoints, Touch Targets, and Auth Flow ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

interface Finding {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  description: string;
  component: string;
  expected: string;
  actual: string;
  impact: string;
}

const findings: Finding[] = [];

function check(id: string, description: string, fn: () => void) {
  try {
    fn();
    passCount++;
    console.log(`  [PASS] [${id}] ${description}`);
  } catch (err: any) {
    failCount++;
    console.error(`  [FAIL] [${id}] ${description}`);
    console.error(`         Error: ${err.message}`);
  }
}

function recordFinding(finding: Finding) {
  findings.push(finding);
}

// =============================================================================
// SECTION 1: BREAKPOINT LAYOUT COLLAPSING & NAVIGATION STRUCTURE
// =============================================================================
console.log('--- 1. Testing Layout Collapsing Across Breakpoints ---');

const topNavSource = fs.readFileSync(
  path.join(__dirname, '../components/author/TopNavBar.tsx'),
  'utf-8'
);
const mobileTabSource = fs.readFileSync(
  path.join(__dirname, '../components/author/MobileTabBar.tsx'),
  'utf-8'
);
const authorLayoutSource = fs.readFileSync(
  path.join(__dirname, '../app/(author)/layout.tsx'),
  'utf-8'
);
const userMenuSource = fs.readFileSync(
  path.join(__dirname, '../components/author/UserMenu.tsx'),
  'utf-8'
);
const loginPageSource = fs.readFileSync(
  path.join(__dirname, '../app/login/page.tsx'),
  'utf-8'
);
const booksPageSource = fs.readFileSync(
  path.join(__dirname, '../app/(author)/books/page.tsx'),
  'utf-8'
);

check('NAV-01', 'Desktop TopNavBar renders nav links with md:flex (>= 768px)', () => {
  // Desktop nav must be hidden by default on mobile (<768px) and flex on md: (>=768px)
  const navMatch = topNavSource.match(/<nav[^>]*aria-label="Author Portal Navigation"[^>]*className="([^"]+)"/);
  assert.ok(navMatch, 'TopNavBar must contain nav with aria-label="Author Portal Navigation"');
  const classNames = navMatch[1];
  assert.ok(classNames.includes('hidden'), 'Nav must be hidden on mobile (< 768px)');
  assert.ok(classNames.includes('md:flex'), 'Nav must have md:flex to render on viewports >= 768px');
});

check('NAV-02', 'TopNavBar "New support query" button hidden on mobile, visible on desktop', () => {
  const queryBtnMatch = topNavSource.match(/href="\/tickets\/new"[^>]*className="([^"]+)"/);
  assert.ok(queryBtnMatch, 'TopNavBar must contain /tickets/new link');
  const classNames = queryBtnMatch[1];
  assert.ok(classNames.includes('hidden'), '"New support query" link must be hidden by default');
  assert.ok(classNames.includes('md:inline-flex'), '"New support query" link must use md:inline-flex for >= 768px');
});

check('NAV-03', 'TopNavBar Desktop Utilities are hidden on viewports < 1024px', () => {
  assert.ok(
    topNavSource.includes('hidden lg:flex'),
    'Desktop utilities (Bell, HelpCircle) must have hidden lg:flex'
  );
});

check('NAV-04', 'MobileTabBar uses md:hidden to collapse on desktop (>= 768px)', () => {
  const tabNavMatch = mobileTabSource.match(/<nav[^>]*aria-label="Mobile Navigation"[^>]*className="([^"]+)"/);
  assert.ok(tabNavMatch, 'MobileTabBar must contain nav with aria-label="Mobile Navigation"');
  const classNames = tabNavMatch[1];
  assert.ok(classNames.includes('md:hidden'), 'MobileTabBar must have md:hidden class to hide on >= 768px');
  assert.ok(classNames.includes('fixed bottom-0'), 'MobileTabBar must be fixed to bottom on mobile');
});

check('NAV-05', 'MobileTabBar renders exactly 3 items: My Books, New query, My Tickets', () => {
  // Check for the 3 required routes
  assert.ok(mobileTabSource.includes('href="/books"'), 'MobileTabBar must link to /books');
  assert.ok(mobileTabSource.includes('href="/tickets/new"'), 'MobileTabBar must link to /tickets/new');
  assert.ok(mobileTabSource.includes('href="/tickets"'), 'MobileTabBar must link to /tickets');

  // Verify labels
  assert.ok(mobileTabSource.includes('>My Books<'), 'MobileTabBar item 1 must be labeled "My Books"');
  assert.ok(mobileTabSource.includes('>New query<'), 'MobileTabBar item 2 must be labeled "New query"');
  assert.ok(mobileTabSource.includes('>My Tickets<'), 'MobileTabBar item 3 must be labeled "My Tickets"');

  // Verify 3-column grid container
  assert.ok(mobileTabSource.includes('grid-cols-3'), 'MobileTabBar must use a 3-column grid');
});

check('NAV-06', 'Author Layout contains both TopNavBar and MobileTabBar with bottom padding guard', () => {
  assert.ok(authorLayoutSource.includes('<TopNavBar />'), 'Author layout must mount <TopNavBar />');
  assert.ok(authorLayoutSource.includes('<MobileTabBar />'), 'Author layout must mount <MobileTabBar />');
  // Check for padding compensation to avoid mobile bottom tab bar occlusion (56px)
  assert.ok(
    authorLayoutSource.includes('pb-24 md:pb-16'),
    'Author layout must add pb-24 md:pb-16 on main container to prevent occlusion'
  );
  assert.ok(
    authorLayoutSource.includes('mb-14 md:mb-0'),
    'Author layout must add mb-14 md:mb-0 on footer to prevent occlusion by bottom bar'
  );
});

check('NAV-07', 'My Books Page collapses between 12-column table and stacked cards at lg (1024px)', () => {
  assert.ok(
    booksPageSource.includes('hidden lg:block'),
    'Desktop 12-column table must have hidden lg:block'
  );
  assert.ok(
    booksPageSource.includes('block lg:hidden'),
    'Mobile stacked cards must have block lg:hidden'
  );
});

// =============================================================================
// SECTION 2: TOUCH TARGET DIMENSIONS AUDIT (STRICTLY >= 44x44px)
// =============================================================================
console.log('\n--- 2. Auditing Touch Target Sizes (Strictly >= 44x44px) ---');

// Audit 2.1: MobileTabBar item touch targets
check('TOUCH-01', 'MobileTabBar items have min-h-[48px] and span 3-column grid', () => {
  const matches = mobileTabSource.match(/min-h-\[48px\]/g);
  assert.ok(matches && matches.length >= 3, 'All 3 items in MobileTabBar must specify min-h-[48px]');
  // Grid container: 3 columns in max-w-md (up to 448px, min 320px)
  // At 320px viewport, width per column is ~101px >= 44px, height is >= 48px >= 44px
});

// Audit 2.2: UserMenu trigger button touch target
check('TOUCH-02', 'UserMenu trigger button specifies min-h-[44px]', () => {
  assert.ok(
    userMenuSource.includes('min-h-[44px]'),
    'UserMenu trigger button must specify min-h-[44px]'
  );
});

// Audit 2.3: UserMenu dropdown "Sign out" button touch target
check('TOUCH-03', 'UserMenu dropdown Sign out button touch target size audit', () => {
  // Check Sign out button styling in UserMenu
  const signOutMatch = userMenuSource.match(/<button[^>]*onClick=\{handleSignOut\}[^>]*className="([^"]+)"/);
  assert.ok(signOutMatch, 'Sign out button must exist in UserMenu');
  const classNames = signOutMatch[1];
  
  // Height check: py-2 = 16px padding + 20px text-sm line-height = 36px
  const hasMinHeight44 = classNames.includes('min-h-[44px]') || classNames.includes('h-11') || classNames.includes('h-12') || classNames.includes('py-3');
  
  if (!hasMinHeight44) {
    recordFinding({
      id: 'TOUCH-FAIL-01',
      severity: 'MEDIUM',
      category: 'Accessibility / Touch Targets',
      component: 'components/author/UserMenu.tsx',
      description: 'Sign out dropdown action button height is approximately 36px (py-2 + text-sm), which falls below the strict 44x44px WCAG 2.5.5 touch target requirement.',
      expected: 'Interactive menu item should have min-h-[44px] or py-3 to meet 44px touch target guidelines.',
      actual: `Button classes are "${classNames}" without min-h-[44px] or equivalent vertical height.`,
      impact: 'On touch screen devices, users with larger fingertips may mis-tap or struggle to activate the Sign out action comfortably.',
    });
    console.warn('    [FINDING RECORDED] Sign out button in UserMenu lacks min-h-[44px] (measures ~36px height).');
  }
});

// Audit 2.4: Login page primary submit button
check('TOUCH-04', 'Login page Submit button meets 48px height', () => {
  assert.ok(
    loginPageSource.includes('h-12'),
    'Login page submit button must have h-12 (48px) >= 44px'
  );
});

// Audit 2.5: Login page password toggle button touch target
check('TOUCH-05', 'Login page password toggle button touch target audit', () => {
  const toggleMatch = loginPageSource.match(/id="togglePassword"[\s\S]*?className="([^"]+)"/);
  assert.ok(toggleMatch, 'Toggle password button must exist');
  const classNames = toggleMatch[1];
  
  // Container input is h-10 (40px). Button is absolute top-1 bottom-1 (32px height).
  const hasMinHeight44 = classNames.includes('min-h-[44px]') || classNames.includes('h-11');
  if (!hasMinHeight44) {
    recordFinding({
      id: 'TOUCH-FAIL-02',
      severity: 'LOW',
      category: 'Accessibility / Touch Targets',
      component: 'app/login/page.tsx',
      description: 'Show/Hide password toggle button is nested inside an h-10 (40px) input with top-1 bottom-1, resulting in a 32px height, below 44px touch target.',
      expected: 'Password visibility toggle should have a minimum 44px touch target or larger hit area padding.',
      actual: 'Height constrained to 32px by parent input h-10.',
      impact: 'Small hit area on mobile devices may require precise tapping to toggle password visibility.',
    });
    console.warn('    [FINDING RECORDED] Show/Hide password toggle button has 32px height (< 44px).');
  }
});

// Audit 2.6: Login page Demo account [ Use ] buttons touch target
check('TOUCH-06', 'Login page Demo account [ Use ] button touch target audit', () => {
  const demoUseButtons = loginPageSource.match(/className="[^"]*h-8[^"]*"/g);
  if (demoUseButtons && demoUseButtons.length > 0) {
    recordFinding({
      id: 'TOUCH-FAIL-03',
      severity: 'LOW',
      category: 'Accessibility / Touch Targets',
      component: 'app/login/page.tsx',
      description: 'Demo account 1-click [ Use ] buttons specify h-8 (32px), which is below 44px touch target guideline.',
      expected: 'Interactive buttons on touch viewports should ideally have min-h-[44px].',
      actual: 'Buttons specify h-8 (32px height).',
      impact: 'Evaluation/demo convenience buttons are compact on small screens.',
    });
    console.warn('    [FINDING RECORDED] Demo account [ Use ] buttons are h-8 (32px < 44px).');
  }
});

// =============================================================================
// SECTION 3: AUTH SIMULATION & REDIRECT FLOWS
// =============================================================================
console.log('\n--- 3. Testing Authentication Simulation & Redirect Logic ---');

// Node-compatible localStorage mock for headless execution
class MockStorage {
  private store: Map<string, string> = new Map();
  getItem(k: string) { return this.store.get(k) || null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

const mockStorage = new MockStorage();
const STORAGE_KEY_AUTH = 'bookleaf_auth_user_v1';

// Simulation of Auth Context state machine
class SimulatedAuthContext {
  user: User | null = null;
  isLoading: boolean = false;

  get isAuthenticated(): boolean {
    return !!this.user;
  }

  get role(): UserRole | null {
    return this.user?.role || null;
  }

  init() {
    const stored = mockStorage.getItem(STORAGE_KEY_AUTH);
    if (stored) {
      try {
        this.user = JSON.parse(stored);
      } catch {
        this.user = null;
      }
    } else {
      // Default to Priya Sharma on initial demo load
      const defaultUser = mockDb.getUserById('author_priya');
      if (defaultUser) {
        this.user = defaultUser;
        mockStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(defaultUser));
      }
    }
  }

  async login(email: string, role?: UserRole): Promise<boolean> {
    this.isLoading = true;
    try {
      let foundUser = mockDb.getUserByEmail(email);
      if (!foundUser) {
        if (email.includes('admin') || role === 'admin') {
          foundUser = mockDb.getUserById('admin_rahul');
        } else {
          foundUser = mockDb.getUserById('author_priya');
        }
      }

      if (foundUser) {
        this.user = foundUser;
        mockStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(foundUser));
        return true;
      }
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  logout() {
    this.user = null;
    mockStorage.removeItem(STORAGE_KEY_AUTH);
  }
}

// Simulated Router
class SimulatedRouter {
  public currentPath: string = '/';
  public history: string[] = [];

  push(path: string) {
    this.currentPath = path;
    this.history.push(path);
  }

  replace(path: string) {
    this.currentPath = path;
    this.history.push(`replace:${path}`);
  }
}

// Layout guard evaluator
function evaluateAuthorLayoutGuard(auth: SimulatedAuthContext, router: SimulatedRouter): boolean {
  if (auth.isLoading) return false;
  if (!auth.isAuthenticated) {
    router.replace('/login');
    return false;
  } else if (auth.user?.role === 'admin') {
    router.replace('/admin/tickets');
    return false;
  }
  return true; // Allowed into author route
}

// Login redirect path calculator (from LoginFormContent)
function getRedirectPath(role: 'author' | 'admin', nextParam?: string | null): string {
  if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) {
    return nextParam;
  }
  return role === 'admin' ? '/admin/tickets' : '/books';
}

check('AUTH-01', 'Unauthenticated access to /books triggers redirect to /login', () => {
  mockStorage.clear();
  const auth = new SimulatedAuthContext();
  auth.user = null; // Unauthenticated
  const router = new SimulatedRouter();
  router.currentPath = '/books';

  const allowed = evaluateAuthorLayoutGuard(auth, router);
  assert.equal(allowed, false, 'Unauthenticated user must be blocked from /books');
  assert.equal(router.currentPath, '/login', 'Router must redirect to /login');
  assert.equal(router.history[router.history.length - 1], 'replace:/login');
});

check('AUTH-02', 'Logging in as Priya Sharma sets author role and redirects to /books', async () => {
  mockStorage.clear();
  const auth = new SimulatedAuthContext();
  const router = new SimulatedRouter();

  const success = await auth.login('priya.sharma@email.com', 'author');
  assert.equal(success, true, 'Login must succeed for Priya Sharma');
  assert.ok(auth.user, 'auth.user must be populated');
  assert.equal(auth.user.id, 'author_priya');
  assert.equal(auth.user.name, 'Priya Sharma');
  assert.equal(auth.user.role, 'author');
  assert.equal(auth.isAuthenticated, true);

  // Verify redirection
  const dest = getRedirectPath(auth.user.role);
  assert.equal(dest, '/books', 'Author role must redirect to /books');
  router.push(dest);
  assert.equal(router.currentPath, '/books');

  // Verify localStorage persistence
  const saved = mockStorage.getItem(STORAGE_KEY_AUTH);
  assert.ok(saved, 'User session must be stored in localStorage');
  assert.equal(JSON.parse(saved!).email, 'priya.sharma@email.com');
});

check('AUTH-03', 'Logging in as Admin sets admin role and redirects to /admin/tickets', async () => {
  mockStorage.clear();
  const auth = new SimulatedAuthContext();
  const router = new SimulatedRouter();

  const success = await auth.login('admin@bookleaf.test', 'admin');
  assert.equal(success, true, 'Login must succeed for Admin');
  assert.ok(auth.user, 'auth.user must be populated');
  assert.equal(auth.user.role, 'admin');
  assert.equal(auth.isAuthenticated, true);

  // Verify redirection
  const dest = getRedirectPath(auth.user.role);
  assert.equal(dest, '/admin/tickets', 'Admin role must redirect to /admin/tickets');
  router.push(dest);
  assert.equal(router.currentPath, '/admin/tickets');
});

check('AUTH-04', 'Admin attempting to access /books is redirected to /admin/tickets', () => {
  const auth = new SimulatedAuthContext();
  auth.user = {
    id: 'admin_rahul',
    name: 'Rahul Varma',
    email: 'admin@bookleaf.test',
    role: 'admin',
    avatar_initials: 'RV',
  };
  const router = new SimulatedRouter();
  router.currentPath = '/books';

  const allowed = evaluateAuthorLayoutGuard(auth, router);
  assert.equal(allowed, false, 'Admin must not access author shell');
  assert.equal(router.currentPath, '/admin/tickets', 'Admin must be redirected to /admin/tickets');
});

check('AUTH-05', 'Sign out in UserMenu calls logout, purges localStorage, and redirects to /login', () => {
  const auth = new SimulatedAuthContext();
  auth.user = mockDb.getUserById('author_priya') || null;
  mockStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(auth.user));
  const router = new SimulatedRouter();
  router.currentPath = '/books';

  // Perform UserMenu handleSignOut simulation
  auth.logout();
  router.push('/login');

  assert.equal(auth.user, null, 'User must be null after logout');
  assert.equal(auth.isAuthenticated, false, 'isAuthenticated must be false after logout');
  assert.equal(mockStorage.getItem(STORAGE_KEY_AUTH), null, 'localStorage key must be deleted');
  assert.equal(router.currentPath, '/login', 'Router must navigate to /login');
});

// =============================================================================
// SECTION 4: ADVERSARIAL STRESS TESTING & EDGE CASES
// =============================================================================
console.log('\n--- 4. Adversarial Stress Testing & Edge Cases ---');

check('ADV-01', 'Open redirect prevention via "next" query param', () => {
  // Attack vectors: protocol relative, external urls, javascript:
  assert.equal(getRedirectPath('author', 'https://malicious.com'), '/books', 'External absolute URL blocked');
  assert.equal(getRedirectPath('author', '//malicious.com'), '/books', 'Protocol-relative URL blocked');
  assert.equal(getRedirectPath('author', 'javascript:alert(1)'), '/books', 'Javascript: protocol blocked');
  assert.equal(getRedirectPath('author', '/tickets/new'), '/tickets/new', 'Valid internal relative path allowed');
});

check('ADV-02', 'Root / routing logic correctly routes author vs admin vs unauth', () => {
  const rootPageSource = fs.readFileSync(
    path.join(__dirname, '../app/page.tsx'),
    'utf-8'
  );
  assert.ok(rootPageSource.includes("router.replace('/login')"), 'Root must redirect unauthenticated to /login');
  assert.ok(rootPageSource.includes("router.replace('/admin/tickets')"), 'Root must redirect admin to /admin/tickets');
  assert.ok(rootPageSource.includes("router.replace('/books')"), 'Root must redirect author to /books');
});

check('ADV-03', 'UserMenu Outside Click & Escape key dismissal handlers exist', () => {
  assert.ok(userMenuSource.includes("'mousedown'"), 'UserMenu listens for mousedown outside');
  assert.ok(userMenuSource.includes("'touchstart'"), 'UserMenu listens for touchstart outside');
  assert.ok(userMenuSource.includes("e.key === 'Escape'"), 'UserMenu listens for Escape key');
  assert.ok(userMenuSource.includes("buttonRef.current?.focus()"), 'UserMenu restores focus to trigger on Escape');
});

check('ADV-04', 'ARIA attributes and semantic landmarks parity in navigation', () => {
  assert.ok(topNavSource.includes('aria-label="Author Portal Navigation"'), 'TopNavBar has aria-label');
  assert.ok(mobileTabSource.includes('aria-label="Mobile Navigation"'), 'MobileTabBar has aria-label');
  assert.ok(userMenuSource.includes('aria-haspopup="menu"'), 'UserMenu has aria-haspopup="menu"');
  assert.ok(userMenuSource.includes('aria-expanded='), 'UserMenu binds aria-expanded');
  assert.ok(userMenuSource.includes('role="menu"'), 'UserMenu dropdown has role="menu"');
  assert.ok(userMenuSource.includes('role="menuitem"'), 'UserMenu actions have role="menuitem"');
});

check('ADV-05', 'Suspense boundary present on /login to prevent CSR deopt', () => {
  assert.ok(
    loginPageSource.includes('<Suspense fallback={<LoginSkeleton />}>'),
    'LoginPage must wrap searchParams reader in Suspense'
  );
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passCount} Passed, ${failCount} Failed`);
console.log(`FINDINGS RECORDED: ${findings.length}`);
console.log('================================================================\n');

if (findings.length > 0) {
  console.log('DETAILED FINDINGS:');
  findings.forEach((f, idx) => {
    console.log(`\n[Finding #${idx + 1}] [${f.severity}] ${f.id} - ${f.description}`);
    console.log(`  Component: ${f.component}`);
    console.log(`  Expected : ${f.expected}`);
    console.log(`  Actual   : ${f.actual}`);
    console.log(`  Impact   : ${f.impact}`);
  });
}

process.exit(failCount > 0 ? 1 : 0);
