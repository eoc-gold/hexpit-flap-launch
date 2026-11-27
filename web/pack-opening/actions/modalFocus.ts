// Small accessibility action for modal dialogs. Applied to the element that
// contains every interactive control in the dialog (the panel, or the scrim
// when a control such as the close button lives outside the panel). It:
//   - moves keyboard focus into the dialog when it opens, so the dialog's own
//     Escape / keyboard handlers actually receive keys. A modal whose trigger
//     keeps focus never sees Escape, which is exactly why the deck-editor
//     dialogs did not close on Escape;
//   - traps Tab within the dialog while it is open, so keyboard focus can't
//     wander onto the page behind the backdrop;
//   - restores focus to the element that opened the dialog when it closes.
//
// It deliberately does NOT own Escape or backdrop dismissal - each dialog keeps
// its own onclose handlers - so this stays a focus utility, not a shared dialog
// primitive (that larger refactor is a post-launch job).

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function modalFocus(node: HTMLElement) {
  // The control that had focus when the dialog opened (usually the trigger).
  const trigger = document.activeElement as HTMLElement | null;

  function focusable(): HTMLElement[] {
    return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) =>
        el.offsetWidth > 0 ||
        el.offsetHeight > 0 ||
        el === document.activeElement,
    );
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const items = focusable();
    if (items.length === 0) {
      e.preventDefault();
      node.focus({ preventScroll: true });
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !node.contains(active)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  // Defer initial focus a frame so open animations / late-mounted children
  // are laid out and measurable before we pick the first focusable.
  const raf = requestAnimationFrame(() => {
    const items = focusable();
    (items[0] ?? node).focus({ preventScroll: true });
  });

  node.addEventListener('keydown', onKeydown);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      node.removeEventListener('keydown', onKeydown);
      // Return focus to the trigger, if it is still in the document.
      if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
        trigger.focus({ preventScroll: true });
      }
    },
  };
}
