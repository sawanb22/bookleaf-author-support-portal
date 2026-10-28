/**
 * Frontend API Client Configuration
 * Connects directly to FastAPI backend (http://localhost:8000/api/v1) backed by Neon PostgreSQL.
 */

import { Book, Ticket, TicketMessage, User, AdminMetric } from './mock/types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? (window.location.origin.includes('localhost') ? 'http://localhost:8000' : '')
    : 'http://localhost:8000');

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) return cleanPath;
  return `${API_BASE_URL.replace(/\/$/, '')}${cleanPath}`;
}

export function getAuthToken(targetPath?: string): string | null {
  if (typeof window !== 'undefined') {
    const isApiPathAdmin = targetPath && (targetPath.startsWith('/api/v1/admin') || targetPath.startsWith('/admin'));
    const isWindowPathAdmin = window.location.pathname.startsWith('/admin');
    
    if (isApiPathAdmin || (isWindowPathAdmin && !targetPath?.startsWith('/api/v1/me'))) {
      return (
        localStorage.getItem('bookleaf_admin_jwt_token') ||
        localStorage.getItem('bookleaf_jwt_token')
      );
    }
    return (
      localStorage.getItem('bookleaf_author_jwt_token') ||
      localStorage.getItem('bookleaf_jwt_token')
    );
  }
  return null;
}

export function setAuthToken(token: string, role?: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('bookleaf_jwt_token', token);
    const isAdmin = role === 'admin' || window.location.pathname.startsWith('/admin');
    if (isAdmin) {
      localStorage.setItem('bookleaf_admin_jwt_token', token);
    } else {
      localStorage.setItem('bookleaf_author_jwt_token', token);
    }
  }
}

export function clearAuthToken(role?: string): void {
  if (typeof window !== 'undefined') {
    const isAdmin = role === 'admin' || window.location.pathname.startsWith('/admin');
    if (isAdmin) {
      localStorage.removeItem('bookleaf_admin_jwt_token');
    } else if (role === 'author') {
      localStorage.removeItem('bookleaf_author_jwt_token');
    } else {
      localStorage.removeItem('bookleaf_jwt_token');
      localStorage.removeItem('bookleaf_admin_jwt_token');
      localStorage.removeItem('bookleaf_author_jwt_token');
    }
  }
}

export function getAuthHeaders(path?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken(path);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = getApiUrl(path);
  const headers = {
    ...getAuthHeaders(path),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail: any = null;
    try {
      errorDetail = await response.json();
    } catch {
      errorDetail = { message: response.statusText };
    }
    const message =
      errorDetail?.error?.message ||
      errorDetail?.detail?.message ||
      (typeof errorDetail?.detail === 'string' ? errorDetail.detail : null) ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    (error as any).status = response.status;
    (error as any).detail = errorDetail;
    throw error;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const apiClient = {
  auth: {
    login: async (email: string, password = 'demo') => {
      const res = await apiFetch<{
        access_token: string;
        token_type: string;
        expires_in: number;
        user: User;
      }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res?.access_token) {
        setAuthToken(res.access_token, res.user?.role);
      }
      return res;
    },
    me: async () => {
      return apiFetch<{ user: User }>('/api/v1/auth/me');
    },
  },
  author: {
    getBooks: async () => {
      return apiFetch<{
        books: Book[];
        summary: {
          total_royalty_earned: number;
          royalty_paid: number;
          royalty_pending: number;
        };
      }>('/api/v1/me/books');
    },
    getTickets: async (status?: string) => {
      const query = status && status !== 'All' ? `?status=${encodeURIComponent(status)}` : '';
      return apiFetch<{ tickets: Ticket[]; total: number }>(`/api/v1/me/tickets${query}`);
    },
    getTicket: async (ticketId: string) => {
      return apiFetch<Ticket>(`/api/v1/me/tickets/${ticketId}`);
    },
    createTicket: async (data: { book_id?: string | null; subject: string; description: string }) => {
      return apiFetch<Ticket>('/api/v1/me/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    addMessage: async (ticketId: string, body: string) => {
      return apiFetch<TicketMessage>(`/api/v1/me/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    },
    createEventSource: () => {
      if (typeof window === 'undefined' || typeof EventSource === 'undefined') return null;
      const token = getAuthToken();
      if (!token) return null;
      return new EventSource(getApiUrl(`/api/v1/me/stream?token=${encodeURIComponent(token)}`));
    },
  },
  admin: {
    getQueue: async (params?: {
      status?: string;
      category?: string;
      priority?: string;
      assignee?: string;
      q?: string;
      sort?: string;
    }) => {
      const sp = new URLSearchParams();
      if (params?.status && params.status !== 'All') sp.set('status', params.status);
      if (params?.category && params.category !== 'All Categories') sp.set('category', params.category);
      if (params?.priority && params.priority !== 'All Priorities') {
        sp.set('priority', params.priority.split(' ')[0]);
      }
      if (params?.assignee) sp.set('assignee', params.assignee);
      if (params?.q?.trim()) sp.set('q', params.q.trim());
      if (params?.sort) sp.set('sort', params.sort);
      const query = sp.toString() ? `?${sp.toString()}` : '';
      return apiFetch<{ items: Ticket[]; total: number }>(`/api/v1/admin/tickets${query}`);
    },
    getStats: async () => {
      return apiFetch<{
        total_in_queue: number;
        needs_first_reply: number;
        awaiting_author: number;
        ai_draft_ready: number;
        resolved_today: number;
        ai_override_rate: number;
      }>('/api/v1/admin/stats');
    },
    getStaff: async () => {
      return apiFetch<{ staff: User[] }>('/api/v1/admin/staff');
    },
    getTicket: async (ticketId: string) => {
      return apiFetch<Ticket & { notes?: any[]; events?: any[]; author_books?: any[]; ai_draft?: string }>(
        `/api/v1/admin/tickets/${ticketId}`
      );
    },
    updateTicket: async (
      ticketId: string,
      updates: {
        status?: string;
        category?: string;
        priority?: string;
        assignee?: string;
        assignee_id?: string;
      }
    ) => {
      return apiFetch<Ticket>(`/api/v1/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    sendMessage: async (ticketId: string, body: string, fromAiDraft = false, status?: string) => {
      return apiFetch<TicketMessage>(`/api/v1/admin/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, from_ai_draft: fromAiDraft, status }),
      });
    },
    addNote: async (ticketId: string, body: string) => {
      return apiFetch<any>(`/api/v1/admin/tickets/${ticketId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    },
    getDraft: async (ticketId: string, regenerate = false) => {
      return apiFetch<{
        body: string;
        missing_info: string[];
        escalation_recommended: boolean;
        unverified_figures: string[];
        cached: boolean;
      }>(`/api/v1/admin/tickets/${ticketId}/draft`, {
        method: 'POST',
        body: JSON.stringify({ regenerate }),
      });
    },
    classify: async (ticketId: string) => {
      return apiFetch<Ticket>(`/api/v1/admin/tickets/${ticketId}/classify`, {
        method: 'POST',
      });
    },
    createEventSource: () => {
      if (typeof window === 'undefined' || typeof EventSource === 'undefined') return null;
      const token = getAuthToken();
      if (!token) return null;
      return new EventSource(getApiUrl(`/api/v1/admin/stream?token=${encodeURIComponent(token)}`));
    },
  },
};
