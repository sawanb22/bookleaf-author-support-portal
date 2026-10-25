'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { HelpCircle, Info, AlertCircle } from 'lucide-react';
import { mockDb } from '@/lib/mock/db';
import { useAuth } from '@/lib/mock/auth-context';
import { apiClient } from '@/lib/api-client';
import { Book } from '@/lib/mock/types';
import { MIN_PAYOUT_INR } from '@/lib/constants';
import { formatINR, formatCount, formatDate } from '@/lib/formatters';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProductionStageBar } from '@/components/author/ProductionStageBar';

export default function MyBooksPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Live API fetch against FastAPI backed by Neon PostgreSQL
      if (typeof window !== 'undefined') {
        try {
          const res = await apiClient.author.getBooks();
          if (res?.books && Array.isArray(res.books)) {
            setBooks(res.books);
            return;
          }
        } catch {
          // Fall through to mockDb on offline/network errors
        }
      }

      // 2. Fallback to mockDb for offline or contract test environments
      const authorId = user?.id || 'AUTH001';
      const authorBooks = mockDb.getBooksByAuthor(authorId);
      setBooks(authorBooks);
    } catch {
      setError('Couldn’t load your books. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateView = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    updateView();
    window.addEventListener('resize', updateView);
    return () => {
      window.removeEventListener('resize', updateView);
    };
  }, []);

  useEffect(() => {
    fetchBooks();
    const unsubscribe = mockDb.subscribe(fetchBooks);
    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  // Aggregate financial metrics
  const totalEarned = books.reduce((sum, b) => sum + (b.total_royalty_earned || 0), 0);
  const totalPaid = books.reduce((sum, b) => sum + (b.royalty_paid || 0), 0);
  const totalPending = books.reduce((sum, b) => sum + (b.royalty_pending || 0), 0);
  const allInProduction = books.length > 0 && books.every((b) => b.status === 'In production');

  return (
    <div className="w-full">
      {/* Editorial Page Title */}
      <div className="mb-8">
        <h1 className="font-title-page text-title-page text-text font-semibold tracking-tight">
          My Books
        </h1>
        <p className="font-body text-body text-text-muted mt-1">
          Overview of published works, ongoing production pipelines, and accumulated royalties.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="mb-8 p-4 bg-danger-tint border-l-[3px] border-l-danger rounded-r-md flex items-center justify-between text-danger"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="font-body text-body font-medium">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchBooks}
            className="px-3 py-1 bg-surface border border-danger/30 text-danger hover:bg-surface-sunken text-caption font-label rounded font-medium transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Summary Band */}
      <section aria-label="Royalties summary" aria-labelledby="royalties-summary" className="mb-10">
        <h2 className="sr-only" id="royalties-summary">
          Royalty Earnings Summary
        </h2>
        {isLoading ? (
          <div className="bg-surface border-y border-border grid grid-cols-1 sm:grid-cols-3 animate-pulse">
            <div className="py-5 px-6 border-b sm:border-b-0 sm:border-r border-border">
              <div className="h-4 w-16 bg-surface-sunken rounded mb-2" />
              <div className="h-8 w-28 bg-surface-sunken rounded" />
            </div>
            <div className="py-5 px-6 border-b sm:border-b-0 sm:border-r border-border">
              <div className="h-4 w-16 bg-surface-sunken rounded mb-2" />
              <div className="h-8 w-28 bg-surface-sunken rounded" />
            </div>
            <div className="py-5 px-6">
              <div className="h-4 w-16 bg-surface-sunken rounded mb-2" />
              <div className="h-8 w-28 bg-surface-sunken rounded" />
            </div>
          </div>
        ) : allInProduction ? (
          <div className="bg-surface border-y border-border py-6 px-6 text-center text-text-muted font-body">
            No royalties yet. They start once a book is published.
          </div>
        ) : (
          <div className="bg-surface border-y border-border grid grid-cols-1 sm:grid-cols-3">
            {/* 1. Earned */}
            <div className="py-5 px-6 border-b sm:border-b-0 sm:border-r border-border flex flex-col justify-between">
              <span className="font-caption text-caption text-text-muted mb-1 block">Earned</span>
              <div className="font-figure-lg text-figure-lg font-medium text-text tabular-nums">
                {formatINR(totalEarned)}
              </div>
            </div>

            {/* 2. Paid */}
            <div className="py-5 px-6 border-b sm:border-b-0 sm:border-r border-border flex flex-col justify-between">
              <span className="font-caption text-caption text-text-muted mb-1 block">Paid</span>
              <div className="font-figure-lg text-figure-lg font-medium text-text tabular-nums">
                {formatINR(totalPaid)}
              </div>
            </div>

            {/* 3. Pending */}
            <div className="py-5 px-6 flex flex-col justify-between bg-surface">
              <span className="font-caption text-caption text-text-muted mb-1 block">Pending</span>
              <div className="font-figure-lg text-figure-lg font-medium text-primary tabular-nums">
                {formatINR(totalPending)}
              </div>
            </div>
          </div>
        )}

        {/* Informative Policy Caption */}
        <p className="font-caption text-caption text-text-muted mt-3">
          Royalties are calculated quarterly and paid within 45 days of the quarter ending. Below ₹1,000 minimum payout threshold amounts roll over to the next quarter.
        </p>
      </section>

      {/* Books Table / Divided List Section */}
      <section aria-label="Published Books and Production Pipeline" className="bg-surface border border-border">
        {isLoading ? (
          <div className="p-6 space-y-6 animate-pulse">
            <div className="h-10 bg-surface-sunken rounded" />
            <div className="h-20 bg-surface-sunken rounded" />
            <div className="h-20 bg-surface-sunken rounded" />
            <div className="h-20 bg-surface-sunken rounded" />
          </div>
        ) : books.length === 0 ? (
          <div className="p-8 py-16 text-center">
            <h3 className="font-title-book text-title-book text-text font-semibold mb-2">No books yet</h3>
            <p className="font-body text-body text-text-muted max-w-md mx-auto">
              Once your manuscript is accepted, your books appear here with their status and royalties.
            </p>
          </div>
        ) : (
          <>
            {/* -------------------------------------------------------------
                Desktop Table View (>= 1024px)
               ------------------------------------------------------------- */}
            {!isMobile && (
              <div className="hidden lg:block">
                {/* Header */}
                <div className="bg-surface-sunken border-b border-border px-6 py-3.5 grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-5 font-label text-[13px] font-medium text-text-muted">Book</div>
                  <div className="col-span-2 font-label text-[13px] font-medium text-text-muted">Status</div>
                  <div className="col-span-1 font-label text-[13px] font-medium text-text-muted text-right">MRP</div>
                  <div className="col-span-1 font-label text-[13px] font-medium text-text-muted text-right">Sold</div>
                  <div className="col-span-1 font-label text-[13px] font-medium text-text-muted text-right">Earned</div>
                  <div className="col-span-1 font-label text-[13px] font-medium text-text-muted text-right">Paid</div>
                  <div className="col-span-1 font-label text-[13px] font-medium text-text-muted text-right">Pending</div>
                </div>

                {/* Rows */}
                {books.map((book) => {
                  const isProduction = book.status === 'In production';
                  const isPaidInFull = book.royalty_pending === 0 && (book.total_royalty_earned > 0 || book.royalty_paid > 0);
                  const isBelowMinimum = book.royalty_pending > 0 && book.royalty_pending < MIN_PAYOUT_INR;

                  return (
                    <article
                      key={book.id}
                      className="border-b border-border last:border-b-0 hover:bg-surface-sunken/40 transition-colors duration-150"
                    >
                      {/* Main Row Grid */}
                      <div className="px-6 pt-5 pb-4 grid grid-cols-12 gap-4 items-start">
                        {/* 1. Book Metadata (Col 1-5) */}
                        <div className="col-span-5 pr-4">
                          <h3 className="font-serif text-title-book text-text font-semibold leading-snug">
                            {book.title}
                          </h3>
                          <div className="font-caption text-caption text-text-muted mt-0.5 flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-text-muted">{book.external_id}</span>
                            <span className="inline-block w-1 h-1 rounded-full bg-border-strong" aria-hidden="true" />
                            <span>{book.genre}</span>
                            <span className="inline-block w-1 h-1 rounded-full bg-border-strong" aria-hidden="true" />
                            <span className="tabular-nums font-mono text-[12px] text-text-subtle whitespace-nowrap">
                              ISBN {book.isbn}
                            </span>
                          </div>
                        </div>

                      {/* 2. Status Badge & Date (Col 6-7) */}
                      <div className="col-span-2">
                        <StatusBadge status={book.status} />
                        <span className="block font-caption text-caption text-text-muted mt-1.5">
                          {isProduction
                            ? 'Not published yet'
                            : book.publication_date
                            ? `Published ${formatDate(book.publication_date)}`
                            : 'Not published yet'}
                        </span>
                      </div>

                      {/* 3. MRP (Col 8) */}
                      <div className="col-span-1 text-right pt-0.5">
                        {isProduction ? (
                          <span className="font-caption text-caption text-text-muted pt-0.5 block">Not set yet</span>
                        ) : (
                          <span className="font-body text-body text-text tabular-nums">{formatINR(book.mrp)}</span>
                        )}
                      </div>

                      {/* 4. Sold (Col 9) */}
                      <div className="col-span-1 text-right pt-0.5">
                        <span className="font-body text-body text-text tabular-nums">
                          {isProduction ? '—' : formatCount(book.total_copies_sold)}
                        </span>
                      </div>

                      {/* 5-7. Royalty Columns (Cols 10-12) */}
                      {isProduction ? (
                        <div className="col-span-3 text-right font-caption text-caption text-text-muted pt-1 italic">
                          Royalties start after publication.
                        </div>
                      ) : (
                        <>
                          {/* Earned (Col 10) */}
                          <div className="col-span-1 text-right font-body text-body text-text tabular-nums pt-0.5">
                            {formatINR(book.total_royalty_earned)}
                          </div>

                          {/* Paid (Col 11) */}
                          <div className="col-span-1 text-right pt-0.5">
                            <div className="font-body text-body text-text tabular-nums">
                              {formatINR(book.royalty_paid)}
                            </div>
                            <div className="font-caption text-[11px] leading-tight text-text-muted mt-1 tabular-nums">
                              {book.last_royalty_payout_date
                                ? `Last payout ${formatDate(book.last_royalty_payout_date)}`
                                : 'No payout yet'}
                            </div>
                          </div>

                          {/* Pending (Col 12) */}
                          <div className="col-span-1 text-right pt-0.5">
                            {isPaidInFull ? (
                              <>
                                <div className="font-body text-body text-text-muted tabular-nums">₹0</div>
                                <div className="font-caption text-[11px] leading-tight text-text-muted mt-1">
                                  Paid in full
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="font-body text-body text-primary font-semibold tabular-nums">
                                  {formatINR(book.royalty_pending)}
                                </div>
                                {isBelowMinimum && (
                                  <div className="font-caption text-[11px] leading-tight text-text-muted mt-1">
                                    Below the ₹1,000 minimum payout threshold. Rolls over to the next quarter.
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* In-Production 9-Segment Bar */}
                    {isProduction && (
                      <div className="px-6 pb-4 pt-1">
                        <ProductionStageBar stage={book.stage} />
                      </div>
                    )}

                    {/* Second Line: Platforms & Query Link */}
                    <div className="px-6 py-2.5 bg-surface-sunken/20 border-t border-border/60 flex items-center justify-between">
                      <p className="font-caption text-caption text-text-muted">
                        {book.platforms && book.platforms.length > 0
                          ? `Available on ${book.platforms.join(', ')}.${book.print_partner ? ` ${book.print_partner}` : ''}`
                          : 'Not listed on any platform yet.'}
                      </p>
                      <Link
                        href={`/tickets/new?book=${book.external_id}`}
                        aria-label={`Raise a query about ${book.title}`}
                        className="font-label text-caption text-text-muted hover:text-primary inline-flex items-center gap-1 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1"
                      >
                        <HelpCircle className="w-4 h-4" />
                        Raise a query
                      </Link>
                    </div>
                  </article>
                );
              })}
              </div>
            )}

            {/* -------------------------------------------------------------
                Responsive Stacked Cards (< 1024px)
               ------------------------------------------------------------- */}
            {isMobile && (
              <div className="block lg:hidden divide-y divide-border">
                {books.map((book) => {
                  const isProduction = book.status === 'In production';
                  const isPaidInFull = book.royalty_pending === 0 && (book.total_royalty_earned > 0 || book.royalty_paid > 0);
                  const isBelowMinimum = book.royalty_pending > 0 && book.royalty_pending < MIN_PAYOUT_INR;

                  return (
                    <article key={book.id} className="p-4 sm:p-6 space-y-4">
                      {/* Header: Title and Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h3 className="font-serif text-title-book text-text font-semibold">
                          {book.title}
                        </h3>
                        <div>
                          <StatusBadge status={book.status} />
                        </div>
                      </div>

                      {/* Genre & ISBN */}
                      <div className="font-caption text-caption text-text-muted flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-text-muted">{book.external_id}</span>
                        <span className="inline-block w-1 h-1 rounded-full bg-border-strong" aria-hidden="true" />
                        <span>{book.genre}</span>
                        <span className="inline-block w-1 h-1 rounded-full bg-border-strong" aria-hidden="true" />
                        <span className="tabular-nums font-mono text-[12px] text-text-subtle">
                          ISBN {book.isbn}
                        </span>
                      </div>

                    {/* Operational Details */}
                    {isProduction ? (
                      <div className="space-y-4">
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-caption">
                          <div>
                            <dt className="text-text-muted">MRP</dt>
                            <dd className="font-medium text-text mt-0.5">Not set yet</dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">Sold</dt>
                            <dd className="font-medium text-text mt-0.5">—</dd>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <dt className="text-text-muted">Publication</dt>
                            <dd className="font-medium text-text mt-0.5">Not published yet</dd>
                          </div>
                        </dl>

                        {/* 9-Segment Progress Line */}
                        <ProductionStageBar stage={book.stage} />

                        <div className="p-3 bg-surface-sunken rounded border border-border text-caption text-text-muted italic">
                          Royalties start after publication.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* 3-Column Definition List (Collapsing to 2 columns on mobile < 640px) */}
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-caption">
                          <div>
                            <dt className="text-text-muted">MRP</dt>
                            <dd className="font-medium text-text mt-0.5 tabular-nums">{formatINR(book.mrp)}</dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">Sold</dt>
                            <dd className="font-medium text-text mt-0.5 tabular-nums">{formatCount(book.total_copies_sold)}</dd>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <dt className="text-text-muted">Published</dt>
                            <dd className="font-medium text-text mt-0.5">
                              {book.publication_date ? formatDate(book.publication_date) : 'Not published yet'}
                            </dd>
                          </div>
                        </dl>

                        {/* Sunken Royalty Totals Block */}
                        <div className="bg-surface-sunken p-3.5 rounded border border-border">
                          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                              <dt className="font-caption text-caption text-text-muted">Earned</dt>
                              <dd className="font-figure text-figure font-medium text-text tabular-nums mt-0.5">
                                {formatINR(book.total_royalty_earned)}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-caption text-caption text-text-muted">Paid</dt>
                              <dd className="font-figure text-figure font-medium text-text tabular-nums mt-0.5">
                                {formatINR(book.royalty_paid)}
                              </dd>
                              <span className="block font-caption text-[11px] text-text-muted mt-0.5">
                                {book.last_royalty_payout_date
                                  ? `Last payout ${formatDate(book.last_royalty_payout_date)}`
                                  : 'No payout yet'}
                              </span>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <dt className="font-caption text-caption text-text-muted">Pending</dt>
                              {isPaidInFull ? (
                                <>
                                  <dd className="font-figure text-figure font-medium text-text-muted tabular-nums mt-0.5">
                                    ₹0
                                  </dd>
                                  <span className="block font-caption text-[11px] text-text-muted mt-0.5">
                                    Paid in full
                                  </span>
                                </>
                              ) : (
                                <>
                                  <dd className="font-figure text-figure font-semibold text-primary tabular-nums mt-0.5">
                                    {formatINR(book.royalty_pending)}
                                  </dd>
                                  {isBelowMinimum && (
                                    <span className="block font-caption text-[11px] text-text-muted mt-0.5">
                                      Below the ₹1,000 minimum payout threshold. Rolls over to the next quarter.
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </dl>
                        </div>
                      </div>
                    )}

                    {/* Platforms & Action Footer */}
                    <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="font-caption text-caption text-text-muted">
                        {book.platforms && book.platforms.length > 0
                          ? `Available on ${book.platforms.join(', ')}.${book.print_partner ? ` ${book.print_partner}` : ''}`
                          : 'Not listed on any platform yet.'}
                      </p>
                      <Link
                        href={`/tickets/new?book=${book.external_id}`}
                        aria-label={`Raise a query about ${book.title}`}
                        className="font-label text-caption text-text-muted hover:text-primary inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto py-1"
                      >
                        <HelpCircle className="w-4 h-4" />
                        Raise a query
                      </Link>
                    </div>
                  </article>
                );
              })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Support Assistance Anchor Strip */}
      <aside className="mt-8 p-4 bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Info className="w-5 h-5 text-text-muted shrink-0" />
          <p className="font-body text-body text-text-muted">
            Need to update your ISBN details, retail distribution channels, or bank payout account?
          </p>
        </div>
        <Link
          href="/tickets/new?category=General%20Inquiry"
          className="font-label text-caption font-semibold text-primary hover:text-primary-hover underline underline-offset-4 decoration-border transition-colors shrink-0"
        >
          Contact Author Operations
        </Link>
      </aside>
    </div>
  );
}
