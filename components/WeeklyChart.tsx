/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo } from 'react';
import { Quote, Expense } from '../types';

interface WeeklyChartProps {
    quotes: Quote[];
    expenses: Expense[];
}

const WeeklyChart: React.FC<WeeklyChartProps> = ({ quotes, expenses }) => {
    // 1. Process Data
    const chartData = useMemo(() => {
        const weeks = [];
        const now = new Date();
        const dataMap = new Map<string, { date: string, income: number, expense: number }>();

        // Generate last 12 weeks keys
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - (i * 7));
            // Set to Sunday
            const day = d.getDay();
            const diff = d.getDate() - day;
            const weekStart = new Date(d.setDate(diff));
            weekStart.setHours(0, 0, 0, 0);
            
            const key = weekStart.toISOString();
            const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
            
            if (!dataMap.has(key)) {
                dataMap.set(key, { date: label, income: 0, expense: 0 });
                weeks.push(key);
            }
        }

        // Aggregate Income (Approved Quotes)
        quotes.forEach(q => {
            if (q.status !== 'approved') return;
            const d = new Date(q.createdAt);
            const day = d.getDay();
            const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
            weekStart.setHours(0, 0, 0, 0);
            const key = weekStart.toISOString();
            
            if (dataMap.has(key)) {
                const entry = dataMap.get(key)!;
                entry.income += q.finalPrice;
            }
        });

        // Aggregate Expenses
        expenses.forEach(e => {
            const d = new Date(e.date);
            const day = d.getDay();
            const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
            weekStart.setHours(0, 0, 0, 0);
            const key = weekStart.toISOString();

            if (dataMap.has(key)) {
                const entry = dataMap.get(key)!;
                entry.expense += e.amount;
            }
        });

        return Array.from(dataMap.values());
    }, [quotes, expenses]);

    // 2. Chart Dimensions & Scales
    const height = 200;
    const width = 600; // SVG coordinate space, fits via CSS
    const padding = 20;
    const graphHeight = height - padding * 2;
    const graphWidth = width - padding * 2;

    const maxVal = Math.max(
        ...chartData.map(d => Math.max(d.income, d.expense)),
        100 // Minimum scale
    );

    // Helper to map values to coordinates
    const getX = (index: number) => padding + (index / (chartData.length - 1)) * graphWidth;
    const getY = (value: number) => height - padding - (value / maxVal) * graphHeight;

    // Generate Paths
    const makePath = (key: 'income' | 'expense') => {
        if (chartData.length === 0) return "";
        return chartData.map((d, i) => 
            `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key])}`
        ).join(' ');
    };

    return (
        <div className="neu-card" style={{ width: '100%', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-light)', textTransform: 'uppercase', margin: '0 0 16px 0' }}>
                Fluxo de Caixa (12 Semanas)
            </h3>
            
            <div style={{ position: 'relative', width: '100%', height: '200px' }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                        const y = height - padding - (pct * graphHeight);
                        return (
                            <line 
                                key={pct} 
                                x1={padding} 
                                y1={y} 
                                x2={width - padding} 
                                y2={y} 
                                stroke="var(--text-light)" 
                                strokeOpacity="0.1" 
                                strokeWidth="1" 
                            />
                        );
                    })}

                    {/* Income Line (Gold/Accent) */}
                    <path
                        d={makePath('income')}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    
                    {/* Expense Line (Red) */}
                    <path
                        d={makePath('expense')}
                        fill="none"
                        stroke="var(--danger)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="5,5"
                    />

                    {/* Data Points */}
                    {chartData.map((d, i) => (
                        <g key={i}>
                            {/* Income Dot */}
                            <circle 
                                cx={getX(i)} 
                                cy={getY(d.income)} 
                                r="3" 
                                fill="var(--bg)" 
                                stroke="var(--accent)" 
                                strokeWidth="2" 
                            />
                            {/* Expense Dot */}
                            <circle 
                                cx={getX(i)} 
                                cy={getY(d.expense)} 
                                r="3" 
                                fill="var(--bg)" 
                                stroke="var(--danger)" 
                                strokeWidth="2" 
                            />
                            
                            {/* X Axis Labels (Show every 2nd or 3rd to avoid clutter) */}
                            {i % 2 === 0 && (
                                <text 
                                    x={getX(i)} 
                                    y={height} 
                                    textAnchor="middle" 
                                    fontSize="10" 
                                    fill="var(--text-light)"
                                    fontWeight="bold"
                                >
                                    {d.date}
                                </text>
                            )}
                        </g>
                    ))}
                </svg>
            </div>
            
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10, fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, background: 'var(--accent)', borderRadius: '50%' }}></div>
                    <span style={{ color: 'var(--text-main)' }}>Entradas</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, background: 'var(--danger)', borderRadius: '50%' }}></div>
                    <span style={{ color: 'var(--text-main)' }}>Saídas</span>
                </div>
            </div>
        </div>
    );
};

export default WeeklyChart;