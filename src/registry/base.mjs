export class Registry {
  constructor() {
    this._items = new Map();
  }

  register(id, item) {
    if (this._items.has(id)) {
      throw new Error(`Item already registered: ${id}`);
    }
    this._items.set(id, Object.freeze({ ...item, id }));
  }

  get(id) {
    const item = this._items.get(id);
    if (!item) throw new Error(`Unknown item: ${id}`);
    return item;
  }

  tryGet(id) {
    return this._items.get(id) ?? null;
  }

  list() {
    return Array.from(this._items.values());
  }

  clear() {
    this._items.clear();
  }

  get size() {
    return this._items.size;
  }

  has(id) {
    return this._items.has(id);
  }
}
