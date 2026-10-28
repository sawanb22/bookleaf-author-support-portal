export type UserRole = 'author' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_initials: string;
  title?: string;
  bank_name?: string;
  account_last4?: string;
}

export type BookStatus = 'Published & Live' | 'In production';

export type ProductionStage =
  | 'Manuscript Received'
  | 'Editing'
  | 'Cover Design'
  | 'Typesetting'
  | 'Proofreading'
  | 'ISBN Assignment'
  | 'Printing'
  | 'Distribution Setup'
  | 'Published & Live';

export interface Book {
  id: string;
  external_id: string; // e.g. "BK001"
  author_id: string;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null; // ISO date string or null if unpublished
  status: BookStatus;
  stage?: ProductionStage | string | null;
  mrp: number | null;
  total_copies_sold: number | null;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  platforms: string[];
}

export type TicketStatus = 'Open' | 'In progress' | 'Resolved' | 'Closed';

export type TicketPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type TicketCategory =
  | 'Royalty & Payments'
  | 'Production & Proofs'
  | 'ISBN & Distribution'
  | 'Author Copies'
  | 'Cover & Design'
  | 'General Inquiry';

export type TicketMessageSenderRole = 'author' | 'support' | 'admin' | 'ai';

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_name: string;
  sender_role: TicketMessageSenderRole;
  body: string;
  created_at: string;
  is_internal_note?: boolean;
  is_official?: boolean;
  disbursement_note?: string;
}

export interface Ticket {
  id: string; // e.g. "BL-1042"
  author_id: string;
  author_name: string;
  author_email: string;
  book_id: string | null;
  book_title: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory | string;
  category_overridden?: boolean;
  priority_overridden?: boolean;
  original_ai_category?: string;
  original_ai_priority?: TicketPriority;
  assignee: string | null;
  assignee_avatar?: string;
  has_unread: boolean;
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
  channel?: 'Portal' | 'Email sync';
  ai_draft?: string | null;
  ai_assist_status?: 'Draft ready' | 'Reviewing' | 'Draft sent' | 'Resolved via AI draft' | null;
  sla_target_hours?: number;
}

export interface AdminMetric {
  total_in_queue: number;
  needs_first_reply: number;
  near_sla_breach_count: number;
  awaiting_author: number;
  ai_draft_ready: number;
  resolved_today: number;
  sla_compliance_rate: number;
}
