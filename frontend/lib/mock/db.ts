import { Book, Ticket, TicketMessage, User, AdminMetric, TicketStatus, TicketPriority } from './types';
import { SEED_BOOKS, SEED_TICKETS, SEED_USERS, INITIAL_ADMIN_METRICS } from './seed';
import { getApiUrl } from '../api-client';

const STORAGE_KEY_DB = 'bookleaf_db_store_v4';
const STORAGE_KEY_IDEMPOTENCY = 'bookleaf_idempotency_keys_v4';

type Listener = () => void;

export class MockDatabase {
  private users: User[] = [];
  private books: Book[] = [];
  private tickets: Ticket[] = [];
  private metrics: AdminMetric = INITIAL_ADMIN_METRICS;
  private idempotencyKeys: Map<string, string> = new Map();
  private listeners: Set<Listener> = new Set();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_DB);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.users = parsed.users || SEED_USERS;
          this.books = parsed.books || SEED_BOOKS;
          this.tickets = parsed.tickets || SEED_TICKETS;
          this.metrics = parsed.metrics || INITIAL_ADMIN_METRICS;
        } else {
          this.resetToSeed();
        }

        const storedKeys = localStorage.getItem(STORAGE_KEY_IDEMPOTENCY);
        if (storedKeys) {
          const entries = JSON.parse(storedKeys);
          this.idempotencyKeys = new Map(entries);
        }
      } catch (err) {
        console.warn('Failed to load mock database from localStorage, using seed:', err);
        this.resetToSeed();
      }
    } else {
      this.resetToSeed();
    }

    this.initialized = true;

    if (typeof window !== 'undefined') {
      this.syncFromApi();
      this.setupLiveStream();
    }
  }

  private getAuthHeaders(role?: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      const token = role === 'admin'
        ? (localStorage.getItem('bookleaf_admin_jwt_token') || localStorage.getItem('bookleaf_jwt_token'))
        : (localStorage.getItem('bookleaf_author_jwt_token') || localStorage.getItem('bookleaf_jwt_token'));
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  public async syncFromApi() {
    if (typeof window === 'undefined') return;
    try {
      const adminToken = localStorage.getItem('bookleaf_admin_jwt_token');
      const authorToken = localStorage.getItem('bookleaf_author_jwt_token');
      const generalToken = localStorage.getItem('bookleaf_jwt_token');

      // Admin sync if admin token exists
      if (adminToken || (generalToken && window.location.pathname.startsWith('/admin'))) {
        const headers = this.getAuthHeaders('admin');
        const [statsRes, adminTicketsRes] = await Promise.all([
          fetch(getApiUrl('/api/v1/admin/stats'), { headers }).catch(() => null),
          fetch(getApiUrl('/api/v1/admin/tickets'), { headers }).catch(() => null),
        ]);

        if (statsRes && statsRes.ok) {
          const stats = await statsRes.json();
          this.metrics = {
            total_in_queue: stats.total_in_queue ?? this.metrics.total_in_queue,
            needs_first_reply: stats.needs_first_reply ?? this.metrics.needs_first_reply,
            near_sla_breach_count: stats.near_sla_breach_count ?? this.metrics.near_sla_breach_count,
            awaiting_author: stats.awaiting_author ?? this.metrics.awaiting_author,
            ai_draft_ready: stats.ai_draft_ready ?? this.metrics.ai_draft_ready,
            resolved_today: stats.resolved_today ?? this.metrics.resolved_today,
            sla_compliance_rate: stats.sla_compliance_rate ?? this.metrics.sla_compliance_rate,
          };
        }

        if (adminTicketsRes && adminTicketsRes.ok) {
          const queueData = await adminTicketsRes.json();
          if (queueData.items && Array.isArray(queueData.items)) {
            this.tickets = queueData.items;
          }
        }
      }

      // Author sync if author token exists
      if (authorToken || (generalToken && !window.location.pathname.startsWith('/admin'))) {
        const headers = this.getAuthHeaders('author');
        const [booksRes, authorTicketsRes] = await Promise.all([
          fetch(getApiUrl('/api/v1/me/books'), { headers }).catch(() => null),
          fetch(getApiUrl('/api/v1/me/tickets'), { headers }).catch(() => null),
        ]);

        if (booksRes && booksRes.ok) {
          const data = await booksRes.json();
          if (data.books && Array.isArray(data.books)) {
            this.books = data.books;
          }
        }

        if (authorTicketsRes && authorTicketsRes.ok) {
          const authorData = await authorTicketsRes.json();
          if (authorData.tickets && Array.isArray(authorData.tickets)) {
            this.tickets = authorData.tickets;
          }
        }
      }
      this.persist();
      this.notify();
    } catch {
      // Offline / fallback to local state
    }
  }

  private setupLiveStream() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    try {
      const token = localStorage.getItem('bookleaf_jwt_token');
      if (!token) return;
      const userStr = localStorage.getItem('bookleaf_auth_user_v1');
      const user = userStr ? JSON.parse(userStr) : null;
      const streamPath = user?.role === 'admin' ? '/api/v1/admin/stream' : '/api/v1/me/stream';
      const source = new EventSource(getApiUrl(`${streamPath}?token=${encodeURIComponent(token)}`));
      source.addEventListener('ticket.created', () => this.syncFromApi());
      source.addEventListener('ticket.updated', () => this.syncFromApi());
      source.addEventListener('message.created', () => this.syncFromApi());
      source.addEventListener('ticket.classified', () => this.syncFromApi());
    } catch {}
  }

  private persist() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          STORAGE_KEY_DB,
          JSON.stringify({
            users: this.users,
            books: this.books,
            tickets: this.tickets,
            metrics: this.metrics,
          })
        );
        localStorage.setItem(
          STORAGE_KEY_IDEMPOTENCY,
          JSON.stringify(Array.from(this.idempotencyKeys.entries()))
        );
      } catch (err) {
        console.warn('Failed to persist mock database to localStorage:', err);
      }
    }
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in mockDb listener:', err);
      }
    });
  }

  public resetToSeed() {
    this.users = JSON.parse(JSON.stringify(SEED_USERS));
    this.books = JSON.parse(JSON.stringify(SEED_BOOKS));
    this.tickets = JSON.parse(JSON.stringify(SEED_TICKETS));
    this.metrics = JSON.parse(JSON.stringify(INITIAL_ADMIN_METRICS));
    this.idempotencyKeys.clear();
    this.persist();
  }

  // --- Users & Auth ---
  public getUsers(): User[] {
    return [...this.users];
  }

  public getUserById(id: string): User | undefined {
    const direct = this.users.find((u) => u.id === id);
    if (direct) return direct;
    if (id === 'author_priya') return this.users.find((u) => u.id === 'AUTH001');
    if (id === 'admin_rahul') return this.users.find((u) => u.role === 'admin');
    return undefined;
  }

  public getUserByEmail(email: string): User | undefined {
    const normalized = email.toLowerCase().trim();
    const direct = this.users.find((u) => u.email.toLowerCase() === normalized);
    if (direct) return direct;
    if (normalized === 'admin@bookleaf.test') {
      return this.users.find((u) => u.role === 'admin');
    }
    return undefined;
  }

  // --- Books ---
  public getAllBooks(): Book[] {
    return [...this.books];
  }

  public getBooksByAuthor(authorId: string): Book[] {
    return this.books.filter(
      (b) =>
        b.author_id === authorId ||
        (authorId === 'AUTH001' && b.author_id === 'author_priya') ||
        (authorId === 'author_priya' && b.author_id === 'AUTH001')
    );
  }

  public getBookByExternalId(externalId: string): Book | undefined {
    return this.books.find(
      (b) => b.external_id.toLowerCase() === externalId.toLowerCase() || b.id === externalId
    );
  }

  public getAuthorRoyaltySummary(authorId: string): { earned: number; paid: number; pending: number } {
    const authorBooks = this.getBooksByAuthor(authorId);
    return authorBooks.reduce(
      (acc, book) => ({
        earned: acc.earned + (book.total_royalty_earned || 0),
        paid: acc.paid + (book.royalty_paid || 0),
        pending: acc.pending + (book.royalty_pending || 0),
      }),
      { earned: 0, paid: 0, pending: 0 }
    );
  }

  // --- Tickets ---
  public getTickets(filters?: {
    authorId?: string;
    status?: TicketStatus | 'All';
    category?: string;
    priority?: TicketPriority;
    search?: string;
  }): Ticket[] {
    let result = [...this.tickets];

    if (filters?.authorId) {
      const target = filters.authorId;
      result = result.filter(
        (t) =>
          t.author_id === target ||
          (target === 'AUTH001' && t.author_id === 'author_priya') ||
          (target === 'author_priya' && t.author_id === 'AUTH001')
      );
    }

    if (filters?.status && filters.status !== 'All') {
      result = result.filter((t) => t.status === filters.status);
    }

    if (filters?.category && filters.category !== 'All' && filters.category !== 'All Categories') {
      result = result.filter((t) => t.category === filters.category);
    }

    if (filters?.priority) {
      result = result.filter((t) => t.priority === filters.priority);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.author_name.toLowerCase().includes(q) ||
          (t.book_title && t.book_title.toLowerCase().includes(q))
      );
    }

    // Default sort: newest updated first
    return result.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  public getTicket(id: string): Ticket | undefined {
    const upperId = id.toUpperCase();
    return this.tickets.find((t) => t.id.toUpperCase() === upperId);
  }

  public getTicketById(id: string): Ticket | undefined {
    return this.getTicket(id);
  }

  public getAuthorTickets(authorEmailOrId: string): Ticket[] {
    const user = this.getUserByEmail(authorEmailOrId);
    const authorId = user ? user.id : authorEmailOrId;
    return this.getTickets({ authorId });
  }

  public createTicket(
    input: {
      author_id: string;
      book_id: string | null;
      subject: string;
      description: string;
      category?: string;
      priority?: TicketPriority;
    },
    idempotencyKey?: string
  ): Ticket {
    // Idempotency check
    if (idempotencyKey && this.idempotencyKeys.has(`ticket:${idempotencyKey}`)) {
      const existingId = this.idempotencyKeys.get(`ticket:${idempotencyKey}`)!;
      const existing = this.getTicket(existingId);
      if (existing) return existing;
    }

    const author = this.getUserById(input.author_id);
    const book = input.book_id ? this.getBookByExternalId(input.book_id) : undefined;

    // Generate next ticket ID: BL-(highest + 1)
    const existingNums = this.tickets
      .map((t) => parseInt(t.id.replace(/\D/g, ''), 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1070;
    const ticketId = `BL-${nextNum}`;

    const now = new Date().toISOString();

    const newTicket: Ticket = {
      id: ticketId,
      author_id: input.author_id,
      author_name: author?.name || 'Author',
      author_email: author?.email || 'author@example.com',
      book_id: book?.external_id || input.book_id || null,
      book_title: book?.title || null,
      subject: input.subject.trim(),
      description: input.description.trim(),
      status: 'Open',
      priority: input.priority || 'Medium',
      category: input.category || 'General Inquiry',
      assignee: null,
      has_unread: false,
      created_at: now,
      updated_at: now,
      channel: 'Portal',
      ai_assist_status: 'Reviewing',
      sla_target_hours: 48,
      messages: [
        {
          id: `msg_${ticketId}_1`,
          ticket_id: ticketId,
          sender_name: author?.name || 'Author',
          sender_role: 'author',
          body: input.description.trim(),
          created_at: now,
        },
      ],
    };

    this.tickets.unshift(newTicket);
    this.metrics.total_in_queue += 1;
    this.metrics.needs_first_reply += 1;

    if (idempotencyKey) {
      this.idempotencyKeys.set(`ticket:${idempotencyKey}`, ticketId);
    }

    this.persist();
    this.notify();
    return newTicket;
  }

  public addMessage(
    ticketId: string,
    message: {
      sender_name: string;
      sender_role: 'author' | 'support' | 'admin' | 'ai';
      body: string;
      is_internal_note?: boolean;
      disbursement_note?: string;
    },
    idempotencyKey?: string
  ): TicketMessage {
    const ticket = this.getTicket(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);
    if (!ticket.messages) {
      ticket.messages = [];
    }

    if (idempotencyKey && this.idempotencyKeys.has(`msg:${ticketId}:${idempotencyKey}`)) {
      const msgId = this.idempotencyKeys.get(`msg:${ticketId}:${idempotencyKey}`)!;
      const existing = ticket.messages.find((m) => m.id === msgId);
      if (existing) return existing;
    }

    const now = new Date().toISOString();
    const newMsg: TicketMessage = {
      id: `msg_${ticket.id}_${ticket.messages.length + 1}`,
      ticket_id: ticket.id,
      sender_name: message.sender_name,
      sender_role: message.sender_role,
      body: message.body.trim(),
      created_at: now,
      is_internal_note: message.is_internal_note,
      is_official: message.sender_role === 'support' || message.sender_role === 'admin',
      disbursement_note: message.disbursement_note,
    };

    ticket.messages.push(newMsg);
    ticket.updated_at = now;

    if (!message.is_internal_note && message.sender_role !== 'author') {
      ticket.has_unread = true;
      if (ticket.status === 'Open') {
        ticket.status = 'In progress';
        this.metrics.needs_first_reply = Math.max(0, this.metrics.needs_first_reply - 1);
      }
    } else if (message.sender_role === 'author') {
      ticket.has_unread = false;
    }

    if (idempotencyKey) {
      this.idempotencyKeys.set(`msg:${ticketId}:${idempotencyKey}`, newMsg.id);
    }

    this.persist();
    this.notify();
    return newMsg;
  }

  public upsertTicket(ticket: Ticket): void {
    const idx = this.tickets.findIndex((t) => t.id === ticket.id);
    const existingMessages = idx >= 0 ? this.tickets[idx].messages : [];
    const mergedMessages = Array.isArray(ticket.messages) ? ticket.messages : (existingMessages || []);
    const mergedTicket: Ticket = {
      ...(idx >= 0 ? this.tickets[idx] : {}),
      ...ticket,
      messages: mergedMessages,
    };
    if (idx >= 0) {
      this.tickets[idx] = mergedTicket;
    } else {
      this.tickets.unshift(mergedTicket);
    }
    this.persist();
    this.notify();
  }

  public assignTicket(ticketId: string, assigneeName: string, avatarInitials = 'RS'): Ticket {
    const ticket = this.getTicket(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    ticket.assignee = assigneeName;
    ticket.assignee_avatar = avatarInitials;
    ticket.updated_at = new Date().toISOString();

    this.persist();
    this.notify();
    return ticket;
  }

  public updateTicketStatus(ticketId: string, status: TicketStatus): Ticket {
    const ticket = this.getTicket(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    const prevStatus = ticket.status;
    ticket.status = status;
    ticket.updated_at = new Date().toISOString();

    if (status === 'Resolved' && prevStatus !== 'Resolved') {
      this.metrics.resolved_today += 1;
      this.metrics.total_in_queue = Math.max(0, this.metrics.total_in_queue - 1);
    }

    this.persist();
    this.notify();
    return ticket;
  }

  public markTicketRead(ticketId: string): void {
    const ticket = this.getTicket(ticketId);
    if (ticket && ticket.has_unread) {
      ticket.has_unread = false;
      this.persist();
    }
  }

  public getAdminMetrics(): AdminMetric {
    return { ...this.metrics };
  }
}

export const mockDb = new MockDatabase();
