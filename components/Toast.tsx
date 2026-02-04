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
                    {t.type === 'success' && <span style={{marginRight: 8}}>✓</span>}
                    {t.type === 'error' && <span style={{marginRight: 8}}>✕</span>}
                    {t.type === 'warning' && <span style={{marginRight: 8}}>⚠</span>}
                    {t.message}
                </div>
            ))}
        </div>
    );
};

export default Toast;