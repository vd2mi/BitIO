const cart = {
  _key: 'bitio-cart',

  get() {
    try {
      return JSON.parse(localStorage.getItem(this._key)) || [];
    } catch {
      return [];
    }
  },

  _save(items) {
    localStorage.setItem(this._key, JSON.stringify(items));
    this.updateNavCount();
  },

  add(product) {
    const items = this.get();
    const existing = items.find(i => i.id === product.id);
    if (existing) {
      existing.qty++;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        category: product.category,
        qty: 1
      });
    }
    this._save(items);
  },

  remove(productId) {
    this._save(this.get().filter(i => i.id !== productId));
  },

  setQty(productId, qty) {
    if (qty <= 0) { this.remove(productId); return; }
    const items = this.get();
    const item = items.find(i => i.id === productId);
    if (item) item.qty = qty;
    this._save(items);
  },

  clear() {
    localStorage.removeItem(this._key);
    this.updateNavCount();
  },

  count() {
    return this.get().reduce((sum, i) => sum + i.qty, 0);
  },

  subtotal() {
    return this.get().reduce((sum, i) => sum + i.price * i.qty, 0);
  },

  updateNavCount() {
    const n = this.count();
    document.querySelectorAll('#cart-n, .cart-count').forEach(el => el.textContent = n);
    document.querySelectorAll('.nav-cart span').forEach(el => el.textContent = n);
  }
};
