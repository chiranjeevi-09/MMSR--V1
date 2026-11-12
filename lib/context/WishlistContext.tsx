'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

export interface WishlistItem {
  id: string; // unique item id e.g. book-1, journal-nature-tech
  type: 'book' | 'journal';
  targetId: number | string;
  title: string;
  subtitle?: string;
  cover?: string;
  price: number;
  slug?: string;
  category?: string;
  isbn?: string;
}

interface ToastMessage {
  id: number;
  message: string;
  title?: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  addItem: (item: WishlistItem) => void;
  removeItem: (id: string) => void;
  toggleItem: (item: WishlistItem) => void;
  clearWishlist: () => void;
  isWishlisted: (id: string) => boolean;
  wishlistCount: number;
  toast: ToastMessage | null;
  dismissToast: () => void;
}

const WISHLIST_STORAGE_KEY = 'mmsr_wishlist_v2';

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Restore wishlist from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load wishlist from localStorage:', e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save wishlist to localStorage whenever items change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.error('Failed to save wishlist to localStorage:', e);
      }
    }
  }, [items, isInitialized]);

  const showToast = (title: string, message: string) => {
    setToast({
      id: Date.now(),
      title,
      message,
    });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const isWishlisted = useCallback(
    (id: string) => {
      return items.some((i) => i.id === id);
    },
    [items]
  );

  const addItem = useCallback(
    (item: WishlistItem) => {
      setItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev;
        showToast('Saved to Wishlist', `"${item.title}" was saved to your academic wishlist.`);
        return [...prev, item];
      });
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        showToast('Removed from Wishlist', `"${target.title}" was removed from your wishlist.`);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const toggleItem = useCallback(
    (item: WishlistItem) => {
      if (isWishlisted(item.id)) {
        removeItem(item.id);
      } else {
        addItem(item);
      }
    },
    [isWishlisted, addItem, removeItem]
  );

  const clearWishlist = useCallback(() => {
    setItems([]);
  }, []);

  const wishlistCount = useMemo(() => items.length, [items]);

  return (
    <WishlistContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        toggleItem,
        clearWishlist,
        isWishlisted,
        wishlistCount,
        toast,
        dismissToast,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistContextType => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
