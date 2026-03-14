"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Structured error capture — in production, send to error tracking (e.g. Sentry)
    const errorPayload = {
      message: error.message,
      digest: error.digest,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : undefined,
    };

    if (process.env.NODE_ENV === "production") {
      // POST to /api/errors for server-side logging
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorPayload),
      }).catch(() => {});
    } else {
      console.error("[GlobalError]", errorPayload);
    }
  }, [error]);

  return (
    <html>
      <body className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-2xl font-bold text-slate-800">Application Error</h1>
          <p className="text-slate-500 text-sm">
            A critical error occurred. Please try refreshing the page.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 font-mono">Error ID: {error.digest}</p>
          )}
          <Button onClick={reset}>Refresh</Button>
        </div>
      </body>
    </html>
  );
}
