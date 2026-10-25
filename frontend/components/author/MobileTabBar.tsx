'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, PlusCircle, Ticket } from 'lucide-react';

export function MobileTabBar() {
  const pathname = usePathname();

  const isBooksActive = pathname === '/books' || pathname.startsWith('/books/');
  const isNewQueryActive = pathname === '/tickets/new';
  const isTicketsActive =
    pathname.startsWith('/tickets') && pathname !== '/tickets/new';

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border shadow-[0_-2px_10px_rgba(24,33,29,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="h-14 grid grid-cols-3 items-center max-w-md mx-auto px-2">
        {/* 1. My Books */}
        <Link
          href="/books"
          aria-current={isBooksActive ? 'page' : undefined}
          className={`min-h-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
            isBooksActive
              ? 'text-primary font-semibold'
              : 'text-text-muted hover:text-text font-normal'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span className="text-[11px] leading-tight">My Books</span>
        </Link>

        {/* 2. New query */}
        <Link
          href="/tickets/new"
          aria-current={isNewQueryActive ? 'page' : undefined}
          className={`min-h-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
            isNewQueryActive
              ? 'text-primary font-semibold'
              : 'text-text-muted hover:text-text font-normal'
          }`}
        >
          <PlusCircle className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span className="text-[11px] leading-tight">New query</span>
        </Link>

        {/* 3. My Tickets */}
        <Link
          href="/tickets"
          aria-current={isTicketsActive ? 'page' : undefined}
          className={`min-h-[48px] flex flex-col items-center justify-center py-1 px-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
            isTicketsActive
              ? 'text-primary font-semibold'
              : 'text-text-muted hover:text-text font-normal'
          }`}
        >
          <Ticket className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span className="text-[11px] leading-tight">My Tickets</span>
        </Link>
      </div>
    </nav>
  );
}
