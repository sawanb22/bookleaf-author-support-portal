'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Ticket, AdminMetric, TicketStatus, TicketPriority } from './types';
import { mockDb } from './db';

import { apiClient } from '../api-client';

/**
 * Live ticket polling and SSE hook.
 * Queries FastAPI backend with real-time SSE stream, with graceful offline fallback.
 * Triggers a 1200ms highlight when a new message or update is detected.
 */
export function useLiveTicket(ticketId: string) {
  const initialLocal = mockDb.getTicket(ticketId);
  const [ticket, setTicket] = useState<Ticket | undefined>(() => initialLocal);
  const [isLoading, setIsLoading] = useState(!initialLocal);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [newReplyHighlight, setNewReplyHighlight] = useState(false);
  const isFirstLoadRef = useRef(true);
  const prevTicketRef = useRef<string>(JSON.stringify(initialLocal || null));

  const refresh = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        const live = await apiClient.author.getTicket(ticketId);
        if (live && live.id) {
          mockDb.upsertTicket(live);
          const currentSerialized = JSON.stringify(live);
          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
            prevTicketRef.current = currentSerialized;
            setTicket(live);
            setLastUpdated(new Date());
            setIsLoading(false);
          } else if (currentSerialized !== prevTicketRef.current) {
            prevTicketRef.current = currentSerialized;
            setTicket(live);
            setLastUpdated(new Date());
            setNewReplyHighlight(true);
            setTimeout(() => setNewReplyHighlight(false), 1200);
          }
          return;
        }
      } catch {
        // Fall through to mockDb
      }
    }

    const latest = mockDb.getTicket(ticketId);
    if (latest) {
      const currentSerialized = JSON.stringify(latest);
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
        prevTicketRef.current = currentSerialized;
        setTicket(latest);
        setLastUpdated(new Date());
        setIsLoading(false);
      } else if (currentSerialized !== prevTicketRef.current) {
        prevTicketRef.current = currentSerialized;
        setTicket(latest);
        setLastUpdated(new Date());
        setNewReplyHighlight(true);
        setTimeout(() => setNewReplyHighlight(false), 1200);
      }
    } else {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    refresh();

    // 1. Reactive subscription to local store updates
    const unsubscribe = mockDb.subscribe(() => {
      refresh();
    });

    // 2. Real-time SSE stream subscription
    const eventSource = apiClient.author.createEventSource();
    if (eventSource) {
      eventSource.addEventListener('message.created', () => refresh());
      eventSource.addEventListener('ticket.updated', () => refresh());
      eventSource.addEventListener('ticket.classified', () => refresh());
    }

    // 3. 10-second polling cadence as robust heartbeat
    const interval = setInterval(() => {
      refresh();
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [refresh]);

  return { ticket, isLoading, lastUpdated, newReplyHighlight, refresh };
}

/**
 * Real-time queue hook for the Admin console.
 */
export function useLiveQueue(filters?: {
  authorId?: string;
  status?: TicketStatus | 'All';
  category?: string;
  priority?: TicketPriority;
  search?: string;
}) {
  const [tickets, setTickets] = useState<Ticket[]>(() => mockDb.getTickets(filters));
  const [metrics, setMetrics] = useState<AdminMetric>(() => mockDb.getAdminMetrics());
  const [newTicketsPill, setNewTicketsPill] = useState<number>(0);

  const refresh = useCallback(() => {
    setTickets(mockDb.getTickets(filters));
    setMetrics(mockDb.getAdminMetrics());
  }, [filters]);

  useEffect(() => {
    const unsubscribe = mockDb.subscribe(() => {
      refresh();
    });

    const interval = setInterval(() => {
      refresh();
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [refresh]);

  return { tickets, metrics, newTicketsPill, refresh };
}

/**
 * LocalStorage draft preservation hook for the support query form.
 */
export function useDraft<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const save = useCallback(
    (newValue: T) => {
      setValue(newValue);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(newValue));
        } catch (err) {
          console.warn('Failed to save draft:', err);
        }
      }
    },
    [key]
  );

  const clear = useCallback(() => {
    setValue(initialValue);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn('Failed to clear draft:', err);
      }
    }
  }, [key, initialValue]);

  return [value, save, clear] as const;
}
