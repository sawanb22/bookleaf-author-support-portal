'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Bell, HelpCircle } from 'lucide-react';
import { UserMenu } from './UserMenu';

export function TopNavBar() {
  const pathname = usePathname();

  const isBooksActive = pathname === '/books' || pathname.startsWith('/books/');
  const isTicketsActive =
    pathname.startsWith('/tickets') && pathname !== '/tickets/new';

  return (
    <header className="w-full h-14 bg-surface border-b border-border sticky top-0 z-30">
      <div className="flex justify-between items-center w-full px-4 sm:px-8 max-w-[1040px] mx-auto h-14">
        {/* Left: Wordmark & Desktop Navigation */}
        <div className="flex items-center gap-8 lg:gap-10 h-full">
          <Link
            href="/books"
            className="font-serif text-title-book text-text font-semibold tracking-tight hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
          >
            BookLeaf
          </Link>

          <nav
            aria-label="Author Portal Navigation"
            className="hidden md:flex items-center gap-6 h-full"
          >
            <Link
              href="/books"
              aria-current={isBooksActive ? 'page' : undefined}
              className={`h-full inline-flex items-center border-b-2 font-label text-sm transition duration-150 ease-in-out px-1 pt-4 pb-4 ${
                isBooksActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-text-muted hover:text-text hover:border-border-strong font-medium'
              }`}
            >
              My Books
            </Link>
            <Link
              href="/tickets"
              aria-current={isTicketsActive ? 'page' : undefined}
              className={`h-full inline-flex items-center border-b-2 font-label text-sm transition duration-150 ease-in-out px-1 pt-4 pb-4 ${
                isTicketsActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-text-muted hover:text-text hover:border-border-strong font-medium'
              }`}
            >
              My Tickets
            </Link>
          </nav>
        </div>

        {/* Right: Actions, Utilities & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {pathname !== '/tickets' && (
            <Link
              href="/tickets/new"
              className="hidden md:inline-flex items-center h-9 px-4 rounded-md bg-primary hover:bg-primary-hover active:bg-primary-pressed text-on-primary font-label text-sm font-medium transition duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5 -ml-0.5" aria-hidden="true" />
              <span>New support query</span>
            </Link>
          )}

          {/* Desktop Utilities (Stitch Parity) */}
          <div className="hidden lg:flex items-center border-l border-border pl-2.5 ml-1 gap-1">
            <button
              type="button"
              aria-label="Notifications"
              className="p-2 text-text-muted hover:text-text hover:bg-surface-sunken rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Bell className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Help & Knowledge Base"
              className="p-2 text-text-muted hover:text-text hover:bg-surface-sunken rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
