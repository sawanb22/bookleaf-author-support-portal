'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, AlertCircle, Info, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/mock/auth-context';
import clsx from 'clsx';

// Fallback skeleton while Suspense resolves searchParams on initial SSR
function LoginSkeleton() {
  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 pt-[102px] md:pt-[122px] pb-12">
      <div className="w-full max-w-[400px] animate-pulse">
        <div className="h-6 w-24 bg-surface-sunken rounded mb-3" />
        <div className="h-9 w-32 bg-surface-sunken rounded mb-3" />
        <div className="h-5 w-64 bg-surface-sunken rounded mb-8" />
        <div className="space-y-4">
          <div className="h-10 bg-surface-sunken rounded" />
          <div className="h-10 bg-surface-sunken rounded" />
          <div className="h-12 bg-surface-sunken rounded mt-2" />
        </div>
      </div>
    </div>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: isAuthLoading, login } = useAuth();

  // URL parameters
  const reason = searchParams.get('reason');
  const nextParam = searchParams.get('next');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isSlowServer, setIsSlowServer] = useState(false);

  // Error states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');

  // Refs for accessibility focus management
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  // Auto-focus email on mount
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  // Safe redirect path calculation
  const getRedirectPath = (role: 'author' | 'admin') => {
    if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) {
      return nextParam;
    }
    return role === 'admin' ? '/admin/tickets' : '/books';
  };



  // Cold start timer (4 seconds)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSubmitting) {
      timer = setTimeout(() => {
        setIsSlowServer(true);
      }, 4000);
    } else {
      setIsSlowServer(false);
    }
    return () => clearTimeout(timer);
  }, [isSubmitting]);

  // Validation functions
  const validateEmail = (val: string): boolean => {
    if (!val.trim()) {
      setEmailError('Enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val.trim())) {
      setEmailError('Enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (val: string): boolean => {
    if (!val) {
      setPasswordError('Enter your password.');
      return false;
    }
    setPasswordError('');
    return true;
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid) {
      emailInputRef.current?.focus();
      return;
    }
    if (!isPasswordValid) {
      passwordInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      // Live authentication call
      const roleHint = email.includes('admin') ? 'admin' : 'author';
      const success = await login(email.trim(), roleHint, password);

      if (success) {
        let targetRole: 'author' | 'admin' = roleHint;
        try {
          const authUser = localStorage.getItem('bookleaf_auth_user_v1');
          if (authUser) {
            const parsed = JSON.parse(authUser);
            if (parsed.role === 'admin' || parsed.role === 'author') {
              targetRole = parsed.role;
            }
          }
        } catch {}
        router.push(getRedirectPath(targetRole));
      } else {
        setAuthError('Email or password is incorrect.');
        setTimeout(() => {
          errorBannerRef.current?.focus();
        }, 50);
      }
    } catch {
      setAuthError('Couldn’t reach the server. Check your connection and try again.');
      setTimeout(() => {
        errorBannerRef.current?.focus();
      }, 50);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 pt-[102px] md:pt-[122px] pb-12">
      <div className="w-full max-w-[400px]">
        {/* Brand & Page Identification */}
        <div className="mb-8">
          <div className="mb-2">
            <span className="font-serif text-[20px] leading-[26px] font-semibold text-text tracking-tight">
              BookLeaf
            </span>
          </div>
          <h1 className="font-serif text-title-page text-text tracking-tight mb-2">
            Sign in
          </h1>
          <p className="font-body-lg text-body-lg text-text-muted">
            Use the email address on your BookLeaf account.
          </p>
        </div>

        {/* Session Expired Info Banner */}
        {reason === 'expired' && (
          <div
            role="status"
            className="mb-6 p-3.5 bg-ai-tint border-l-[3px] border-l-ai rounded-r-md flex items-start gap-2.5 text-text"
          >
            <Info className="w-5 h-5 text-ai shrink-0 mt-0.5" />
            <p className="font-body text-body">
              Your session expired. Sign in again to continue.
            </p>
          </div>
        )}

        {/* Auth Error Banner */}
        {authError && (
          <div
            ref={errorBannerRef}
            tabIndex={-1}
            role="alert"
            className="mb-6 p-3.5 bg-danger-tint border-l-[3px] border-l-danger rounded-r-md flex items-start gap-2.5 text-danger outline-none"
          >
            <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <p className="font-body text-body font-medium">{authError}</p>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4" id="signInForm">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block font-label text-label text-text mb-1.5">
              Email
            </label>
            <div className="relative">
              <input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                  if (authError) setAuthError('');
                }}
                onBlur={() => email && validateEmail(email)}
                disabled={isSubmitting}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
                className={clsx(
                  'w-full h-10 px-3.5 bg-surface text-text font-body text-body border rounded-md transition-all duration-150',
                  'placeholder:text-text-subtle placeholder:font-normal',
                  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  'disabled:bg-surface-sunken disabled:text-text-subtle disabled:cursor-not-allowed',
                  emailError
                    ? 'border-danger focus:border-danger focus:ring-danger'
                    : 'border-border hover:border-border-strong',
                  isFlashing && 'border-primary ring-2 ring-primary ring-offset-1 bg-primary-tint/20'
                )}
              />
            </div>
            {emailError && (
              <p
                id="email-error"
                className="mt-1.5 text-caption font-caption text-danger flex items-center gap-1"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="password" className="block font-label text-label text-text">
                Password
              </label>
              <a
                href="#forgot-password"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Please contact your editorial desk or support team to reset your password.');
                }}
                className="font-caption text-caption text-primary hover:text-primary-hover hover:underline transition-colors duration-150"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <input
                ref={passwordInputRef}
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError('');
                  if (authError) setAuthError('');
                }}
                onBlur={() => password && validatePassword(password)}
                disabled={isSubmitting}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
                className={clsx(
                  'w-full h-10 pl-3.5 pr-14 bg-surface text-text font-body text-body border rounded-md transition-all duration-150',
                  'placeholder:text-text-subtle',
                  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  'disabled:bg-surface-sunken disabled:text-text-subtle disabled:cursor-not-allowed',
                  passwordError
                    ? 'border-danger focus:border-danger focus:ring-danger'
                    : 'border-border hover:border-border-strong',
                  isFlashing && 'border-primary ring-2 ring-primary ring-offset-1 bg-primary-tint/20'
                )}
              />
              <button
                id="togglePassword"
                type="button"
                aria-label="Toggle password visibility"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1 bottom-1 px-3 text-text-muted hover:text-text font-label text-[13px] flex items-center justify-center rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwordError && (
              <p
                id="password-error"
                className="mt-1.5 text-caption font-caption text-danger flex items-center gap-1"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordError}</span>
              </p>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full h-12 bg-primary hover:bg-primary-hover active:bg-primary-pressed disabled:bg-surface-sunken disabled:text-text-subtle disabled:cursor-not-allowed text-on-primary font-label text-label rounded-md transition-colors duration-150 flex items-center justify-center shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-on-primary" />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          {/* Slow server wakeup notification */}
          {isSlowServer && isSubmitting && (
            <div className="mt-3 p-3 bg-surface-sunken border border-border rounded-md text-caption text-text-muted flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-text-muted shrink-0" />
              <span>
                The server is waking up. The first request after a quiet period can take up to a minute.
              </span>
            </div>
          )}

          {/* Footer help link */}
          <div className="text-center pt-1">
            <span className="font-caption text-caption text-text-muted">
              Need an author desk account?
            </span>
            <a
              href="mailto:editorial@bookleaf.test"
              className="font-caption text-caption text-primary hover:text-primary-hover ml-1 font-medium hover:underline"
            >
              Contact your editor
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="bg-page text-text min-h-screen flex flex-col justify-between selection:bg-primary-tint selection:text-primary">
      {/* Top Minimalist Utility Bar */}
      <header className="w-full">
        <div className="max-w-[1040px] mx-auto px-6 lg:px-8 h-14 flex items-center justify-end">
          <div className="flex items-center gap-4 text-caption font-caption text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Shield className="w-4 h-4 text-text-subtle" />
              <span>Author Portal Auth</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Form wrapped in Suspense for Next.js 14 searchParams static prerendering */}
      <main id="main-content" className="w-full flex-grow flex flex-col items-center">
        <Suspense fallback={<LoginSkeleton />}>
          <LoginFormContent />
        </Suspense>
      </main>

      {/* Editorial Quiet Footer */}
      <footer className="w-full py-6 mt-auto">
        <div className="max-w-[1040px] mx-auto px-6 lg:px-8 text-center text-text-subtle font-caption text-caption">
          <p className="tracking-normal">
            © 2026 BookLeaf Publishing Services Pvt. Ltd. •{' '}
            <a
              href="#sla"
              className="hover:text-text hover:underline transition-colors duration-150"
            >
              Help Desk SLA
            </a>{' '}
            •{' '}
            <a
              href="#privacy"
              className="hover:text-text hover:underline transition-colors duration-150"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
