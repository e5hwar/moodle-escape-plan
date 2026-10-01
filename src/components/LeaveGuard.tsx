import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PrmModal } from "./PrmModal";

/* Unsaved-changes guard, shared by every wizard and every page with a Save /
   Discard bar. A page registers whether it is dirty with `useLeaveGuard`; every
   way out of it then stops at one standard PrmModal confirm first:

   - the page's own exits (Cancel, Back, breadcrumbs) call the function the
     hook returns, `guard(proceed)`;
   - the app's exits (sidebar, browser Back/Forward) call `confirmLeave`;
   - closing or reloading the tab gets the browser's own beforeunload prompt —
     the one exit a page can't draw its own modal over.

   Success paths (Create, Save) navigate directly, never through the guard: the
   work isn't being thrown away, so there is nothing to ask. */

export type LeaveCopy = {
  /** What's being edited — "Certification", "Task", "Company"… */
  noun?: string;
  /** A create: nothing exists yet, so leaving throws the whole thing away. */
  creating?: boolean;
  /** Overrides for flows the noun copy doesn't fit. */
  title?: string;
  body?: ReactNode;
  /** Clean-up a discard needs beyond unmounting (a half-made record that saved
   *  live). Run for the app's exits — sidebar, browser Back — which can't know
   *  about it; the flow's own exits do their clean-up in `proceed`. */
  onDiscard?: () => void;
};

type Guard = { dirty: boolean; copy: LeaveCopy };

/* Every mounted guard, outermost first. Flows nest — a Task wizard inside the
   Certification wizard, a Design Template wizard over Product Config — and the
   page underneath stays mounted with its own unsaved work, so one slot isn't
   enough: closing the inner flow must leave the outer one still guarded. */
const guards: Guard[] = [];
let pending: { copy: LeaveCopy; proceed: () => void; leaving: Guard[]; external: boolean } | null =
  null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function ask(leaving: Guard[], proceed: () => void, external = false) {
  // The innermost unsaved flow names what's being thrown away.
  const top = [...leaving].reverse().find((g) => g.dirty);
  if (!top) {
    proceed();
    return;
  }
  pending = { copy: top.copy, proceed, leaving, external };
  emit();
}

/** Whether leaving the whole page right now would lose work. */
export function hasUnsavedChanges(): boolean {
  return guards.some((g) => g.dirty);
}

/** For the app's own exits (sidebar, browser Back), which leave every open
 *  flow at once: run `proceed` now, or once the admin confirms the discard. */
export function confirmLeave(proceed: () => void): void {
  ask([...guards], proceed, true);
}

/** Register this page's dirty state for as long as it's mounted. Returns the
 *  guard its own exits go through — it asks about this flow only, so a nested
 *  wizard's Cancel never stops over its parent's unsaved work. */
export function useLeaveGuard(dirty: boolean, copy: LeaveCopy = {}) {
  const guard = useRef<Guard>({ dirty, copy });
  guard.current.dirty = dirty;
  guard.current.copy = copy;

  useEffect(() => {
    const g = guard.current;
    guards.push(g);
    return () => {
      const i = guards.indexOf(g);
      if (i >= 0) guards.splice(i, 1);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const g = guard.current;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      // Cleared by a confirmed discard that leaves by full page load.
      if (!g.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (proceed: () => void) => ask([guard.current], proceed);
}

/* A form's comparable fingerprint for "has anything been done?". Blank is
   blank however it got there: a field typed in and cleared again, a rich-text
   editor left holding an empty paragraph, stray spaces — none of that is work,
   so none of it makes a page ask before leaving. Compare a page's fingerprint
   now with the one it opened with. */
export function draftKey(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "string" ? blankless(v) : v));
}
function blankless(v: string): string {
  const text = v.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  // Markup with no words in it is empty — unless it carries an image.
  return text === "" && !/<img\b/i.test(v) ? "" : v.trim();
}

function copyFor({ noun, creating, title, body }: LeaveCopy) {
  return {
    title:
      title ?? (creating && noun ? `Discard this ${noun}?` : "Discard unsaved changes?"),
    body:
      body ??
      (creating && noun
        ? `This ${noun} hasn't been created yet — everything you've filled in will be lost.`
        : noun
          ? `Your changes to this ${noun} haven't been saved and will be lost. This can't be undone.`
          : "Your changes haven't been saved and will be lost. This can't be undone."),
  };
}

/** Mounted once, at the app root: the confirm every guarded exit stops at. */
export function LeaveGuardHost() {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
  );
  if (!current) return null;
  const { title, body } = copyFor(current.copy);
  const close = () => {
    pending = null;
    emit();
  };
  return createPortal(
    <PrmModal
      title={title}
      confirmLabel="Discard"
      cancelLabel="Keep Editing"
      danger
      onCancel={close}
      onConfirm={() => {
        const { proceed, leaving, external } = current;
        close();
        if (external) leaving.filter((g) => g.dirty).forEach((g) => g.copy.onDiscard?.());
        // These flows are leaving for good, so their guards go with them — a
        // second exit fired by the same navigation mustn't ask again.
        leaving.forEach((g) => (g.dirty = false));
        proceed();
      }}
    >
      <p className="prm-content">{body}</p>
    </PrmModal>,
    document.body,
  );
}
