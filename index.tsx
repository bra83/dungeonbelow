/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import Navigation from './components/Navigation';
import FilamentSpool from './components/FilamentSpool';
import SideDrawer from './components/SideDrawer';
import ConfirmationModal from './components/ConfirmationModal';
import Toast, { ToastMessage } from './components/Toast';
import WeeklyChart from './components/WeeklyChart';
import { Filament, Client, Quote, Settings, Expense, ViewMode, QuoteItem, FilamentType, ExpenseCategory, QuoteItemFilament, ProductionOrder, SalesChannel, MarketplaceFee } from './types';
import { generateId, formatCurrency, formatDate, calculateHourlyOperationalCost, calculateQuoteTotal } from './utils';
import { api } from './api';
import { DEFAULT_SETTINGS } from './constants';

// Threshold percentage for low stock alert
const LOW_STOCK_THRESHOLD = 15;

// --- APP COMPONENT ---

function App() {
    // Theme State
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('nonobit_theme') as 'light' | 'dark') || 'light';
    });

    // PWA Install Prompt State
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    // State Management
    const [view, setView] = useState<ViewMode>('dashboard');
    const [loading, setLoading] = useState(false);
    
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
    const [marketplaceFees, setMarketplaceFees] = useState<MarketplaceFee[]>([]); // NEW
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

    // UI States
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerType, setDrawerType] = useState<'filament' | 'client' | 'quote' | 'expense' | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Custom Modal & Toast State
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
        isLoading: false
    });
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    // --- EFFECTS ---
    
    // PWA Install Listener
    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult: any) => {
                if (choiceResult.outcome === 'accepted') {
                    setDeferredPrompt(null);
                }
            });
        } else {
            // Se o prompt nÃ£o estiver disponÃ­vel (ex: iOS ou jÃ¡ instalado/rejeitado), mostra instruÃ§Ã£o
            showToast("Para instalar: Toque em 'Compartilhar' > 'Adicionar Ã  Tela de InÃ­cio'", "info");
        }
    };

    // Apply Theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('nonobit_theme', theme);
        // Atualiza meta tag theme-color para mobile
        const metaThemeColor = document.querySelector("meta[name=theme-color]");
        if (metaThemeColor) {
            metaThemeColor.setAttribute("content", theme === 'dark' ? '#212529' : '#EFEEEE');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    // --- CALCULATED STATES (REALTIME DASHBOARD) ---
    const dashboardSummary = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const approvedQuotes = quotes.filter(q => q.status === 'approved');

        // Receita Total (Lifetime) e Mensal - Usar netValue se disponÃ­vel (Receita Real), senÃ£o finalPrice
        const revenueTotal = approvedQuotes.reduce((acc, q) => acc + (q.netValue || q.finalPrice), 0);
        
        const revenueMonth = approvedQuotes
            .filter(q => {
                const d = new Date(q.createdAt);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            })
            .reduce((acc, q) => acc + (q.netValue || q.finalPrice), 0);

        // Despesas Totais
        const expenseTotal = expenses.reduce((acc, e) => acc + e.amount, 0);
        
        // Custo estimado dos produtos vendidos
        const costOfGoodsSold = approvedQuotes.reduce((acc, q) => acc + q.totalCost, 0);

        // Lucro Estimado (Receita LÃ­quida - Custo ProduÃ§Ã£o)
        const estimatedProfit = revenueTotal - costOfGoodsSold;

        return {
            receitaTotal: revenueTotal,
            receitaMes: revenueMonth,
            despesasTotal: expenseTotal,
            lucroEstimado: estimatedProfit,
            saldoCaixa: revenueTotal - expenseTotal
        };
    }, [quotes, expenses]);

    const funnelData = useMemo(() => {
        const draft = quotes.filter(q => q.status === 'draft').length;
        const pending = quotes.filter(q => q.status === 'pending').length;
        const approved = quotes.filter(q => q.status === 'approved').length;
        const productionPending = productionOrders.length > 0 
            ? productionOrders.filter(p => p.Status !== 'ConcluÃ­da').length 
            : approved;
        const productionDone = productionOrders.filter(p => p.Status === 'ConcluÃ­da').length;

        return { draft, pending, approved, productionPending, productionDone };
    }, [quotes, productionOrders]);

    // NEW: Channel Stats
    const channelStats = useMemo(() => {
        const stats = new Map<SalesChannel, { count: number, revenue: number, profit: number }>();
        
        quotes.filter(q => q.status === 'approved').forEach(q => {
            const ch = q.channel || 'Direto';
            const current = stats.get(ch) || { count: 0, revenue: 0, profit: 0 };
            const net = q.netValue || q.finalPrice;
            
            stats.set(ch, {
                count: current.count + 1,
                revenue: current.revenue + net,
                profit: current.profit + (net - q.totalCost)
            });
        });
        
        return Array.from(stats.entries()).sort((a,b) => b[1].revenue - a[1].revenue);
    }, [quotes]);

    // --- UTILS ---
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const confirmAction = (title: string, message: string, action: () => Promise<void> | void) => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isLoading: true }));
                await action();
                setModalConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
            },
            isLoading: false
        });
    };

    // --- BACKUP AUTOMÃTICO (OFFLINE SUPPORT) ---
    useEffect(() => {
        localStorage.setItem('nonobit_quotes_backup', JSON.stringify(quotes));
    }, [quotes]);

    useEffect(() => {
        if(filaments.length > 0) localStorage.setItem('nonobit_filaments_backup', JSON.stringify(filaments));
    }, [filaments]);

    useEffect(() => {
        if(clients.length > 0) localStorage.setItem('nonobit_clients_backup', JSON.stringify(clients));
    }, [clients]);

    useEffect(() => {
        if(expenses.length > 0) localStorage.setItem('nonobit_expenses_backup', JSON.stringify(expenses));
    }, [expenses]);

    // Initial Load from API
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // SEQUENTIAL LOADING to avoid Rate Limiting
            const fils = await api.getFilaments();
            const clis = await api.getClients();
            const quotesCloud = await api.getQuotes();
            const expList = await api.getExpenses();
            const conf = await api.getConfig();
            const prods = await api.getProductionOrders();
            const fees = await api.getMarketplaceFees(); // Load Fees

            if(fils.length > 0) setFilaments(fils);
            if(clis.length > 0) setClients(clis);

            // RECONCILIATION
            const processedQuotes = quotesCloud.map(q => {
                const idMatch = clis.find(c => c.id === q.clientId);
                if (idMatch) return q;
                const nameMatch = clis.find(c => c.name.toLowerCase().trim() === q.clientId.toLowerCase().trim());
                if (nameMatch) {
                    return { ...q, clientId: nameMatch.id };
                }
                return q;
            });
            
            if(processedQuotes.length > 0) setQuotes(processedQuotes);
            if(expList.length > 0) setExpenses(expList);
            if(prods.length > 0) setProductionOrders(prods);
            if(fees.length > 0) setMarketplaceFees(fees);
            
            setSettings(conf);

            if(fils.length === 0 && clis.length === 0 && quotesCloud.length === 0) {
                 showToast("NÃ£o foi possÃ­vel conectar ao servidor. Verifique a URL do App Script ou sua internet.", "warning");
            }

        } catch (error) {
            console.error("Critical Failure in loadData", error);
            showToast("Erro crÃ­tico ao carregar dados.", "error");
        } finally {
            setLoading(false);
        }
    };

    // --- CRUD OPERATIONS ---
    
    const handleSaveFilament = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const form = e.target as HTMLFormElement;
        const data = new FormData(form);
        const safeFloat = (val: FormDataEntryValue | null) => val ? parseFloat(val as string) : 0;
        const newFilament: Filament = {
            id: editingId || generateId(),
            brand: data.get('brand') as string,
            name: data.get('name') as string,
            type: data.get('type') as FilamentType,
            colorHex: data.get('colorHex') as string,
            pricePerSpool: safeFloat(data.get('price')),
            weightPerSpoolGrams: safeFloat(data.get('weight')),
            currentWeightGrams: safeFloat(data.get('current')),
            purchaseDate: Date.now()
        };
        if (editingId) setFilaments(prev => prev.map(f => f.id === editingId ? newFilament : f));
        else setFilaments(prev => [...prev, newFilament]);
        setDrawerOpen(false);
        try { await api.saveFilament(newFilament); showToast("Filamento salvo!", "success"); } 
        catch (err: any) { showToast("Erro ao salvar.", "error"); } 
        finally { setLoading(false); }
    };

    const handleDeleteFilament = (id: string) => {
        if (!id) return;
        confirmAction("Excluir Filamento?", "Esta aÃ§Ã£o irÃ¡ mover o filamento para o arquivo morto.", async () => {
            setFilaments(prev => prev.filter(f => f.id !== id));
            try { await api.deleteFilament(id); showToast("Filamento excluÃ­do.", "success"); } 
            catch (err: any) { showToast("Erro API.", "error"); }
        });
    };

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const form = e.target as HTMLFormElement;
        const data = new FormData(form);
        const newClient: Client = {
            id: editingId || generateId(),
            name: data.get('name') as string,
            phone: data.get('phone') as string,
            email: data.get('email') as string,
            notes: data.get('notes') as string
        };
        if (editingId) setClients(prev => prev.map(c => c.id === editingId ? newClient : c));
        else setClients(prev => [...prev, newClient]);
        setDrawerOpen(false);
        try { await api.saveClient(newClient); showToast("Cliente salvo!", "success"); } 
        catch (err: any) { showToast("Erro nuvem.", "error"); } 
        finally { setLoading(false); }
    };

    const handleSaveQuote = async (quoteData: Quote) => {
        setLoading(true);
        if (editingId) setQuotes(prev => prev.map(q => q.id === editingId ? quoteData : q));
        else setQuotes(prev => [...prev, quoteData]);
        setDrawerOpen(false);
        try {
            const clientName = clients.find(c => c.id === quoteData.clientId)?.name;
            await api.saveQuote(quoteData, clientName);
            showToast("OrÃ§amento salvo!", "success");
        } catch (err: any) { showToast("Erro ao salvar.", "error"); } 
        finally { setLoading(false); }
    };
    
    const handleDeleteQuote = (id: string) => {
        if (!id) return;
        confirmAction("Excluir OrÃ§amento?", "AÃ§Ã£o irreversÃ­vel.", async () => {
            setQuotes(prev => prev.filter(q => q.id !== id));
            try { await api.deleteQuote(id); showToast("Removido.", "success"); } 
            catch (err: any) { showToast("Erro API.", "error"); }
        });
    };
    
    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const form = e.target as HTMLFormElement;
        const data = new FormData(form);
        const safeFloat = (val: FormDataEntryValue | null) => val ? parseFloat(val as string) : 0;
        const dateStr = data.get('date') as string;
        const expenseDate = dateStr ? new Date(dateStr + 'T12:00:00').getTime() : Date.now();
        const newExpense: Expense = {
            id: editingId || generateId(),
            description: data.get('description') as string,
            category: data.get('category') as ExpenseCategory,
            amount: safeFloat(data.get('amount')),
            isFixed: data.get('isFixed') === 'on',
            date: expenseDate
        };
        if (editingId) setExpenses(prev => prev.map(ex => ex.id === editingId ? newExpense : ex));
        else setExpenses(prev => [newExpense, ...prev]);
        setDrawerOpen(false);
        try { await api.saveExpense(newExpense); showToast("Despesa registrada!", "success"); } 
        catch (err: any) { showToast("Erro ao salvar.", "error"); } 
        finally { setLoading(false); }
    };

    const handleDeleteExpense = (id: string) => {
         confirmAction("Excluir Despesa?", "Remover registro?", async () => {
             setExpenses(prev => prev.filter(e => e.id !== id));
             try { await api.deleteExpense(id); showToast("Removida.", "success"); } 
             catch (err) { showToast("Erro ao remover.", "error"); }
         });
    };

    const handleApproveQuote = async (quoteId: string) => {
        const quote = quotes.find(q => q.id === quoteId);
        if(!quote || quote.status === 'approved') return;
        confirmAction("Aprovar Venda?", `Confirmar venda de ${formatCurrency(quote.netValue || quote.finalPrice)} (LÃ­quido)?`, async () => {
                setLoading(true);
                const client = clients.find(c => c.id === quote.clientId);
                // 1. Deduct Stock Locally
                const newFilaments = [...filaments];
                quote.items.forEach(item => {
                    item.filamentUsage.forEach(usage => {
                        const filIndex = newFilaments.findIndex(f => f.id === usage.filamentId);
                        if (filIndex > -1) {
                            newFilaments[filIndex] = { ...newFilaments[filIndex], currentWeightGrams: Math.max(0, newFilaments[filIndex].currentWeightGrams - usage.gramsUsed) };
                            api.saveFilament(newFilaments[filIndex]).catch(() => {});
                        }
                    });
                });
                setFilaments(newFilaments);
                // 2. Update status
                const updatedQuote = { ...quote, status: 'approved' as const };
                setQuotes(prev => prev.map(q => q.id === quoteId ? updatedQuote : q));
                try {
                    await api.finalizeSale(quote, client?.name || 'Desconhecido');
                    await api.saveQuote(updatedQuote, client?.name);
                    showToast("Venda registrada!", "success");
                } catch (err: any) { showToast("Erro ao salvar na nuvem.", "error"); } 
                finally { setLoading(false); }
            }
        );
    };

    const handleSaveSettings = async () => {
        setLoading(true);
        try { await api.saveConfig(settings); showToast("ConfiguraÃ§Ãµes salvas!", "success"); } 
        catch (err) { showToast("Erro ao salvar.", "error"); } 
        finally { setLoading(false); }
    }

    const handleWhatsapp = (quote: Quote) => {
        const client = clients.find(c => c.id === quote.clientId);
        if(!client) return;
        const message = `OlÃ¡ ${client.name}, segue orÃ§amento:\nTotal: ${formatCurrency(quote.finalPrice)}`;
        window.open(`https://wa.me/${client.phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`, '_blank');
    };

    // --- NEW DASHBOARD VIEW ---

    const DashboardView = () => {
        const lowStockFilaments = filaments.filter(f => {
            const pct = (f.currentWeightGrams / f.weightPerSpoolGrams) * 100;
            return pct <= LOW_STOCK_THRESHOLD;
        });

        const productionItems = productionOrders.length > 0 ? productionOrders : [];

        // Simple donut chart CSS
        const getDonutStyle = (stats: typeof channelStats) => {
            if (stats.length === 0) return {};
            const total = stats.reduce((acc, curr) => acc + curr[1].revenue, 0);
            let accum = 0;
            const gradients = stats.map((entry, i) => {
                const pct = (entry[1].revenue / total) * 100;
                const prev = accum;
                accum += pct;
                // Colors: Direto=Green, ML=Yellow, Shopee=Orange, Amazon=Blue, Outros=Gray
                let color = '#9CA3AF';
                if(entry[0] === 'Direto') color = 'var(--accent)'; // Green/Gold
                if(entry[0] === 'MercadoLivre') color = '#FACC15'; // Yellow
                if(entry[0] === 'Shopee') color = '#FB923C'; // Orange
                if(entry[0] === 'Amazon') color = '#60A5FA'; // Blue
                
                return `${color} ${prev}% ${accum}%`;
            }).join(', ');
            return { background: `conic-gradient(${gradients})` };
        };

        return (
            <div className="view-container">
                <div className="view-header">
                    <h1>Dashboard</h1>
                    {loading && <span className="status pending">Atualizando...</span>}
                </div>
                
                {/* 1. KPIs FINANCEIROS */}
                <div className="kpi-grid" style={{marginBottom: 24}}>
                    <div className="neu-card" style={{padding: 15}}>
                        <div style={{display:'flex', alignItems:'center', gap: 8, color: 'var(--text-light)', marginBottom: 5}}>
                            {/* SVG Icon instead of Emoji */}
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                            <span style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase'}}>Pedidos</span>
                        </div>
                        <p style={{fontSize: '1.5rem', fontWeight: 800, margin: 0}}>{funnelData.approved}</p>
                    </div>

                    <div className="neu-card" style={{padding: 15}}>
                         <div style={{display:'flex', alignItems:'center', gap: 8, color: 'var(--text-light)', marginBottom: 5}}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                            <span style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase'}}>Faturamento LÃ­q.</span>
                        </div>
                        <p style={{fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--accent)'}}>{formatCurrency(dashboardSummary.receitaTotal)}</p>
                    </div>

                    <div className="neu-card" style={{padding: 15}}>
                         <div style={{display:'flex', alignItems:'center', gap: 8, color: 'var(--text-light)', marginBottom: 5}}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                            <span style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase'}}>Despesas</span>
                        </div>
                        <p style={{fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--danger)'}}>{formatCurrency(dashboardSummary.despesasTotal)}</p>
                    </div>

                     <div className="neu-card" style={{padding: 15}}>
                         <div style={{display:'flex', alignItems:'center', gap: 8, color: 'var(--text-light)', marginBottom: 5}}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l9 4.9V17L12 22l-9-4.9V6.9L12 2z"></path></svg>
                            <span style={{fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase'}}>Lucro Real</span>
                        </div>
                        <p style={{fontSize: '1.5rem', fontWeight: 800, margin: 0, color: dashboardSummary.lucroEstimado >= 0 ? 'var(--accent)' : 'var(--danger)'}}>
                            {formatCurrency(dashboardSummary.lucroEstimado)}
                        </p>
                    </div>
                </div>

                <div className="grid-cards" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24}}>
                    
                    {/* 2. COLUNA ESQUERDA: ProduÃ§Ã£o e Estoque */}
                    <div style={{display:'flex', flexDirection:'column', gap: 24}}>
                         {/* CANAIS DE VENDA */}
                         <div className="neu-card">
                            <h3 style={{fontSize: '0.9rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 15}}>
                                ðŸŒ Canais de Venda
                            </h3>
                            <div style={{display:'flex', alignItems:'center', gap: 20}}>
                                {/* Donut Chart */}
                                <div style={{position:'relative', width: 100, height: 100, borderRadius:'50%', ...getDonutStyle(channelStats)}}>
                                     <div style={{position:'absolute', inset: 15, background:'var(--bg)', borderRadius:'50%'}}></div>
                                </div>
                                <div style={{flex:1}}>
                                    {channelStats.map(([channel, data]) => (
                                        <div key={channel} style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', marginBottom: 4, borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
                                            <span style={{fontWeight: 700}}>{channel}</span>
                                            <span>{data.count} un â€¢ {formatCurrency(data.revenue)}</span>
                                        </div>
                                    ))}
                                    {channelStats.length === 0 && <small>Sem vendas aprovadas.</small>}
                                </div>
                            </div>
                        </div>

                        {/* STATUS DE PRODUÃ‡ÃƒO */}
                        <div className="neu-card">
                            <h3 style={{fontSize: '0.9rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 15}}>
                                ðŸ­ Fila de ProduÃ§Ã£o
                            </h3>
                            {productionItems.length === 0 ? (
                                <div style={{textAlign:'center', padding: 20, opacity: 0.6}}>
                                    <p>Nenhuma ordem de produÃ§Ã£o.</p>
                                </div>
                            ) : (
                                <div style={{display:'flex', flexDirection:'column', gap: 10}}>
                                    {productionItems.slice(0, 5).map((op, i) => (
                                        <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
                                            <div>
                                                <div style={{fontWeight: 700, fontSize:'0.9rem'}}>OP #{op.ID_OP.split('-')[1] || op.ID_OP}</div>
                                                <div style={{fontSize:'0.75rem', color: 'var(--text-light)'}}>Ref: Pedido {op.ID_Pedido}</div>
                                            </div>
                                            <span className={`status ${op.Status === 'ConcluÃ­da' ? 'approved' : 'pending'}`}>
                                                {op.Status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. COLUNA DIREITA: Funil e GrÃ¡ficos */}
                    <div style={{display:'flex', flexDirection:'column', gap: 24}}>
                        {/* FUNIL DE VENDAS */}
                        <div className="neu-card">
                            <h3 style={{fontSize: '0.9rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 20}}>
                                ðŸŽ¯ Funil de Vendas
                            </h3>
                            <div style={{display:'flex', flexDirection:'column', gap: 12}}>
                                <div style={{display:'flex', alignItems:'center', gap: 10}}>
                                    <div style={{width: 60, fontSize:'0.75rem', textAlign:'right'}}>Rascunho</div>
                                    <div style={{flex: 1, background:'rgba(0,0,0,0.05)', height: 20, borderRadius: 4, overflow:'hidden'}}>
                                        <div style={{width: `${(funnelData.draft / (quotes.length || 1)) * 100}%`, background:'#9CA3AF', height:'100%'}}></div>
                                    </div>
                                    <div style={{width: 30, fontSize:'0.8rem', fontWeight:700}}>{funnelData.draft}</div>
                                </div>
                                <div style={{display:'flex', alignItems:'center', gap: 10}}>
                                    <div style={{width: 60, fontSize:'0.75rem', textAlign:'right'}}>Aprovado</div>
                                    <div style={{flex: 1, background:'rgba(0,0,0,0.05)', height: 20, borderRadius: 4, overflow:'hidden'}}>
                                        <div style={{width: `${(funnelData.approved / (quotes.length || 1)) * 100}%`, background:'var(--accent)', height:'100%'}}></div>
                                    </div>
                                    <div style={{width: 30, fontSize:'0.8rem', fontWeight:700}}>{funnelData.approved}</div>
                                </div>
                                <div style={{display:'flex', alignItems:'center', gap: 10}}>
                                    <div style={{width: 60, fontSize:'0.75rem', textAlign:'right'}}>Fila Prod.</div>
                                    <div style={{flex: 1, background:'rgba(0,0,0,0.05)', height: 20, borderRadius: 4, overflow:'hidden'}}>
                                         <div style={{width: `${(funnelData.productionPending / (quotes.length || 1)) * 100}%`, background:'#3B82F6', height:'100%'}}></div>
                                    </div>
                                    <div style={{width: 30, fontSize:'0.8rem', fontWeight:700}}>{funnelData.productionPending}</div>
                                </div>
                            </div>
                        </div>

                         {/* FLUXO DE CAIXA (GrÃ¡fico) */}
                        <WeeklyChart quotes={quotes} expenses={expenses} />

                    </div>
                </div>
            </div>
        );
    };

    const FilamentsView = () => (
        <div className="view-container">
            <div className="view-header">
                <h1>Filamentos</h1>
                <div style={{display:'flex', gap: 10}}>
                    {loading && <span className="status pending">Carregando...</span>}
                    <button className="fab-button" onClick={() => { setEditingId(null); setDrawerType('filament'); setDrawerOpen(true); }}>+</button>
                </div>
            </div>
            <div className="grid-cards">
                {filaments.length === 0 && !loading && (
                    <div className="neu-card" style={{textAlign:'center', gridColumn: '1 / -1'}}>Nenhum filamento encontrado. Verifique a conexÃ£o.</div>
                )}
                {filaments.map(f => (
                    <FilamentSpool 
                        key={f.id} 
                        filament={f} 
                        onEdit={(fil) => { setEditingId(fil.id); setDrawerType('filament'); setDrawerOpen(true); }}
                        onDelete={handleDeleteFilament}
                    />
                ))}
            </div>
        </div>
    );

    const ClientsView = () => (
        <div className="view-container">
            <div className="view-header">
                <h1>Clientes</h1>
                <div style={{display:'flex', gap: 10}}>
                    {loading && <span className="status pending">Carregando...</span>}
                    <button className="fab-button" onClick={() => { setEditingId(null); setDrawerType('client'); setDrawerOpen(true); }}>+</button>
                </div>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr><th>Nome</th><th>AÃ§Ãµes</th></tr>
                    </thead>
                    <tbody>
                         {clients.length === 0 && !loading && (
                            <tr><td colSpan={2} style={{textAlign:'center'}}>Nenhum cliente encontrado.</td></tr>
                        )}
                        {clients.map(c => (
                            <tr key={c.id}>
                                <td>
                                    <div style={{fontWeight:'bold'}}>{c.name}</div>
                                    <div style={{fontSize:'0.8rem', color:'var(--text-light)'}}>{c.phone}</div>
                                </td>
                                <td>
                                    <button className="neu-btn" style={{padding: '6px 12px', fontSize:'0.8rem'}} onClick={() => { setEditingId(c.id); setDrawerType('client'); setDrawerOpen(true); }}>Editar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
    
    const QuotesView = () => {
        const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Desconhecido';
        const sortedQuotes = [...quotes].sort((a, b) => b.createdAt - a.createdAt);

        return (
            <div className="view-container">
                <div className="view-header">
                    <h1>OrÃ§amentos</h1>
                    <div style={{display:'flex', gap: 10}}>
                        {loading && <span className="status pending">Carregando...</span>}
                        <button className="fab-button" onClick={() => { setEditingId(null); setDrawerType('quote'); setDrawerOpen(true); }}>+</button>
                    </div>
                </div>
                <div className="grid-cards">
                    {sortedQuotes.length === 0 && !loading && (
                        <div className="neu-card" style={{textAlign:'center', gridColumn: '1 / -1'}}>Nenhum orÃ§amento encontrado.</div>
                    )}
                    {sortedQuotes.map(q => (
                        <div key={q.id} className="neu-card" style={{position:'relative'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom: 10}}>
                                <span className={`status ${q.status}`}>{q.status}</span>
                                <span style={{fontSize: '0.75rem', color: 'var(--text-light)'}}>{formatDate(q.createdAt)}</span>
                            </div>
                            <h3 style={{marginBottom: 5}}>{getClientName(q.clientId)}</h3>
                            
                            <div style={{fontSize:'1.5rem', fontWeight: 800, margin: '10px 0', color: 'var(--accent)'}}>
                                {formatCurrency(q.finalPrice)}
                            </div>
                            
                            <div style={{display:'flex', gap: 10, fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: 15}}>
                                <span>{q.items.length} item(s)</span>
                                <span>â€¢</span>
                                <span>{q.channel || 'Direto'}</span>
                            </div>
                            
                            <div className="card-actions" style={{display:'flex', gap: 8}}>
                                <button className="neu-btn" style={{flex:1}} onClick={() => { setEditingId(q.id); setDrawerType('quote'); setDrawerOpen(true); }}>Editar</button>
                                <button className="neu-btn" title="Enviar WhatsApp" onClick={() => handleWhatsapp(q)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                </button>
                                {q.status !== 'approved' && (
                                    <button className="neu-btn primary" title="Aprovar Venda" onClick={() => handleApproveQuote(q.id)}>âœ“</button>
                                )}
                                <button className="neu-btn danger" title="Excluir" onClick={() => handleDeleteQuote(q.id)}>âœ•</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const ExtractView = () => {
        const sortedExpenses = [...expenses].sort((a, b) => b.date - a.date);

        return (
            <div className="view-container">
                <div className="view-header">
                    <h1>Extrato Financeiro</h1>
                    <div style={{display:'flex', gap: 10}}>
                         {loading && <span className="status pending">Carregando...</span>}
                         <button className="fab-button" onClick={() => { setEditingId(null); setDrawerType('expense'); setDrawerOpen(true); }}>+</button>
                    </div>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>DescriÃ§Ã£o / Categoria</th>
                                <th style={{textAlign: 'right'}}>Valor</th>
                                <th style={{textAlign: 'center'}}>AÃ§Ãµes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedExpenses.length === 0 && !loading && (
                                <tr><td colSpan={4} style={{textAlign:'center', padding: 20}}>Nenhuma despesa registrada.</td></tr>
                            )}
                            {sortedExpenses.map(e => (
                                <tr key={e.id}>
                                    <td style={{fontSize:'0.85rem'}}>{formatDate(e.date)}</td>
                                    <td>
                                        <div style={{fontWeight:'bold'}}>{e.description}</div>
                                        <span className="badge-tag">{e.category}</span>
                                        {e.isFixed && <span className="badge-tag" style={{marginLeft: 5, background: 'var(--accent)', color: '#fff'}}>Fixo</span>}
                                    </td>
                                    <td style={{textAlign: 'right', fontWeight: 700, color: 'var(--danger)'}}>
                                        - {formatCurrency(e.amount)}
                                    </td>
                                    <td style={{textAlign: 'center'}}>
                                         <div style={{display:'flex', gap: 5, justifyContent:'center'}}>
                                            <button className="mini-btn" onClick={() => { setEditingId(e.id); setDrawerType('expense'); setDrawerOpen(true); }}>âœŽ</button>
                                            <button className="mini-btn danger" onClick={() => handleDeleteExpense(e.id)}>âœ•</button>
                                         </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const ProductionView = () => {
        return (
            <div className="view-container">
                <div className="view-header">
                    <h1>Ordens de ProduÃ§Ã£o</h1>
                    {loading && <span className="status pending">Atualizando...</span>}
                </div>
                {productionOrders.length === 0 && !loading ? (
                    <div className="neu-card" style={{textAlign:'center', padding: 30}}>Nenhuma ordem de produÃ§Ã£o ativa.</div>
                ) : (
                    <div className="grid-cards">
                        {productionOrders.map((op, i) => (
                             <div key={i} className="neu-card">
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
                                    <h3 style={{margin:0}}>OP #{op.ID_OP.split('-')[1] || op.ID_OP}</h3>
                                    <span className={`status ${op.Status === 'ConcluÃ­da' ? 'approved' : 'pending'}`}>{op.Status}</span>
                                </div>
                                <p style={{color: 'var(--text-light)', margin: '5px 0'}}>Pedido ReferÃªncia: <strong>{op.ID_Pedido}</strong></p>
                                {op.Peso_Real_g ? (
                                    <p style={{margin: '5px 0'}}>Peso Real: <strong>{op.Peso_Real_g}g</strong></p>
                                ) : (
                                    <p style={{margin: '5px 0', color: 'var(--text-light)', fontSize: '0.8rem'}}>Peso ainda nÃ£o registrado</p>
                                )}
                             </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const SettingsView = () => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setSettings(prev => ({ ...prev, [e.target.name]: parseFloat(e.target.value) }));
        };
        const currentMonthTotalFixed = expenses.filter(e => e.isFixed).reduce((acc, curr) => acc + curr.amount, 0);
        const updateFixedExpenses = () => {
             setSettings(prev => ({ ...prev, monthlyFixedExpenses: currentMonthTotalFixed }));
             showToast("Valor atualizado!", "success");
        };
        const hourlyCost = calculateHourlyOperationalCost(settings);
        const machineDepreciation = (settings.machineValue || 0) / (settings.machineLifespanHours || 1);

        return (
            <div className="view-container">
                <div className="view-header">
                     <h1>ConfiguraÃ§Ã£o</h1>
                     <button className="neu-btn primary" onClick={handleSaveSettings} disabled={loading}>Salvar Nuvem</button>
                </div>
                
                {/* PWA INSTALL BUTTON - ALWAYS VISIBLE */}
                <div className="neu-card" style={{marginBottom: 20, textAlign: 'center', background: 'rgba(212, 175, 55, 0.1)', border: '1px solid var(--accent)'}}>
                    <h3 style={{fontSize: '0.9rem', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10}}>Instalar Aplicativo</h3>
                    <p style={{fontSize: '0.9rem', marginBottom: 15}}>Instale o DungeonERP no seu celular para acesso rÃ¡pido e modo tela cheia.</p>
                    <button 
                        className="neu-btn primary" 
                        style={{width: '100%', padding: 12}} 
                        onClick={handleInstallClick}
                    >
                        {deferredPrompt ? 'Instalar Agora' : 'Como Instalar?'}
                    </button>
                </div>

                <div className="neu-card" style={{marginBottom: 20, textAlign: 'center'}}>
                    <h3 style={{fontSize: '0.8rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 5}}>Custo Total da Hora</h3>
                    <p style={{fontSize: '1.8rem', fontWeight: 800, margin: 0}}>{formatCurrency(hourlyCost)}</p>
                    <small style={{fontSize: '0.7rem', color: 'var(--text-light)'}}>Soma de Fixo, Energia, MÃ¡quina e MÃ£o de Obra</small>
                </div>
                <div className="neu-card">
                    <h3 style={{marginTop:0, marginBottom: 20, fontSize: '0.9rem', color:'var(--text-light)', textTransform:'uppercase'}}>Custos Operacionais</h3>
                    <div className="erp-form two-col">
                        <div className="form-group">
                            <label>Despesas Fixas (R$/mÃªs)</label>
                            <input className="neu-input" type="number" name="monthlyFixedExpenses" value={settings.monthlyFixedExpenses} onChange={handleChange} />
                            {currentMonthTotalFixed > 0 && currentMonthTotalFixed !== settings.monthlyFixedExpenses && (
                                <button className="neu-btn" style={{fontSize:'0.7rem', padding: '4px 8px', marginTop: 4}} onClick={updateFixedExpenses}>Usar valor calculado: {formatCurrency(currentMonthTotalFixed)}</button>
                            )}
                        </div>
                        <div className="form-group">
                            <label>Horas Trab./MÃªs</label>
                            <input className="neu-input" type="number" name="workHoursPerMonth" value={settings.workHoursPerMonth} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Custo Energia (R$/kWh)</label>
                            <input className="neu-input" type="number" step="0.01" name="energyCostPerKwh" value={settings.energyCostPerKwh} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>PotÃªncia Impressora (W)</label>
                            <input className="neu-input" type="number" name="printerPowerWatts" value={settings.printerPowerWatts} onChange={handleChange} />
                        </div>
                         <div className="form-group" style={{gridColumn: '1 / -1', border: '1px solid rgba(125,125,125,0.1)', padding: 10, borderRadius: 12}}>
                            <label style={{color: 'var(--text-main)', marginBottom: 10, display: 'block'}}>MÃ¡quina / DepreciaÃ§Ã£o</label>
                            <div className="two-col">
                                <div>
                                    <label style={{fontSize: '0.7rem'}}>Valor MÃ¡quina (R$)</label>
                                    <input className="neu-input" type="number" name="machineValue" value={settings.machineValue} onChange={handleChange} />
                                </div>
                                <div>
                                    <label style={{fontSize: '0.7rem'}}>Vida Ãštil (Horas)</label>
                                    <input className="neu-input" type="number" name="machineLifespanHours" value={settings.machineLifespanHours} onChange={handleChange} />
                                </div>
                            </div>
                            <small style={{display:'block', marginTop:5, fontSize:'0.75rem', color: 'var(--accent)', fontWeight: 700}}>Custo Calculado: {formatCurrency(machineDepreciation)} / hora</small>
                        </div>
                         <div className="form-group" style={{border: '1px solid var(--accent)', padding: 10, borderRadius: 12, background: 'rgba(212, 175, 55, 0.05)'}}>
                            <label style={{color: 'var(--accent)'}}>MÃ£o de Obra MÃ¡quina (R$/h)</label>
                            <input className="neu-input" type="number" name="laborRatePerHour" value={settings.laborRatePerHour} onChange={handleChange} />
                        </div>
                    </div>
                    <h3 style={{marginTop:30, marginBottom: 20, fontSize: '0.9rem', color:'var(--text-light)', textTransform:'uppercase'}}>Margens e Perdas</h3>
                    <div className="erp-form two-col">
                        <div className="form-group">
                            <label>Taxa de Falha (%)</label>
                            <input className="neu-input" type="number" name="failureRatePercent" value={settings.failureRatePercent} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>DesperdÃ­cio Mat. (%)</label>
                            <input className="neu-input" type="number" name="materialWastePercent" value={settings.materialWastePercent || 5} onChange={handleChange} placeholder="Suportes, Poop, Flush" />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const QuoteForm = () => {
        const existingQuote = useMemo(() => editingId ? quotes.find(q => q.id === editingId) : null, [editingId, quotes]);
        const [items, setItems] = useState<QuoteItem[]>(existingQuote?.items || []);
        const [selectedClient, setSelectedClient] = useState(existingQuote?.clientId || '');
        const [margin, setMargin] = useState(existingQuote?.profitMarginPercent || 50);
        const [channel, setChannel] = useState<SalesChannel>(existingQuote?.channel || 'Direto');
        
        // Dynamic Calculation including Marketplace Fees
        const calc = useMemo(() => {
             return calculateQuoteTotal(items, filaments, settings, margin, channel, marketplaceFees);
        }, [items, filaments, settings, margin, channel, marketplaceFees]);

        const addItem = () => setItems([...items, { id: generateId(), description: '', printTimeHours: 0, filamentUsage: [{ id: generateId(), filamentId: filaments[0]?.id || '', gramsUsed: 0 }] }]);
        const updateItem = (index: number, field: keyof QuoteItem, val: any) => { const newItems = [...items]; newItems[index] = { ...newItems[index], [field]: val }; setItems(newItems); };
        const addFilamentToItem = (itemIndex: number) => { const newItems = [...items]; newItems[itemIndex].filamentUsage.push({ id: generateId(), filamentId: filaments[0]?.id || '', gramsUsed: 0 }); setItems(newItems); };
        const updateFilamentUsage = (itemIndex: number, filamentIndex: number, field: keyof QuoteItemFilament, val: any) => { const newItems = [...items]; newItems[itemIndex].filamentUsage[filamentIndex] = { ...newItems[itemIndex].filamentUsage[filamentIndex], [field]: val }; setItems(newItems); };
        const removeFilamentFromItem = (itemIndex: number, filamentIndex: number) => { const newItems = [...items]; newItems[itemIndex].filamentUsage = newItems[itemIndex].filamentUsage.filter((_, i) => i !== filamentIndex); setItems(newItems); };
        const deleteItem = (index: number) => setItems(items.filter((_, i) => i !== index));

        const save = () => {
            if(!selectedClient) return showToast('Selecione um cliente', 'error');
            const newQuote: Quote = { 
                id: editingId || generateId(), 
                clientId: selectedClient, 
                items, 
                profitMarginPercent: margin, 
                totalCost: calc.totalCost, 
                finalPrice: calc.finalPrice, 
                channel: channel,
                taxAmount: calc.taxAmount,
                netValue: calc.netValue,
                status: existingQuote ? existingQuote.status : 'pending', 
                createdAt: existingQuote ? existingQuote.createdAt : Date.now() 
            };
            handleSaveQuote(newQuote);
        };

        return (
            <div className="erp-form">
                <div className="form-group"><label>Cliente</label><select className="neu-input" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}><option value="">Selecione...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                
                {/* CHANNEL SELECTOR */}
                <div className="form-group">
                    <label>Canal de Venda</label>
                    <select className="neu-input" value={channel} onChange={e => setChannel(e.target.value as SalesChannel)}>
                        <option value="Direto">Direto (Sem Taxa)</option>
                        <option value="MercadoLivre">Mercado Livre</option>
                        <option value="Shopee">Shopee</option>
                        <option value="Amazon">Amazon</option>
                        <option value="Outros">Outros</option>
                    </select>
                </div>

                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10}}><h3>Itens</h3><button type="button" className="neu-btn" onClick={addItem}>+ Item</button></div>
                {items.map((item, idx) => (
                    <div key={item.id} className="neu-card" style={{marginBottom: 10, padding: 15, position: 'relative'}}>
                        <button type="button" className="neu-btn danger" style={{position: 'absolute', right: 5, top: 5, width: 24, height: 24, padding: 0}} onClick={() => deleteItem(idx)}>&times;</button>
                        <div className="two-col"><div className="form-group"><label>DescriÃ§Ã£o</label><input className="neu-input" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} /></div><div className="form-group"><label>Tempo (h)</label><input className="neu-input" type="number" value={item.printTimeHours} onChange={e => updateItem(idx, 'printTimeHours', parseFloat(e.target.value))} /></div></div>
                        <div style={{marginTop: 10, padding: 10, background: 'rgba(0,0,0,0.03)', borderRadius: 10}}>
                             <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                <label>Filamentos</label><button type="button" className="neu-btn primary" onClick={() => addFilamentToItem(idx)} style={{padding: '2px 8px', fontSize: '0.7rem'}}>+ Cor</button>
                             </div>
                             {item.filamentUsage.map((usage, fIdx) => (
                                <div key={usage.id} style={{display: 'grid', gridTemplateColumns: '1fr 80px 30px', gap: 8, marginTop: 5}}>
                                    <select className="neu-input" style={{padding: 5}} value={usage.filamentId} onChange={e => updateFilamentUsage(idx, fIdx, 'filamentId', e.target.value)}>{filaments.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                                    <input className="neu-input" style={{padding: 5}} type="number" value={usage.gramsUsed} onChange={e => updateFilamentUsage(idx, fIdx, 'gramsUsed', parseFloat(e.target.value))} />
                                    <button type="button" className="neu-btn danger" style={{padding:0}} onClick={() => removeFilamentFromItem(idx, fIdx)}>&times;</button>
                                </div>
                             ))}
                        </div>
                    </div>
                ))}
                
                <div className="form-group"><label>Margem LÃ­quida Desejada (%)</label><input className="neu-input" type="number" value={margin} onChange={e => setMargin(parseFloat(e.target.value))} /></div>
                
                <div className="kpi-card" style={{marginTop: 20}}>
                    <h3>PreÃ§o Sugerido ({channel})</h3>
                    <p className="value">{formatCurrency(calc.finalPrice)}</p>
                    
                    <div style={{width: '100%', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4}}>
                         <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', paddingBottom: 5, borderBottom: '1px solid rgba(125,125,125,0.1)'}}>
                            <span style={{color: 'var(--text-light)'}}>Custo ProduÃ§Ã£o:</span>
                            <span style={{fontWeight: 700}}>{formatCurrency(calc.totalCost)}</span>
                         </div>
                         
                         {/* Detalhamento de Custo */}
                         {calc.breakdown && (
                             <div style={{fontSize: '0.7rem', color: 'var(--text-light)', paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 5}}>
                                 <div style={{display:'flex', justifyContent:'space-between'}}><span>Material:</span><span>{formatCurrency(calc.breakdown.material)}</span></div>
                                 <div style={{display:'flex', justifyContent:'space-between'}}><span>Energia:</span><span>{formatCurrency(calc.breakdown.energy)}</span></div>
                                 <div style={{display:'flex', justifyContent:'space-between'}}><span>DepreciaÃ§Ã£o:</span><span>{formatCurrency(calc.breakdown.depreciation)}</span></div>
                                 <div style={{display:'flex', justifyContent:'space-between'}}><span>Fixo + MO:</span><span>{formatCurrency(calc.breakdown.fixed + calc.breakdown.labor)}</span></div>
                                 <div style={{display:'flex', justifyContent:'space-between'}}><span>Risco/Perda:</span><span>{formatCurrency(calc.breakdown.risk)}</span></div>
                             </div>
                         )}

                         <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem'}}>
                            <span style={{color: 'var(--text-light)'}}>Taxas ({channel}):</span>
                            <span style={{color: 'var(--danger)'}}>- {formatCurrency(calc.taxAmount)}</span>
                         </div>
                         <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, borderTop: '1px solid rgba(125,125,125,0.1)', paddingTop: 4}}>
                            <span>LÃ­quido (VocÃª Recebe):</span>
                            <span style={{color: 'var(--accent)'}}>{formatCurrency(calc.netValue)}</span>
                         </div>
                         <small style={{fontSize:'0.7rem', color: 'var(--text-light)', marginTop: 4, textAlign: 'right'}}>
                             Lucro Real: {formatCurrency(calc.marginValue)}
                         </small>
                    </div>
                </div>
                
                <div className="drawer-footer"><button className="neu-btn btn-save" onClick={save}>Salvar</button><button className="neu-btn btn-cancel" onClick={() => setDrawerOpen(false)}>Voltar</button></div>
            </div>
        );
    };

    // ClientForm, FilamentForm... (Mantidos)
    const FilamentForm = () => {
        const initial = (filaments.find(f => f.id === editingId) || {}) as Partial<Filament>;
        return (
            <form className="erp-form" onSubmit={handleSaveFilament}>
                <div className="form-group"><label>Marca</label><input className="neu-input" name="brand" defaultValue={initial.brand} required /></div>
                <div className="form-group"><label>Nome / Cor</label><input className="neu-input" name="name" defaultValue={initial.name} required /></div>
                <div className="two-col"><div className="form-group"><label>Tipo</label><select className="neu-input" name="type" defaultValue={initial.type || 'PLA'}><option value="PLA">PLA</option><option value="ABS">ABS</option><option value="PETG">PETG</option><option value="TPU">TPU</option><option value="RESIN">Resina</option></select></div><div className="form-group"><label>Cor</label><input className="neu-input" type="color" name="colorHex" defaultValue={initial.colorHex || '#4ade80'} style={{height: 48, padding: 4}} /></div></div>
                <div className="two-col"><div className="form-group"><label>PreÃ§o</label><input className="neu-input" name="price" type="number" step="0.01" defaultValue={initial.pricePerSpool} required /></div><div className="form-group"><label>Peso Total (g)</label><input className="neu-input" name="weight" type="number" defaultValue={initial.weightPerSpoolGrams || 1000} required /></div></div>
                <div className="form-group"><label>Peso Atual (g)</label><input className="neu-input" name="current" type="number" defaultValue={initial.currentWeightGrams || 1000} required /></div>
                <div className="drawer-footer"><button type="submit" className="neu-btn btn-save" disabled={loading}>Salvar</button><button type="button" className="neu-btn btn-cancel" onClick={() => setDrawerOpen(false)}>Cancelar</button></div>
            </form>
        );
    };

     const ClientForm = () => {
        const initial = (clients.find(c => c.id === editingId) || {}) as Partial<Client>;
        return (
            <form className="erp-form" onSubmit={handleSaveClient}>
                <div className="form-group"><label>Nome</label><input className="neu-input" name="name" defaultValue={initial.name} required /></div>
                <div className="form-group"><label>Telefone</label><input className="neu-input" name="phone" defaultValue={initial.phone} required /></div>
                <div className="form-group"><label>Email</label><input className="neu-input" name="email" type="email" defaultValue={initial.email} /></div>
                <div className="form-group"><label>Notas</label><textarea className="neu-input" name="notes" defaultValue={initial.notes} /></div>
                <div className="drawer-footer"><button type="submit" className="neu-btn btn-save" disabled={loading}>Salvar</button><button type="button" className="neu-btn btn-cancel" onClick={() => setDrawerOpen(false)}>Cancelar</button></div>
            </form>
        );
    };

    const ExpenseForm = () => {
        const initial = (expenses.find(e => e.id === editingId) || { date: Date.now() }) as Partial<Expense>;
        const dateValue = initial.date ? new Date(initial.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        return (
             <form className="erp-form" onSubmit={handleSaveExpense}>
                <div className="form-group">
                    <label>DescriÃ§Ã£o</label>
                    <input className="neu-input" name="description" defaultValue={initial.description} required placeholder="Ex: Rolo PLA Preto" />
                </div>
                <div className="form-group">
                    <label>Categoria</label>
                    <select className="neu-input" name="category" defaultValue={initial.category || 'outros'}>
                        <option value="filamento">Filamento</option>
                        <option value="ferramenta">Ferramenta / PeÃ§as</option>
                        <option value="manutencao">ManutenÃ§Ã£o</option>
                        <option value="energia">Energia ElÃ©trica</option>
                        <option value="fixo">Custo Fixo (Aluguel/Softwares)</option>
                        <option value="outros">Outros</option>
                    </select>
                </div>
                <div className="two-col">
                    <div className="form-group">
                        <label>Valor (R$)</label>
                        <input className="neu-input" name="amount" type="number" step="0.01" defaultValue={initial.amount} required />
                    </div>
                     <div className="form-group">
                        <label>Data</label>
                        <input className="neu-input" name="date" type="date" defaultValue={dateValue} required />
                    </div>
                </div>
                <div className="form-group" style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10}}>
                    <input type="checkbox" name="isFixed" defaultChecked={initial.isFixed} id="isFixedCheck" style={{width: 20, height: 20}} />
                    <label htmlFor="isFixedCheck" style={{marginBottom:0}}>Despesa Fixa Recorrente?</label>
                </div>
                <p style={{fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: 20}}>
                    Despesas fixas marcadas aqui sÃ£o usadas para calcular a sugestÃ£o de "Custo Fixo Mensal" na aba de ConfiguraÃ§Ã£o.
                </p>
                <div className="drawer-footer">
                    <button type="submit" className="neu-btn btn-save" disabled={loading}>Salvar</button>
                    <button type="button" className="neu-btn btn-cancel" onClick={() => setDrawerOpen(false)}>Cancelar</button>
                </div>
            </form>
        );
    };

    return (
        <div className="erp-container">
            <ConfirmationModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} isLoading={modalConfig.isLoading} />
            <Toast toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
            <div className="mobile-header"><h1 className="brand-text">Dungeon Below</h1><button onClick={toggleTheme} className="fab-button" style={{width: 32, height: 32, fontSize: '0.8rem', marginLeft: 'auto', marginRight: 0, boxShadow: 'none', background: 'transparent'}}>{theme === 'light' ? 'ðŸŒ™' : 'â˜€ï¸'}</button></div>
            <Navigation currentView={view} setView={setView} toggleTheme={toggleTheme} isDarkMode={theme === 'dark'} />
            <main className="main-content">
                {view === 'dashboard' && <DashboardView />}
                {view === 'filaments' && <FilamentsView />}
                {view === 'clients' && <ClientsView />}
                {view === 'quotes' && <QuotesView />}
                {view === 'calculator' && <SettingsView />}
                {view === 'extract' && <ExtractView />}
                {view === 'production' && <ProductionView />}
            </main>
            <SideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={drawerType === 'filament' ? 'Filamento' : drawerType === 'client' ? 'Cliente' : drawerType === 'quote' ? 'OrÃ§amento' : 'Despesa'}>
                {drawerType === 'filament' && <FilamentForm />}
                {drawerType === 'client' && <ClientForm />}
                {drawerType === 'quote' && <QuoteForm />}
                {drawerType === 'expense' && <ExpenseForm />}
            </SideDrawer>
        </div>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
        }
