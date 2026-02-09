/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect } from 'react';

export interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastProps {
    toasts: ToastMessage[];
    onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, onRemove }) => {
    useEffect(() => {
        if (toasts.length > 0) {
            const timer = setTimeout(() => {
                onRemove(toasts[0].id);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toasts, onRemove]);

    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast-item ${t.type}`}>
                    {t.type === 'success' && (
                        <span style={{marginRight: 8, display:'flex'}}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </span>
                    )}
                    {t.type === 'error' && (
                        <span style={{marginRight: 8, display:'flex'}}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </span>
                    )}
                    {t.type === 'warning' && (
                        <span style={{marginRight: 8, display:'flex'}}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </span>
                    )}
                    {t.type === 'info' && (
                        <span style={{marginRight: 8, display:'flex'}}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        </span>
                    )}
                    {t.message}
                </div>
            ))}
        </div>
    );
};

export default Toast;
