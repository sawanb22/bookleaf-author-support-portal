'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  ChevronDown,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { mockDb } from '@/lib/mock/db';
import { useAuth } from '@/lib/mock/auth-context';
import { Book, Ticket } from '@/lib/mock/types';
import { formatINR, formatDate } from '@/lib/formatters';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { AttachmentDropzone, AttachmentFile } from '@/components/shared/AttachmentDropzone';
import { apiClient } from '@/lib/api-client';

const STORAGE_KEY_DRAFT = 'draft:new-ticket';

interface FieldErrors {
  book?: string;
  subject?: string;
  description?: string;
}

interface ErrorSummaryItem {
  fieldId: string;
  message: string;
}

function determineCategory(
  book: Book | undefined,
  subject: string,
  description: string
): string {
  const combined = `${subject} ${description}`.toLowerCase();
  if (
    combined.includes('royalty') ||
    combined.includes('payment') ||
    combined.includes('payout') ||
    combined.includes('bank') ||
    combined.includes('money')
  ) {
    return 'Royalty & Payments';
  }
  if (
    combined.includes('cover') ||
    combined.includes('design') ||
    combined.includes('illustration') ||
    combined.includes('artwork')
  ) {
    return 'Cover & Design';
  }
  if (
    combined.includes('proof') ||
    combined.includes('typeset') ||
    combined.includes('print') ||
    combined.includes('emboss') ||
    combined.includes('foil')
  ) {
    return 'Production & Proofs';
  }
  if (
    combined.includes('author copy') ||
    combined.includes('author copies') ||
    combined.includes('order copies')
  ) {
    return 'Author Copies';
  }
  if (
    combined.includes('isbn') ||
    combined.includes('distribution') ||
    combined.includes('amazon') ||
    combined.includes('flipkart') ||
    combined.includes('retail')
  ) {
    return 'ISBN & Distribution';
  }
  if (book && book.status === 'In production') {
    return 'Production & Proofs';
  }
  return 'General Inquiry';
}

function NewTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookParam = searchParams.get('book');

  const { user } = useAuth();
  const authorId = user?.id || 'AUTH001';

  // State
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [historicalTickets, setHistoricalTickets] = useState<Ticket[]>([]);

  // Validation & UI State
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string>('');
  const hasRestoredDraftRef = useRef<boolean>(false);

  // Generate unique idempotency key once per page lifecycle
  useEffect(() => {
    idempotencyKeyRef.current = `ticket_create_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }, []);

  // 1. Load Author's Books & Historical Tickets from FastAPI backend
  const refreshDbData = async () => {
    try {
      if (typeof window !== 'undefined') {
        try {
          const [booksRes, ticketsRes] = await Promise.all([
            apiClient.author.getBooks().catch(() => null),
            apiClient.author.getTickets().catch(() => null),
          ]);
          if (booksRes?.books && Array.isArray(booksRes.books)) {
            setBooks(booksRes.books);
          } else {
            setBooks(mockDb.getBooksByAuthor(authorId));
          }
          if (ticketsRes?.tickets && Array.isArray(ticketsRes.tickets)) {
            setHistoricalTickets(ticketsRes.tickets);
          } else {
            setHistoricalTickets(mockDb.getTickets({ authorId }));
          }
          return;
        } catch {}
      }

      const authorBooks = mockDb.getBooksByAuthor(authorId);
      setBooks(authorBooks);
      const allAuthorTickets = mockDb.getTickets({ authorId });
      setHistoricalTickets(allAuthorTickets);
    } catch (err) {
      console.warn('Failed to load database records:', err);
    }
  };

  useEffect(() => {
    refreshDbData();
    const unsubscribe = mockDb.subscribe(refreshDbData);
    return () => unsubscribe();
  }, [authorId]);

  // 2. Sort Author's Books Alphabetically A to Z by Title
  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    );
  }, [books]);

  // Find currently selected book object
  const selectedBook = useMemo(() => {
    if (!bookId || bookId === 'general') return undefined;
    return books.find(
      (b) =>
        b.external_id.toLowerCase() === bookId.toLowerCase() ||
        b.id.toLowerCase() === bookId.toLowerCase()
    );
  }, [books, bookId]);

  // 3. Draft Restoration (Runs once on client mount)
  useEffect(() => {
    if (hasRestoredDraftRef.current) return;
    hasRestoredDraftRef.current = true;

    try {
      let restoredBookId = '';
      let restoredSubject = '';
      let restoredDescription = '';

      const storedDraft = localStorage.getItem(STORAGE_KEY_DRAFT);
      if (storedDraft) {
        const parsed = JSON.parse(storedDraft);
        if (parsed.bookId) restoredBookId = parsed.bookId;
        if (parsed.subject) restoredSubject = parsed.subject;
        if (parsed.description) restoredDescription = parsed.description;
      }

      if (restoredBookId) setBookId(restoredBookId);
      if (restoredSubject) setSubject(restoredSubject);
      if (restoredDescription) setDescription(restoredDescription);
    } catch (err) {
      console.warn('Failed to parse localStorage ticket draft:', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // 3b. URL Preselection (?book=<id> takes precedence over draft)
  useEffect(() => {
    if (!bookParam) return;
    if (bookParam.toLowerCase() === 'general') {
      setBookId('general');
      return;
    }
    const matched = books.find(
      (b) =>
        b.external_id.toLowerCase() === bookParam.toLowerCase() ||
        b.id.toLowerCase() === bookParam.toLowerCase()
    );
    if (matched) {
      setBookId(matched.external_id);
    } else {
      setBookId(bookParam);
    }
  }, [bookParam, books]);

  // 4. LocalStorage Draft Preservation (Auto-save on changes)
  useEffect(() => {
    if (!isHydrated || !hasRestoredDraftRef.current) return;
    try {
      if (!bookId && !subject.trim() && !description.trim()) {
        localStorage.removeItem(STORAGE_KEY_DRAFT);
      } else {
        localStorage.setItem(
          STORAGE_KEY_DRAFT,
          JSON.stringify({
            bookId,
            subject,
            description,
          })
        );
      }
    } catch (err) {
      console.warn('Failed to persist ticket draft to localStorage:', err);
    }
  }, [bookId, subject, description, isHydrated]);

  // 5. Auto-grow Textarea (Min 128px)
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    const nextHeight = Math.max(128, node.scrollHeight);
    node.style.height = `${nextHeight}px`;
  }, [description]);

  // 6. Validation Logic
  const validate = (): FieldErrors => {
    const newErrors: FieldErrors = {};

    // Book validation: required
    if (!bookId) {
      newErrors.book = 'Choose a book, or General / account level.';
    }

    // Subject validation: 5 to 120 chars
    const trimmedSubject = subject.trim();
    if (!trimmedSubject || trimmedSubject.length < 5) {
      newErrors.subject = 'Add a short subject so we can route your query.';
    } else if (subject.length > 120) {
      newErrors.subject = 'Subject must be 120 characters or fewer.';
    }

    // Description validation: 20 to 3000 chars
    const trimmedDesc = description.trim();
    if (!trimmedDesc || trimmedDesc.length < 20) {
      newErrors.description =
        'Describe the issue in at least 20 characters so we can help faster.';
    } else if (description.length > 3000) {
      newErrors.description = 'Description must be 3000 characters or fewer.';
    }

    return newErrors;
  };

  const handleBookBlur = () => {
    setTouched((prev) => ({ ...prev, book: true }));
    if (!bookId) {
      setErrors((prev) => ({
        ...prev,
        book: 'Choose a book, or General / account level.',
      }));
    } else {
      setErrors((prev) => ({ ...prev, book: undefined }));
    }
  };

  const handleSubjectBlur = () => {
    setTouched((prev) => ({ ...prev, subject: true }));
    const trimmed = subject.trim();
    if (!trimmed || trimmed.length < 5) {
      setErrors((prev) => ({
        ...prev,
        subject: 'Add a short subject so we can route your query.',
      }));
    } else if (subject.length > 120) {
      setErrors((prev) => ({
        ...prev,
        subject: 'Subject must be 120 characters or fewer.',
      }));
    } else {
      setErrors((prev) => ({ ...prev, subject: undefined }));
    }
  };

  const handleDescriptionBlur = () => {
    setTouched((prev) => ({ ...prev, description: true }));
    const trimmed = description.trim();
    if (!trimmed || trimmed.length < 20) {
      setErrors((prev) => ({
        ...prev,
        description:
          'Describe the issue in at least 20 characters so we can help faster.',
      }));
    } else if (description.length > 3000) {
      setErrors((prev) => ({
        ...prev,
        description: 'Description must be 3000 characters or fewer.',
      }));
    } else {
      setErrors((prev) => ({ ...prev, description: undefined }));
    }
  };

  // 7. Form Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validate();
    setErrors(validationErrors);
    setTouched({ book: true, subject: true, description: true });

    if (Object.keys(validationErrors).length > 0) {
      setTimeout(() => {
        errorSummaryRef.current?.focus();
      }, 50);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const targetBookId =
        bookId === 'general' ? null : selectedBook?.external_id || bookId;

      let createdTicket: Ticket | null = null;

      // Live ticket submission to FastAPI backend backed by Neon PostgreSQL
      if (typeof window !== 'undefined') {
        try {
          const res = await apiClient.author.createTicket({
            book_id: targetBookId,
            subject: subject.trim(),
            description: description.trim(),
          });
          if (res && res.id) {
            createdTicket = res;
          }
        } catch (apiErr: any) {
          console.error('API submission failed:', apiErr);
          const errorMsg =
            apiErr?.detail?.message ||
            apiErr?.message ||
            'Failed to submit ticket to BookLeaf server. Please check your credentials and try again.';
          setSubmitError(errorMsg);
          setIsSubmitting(false);
          return;
        }
      }

      if (!createdTicket) {
        setSubmitError('Failed to submit ticket to BookLeaf server. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Ensure initial message is present on the ticket object for immediate thread display
      if (!createdTicket.messages || createdTicket.messages.length === 0) {
        createdTicket.messages = [
          {
            id: `msg_${createdTicket.id}_1`,
            ticket_id: createdTicket.id,
            sender_name: user?.name || 'Author',
            sender_role: 'author',
            body: description.trim(),
            created_at: new Date().toISOString(),
          },
        ];
      }

      // Keep mockDb cache in sync with the real server ticket ID
      mockDb.upsertTicket(createdTicket);

      try {
        localStorage.removeItem(STORAGE_KEY_DRAFT);
      } catch {}

      router.push(`/tickets/${createdTicket.id}?sent=1`);
    } catch {
      setSubmitError(
        'Your query wasn’t sent. Your text is still here. Try again.'
      );
      setIsSubmitting(false);
    }
  };

  // 8. Cancel & Discard Dialog Handlers
  const handleCancelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const isDirty =
      (bookId && bookId !== 'general') ||
      subject.trim().length > 0 ||
      description.trim().length > 0;

    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      router.push('/tickets');
    }
  };

  const handleConfirmDiscard = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_DRAFT);
    } catch {}
    setShowDiscardModal(false);
    router.push('/tickets');
  };

  // 9. Historical Tickets for Chosen Context
  const relevantInquiries = useMemo(() => {
    if (!bookId) return [];
    if (bookId === 'general') {
      return historicalTickets.filter(
        (t) => !t.book_id || t.category === 'General Inquiry'
      );
    }
    return historicalTickets.filter(
      (t) =>
        t.book_id?.toLowerCase() === bookId.toLowerCase() ||
        (selectedBook &&
          (t.book_id?.toLowerCase() === selectedBook.external_id.toLowerCase() ||
            t.book_title?.toLowerCase() === selectedBook.title.toLowerCase()))
    );
  }, [historicalTickets, bookId, selectedBook]);

  // Top Error Summary List
  const errorSummaryList: ErrorSummaryItem[] = useMemo(() => {
    const list: ErrorSummaryItem[] = [];
    if (errors.book) {
      list.push({ fieldId: 'book-select', message: errors.book });
    }
    if (errors.subject) {
      list.push({ fieldId: 'ticket-subject', message: errors.subject });
    }
    if (errors.description) {
      list.push({ fieldId: 'ticket-description', message: errors.description });
    }
    return list;
  }, [errors]);

  return (
    <div className="w-full max-w-[640px]">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center space-x-2 text-caption text-text-muted mb-4 font-caption"
      >
        <Link href="/books" className="hover:text-primary transition-colors">
          Support
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
        <Link href="/tickets" className="hover:text-primary transition-colors">
          My Tickets
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
        <span className="text-text font-medium" aria-current="page">
          New query
        </span>
      </nav>

      <div className="mb-3">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-primary transition-colors font-medium"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back to My Tickets</span>
        </Link>
      </div>

      {/* Page Heading & Editorial Introduction */}
      <div className="mb-8">
        <h1 className="font-title-page text-title-page text-text font-semibold tracking-tight">
          Submit a Support Query
        </h1>
        <p className="font-body text-body text-text-muted mt-2">
          Tell us what’s happening. A member of our team will reply here.
        </p>
      </div>

      {/* Top Error Summary Banner (Spec §3.3 & §5.3) */}
      {errorSummaryList.length > 0 && (
        <div
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
          aria-labelledby="error-summary-heading"
          className="mb-6 p-4 bg-danger-tint border-l-[3px] border-l-danger rounded-r-md text-danger focus:outline-none"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2
                id="error-summary-heading"
                className="font-label text-label font-semibold"
              >
                There was a problem with your submission
              </h2>
              <ul className="mt-2 list-disc list-inside space-y-1 text-caption font-body">
                {errorSummaryList.map((err, i) => (
                  <li key={i}>
                    <a
                      href={`#${err.fieldId}`}
                      className="underline underline-offset-2 hover:opacity-80"
                    >
                      {err.message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Server/Network Error Banner */}
      {submitError && (
        <div
          role="alert"
          className="mb-6 p-4 bg-danger-tint border-l-[3px] border-l-danger rounded-r-md flex items-center justify-between text-danger"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
            <p className="font-body text-body font-medium">{submitError}</p>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-3 py-1 bg-surface border border-danger/30 text-danger hover:bg-surface-sunken text-caption font-label rounded font-medium transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Main Support Query Form Card */}
      <div className="bg-surface border border-border rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Field 1: Book Selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="book-select"
              className="block font-label text-label text-text font-medium"
            >
              Which book is this about?
            </label>
            <div className="relative">
              <select
                id="book-select"
                name="book"
                value={bookId}
                onChange={(e) => {
                  setBookId(e.target.value);
                  if (errors.book) {
                    setErrors((prev) => ({ ...prev, book: undefined }));
                  }
                }}
                onBlur={handleBookBlur}
                className={`w-full h-10 px-3 pr-10 bg-surface border ${
                  errors.book && touched.book
                    ? 'border-danger focus:border-danger'
                    : 'border-border hover:border-border-strong focus:border-primary'
                } rounded-xl font-body text-body text-text appearance-none cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
                aria-invalid={!!(errors.book && touched.book)}
                aria-describedby={
                  errors.book && touched.book
                    ? 'book-error'
                    : selectedBook
                    ? 'book-context-pill'
                    : undefined
                }
              >
                <option value="" disabled>
                  Choose a book, or General / account level
                </option>
                <option value="general">General / account level</option>
                {sortedBooks.map((b) => (
                  <option key={b.external_id} value={b.external_id}>
                    {b.title}
                    {b.status === 'In production' ? ' (In production)' : ''}
                  </option>
                ))}
              </select>
              <div
                className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text-muted"
                aria-hidden="true"
              >
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>

            {/* Book Selector Error */}
            {errors.book && touched.book && (
              <p
                id="book-error"
                className="flex items-center gap-1.5 text-caption text-danger pt-0.5"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errors.book}</span>
              </p>
            )}

            {/* Context Awareness Pill & Status */}
            {selectedBook && (
              <div
                id="book-context-pill"
                className="pt-1 flex items-center space-x-2"
              >
                <StatusBadge
                  status={selectedBook.status}
                  stage={selectedBook.stage}
                />
                <span className="font-caption text-caption text-text-muted tabular-nums">
                  •{' '}
                  {selectedBook.status === 'In production'
                    ? 'Royalties start after publication.'
                    : `${formatINR(selectedBook.royalty_pending)} royalty pending.`}
                </span>
              </div>
            )}
          </div>

          {/* Field 2: Subject Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label
                htmlFor="ticket-subject"
                className="block font-label text-label text-text font-medium"
              >
                Subject
              </label>
              {subject.length >= 96 && (
                <span
                  id="subject-counter"
                  aria-live="polite"
                  className={`font-caption text-caption tabular-nums ${
                    subject.length > 120
                      ? 'text-danger font-medium'
                      : 'text-text-muted'
                  }`}
                >
                  {subject.length} / 120
                </span>
              )}
            </div>
            <div>
              <input
                id="ticket-subject"
                name="subject"
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (errors.subject && e.target.value.trim().length >= 5) {
                    setErrors((prev) => ({ ...prev, subject: undefined }));
                  }
                }}
                onBlur={handleSubjectBlur}
                placeholder="Royalty for Q3 not received"
                className={`w-full h-10 px-3 bg-surface border ${
                  errors.subject && touched.subject
                    ? 'border-danger focus:border-danger'
                    : 'border-border hover:border-border-strong focus:border-primary'
                } rounded-xl font-body text-body text-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
                aria-invalid={!!(errors.subject && touched.subject)}
                aria-describedby={
                  errors.subject && touched.subject
                    ? 'subject-error'
                    : 'subject-caption'
                }
              />
            </div>
            {errors.subject && touched.subject ? (
              <p
                id="subject-error"
                className="flex items-center gap-1.5 text-caption text-danger"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errors.subject}</span>
              </p>
            ) : (
              <p
                id="subject-caption"
                className="font-caption text-caption text-text-muted"
              >
                A short summary, for example: Royalty for Q3 not received.
              </p>
            )}
          </div>

          {/* Field 3: Description Textarea */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label
                htmlFor="ticket-description"
                className="block font-label text-label text-text font-medium"
              >
                Description
              </label>
              {description.length >= 2400 && (
                <span
                  id="desc-counter"
                  aria-live="polite"
                  className={`font-caption text-caption tabular-nums ${
                    description.length > 3000
                      ? 'text-danger font-medium'
                      : 'text-text-muted'
                  }`}
                >
                  {description.length} / 3000
                </span>
              )}
            </div>
            <div>
              <textarea
                ref={textareaRef}
                id="ticket-description"
                name="description"
                rows={5}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description && e.target.value.trim().length >= 20) {
                    setErrors((prev) => ({ ...prev, description: undefined }));
                  }
                }}
                onBlur={handleDescriptionBlur}
                placeholder="Include dates, amounts and anything else that helps us check this."
                className={`w-full min-h-[128px] p-3 bg-surface border ${
                  errors.description && touched.description
                    ? 'border-danger focus:border-danger'
                    : 'border-border hover:border-border-strong focus:border-primary'
                } rounded-xl font-body text-body text-text resize-y leading-relaxed transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
                aria-invalid={!!(errors.description && touched.description)}
                aria-describedby={
                  errors.description && touched.description
                    ? 'desc-error'
                    : 'desc-caption'
                }
              />
            </div>
            {errors.description && touched.description ? (
              <p
                id="desc-error"
                className="flex items-center gap-1.5 text-caption text-danger"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errors.description}</span>
              </p>
            ) : (
              <p
                id="desc-caption"
                className="font-caption text-caption text-text-muted"
              >
                Include dates, amounts and anything else that helps us check this.
              </p>
            )}
          </div>

          {/* Field 4: Attachments Dropzone (Optional) */}
          <AttachmentDropzone files={files} onFilesChange={setFiles} />

          {/* Divider */}
          <div className="h-px bg-border my-6" aria-hidden="true" />

          {/* Action Buttons Bar */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-4">
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-on-primary font-label text-label rounded-xl hover:bg-primary-hover active:bg-primary-pressed transition-colors shadow-none disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      className="w-4 h-4 mr-2 animate-spin shrink-0"
                      aria-hidden="true"
                    />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Send query</span>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelClick}
                className="font-label text-label text-text-muted hover:text-text px-3 py-2 rounded-xl transition-colors hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Editorial Reassurance Callout Box */}
      <div className="mt-6 border-l-2 border-primary bg-primary-tint/40 p-4 rounded-r-xl">
        <div className="flex items-start space-x-3">
          <Clock
            className="w-5 h-5 text-primary mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <p className="font-body text-body text-text-muted leading-relaxed">
            Responses from BookLeaf publishing coordinators typically take 12 to
            24 business hours. We aim to reply within 48 hours.
          </p>
        </div>
      </div>

      {/* Manuscript Historical Queries List */}
      <div className="mt-10 pt-6 border-t border-border">
        <h2 className="font-title-section text-title-section text-text font-semibold mb-3">
          {selectedBook
            ? 'Previous inquiries for this manuscript'
            : 'Previous inquiries'}
        </h2>
        {relevantInquiries.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-4 text-caption text-text-muted">
            {selectedBook
              ? 'No previous inquiries for this manuscript.'
              : 'No previous inquiries found.'}
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl divide-y divide-border">
            {relevantInquiries.map((ticket) => (
              <div
                key={ticket.id}
                className="p-3.5 flex items-center justify-between hover:bg-surface-sunken/50 transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <StatusBadge status={ticket.status} />
                  <div className="min-w-0">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="font-label text-label text-text hover:text-primary font-medium block truncate"
                    >
                      {ticket.subject}
                    </Link>
                    <span className="font-caption text-caption text-text-muted block">
                      Ticket #{ticket.id} •{' '}
                      {ticket.status === 'Closed'
                        ? `Closed ${formatDate(ticket.updated_at)}`
                        : `Updated ${formatDate(ticket.updated_at)}`}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="text-text-muted hover:text-primary p-1 shrink-0"
                  aria-label={`View ticket ${ticket.id}`}
                >
                  <ChevronRight className="w-[18px] h-[18px]" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discard Query Confirmation Dialog (Spec §5.3) */}
      {showDiscardModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <div className="w-full max-w-[440px] bg-surface rounded-lg p-6 shadow-overlay border border-border space-y-4">
            <h3
              id="discard-dialog-title"
              className="font-title-section text-title-section text-text font-semibold"
            >
              Discard this query?
            </h3>
            <p className="font-body text-body text-text-muted">
              You have unsaved changes in your support query. If you discard now,
              your text will be permanently cleared.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="px-4 py-2 border border-border hover:bg-surface-sunken text-text font-label text-label rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-4 py-2 bg-danger hover:opacity-90 text-on-primary font-label text-label rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
              >
                Discard query
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewTicketPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[640px] space-y-6 animate-pulse">
          <div className="h-4 w-40 bg-surface-sunken rounded" />
          <div className="h-8 w-72 bg-surface-sunken rounded" />
          <div className="h-96 bg-surface border border-border rounded-xl" />
        </div>
      }
    >
      <NewTicketForm />
    </Suspense>
  );
}
