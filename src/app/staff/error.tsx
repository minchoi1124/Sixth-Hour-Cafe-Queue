'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Staff page error:', error);
  }, [error]);

  const isRateLimitError = error.name === 'FirestoreRateLimitError' ||
    error.message.includes('Rate limit exceeded') ||
    error.message.includes('resource-exhausted');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-4">
          {isRateLimitError ? (
            <svg
              className="w-16 h-16 mx-auto text-orange-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className="w-16 h-16 mx-auto text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isRateLimitError ? 'Too Many Requests' : 'Error Loading Staff Page'}
        </h1>

        <p className="text-gray-600 mb-6">
          {isRateLimitError
            ? "The system is experiencing high traffic. We're automatically retrying your request."
            : 'An unexpected error occurred while loading the staff dashboard.'}
        </p>

        <div className="space-y-3">
          <Button
            onClick={reset}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            Try again
          </Button>

          <Button
            onClick={() => window.location.href = '/staff'}
            variant="outline"
            className="w-full"
          >
            Refresh staff page
          </Button>
        </div>

        {isRateLimitError && (
          <p className="text-sm text-gray-500 mt-4">
            This usually resolves automatically within a few seconds.
          </p>
        )}
      </div>
    </div>
  );
}
