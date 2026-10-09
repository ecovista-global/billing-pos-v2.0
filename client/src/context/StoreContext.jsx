import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../services/api';

const StoreContext = createContext();

export function StoreProvider({ children }) {
  const { user } = useAuth();
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [stores, setStores] = useState([]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      apiFetch('/stores').then(r => setStores(r.stores || [])).catch(() => {});
    } else if (user?.assigned_store_id) {
      setSelectedStoreId(user.assigned_store_id);
    }
  }, [user]);

  return (
    <StoreContext.Provider value={{ 
      selectedStoreId, 
      setSelectedStoreId: (user?.role === 'admin' || user?.role === 'super_admin') ? setSelectedStoreId : () => {},
      stores,
      isAllStores: selectedStoreId === null
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStoreContext = () => useContext(StoreContext);
