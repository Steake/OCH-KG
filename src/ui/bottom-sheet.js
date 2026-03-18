/**
 * BottomSheet — Mobile drawer component
 *
 * Provides a draggable bottom-sheet overlay for mobile panels.
 * - Drag the handle bar to dismiss (swipe down > 100px)
 * - Tap the backdrop to close
 * - Programmatic open() / close()
 */
export class BottomSheet {
  constructor(id, options = {}) {
    this.el = document.getElementById(id);
    if (!this.el) throw new Error(`BottomSheet: element #${id} not found`);

    this.isOpen    = false;
    this.isDragging = false;   // ← guards touchmove/touchend
    this.dragStartY = 0;
    this.onClose   = options.onClose || null;

    this._boundDragMove = (e) => this._onDragMove(e);
    this._boundDragEnd  = (e) => this._onDragEnd(e);

    this._init();
  }

  _init() {
    this.el.classList.add('bottom-sheet');

    // Only prepend drag handle once
    if (!this.el.querySelector('.bs-handle')) {
      const handle = document.createElement('div');
      handle.className = 'bs-handle';
      handle.innerHTML = '<div class="bs-bar"></div>';
      this.el.prepend(handle);
    }

    // Shared backdrop (one per sheet)
    if (!this.backdrop) {
      this.backdrop = document.createElement('div');
      this.backdrop.className = 'bs-backdrop';
      document.body.appendChild(this.backdrop);
    }
    this.backdrop.onclick = () => this.close();

    // Drag on the handle only
    const handle = this.el.querySelector('.bs-handle');
    handle.addEventListener('touchstart', (e) => this._onDragStart(e), { passive: true });

    // Move/end bound to the *element* (not window) to avoid stealing
    // global touch events from close buttons and other controls.
    this.el.addEventListener('touchmove',  this._boundDragMove, { passive: false });
    this.el.addEventListener('touchend',   this._boundDragEnd);
    this.el.addEventListener('touchcancel', this._boundDragEnd);
  }

  /* ── Drag lifecycle ─────────────────────────── */

  _onDragStart(e) {
    this.isDragging = true;
    this.dragStartY = e.touches[0].clientY;
    this.el.style.transition = 'none';
    this.backdrop.style.transition = 'none';
  }

  _onDragMove(e) {
    if (!this.isDragging) return;
    const delta = e.touches[0].clientY - this.dragStartY;
    if (delta < 0) return; // don't drag above start

    e.preventDefault();     // prevent scroll while dragging
    this.el.style.transform = `translateY(${delta}px)`;
    this.backdrop.style.opacity = Math.max(0, 1 - delta / window.innerHeight);
  }

  _onDragEnd(e) {
    if (!this.isDragging) return;          // ← critical guard
    const delta = e.changedTouches[0].clientY - this.dragStartY;
    this.isDragging = false;
    this.dragStartY = 0;
    this.el.style.transition = '';
    this.backdrop.style.transition = '';
    this.el.style.transform = '';          // reset inline transform

    if (delta > 100) {
      this.close();
    } else {
      // Snap back to open position
      this.el.classList.add('open');
    }
  }

  /* ── Public API ─────────────────────────────── */

  open() {
    this.el.style.transform = '';   // clear any leftover inline drag
    this.el.classList.add('open');
    this.backdrop.classList.add('show');
    this.isOpen = true;
    document.body.classList.add('bs-active');
  }

  close() {
    this.el.style.transform = '';   // clear any leftover inline drag
    this.el.classList.remove('open');
    this.backdrop.classList.remove('show');
    this.isOpen = false;
    document.body.classList.remove('bs-active');
    if (this.onClose) this.onClose();
  }

  /** Tear down DOM additions so the element can be used as a normal panel. */
  destroy() {
    this.el.classList.remove('bottom-sheet', 'open');
    this.el.style.transform = '';
    const handle = this.el.querySelector('.bs-handle');
    if (handle) handle.remove();
    if (this.backdrop) { this.backdrop.remove(); this.backdrop = null; }
    this.isOpen = false;
    document.body.classList.remove('bs-active');
  }
}
