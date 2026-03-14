"use client";

import { useEffect, useCallback } from "react";

type ShortcutHandler = (e: KeyboardEvent) => void;

interface ShortcutConfig {
  key: string;
  /** If true, only fires when no modifier keys are held */
  noModifiers?: boolean;
  /** Skip when focus is inside an input/textarea/select/contenteditable */
  skipInInput?: boolean;
  handler: ShortcutHandler;
}

export function useKeyboardShortcut(config: ShortcutConfig) {
  const { key, noModifiers = true, skipInInput = true, handler } = config;

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (noModifiers && (e.ctrlKey || e.metaKey || e.altKey)) return;

      if (skipInInput) {
        const target = e.target as HTMLElement;
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (e.key === key) {
        handler(e);
      }
    },
    [key, noModifiers, skipInInput, handler]
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);
}

/**
 * Register multiple shortcuts at once.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const { key, noModifiers = true, skipInInput = true, handler } of shortcuts) {
        if (noModifiers && (e.ctrlKey || e.metaKey || e.altKey)) continue;

        if (skipInInput) {
          const target = e.target as HTMLElement;
          const tag = target.tagName;
          if (
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            tag === "SELECT" ||
            target.isContentEditable
          ) {
            continue;
          }
        }

        if (e.key === key) {
          handler(e);
          break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);
}
