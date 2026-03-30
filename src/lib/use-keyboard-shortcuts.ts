import { useEffect, useRef } from "react";

type KeyCombo = string; // e.g. "ctrl+n", "escape", "slash"

interface ShortcutMap {
  [combo: string]: (e: KeyboardEvent) => void;
}

/**
 * Register global keyboard shortcuts.
 *
 * @example
 * useKeyboardShortcuts({
 *   'ctrl+n': () => openCreateForm(),
 *   'escape': () => closeDrawer(),
 *   '/': () => focusSearch(),
 * });
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      // Don't fire inside inputs/textareas unless it's Escape
      const isInput = tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;

      for (const [combo, fn] of Object.entries(ref.current)) {
        if (matchesCombo(e, combo, isInput)) {
          e.preventDefault();
          fn(e);
          return;
        }
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}

function matchesCombo(e: KeyboardEvent, combo: KeyCombo, isInput: boolean): boolean {
  const parts = combo.toLowerCase().split("+").map((p) => p.trim());
  const needCtrl = parts.includes("ctrl") || parts.includes("mod");
  const needShift = parts.includes("shift");
  const needAlt = parts.includes("alt");
  const key = parts.filter((p) => !["ctrl", "mod", "shift", "alt"].includes(p))[0];

  if (!key) return false;

  // Escape always fires, even in inputs
  if (key === "escape") {
    return e.key === "Escape";
  }

  // All other shortcuts are suppressed inside inputs
  if (isInput && !needCtrl) return false;

  const ctrlMatch = needCtrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
  const shiftMatch = needShift ? e.shiftKey : !e.shiftKey;
  const altMatch = needAlt ? e.altKey : !e.altKey;

  let keyMatch = false;
  if (key === "slash" || key === "/") {
    keyMatch = e.key === "/" || e.key === "?";
  } else {
    keyMatch = e.key.toLowerCase() === key;
  }

  return ctrlMatch && shiftMatch && altMatch && keyMatch;
}
