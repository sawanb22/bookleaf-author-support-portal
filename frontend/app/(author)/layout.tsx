'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/mock/auth-context';
import { TopNavBar } from '@/components/author/TopNavBar';
import { MobileTabBar } from '@/components/author/MobileTabBar';

export default function AuthorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (user?.role === 'admin') {
      router.replace('/admin/tickets');
    }
  }, [user, isAuthenticated, isLoading, router, pathname]);

  if (isLoading || !isAuthenticated || user?.role !== 'author') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page text-text-muted">
        <div className="flex items-center gap-2 font-body text-body">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Verifying author authorization...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-page text-text selection:bg-primary-tint selection:text-primary">
      {/* 56px Top Bar */}
      <TopNavBar />

      {/* Main Reading Container (Max Width 1040px) */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 w-full max-w-[1040px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-24 md:pb-16 focus:outline-none"
      >
        {children}
      </main>

      {/* Colophon Footer */}
      <footer className="w-full border-t border-border bg-surface py-6 mt-auto mb-14 md:mb-0">
        <div className="w-full max-w-[1040px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-text-muted font-caption text-caption">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1">
            <span>© 2025 BookLeaf Publishing Services Pvt. Ltd.</span>
            <span
              className="hidden sm:inline-block w-1 h-1 rounded-full bg-border-strong"
              aria-hidden="true"
            />
            <Link
              href="/books"
              className="hover:text-text transition-colors"
            >
              Author Terms &amp; Royalty Policy
            </Link>
            <span
              className="hidden sm:inline-block w-1 h-1 rounded-full bg-border-strong"
              aria-hidden="true"
            />
            <Link
              href="/tickets"
              className="hover:text-text transition-colors"
            >
              Help Desk SLA
            </Link>
          </div>
          <div className="tabular-nums text-[12px] text-text-subtle font-mono">
            BookLeaf Console v4.8.2
          </div>
        </div>
      </footer>

      {/* Fixed Bottom Tab Bar on Mobile (< 768px) */}
      <MobileTabBar />
    </div>
  );
}
