/**
 * BottomSheet — Mobile drawer component
 */
export class BottomSheet {
  constructor(id, options = {}) {
    this.el = document.getElementById(id);
    this.isOpen = false;
    this.dragStart = 0;
    this.currentY = 0;
    this.snapPoints = options.snapPoints || [0, 0.5, 0.92]; // 0% (closed), 50%, 92%
    
    this._init();
  }

  _init() {
    this.el.classList.add('bottom-sheet');
    
    // Create drag handle
    const handle = document.createElement('div');
    handle.className = 'bs-handle';
    handle.innerHTML = '<div class="bs-bar"></div>';
    this.el.prepend(handle);

    // Backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'bs-backdrop';
    document.body.appendChild(this.backdrop);
    this.backdrop.onclick = () => this.close();

    // Event listeners
    handle.addEventListener('touchstart', (e) => this._onDragStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this._onDragMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this._onDragEnd(e));
  }

  _onDragStart(e) {
    this.dragStart = e.touches[0].clientY;
    this.el.style.transition = 'none';
    this.backdrop.style.transition = 'none';
  }

  _onDragMove(e) {
    if (this.dragStart === 0) return;
    const delta = e.touches[0].clientY - this.dragStart;
    if (delta < 0 && this.isOpen) return; // Don't drag past top
    
    const height = window.innerHeight;
    const pos = delta > 0 ? delta : 0;
    this.el.style.transform = `translateY(${pos}px)`;
    this.backdrop.style.opacity = Math.max(0, 1 - (pos / height));
  }

  _onDragEnd(e) {
    const delta = e.changedTouches[0].clientY - this.dragStart;
    this.dragStart = 0;
    this.el.style.transition = '';
    this.backdrop.style.transition = '';

    if (delta > 100) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.el.classList.add('open');
    this.backdrop.classList.add('show');
    this.isOpen = true;
    document.body.classList.add('bs-active');
  }

  close() {
    this.el.classList.remove('open');
    this.backdrop.classList.remove('show');
    this.isOpen = false;
    document.body.classList.remove('bs-active');
  }
}
