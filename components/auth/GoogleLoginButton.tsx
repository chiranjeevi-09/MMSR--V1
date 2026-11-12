'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Google Identity Services (GIS) sign-in button.
 *
 * Loads the official GIS client, initializes it with the public Web Client ID
 * (NEXT_PUBLIC_GOOGLE_CLIENT_ID), and renders Google's own "Continue with
 * Google" button. On success the browser receives a Google-issued ID token,
 * which is forwarded to `onCredential` for the caller to exchange at the
 * backend's dedicated Google endpoint (where it is verified server-side).
 *
 * The Client Secret is NEVER used here — the token-verification flow only
 * needs the public Client ID on the front end. When the Client ID is not
 * configured, the button degrades to an honest "not configured" notice so the
 * feature never appears to work without proper setup.
 */

declare global {
  interface Window {
    google?: any;
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

function loadGisScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.google?.accounts?.id) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      if (existing.dataset.gisLoaded === 'true') return resolve(true);
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.gisLoaded = 'true';
      resolve(true);
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

interface GoogleLoginButtonProps {
  /** Receives the raw Google ID token (credential) to send to the backend. */
  onCredential: (idToken: string) => void | Promise<void>;
  /** Grey-out overlay while an exchange is in flight (prevents double-clicks). */
  disabled?: boolean;
  /** Button label context; GIS supports sign-in / continue / sign-up variants. */
  text?: 'signin' | 'continue_with' | 'sign_up_with';
}

type ButtonStatus = 'loading' | 'ready' | 'unavailable';

export function GoogleLoginButton({ onCredential, disabled = false, text = 'continue_with' }: GoogleLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Always call the latest handler without re-initializing GIS on every render.
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  const [status, setStatus] = useState<ButtonStatus>(CLIENT_ID ? 'loading' : 'unavailable');

  useEffect(() => {
    if (!CLIENT_ID) {
      setStatus('unavailable');
      return;
    }
    let cancelled = false;

    loadGisScript().then((ok) => {
      if (cancelled) return;
      if (!ok || !window.google?.accounts?.id) {
        setStatus('unavailable');
        return;
      }
      try {
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          ux_mode: 'popup',
          auto_select: false,
          cancel_previous_tap_prompt: true,
          callback: (response: { credential?: string }) => {
            if (response?.credential) {
              void callbackRef.current(response.credential);
            }
          },
        });
        if (containerRef.current) {
          containerRef.current.replaceChildren();
          window.google.accounts.id.renderButton(containerRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text,
            locale: 'en',
            logo_alignment: 'left',
          });
        }
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [text]);

  // Not configured → honest placeholder, never a fake-working button.
  if (!CLIENT_ID || status === 'unavailable') {
    return (
      <div className="rounded-xl border border-[#D4AC54]/40 bg-white/5 px-4 py-3 text-center text-[13px] leading-relaxed text-text-muted">
        Google sign-in is not configured yet. Set{' '}
        <span className="font-mono text-gold-400">NEXT_PUBLIC_GOOGLE_CLIENT_ID</span> (frontend) and{' '}
        <span className="font-mono text-gold-400">GOOGLE_OAUTH_CLIENT_ID</span> (backend), then restart the
        servers to enable it.
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="flex justify-center min-h-[44px]" aria-busy={status !== 'ready'} />
      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 text-[13px] text-text-muted py-3">
          <span className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          Loading Google sign-in…
        </div>
      )}
      {disabled && (
        <div className="absolute inset-0 rounded-xl bg-navy-950/60 cursor-wait" aria-hidden />
      )}
    </div>
  );
}

export default GoogleLoginButton;
