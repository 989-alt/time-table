import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

const STYLES = {
  success: 'bg-green-50 border-green-300 text-green-800',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  error: 'bg-red-50 border-red-300 text-red-800',
};

const ICON_STYLES = {
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
};

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const Icon = ICONS[toast.type] || ICONS.success;

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  }, [toast.id, onRemove]);

  useEffect(() => {
    const timer = setTimeout(handleClose, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [handleClose, toast.duration]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-sm
        ${STYLES[toast.type] || STYLES.success}
        ${exiting ? 'toast-exit' : 'toast-enter'}
      `}
      role="alert"
    >
      <Icon className={`w-5 h-5 shrink-0 ${ICON_STYLES[toast.type] || ICON_STYLES.success}`} />
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button
        onClick={handleClose}
        className="p-0.5 rounded hover:bg-black/10 transition-colors shrink-0"
        aria-label="알림 닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, removeToast }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}
