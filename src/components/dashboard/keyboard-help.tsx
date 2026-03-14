"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcuts";

const SHORTCUTS = [
  { keys: ["j", "↓"], description: "Move down patient list" },
  { keys: ["k", "↑"], description: "Move up patient list" },
  { keys: ["Enter"], description: "Open selected patient" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["n"], description: "New patient" },
  { keys: ["Esc"], description: "Close dialog / clear focus" },
  { keys: ["1"], description: "Overview tab" },
  { keys: ["2"], description: "Timeline tab" },
  { keys: ["3"], description: "Care Plan tab" },
  { keys: ["4"], description: "Messages tab" },
  { keys: ["5"], description: "Visit Notes tab" },
  { keys: ["?"], description: "Show this help" },
];

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useKeyboardShortcut({
    key: "?",
    skipInInput: true,
    handler: () => setOpen(true),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 py-1">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-600">{s.description}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded text-slate-700"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 pt-1">Press <kbd className="px-1 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">?</kbd> anywhere to open this</p>
      </DialogContent>
    </Dialog>
  );
}
