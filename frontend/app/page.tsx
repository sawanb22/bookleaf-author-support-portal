'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/mock/auth-context';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace('/login');
    } else if (user.role === 'admin') {
      router.replace('/admin/tickets');
    } else {
      router.replace('/books');
    }
  }, [user, isAuthenticated, isLoading, router]);

  return (
    <main
      id="main-content"
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-page text-text"
    >
      <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
      <h1 className="font-serif text-title-section text-text mb-2">
        BookLeaf Author Support Portal
      </h1>
      <p className="text-text-muted font-body mb-4">
        Connecting you to your publishing dashboard...
      </p>
      <noscript>
        <div className="bg-surface border border-border p-4 rounded-md shadow-sm">
          <p className="font-body mb-2 text-text">JavaScript is required to use this portal.</p>
          <a href="/login" className="text-primary underline font-medium">
            Proceed to Sign in
          </a>
        </div>
      </noscript>
    </main>
  );
}
