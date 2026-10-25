'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/mock/auth-context';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout, switchDemoAccount } = useAuth();

  // Route guard: strictly require authenticated admin session
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (user?.role !== 'admin') {
      router.replace('/books');
    }
  }, [user, isAuthenticated, isLoading, router, pathname]);

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  if (isLoading || !isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page text-text-muted">
        <div className="flex items-center gap-2 font-body text-body">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Verifying admin authorization...</span>
        </div>
      </div>
    );
  }

  const isQueueActive = pathname.startsWith('/admin/tickets');
  const isInsightsActive = pathname === '/admin/insights';
  const isPublishingActive = pathname === '/admin/authors' || pathname === '/admin/publishing';

  const adminName = user?.name || 'Rahul';
  const adminTitle = user?.title || 'Operations Lead';

  return (
    <div className="min-h-screen flex flex-col bg-page text-text selection:bg-primary-tint selection:text-primary">
      {/* Accessible Skip Link */}
      <a
        href="#main-admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-md focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to administrative content
      </a>

      {/* 56px Dark Top Bar (#18211D / color-text) */}
      <header className="bg-text text-surface h-14 w-full border-b border-[#2A3730] shrink-0 sticky top-0 z-40">
        <div className="max-w-[1320px] mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Left: Wordmark & Admin Badge & Nav Links */}
          <div className="flex items-center space-x-6 sm:space-x-8 h-full">
            <div className="flex items-center space-x-2.5">
              <Link
                href="/admin/tickets"
                className="font-serif text-title-book text-surface font-semibold tracking-tight hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-white/40 rounded transition-colors"
              >
                BookLeaf
              </Link>
              <span className="bg-[#2A3730] text-[#A3B899] text-[11px] font-semibold px-2 py-0.5 rounded font-label uppercase tracking-wider border border-[#3E5046]/40">
                Admin
              </span>
            </div>

            <nav
              aria-label="Admin Navigation"
              className="hidden md:flex items-center space-x-6 font-label text-sm h-14"
            >
              <Link
                href="/admin/tickets"
                aria-current={isQueueActive ? 'page' : undefined}
                className={`h-14 flex items-center border-b-2 font-medium transition duration-150 px-1 pt-0.5 ${
                  isQueueActive
                    ? 'border-surface text-surface font-semibold'
                    : 'border-transparent text-surface/70 hover:text-surface'
                }`}
              >
                Queue
              </Link>
              <Link
                href="/admin/insights"
                aria-current={isInsightsActive ? 'page' : undefined}
                className={`h-14 flex items-center border-b-2 font-medium transition duration-150 px-1 pt-0.5 ${
                  isInsightsActive
                    ? 'border-surface text-surface font-semibold'
                    : 'border-transparent text-surface/70 hover:text-surface'
                }`}
              >
                Insights
              </Link>
              <Link
                href="/admin/authors"
                aria-current={isPublishingActive ? 'page' : undefined}
                className={`h-14 flex items-center border-b-2 font-medium transition duration-150 px-1 pt-0.5 ${
                  isPublishingActive
                    ? 'border-surface text-surface font-semibold'
                    : 'border-transparent text-surface/70 hover:text-surface'
                }`}
              >
                Publishing Desk
              </Link>
            </nav>
          </div>

          {/* Right: Live Console Indicator & User Avatar / Sign Out */}
          <div className="flex items-center space-x-4 sm:space-x-5">
            {/* Console online green pulse indicator */}
            <div
              className="flex items-center space-x-2 text-surface/80 text-caption font-caption"
              title="Real-time WebSocket & polling bridge connected"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="hidden sm:inline text-surface/70 text-xs">Console Online</span>
            </div>

            <div className="h-4 w-px bg-white/10 hidden sm:block" aria-hidden="true" />

            {/* Admin User Badge */}
            <div className="flex items-center space-x-3">
              <div className="flex flex-col text-left">
                <span className="font-label text-xs font-semibold text-surface leading-tight">
                  {adminName}
                </span>
                <span className="font-caption text-[11px] text-surface/60 leading-none">
                  {adminTitle}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-surface/60 hover:text-surface ml-1 p-1.5 rounded hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                title="Sign out of Admin Console"
                aria-label="Sign out of Admin Console"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Admin Canvas (max-w-[1320px]) */}
      <main
        id="main-admin-content"
        tabIndex={-1}
        className="flex-1 w-full max-w-[1320px] mx-auto px-4 md:px-6 lg:px-8 py-6 sm:py-8 focus:outline-none"
      >
        {children}
      </main>

      {/* Admin Operations Footer */}
      <footer className="w-full border-t border-border bg-surface py-4 mt-auto">
        <div className="max-w-[1320px] mx-auto px-4 md:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-text-muted text-xs font-caption">
          <div className="flex items-center space-x-3">
            <span>BookLeaf Operations Desk</span>
            <span className="w-1 h-1 rounded-full bg-border-strong" aria-hidden="true" />
            <span>SLA Standard: 48h Resolution Target</span>
            <span className="w-1 h-1 rounded-full bg-border-strong" aria-hidden="true" />
            <span className="text-text-subtle">Asia/Kolkata (IST)</span>
          </div>
          <div className="tabular-nums text-text-subtle font-mono text-[11px]">
            Admin Console v2.4.8 • Production Console
          </div>
        </div>
      </footer>
    </div>
  );
}
