"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Clock } from "lucide-react";

const WARN_AFTER_MS = 25 * 60 * 1000; // 25 minutes idle → show warning
const LOGOUT_AFTER_MS = 30 * 60 * 1000; // 30 minutes idle → auto-logout

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

export function SessionTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300); // 5 min countdown
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();
    setShowWarning(false);

    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(300);
      countdownRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }, WARN_AFTER_MS);

    logoutTimerRef.current = setTimeout(() => {
      void signOut({ callbackUrl: "/login?reason=timeout" });
    }, LOGOUT_AFTER_MS);
  }, [clearTimers]);

  const handleActivity = useCallback(() => {
    if (!showWarning) {
      startTimers();
    }
  }, [showWarning, startTimers]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    startTimers();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      clearTimers();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [handleActivity, startTimers, clearTimers]);

  function handleStayLoggedIn() {
    setShowWarning(false);
    startTimers();
  }

  function handleLogout() {
    void signOut({ callbackUrl: "/login" });
  }

  const minutesLeft = Math.floor(secondsLeft / 60);
  const secLeft = secondsLeft % 60;

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Session Expiring Soon
          </DialogTitle>
          <DialogDescription>
            You&apos;ve been inactive for 25 minutes. For patient data security, you&apos;ll be
            logged out in{" "}
            <span className="font-semibold text-amber-600">
              {minutesLeft}:{secLeft.toString().padStart(2, "0")}
            </span>
            .
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleLogout} size="sm">
            Log out now
          </Button>
          <Button onClick={handleStayLoggedIn} size="sm" className="bg-rose-600 hover:bg-rose-700">
            Stay logged in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
