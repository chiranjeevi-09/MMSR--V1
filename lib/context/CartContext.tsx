'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

export type CartItemType = 'book' | 'journal_issue' | 'journal_subscription' | 'article';
export type PurchaseFormat = 'digital' | 'print' | 'bundle';

export interface CartItem {
  id: string; // unique cart key e.g. book-12, issue-5-digital, sub-2
  itemType: CartItemType;
  targetId: number; // original DB ID
  title: string;
  isbn?: string;
  cover?: string;
  price: number;
  salePrice?: number;
  quantity: number;
  journalSlug?: string;
  duration?: string;
  format?: PurchaseFormat;
  formatLabel?: string;
}

interface ToastMessage {
  id: number;
  message: string;
  title?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  isMiniCartOpen: boolean;
  setIsMiniCartOpen: (open: boolean) => void;
  toast: ToastMessage | null;
  dismissToast: () => void;
}

const CART_STORAGE_KEY = 'mmsr_cart_v2';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMiniCartOpen, setIsMiniCartOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Restore cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Issue-level purchasing has been retired. Drop any legacy complete-issue
          // cart item persisted before the change so it can never reach checkout.
          setItems(parsed.filter((i: CartItem) => i && i.itemType !== 'journal_issue'));
        }
      }
    } catch (e) {
      console.error('Failed to load cart from localStorage:', e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.error('Failed to persist cart to localStorage:', e);
      }
    }
  }, [items, isInitialized]);

  const showToastNotification = (title: string, message: string) => {
    setToast({
      id: Date.now(),
      title,
      message,
    });

    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const addItem = useCallback(
    (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      // Complete issues are no longer purchasable - they are covered by a journal
      // subscription. Ignore such items instead of adding them to the cart.
      if (newItem.itemType === 'journal_issue') {
        showToastNotification(
          'Issues are included with a subscription',
          'Individual issues can no longer be bought separately. Subscribe to the journal to access its complete issue PDFs.'
        );
        return;
      }

      const addQty = newItem.quantity && newItem.quantity > 0 ? newItem.quantity : 1;

      setItems((prevItems) => {
        const existingIndex = prevItems.findIndex((i) => i.id === newItem.id);

        if (existingIndex > -1) {
          const updated = [...prevItems];
          const currentQty = updated[existingIndex].quantity;
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: currentQty + addQty,
          };
          return updated;
        }

        return [...prevItems, { ...newItem, quantity: addQty }];
      });

      showToastNotification('Added to Cart', `"${newItem.title}" was added to your shopping cart.`);
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prevItems) => {
      const target = prevItems.find((i) => i.id === id);
      if (target) {
        showToastNotification('Item Removed', `"${target.title}" was removed from your cart.`);
      }
      return prevItems.filter((i) => i.id !== id);
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prevItems) => prevItems.filter((i) => i.id !== id));
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const itemCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const unit = item.salePrice ?? item.price;
      return sum + unit * item.quantity;
    }, 0);
  }, [items]);

  const discount = 0;
  const shipping = 0; // Free shipping on all scholarly publications
  const total = subtotal - discount + shipping;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        discount,
        shipping,
        total,
        isMiniCartOpen,
        setIsMiniCartOpen,
        toast,
        dismissToast,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
