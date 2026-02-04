/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Filament } from '../types';

interface FilamentSpoolProps {
    filament: Filament;
    onEdit: (f: Filament) => void;
    onDelete: (id: string) => void;
}

const FilamentSpool: React.FC<FilamentSpoolProps> = ({ filament, onEdit, onDelete }) => {
    const percentage = Math.max(0, Math.min(100, (filament.currentWeightGrams / filament.weightPerSpoolGrams) * 100));
    const isLowStock = percentage <= 10;
    
    // Using simple colored stroke logic for the neumorphic style instead of full gradient
    // We simulate the progress by just showing the color in the "donut"
    
    return (
        <div className="filament-card">
            <div className="filament-actions-overlay">
                <button className="mini-btn" onClick={() => onEdit(filament)}>
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="mini-btn danger" onClick={() => onDelete(filament.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>

            <div className="spool-visual-container">
                <div 
                    className="spool-outer" 
                    style={{ 
                        background: `conic-gradient(${isLowStock ? '#EF4444' : filament.colorHex} ${percentage}%, transparent ${percentage}%)` 
                    }}
                >
                    <div className="spool-inner">
                        <span className="spool-percent" style={{color: isLowStock ? '#EF4444' : filament.colorHex}}>{Math.round(percentage)}%</span>
                    </div>
                </div>
            </div>
            
            <div className="filament-info">
                <span className="filament-brand">{filament.brand}</span>
                <h3 className="filament-name">{filament.name}</h3>
                <div className="filament-meta">
                    <span style={{ fontWeight: 700 }}>{filament.type}</span>
                    <span>•</span>
                    <span>{filament.currentWeightGrams}g</span>
                </div>
            </div>

            {isLowStock && (
                <div className="badge-low-stock">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Baixo
                </div>
            )}
        </div>
    );
};

export default FilamentSpool;