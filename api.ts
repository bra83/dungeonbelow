/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { API_URL, DEFAULT_SETTINGS } from './constants';
import { Filament, Settings, Client, Quote, QuoteItem, Expense, QuoteItemFilament, ProductionOrder, MarketplaceFee } from './types';
import { generateId } from './utils';

// Helper para fazer requisições ao GAS com Retry
async function fetchGAS(params: string, method: 'GET' | 'POST' = 'GET', body?: any, retries = 1) {
    const url = new URL(API_URL);
    const incomingParams = new URLSearchParams(params);
    incomingParams.forEach((value, key) => url.searchParams.append(key, value));
    url.searchParams.append('_t', Date.now().toString()); // Cache Buster

    const options: RequestInit = {
        method,
        mode: 'cors',
        credentials: 'omit',
    };

    if (method === 'POST' && body) {
        options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url.toString(), options);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            // Check for common HTML error pages from Google Apps Script (e.g. 404, Permissions, Script Error)
            if (text.trim().startsWith("<") || text.includes("<!DOCTYPE html>")) {
                 throw new Error("GAS returned HTML. Check API URL or Script Deployment ID.");
            }
            throw new Error("Invalid JSON response from server.");
        }
        
        if (data && data.error) throw new Error(data.error);
        return data;
    } catch (error) {
        if (retries > 0) {
            // Wait 1s before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchGAS(params, method, body, retries - 1);
        }
        throw error;
    }
}

// --- MAPPERS ---

const parseNumber = (value: any, defaultValue: number = 0): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const clean = value.replace(',', '.').trim();
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
};

const formatDateForSheet = (timestamp: number) => {
    // Return YYYY-MM-DD HH:mm:ss for better compatibility
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const mapFilamentFromGAS = (f: any): Filament => {
    // Helper seguro para arrays ou objetos
    const getVal = (key: string, idx: number, def: any) => {
        if (f[key] !== undefined) return f[key];
        if (Array.isArray(f) && f.length > idx) return f[idx];
        return def;
    };

    const type = getVal('tipo', 2, 'PLA');
    const color = getVal('cor', 3, '');
    const rawId = getVal('id', 0, '') || getVal('0', 0, '');

    return {
        id: rawId ? String(rawId).trim() : '',
        brand: getVal('marca', 1, 'Generico'),
        name: type + ' ' + color,
        type: type,
        colorHex: getVal('cor_hex', 11, '#4ade80'),
        pricePerSpool: parseNumber(getVal('preco_total', 6, 0)),
        weightPerSpoolGrams: parseNumber(getVal('peso_inicial_g', 4, 1000)),
        currentWeightGrams: parseNumber(getVal('peso_atual_g', 5, 1000)),
        purchaseDate: new Date(getVal('data_compra', 10, Date.now())).getTime()
    };
};

const mapFilamentToGAS = (f: Filament) => {
    let cor = f.name;
    const typeLower = f.type.toLowerCase();
    const nameLower = f.name.toLowerCase();
    if (nameLower.startsWith(typeLower)) {
        cor = f.name.substring(f.type.length).trim();
    }
    if (!cor) cor = f.name;

    return {
        id: String(f.id).trim(),
        marca: f.brand,
        tipo: f.type,
        cor: cor,
        peso_inicial_g: f.weightPerSpoolGrams,
        peso_atual_g: f.currentWeightGrams,
        preco_total: f.pricePerSpool,
        cor_hex: f.colorHex,
        data_compra: formatDateForSheet(f.purchaseDate)
    };
};

const mapQuoteFromGAS = (q: any): Quote => {
    let items: QuoteItem[] = [];
    try {
        const rawItems = q.items;
        let parsedItems: any[] = [];
        if (Array.isArray(rawItems)) parsedItems = rawItems;
        else if (typeof rawItems === 'string') parsedItems = JSON.parse(rawItems);

        items = parsedItems.map((item: any) => {
            const newItem: QuoteItem = {
                id: item.id || generateId(),
                description: item.description || '',
                printTimeHours: parseNumber(item.printTimeHours, 0),
                filamentUsage: []
            };

            if (item.filamentUsage && Array.isArray(item.filamentUsage)) {
                newItem.filamentUsage = item.filamentUsage;
            } else if (item.filamentId) {
                newItem.filamentUsage.push({
                    id: generateId(),
                    filamentId: item.filamentId,
                    gramsUsed: parseNumber(item.gramsUsed, 0)
                });
            }
            return newItem;
        });
    } catch (e) { items = []; }

    return {
        id: String(q.id || ''),
        clientId: String(q.clientId || ''),
        items: items,
        profitMarginPercent: parseNumber(q.profitMarginPercent),
        totalCost: parseNumber(q.totalCost),
        finalPrice: parseNumber(q.finalPrice),
        // New fields
        channel: (q.channel || 'Direto') as any,
        taxAmount: parseNumber(q.taxAmount || q.taxas || 0),
        netValue: parseNumber(q.netValue || q.valor_liquido || q.finalPrice),
        
        status: (q.status || 'draft') as any,
        createdAt: new Date(q.createdAt || Date.now()).getTime()
    };
};

const mapQuoteToGAS = (q: Quote, clientName?: string) => ({
    id: q.id,
    clientId: clientName || q.clientId,
    cliente_id_sistema: q.clientId,
    nome_cliente: clientName || '',
    cliente: clientName || '', 
    items: JSON.stringify(q.items),
    profitMarginPercent: q.profitMarginPercent,
    totalCost: q.totalCost,
    finalPrice: q.finalPrice,
    // Sending new fields to backend
    channel: q.channel,
    taxas: q.taxAmount,
    valor_liquido: q.netValue,
    
    status: q.status,
    createdAt: formatDateForSheet(q.createdAt)
});

const mapSettingsFromGAS = (c: any): Settings => {
    let cfg: any = {};
    const processEntry = (k: string, v: any) => { cfg[String(k).toLowerCase().trim()] = v; };

    if (Array.isArray(c)) {
        c.forEach((row: any) => {
            if (Array.isArray(row) && row.length >= 2) processEntry(row[0], row[1]);
            else if (typeof row === 'object') Object.keys(row).forEach(k => processEntry(k, row[k]));
        });
    } else if (typeof c === 'object' && c !== null) {
        Object.keys(c).forEach(k => processEntry(k, c[k]));
    }

    const get = (keys: string[], def: number) => {
        for (const k of keys) {
            if (cfg[k] !== undefined && cfg[k] !== "" && cfg[k] !== null) return parseNumber(cfg[k], def);
        }
        return def;
    };

    return {
        currency: 'BRL',
        energyCostPerKwh: get(['custo_kwh', 'custo_energia'], DEFAULT_SETTINGS.energyCostPerKwh),
        printerPowerWatts: get(['consumo_w', 'potencia'], DEFAULT_SETTINGS.printerPowerWatts),
        failureRatePercent: get(['taxa_falha', 'falha'], 10), 
        materialWastePercent: get(['taxa_desperdicio', 'desperdicio'], DEFAULT_SETTINGS.materialWastePercent),
        monthlyFixedExpenses: get(['custo_fixo_mensal', 'custo_fixo'], DEFAULT_SETTINGS.monthlyFixedExpenses),
        workHoursPerMonth: get(['horas_mensais'], DEFAULT_SETTINGS.workHoursPerMonth),
        laborRatePerHour: get(['valor_hora', 'mao_de_obra'], DEFAULT_SETTINGS.laborRatePerHour),
        wearAndTearPerHour: get(['depreciacao', 'manutencao'], DEFAULT_SETTINGS.wearAndTearPerHour),
        machineValue: get(['valor_maquina'], DEFAULT_SETTINGS.machineValue),
        machineLifespanHours: get(['vida_util_horas'], DEFAULT_SETTINGS.machineLifespanHours)
    };
};

const mapSettingsToGAS = (s: Settings) => ({
    valor_hora: s.laborRatePerHour,
    consumo_w: s.printerPowerWatts,
    custo_kwh: s.energyCostPerKwh,
    custo_fixo_mensal: s.monthlyFixedExpenses,
    horas_mensais: s.workHoursPerMonth,
    taxa_falha: s.failureRatePercent,
    taxa_desperdicio: s.materialWastePercent,
    depreciacao: s.wearAndTearPerHour,
    valor_maquina: s.machineValue,
    vida_util_horas: s.machineLifespanHours
});

const mapExpenseFromGAS = (e: any): Expense => ({
    id: String(e.id || ''),
    description: String(e.descricao || e.description || 'Despesa'),
    category: (e.categoria || e.category || 'outros') as any,
    amount: parseNumber(e.valor || e.amount),
    date: (e.data || e.date) ? new Date(e.data || e.date).getTime() : Date.now(),
    isFixed: Boolean(e.automatico || e.isFixed)
});

const mapExpenseToGAS = (e: Expense) => ({
    id: e.id,
    descricao: e.description,
    categoria: e.category,
    valor: e.amount,
    data: formatDateForSheet(e.date),
    automatico: e.isFixed,
    tipo: 'SAIDA'
});

// --- API METHODS ---

export const api = {
    getFilaments: async (): Promise<Filament[]> => {
        try {
            const raw = await fetchGAS('rota=listarFilamentos');
            const list = Array.isArray(raw) ? raw : (raw.data || raw.items || []);
            return Array.isArray(list) ? list.map(mapFilamentFromGAS) : [];
        } catch (e) {
            console.warn("API: Erro ao listar filamentos - Usando Backup Local");
            const local = localStorage.getItem('nonobit_filaments_backup');
            return local ? JSON.parse(local) : [];
        }
    },

    saveFilament: async (filament: Filament) => {
        try {
            return await fetchGAS('rota=salvarFilamento', 'POST', mapFilamentToGAS(filament));
        } catch (e: any) {
            if(e.message && (e.message.includes("Rota") || e.message.includes("inválida") || e.message.includes("HTML"))) throw new Error("BACKEND_OUTDATED");
            throw e;
        }
    },

    deleteFilament: async (id: string) => {
        try {
            return await fetchGAS('rota=excluirFilamento', 'POST', { id: String(id).trim() });
        } catch (e: any) {
             if(e.message && (e.message.includes("Rota") || e.message.includes("inválida") || e.message.includes("HTML"))) throw new Error("BACKEND_OUTDATED");
             throw e;
        }
    },

    getConfig: async (): Promise<Settings> => {
        try {
            const raw = await fetchGAS('rota=getConfig');
            const data = (raw && raw.data) ? raw.data : raw;
            return data ? mapSettingsFromGAS(data) : DEFAULT_SETTINGS;
        } catch (e) {
            return DEFAULT_SETTINGS;
        }
    },

    saveConfig: async (settings: Settings) => {
        return await fetchGAS('rota=salvarConfig', 'POST', mapSettingsToGAS(settings));
    },

    getClients: async (): Promise<Client[]> => {
        try {
            const raw = await fetchGAS('rota=listarClientes');
            const list = Array.isArray(raw) ? raw : (raw.data || []);
            
            if (Array.isArray(list)) {
                return list.map((c: any) => {
                     const getVal = (k: string, i: number) => c[k] || (Array.isArray(c) ? c[i] : '');
                     return {
                        id: getVal('id', 0),
                        name: getVal('nome', 1),
                        phone: getVal('whatsapp', 2) || getVal('telefone', 2),
                        email: getVal('email', 3), 
                        notes: getVal('obs', 5)
                    };
                });
            }
            return [];
        } catch (e) { 
            const local = localStorage.getItem('nonobit_clients_backup');
            return local ? JSON.parse(local) : [];
        }
    },

    saveClient: async (client: Client) => {
        try {
            return await fetchGAS('rota=salvarCliente', 'POST', {
                id: client.id, nome: client.name, whatsapp: client.phone, email: client.email, obs: client.notes
            });
        } catch (e: any) {
             if(e.message && (e.message.includes("Rota") || e.message.includes("inválida") || e.message.includes("HTML"))) throw new Error("BACKEND_OUTDATED");
             throw e;
        }
    },

    getQuotes: async (): Promise<Quote[]> => {
        try {
            const raw = await fetchGAS('rota=listarOrcamentos');
            const list = Array.isArray(raw) ? raw : [];
            return list.map(mapQuoteFromGAS);
        } catch (e) {
            console.warn("API: Erro ao listar orçamentos - Usando Backup Local");
            const local = localStorage.getItem('nonobit_quotes_backup');
            return local ? JSON.parse(local) : [];
        }
    },

    saveQuote: async (quote: Quote, clientName?: string) => {
        try {
             return await fetchGAS('rota=salvarOrcamento', 'POST', mapQuoteToGAS(quote, clientName));
        } catch (e: any) {
             if(e.message && (e.message.includes("Rota") || e.message.includes("inválida") || e.message.includes("HTML"))) throw new Error("BACKEND_OUTDATED");
             throw e;
        }
    },
    
    deleteQuote: async (id: string) => {
        try {
             return await fetchGAS('rota=excluirOrcamento', 'POST', { id: String(id).trim() });
        } catch (e: any) {
             if(e.message && (e.message.includes("Rota") || e.message.includes("inválida") || e.message.includes("HTML"))) throw new Error("BACKEND_OUTDATED");
             throw e;
        }
    },

    getExpenses: async (): Promise<Expense[]> => {
        try {
            const raw = await fetchGAS('rota=listarDespesas');
            const list = Array.isArray(raw) ? raw : [];
            return list.map(mapExpenseFromGAS);
        } catch (e) {
             const local = localStorage.getItem('nonobit_expenses_backup');
             return local ? JSON.parse(local) : [];
        }
    },

    saveExpense: async (expense: Expense) => {
        try {
            return await fetchGAS('rota=salvarDespesa', 'POST', mapExpenseToGAS(expense));
        } catch (e: any) {
             if(e.message && (e.message.includes("Rota") || e.message.includes("inválida") || e.message.includes("HTML"))) throw new Error("BACKEND_OUTDATED");
             throw e;
        }
    },

    deleteExpense: async (id: string) => {
        try {
            return await fetchGAS('rota=excluirDespesa', 'POST', { id: String(id).trim() });
        } catch (e: any) {
             if(e.message && (e.message.includes("Rota") || e.message.includes("inválida") || e.message.includes("HTML"))) throw new Error("BACKEND_OUTDATED");
             throw e;
        }
    },

    // --- NEW METHODS FOR DASHBOARD ---
    
    getProductionOrders: async (): Promise<ProductionOrder[]> => {
        try {
            const raw = await fetchGAS('rota=listarOrdensProducao', 'GET', undefined, 0); 
            const list = Array.isArray(raw) ? raw : [];
            return list.map((o: any) => ({
                ID_OP: o.ID_OP || '',
                ID_Pedido: o.ID_Pedido || '',
                Status: o.Status || 'Pendente',
                Peso_Real_g: parseNumber(o.Peso_Real_g || o.Peso_Consumido || 0)
            }));
        } catch (e) {
            return [];
        }
    },
    
    getMarketplaceFees: async (): Promise<MarketplaceFee[]> => {
        try {
            // Tenta buscar taxas da planilha (Rota deve ser criada no backend para persistencia real)
            // Se falhar ou rota não existir, retorna defaults
            const raw = await fetchGAS('rota=listarTaxasMarketplace', 'GET', undefined, 0);
            if (Array.isArray(raw) && raw.length > 0) {
                 return raw.map((r: any) => ({
                     channel: r.Canal || r.channel,
                     percent: parseNumber(r.Porcentagem || r.percent || 0),
                     fixed: parseNumber(r.Fixo || r.fixed || 0)
                 }));
            }
            throw new Error("No data");
        } catch (e) {
            // DEFAULTS
            return [
                { channel: 'Direto', percent: 0, fixed: 0 },
                { channel: 'MercadoLivre', percent: 16, fixed: 5.00 }, // Clássico Premium + Taxa Fixa
                { channel: 'Shopee', percent: 14, fixed: 3.00 },
                { channel: 'Amazon', percent: 15, fixed: 0 },
                { channel: 'Outros', percent: 0, fixed: 0 }
            ];
        }
    },

    finalizeSale: async (quote: Quote, clientName: string) => {
        const flatItems = quote.items.flatMap(item => 
            item.filamentUsage.map(usage => ({
                filamento_id: usage.filamentId,
                peso_g: usage.gramsUsed
            }))
        );

        const payload = {
            data: formatDateForSheet(Date.now()),
            // Descrição agora inclui o canal para clareza
            descricao: `Venda ${clientName} (${quote.items.length} itens) - ${quote.channel || 'Direto'}`,
            categoria: 'venda',
            tipo: 'ENTRADA',
            valor: quote.netValue || quote.finalPrice, // IMPORTANTE: Entrada de caixa é o Líquido
            cliente: clientName,
            cliente_id: quote.clientId,
            itens: JSON.stringify(flatItems),
            custo_total: quote.totalCost,
            preco_venda: quote.finalPrice,
            lucro: (quote.netValue || quote.finalPrice) - quote.totalCost,
            
            // Dados Extras para o Backend novo
            canal: quote.channel || 'Direto',
            taxas: quote.taxAmount || 0,
            
            // Legacy fallbacks
            amount: quote.netValue || quote.finalPrice,
            description: `Venda ${clientName}`,
            category: 'venda',
            type: 'ENTRADA'
        };

        try {
            // Tenta disparar o pipeline também
            try { fetchGAS('rota=rodarPipeline', 'POST', {}).catch(() => {}); } catch(e) {}
            
            return await fetchGAS('rota=finalizarVenda', 'POST', payload);
        } catch (e: any) {
             if(e.message && (e.message.includes("Rota") || e.message.includes("inválida") || e.message.includes("HTML"))) throw new Error("BACKEND_OUTDATED");
             throw e;
        }
    }
};