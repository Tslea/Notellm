'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
  type?: 'error' | 'success';
}

export default function Toast({ message, onClose, type = 'error' }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 flex justify-center">
      <div
        className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
          type === 'error'
            ? 'bg-red-50 text-red-800 border border-red-200'
            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}
      >
        {message}
      </div>
    </div>
  );
}
