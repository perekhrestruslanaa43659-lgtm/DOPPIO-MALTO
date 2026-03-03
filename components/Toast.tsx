'use client';

import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ type, title, message, duration = 5000, onClose }) => {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const icons = {
        success: <CheckCircle className="w-6 h-6 text-green-500" />,
        error: <XCircle className="w-6 h-6 text-red-500" />,
        warning: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
        info: <Info className="w-6 h-6 text-blue-500" />
    };

    const bgColors = {
        success: 'bg-green-50 border-green-200',
        error: 'bg-red-50 border-red-200',
        warning: 'bg-yellow-50 border-yellow-200',
        info: 'bg-blue-50 border-blue-200'
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
            <div
                className={`
                    ${bgColors[type]} 
                    border-2 rounded-2xl shadow-2xl 
                    p-6 max-w-md w-full mx-4
                    pointer-events-auto
                    animate-in fade-in slide-in-from-top-4 duration-300
                `}
            >
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                        {icons[type]}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {title}
                        </h3>
                        {message && (
                            <p className="text-sm text-gray-700 whitespace-pre-line">
                                {message}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Toast;
