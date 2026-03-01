const GUEST_CART_ID_KEY = 'guest-cart-id';

const createGuestCartId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const getGuestCartId = (): string => {
  if (typeof window === 'undefined') {
    return 'guest_server';
  }

  const existing = window.localStorage.getItem(GUEST_CART_ID_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const nextId = createGuestCartId();
  window.localStorage.setItem(GUEST_CART_ID_KEY, nextId);
  return nextId;
};

export const resetGuestCartId = (): string => {
  const nextId = createGuestCartId();

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(GUEST_CART_ID_KEY, nextId);
  }

  return nextId;
};
