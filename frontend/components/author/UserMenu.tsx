'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/mock/auth-context';

export function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const name = user?.name || 'Priya Sharma';
  const email = user?.email || 'priya.sharma@email.com';

  // Close menu on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSignOut = () => {
    setIsOpen(false);
    logout();
    router.push('/login');
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        id="user-menu-button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls="user-menu-dropdown"
        aria-label="User account menu"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-surface-sunken transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 min-h-[44px]"
      >
        <span className="font-label text-sm text-text font-medium truncate max-w-[140px]">
          {name}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          id="user-menu-dropdown"
          aria-labelledby="user-menu-button"
          className="absolute right-0 top-full mt-1.5 w-60 bg-surface border border-border rounded-lg shadow-overlay z-50 py-1 divide-y divide-border animate-in fade-in-50 duration-150"
        >
          {/* User Details */}
          <div className="px-3.5 py-2.5 bg-surface-sunken/40">
            <p className="font-medium text-sm text-text truncate">{name}</p>
            <p className="font-caption text-caption text-text-muted truncate mt-0.5">
              {email}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[11px] font-medium text-text-subtle uppercase tracking-wider">
                Author Account
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full text-left px-3.5 py-2 text-sm text-danger hover:bg-danger-tint flex items-center gap-2.5 transition-colors focus:outline-none focus:bg-danger-tint"
            >
              <LogOut className="w-4 h-4 text-danger flex-shrink-0" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
