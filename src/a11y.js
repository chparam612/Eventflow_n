/**
 * EventFlow V2 — Accessibility Utilities
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

function getFocusable(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter(el => !el.hasAttribute('hidden') && el.offsetParent !== null);
}

export function announce(message, priority = 'polite') {
  if (!message || typeof document === 'undefined') return;
  const id = priority === 'assertive' ? 'ef-live-assertive' : 'ef-live-polite';
  let region = document.getElementById(id);
  if (!region) {
    region = document.createElement('div');
    region.id = id;
    region.className = 'sr-only';
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }
  region.textContent = '';
  setTimeout(() => { region.textContent = message; }, 20);
}

export function createDialogController({ dialog, onOpen, onClose } = {}) {
  if (!dialog) {
    return { open() {}, close() {}, destroy() {} };
  }

  let lastFocused = null;
  let keydownHandler = null;

  const close = () => {
    if (keydownHandler) {
      dialog.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
    dialog.setAttribute('aria-hidden', 'true');
    onClose?.();
    if (lastFocused?.focus) {
      setTimeout(() => lastFocused.focus(), 0);
    }
  };

  const open = (triggerEl) => {
    lastFocused = triggerEl || document.activeElement;
    dialog.setAttribute('aria-hidden', 'false');
    onOpen?.();

    keydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusable(dialog);
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', keydownHandler);

    const focusables = getFocusable(dialog);
    const target = focusables[0] || dialog;
    setTimeout(() => target.focus(), 0);
  };

  return {
    open,
    close,
    destroy() {
      if (keydownHandler) {
        dialog.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
      }
    }
  };
}

export function makeSelectableList({
  container,
  itemSelector,
  getValue = (el) => el?.dataset?.id,
  onSelect,
  initialSelectedValue
} = {}) {
  if (!container) return;
  const items = [...container.querySelectorAll(itemSelector)];
  if (items.length === 0) return;

  const selectItem = (el, shouldFocus = true) => {
    if (!el) return;
    const value = getValue(el);
    items.forEach((item) => {
      const active = item === el;
      item.setAttribute('aria-checked', active ? 'true' : 'false');
      item.tabIndex = active ? 0 : -1;
      item.dataset.selected = active ? 'true' : 'false';
      if (active && shouldFocus) item.focus();
    });
    onSelect?.(el, value);
  };

  items.forEach((item, idx) => {
    if (!item.hasAttribute('role')) item.setAttribute('role', 'radio');
    item.tabIndex = idx === 0 ? 0 : -1;
    item.addEventListener('click', () => selectItem(item, false));
    item.addEventListener('keydown', (e) => {
      const currentIndex = items.indexOf(item);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        selectItem(items[(currentIndex + 1) % items.length]);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        selectItem(items[(currentIndex - 1 + items.length) % items.length]);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        selectItem(item, false);
      }
    });
  });

  const selectedByValue = items.find(i => getValue(i) === initialSelectedValue);
  const selectedByAttr = items.find(i => i.dataset.selected === 'true');
  selectItem(selectedByValue || selectedByAttr || items[0], false);
}
