/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type FilamentType = 'PLA' | 'ABS' | 'PETG' | 'TPU' | 'ASA' | 'RESIN' | 'OTHER';

export interface Filament {
  id: string;
  brand: string;
  name: string;
  type: FilamentType;
  colorHex: string;
  pricePerSpool: number;
  weightPerSpoolGrams: number;
  currentWeightGrams: number;
  purchaseDate: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export interface Settings {
  currency: string;
  energyCostPerKwh: number;
  printerPowerWatts: number;
  failureRatePercent: number; // Risk of print failing
  materialWastePercent: number; // Poop, flush, supports (Standard waste)
  monthlyFixedExpenses: number; // Aluguel, software, etc.
  workHoursPerMonth: number; // Para diluir as despesas fixas
  laborRatePerHour: number; // Valor da sua hora
  
  // Machine Depreciation
  machineValue: number; // Valor de compra (ex: 4200)
  machineLifespanHours: number; // Vida util em horas (ex: 8000)
  wearAndTearPerHour: number; // Mantido para compatibilidade ou custos extras de manutencao
}

export type ExpenseCategory = 'filamento' | 'ferramenta' | 'manutencao' | 'energia' | 'fixo' | 'outros';

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: number;
  isFixed: boolean; // Se true, entra na sugestão de cálculo de custo fixo
}

// NEW: Sub-item to handle multiple filaments
export interface QuoteItemFilament {
    id: string;
    filamentId: string;
    gramsUsed: number;
}

export interface QuoteItem {
  id: string;
  description: string;
  printTimeHours: number;
  filamentUsage: QuoteItemFilament[]; 
}

// NEW: Channel Support
export type SalesChannel = 'Direto' | 'MercadoLivre' | 'Shopee' | 'Amazon' | 'Outros';

export interface MarketplaceFee {
    channel: SalesChannel;
    percent: number; // e.g., 16 for 16%
    fixed: number;   // e.g., 5.00 for R$5 flat fee
}

export interface Quote {
  id: string;
  clientId: string;
  items: QuoteItem[];
  profitMarginPercent: number;
  
  // Financials
  totalCost: number; // Custo Produção (Material + Hora)
  finalPrice: number; // Preço Final de Venda (Bruto)
  
  // Channel Specifics
  channel?: SalesChannel;
  taxAmount?: number; // Valor pago ao marketplace
  netValue?: number; // Valor Liquido que entra no caixa (Final - Tax)

  status: 'draft' | 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

// --- NOVOS TIPOS PARA DASHBOARD DE PRODUÇÃO ---

export interface ProductionOrder {
  ID_OP: string;
  ID_Pedido: string;
  Status: string; // 'Pendente' | 'Concluída'
  Data_Criacao?: string;
  Peso_Real_g?: number;
}

export type ViewMode = 'dashboard' | 'filaments' | 'clients' | 'calculator' | 'quotes' | 'extract';