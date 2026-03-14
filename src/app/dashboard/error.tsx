"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    // Log to error reporting service in production
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="p-3 rounded-full bg-red-50">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-slate-800">Something went wrong</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          An unexpected error occurred while loading this page. Your data is safe.
        </p>
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  );
}
