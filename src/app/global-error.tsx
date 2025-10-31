'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  const isRateLimitError = error.name === 'FirestoreRateLimitError' ||
    error.message.includes('Rate limit exceeded') ||
    error.message.includes('resource-exhausted');

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to bottom right, #fffbeb, #ffedd5)',
          padding: '1rem'
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            background: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {isRateLimitError ? 'Too Many Requests' : 'Something went wrong'}
            </h1>
            <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
              {isRateLimitError
                ? "We're experiencing high traffic. Please wait a moment and try again."
                : 'An unexpected error occurred.'}
            </p>
            <button
              onClick={reset}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                background: '#f97316',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
