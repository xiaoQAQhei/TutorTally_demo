// ── Toast 全局 Context ──
/**
 * 全局 Toast 上下文，将 Toast 渲染在根层级，避免被 Modal/BottomSheet 遮挡。
 * 用法：useToast().showToast('消息', 'success')
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import Toast from '../components/Toast';

/** Toast 状态 */
interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
}

/** Context 暴露的方法 */
interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

// ── Provider ──
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast 渲染在 Provider 末尾，处于根层级，永远叠在 Modal 之上 */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
    </ToastContext.Provider>
  );
};

// ── Hook ──
export const useToast = () => useContext(ToastContext);
