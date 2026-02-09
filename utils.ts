/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Settings, Filament, QuoteItem, SalesChannel, MarketplaceFee } from './types';

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR');
};

// --- CÁLCULOS ROBUSTOS ---

export const calculateHourlyOperationalCost = (settings: Settings): number => {
    // Fator de absorção (0.0 a 1.0). Se não definido, assume 1.0 (100%)
    const absorption = (settings.overheadAbsorptionPercent || 100) / 100;

    // Custo Fixo por Hora = (Despesas Mensais / Horas Trabalhadas) * Absorção
    const fixedCostPerHour = ((settings.monthlyFixedExpenses || 0) / (settings.workHoursPerMonth || 1)) * absorption;
    
    // Custo Energia = (Watts / 1000) * Preço kWh (Sempre 100% repassado, é custo variável direto)
    const energyCostPerHour = ((settings.printerPowerWatts || 0) / 1000) * (settings.energyCostPerKwh || 0);
    
    // Custo Máquina (Depreciação) = Valor / Vida Útil (Sempre 100%, é o desgaste real)
    const machineDepreciation = (settings.machineValue || 0) / (settings.machineLifespanHours || 1);
    
    const extraMaintenance = settings.wearAndTearPerHour || 0;
    
    // Custo Mão de Obra * Absorção
    const laborCost = (settings.laborRatePerHour || 0) * absorption;

    return fixedCostPerHour + energyCostPerHour + machineDepreciation + extraMaintenance + laborCost; 
};

export const calculateItemCost = (
    item: QuoteItem, 
    filaments: Filament[], 
    settings: Settings
): { materialCost: number, operationalCost: number, totalCost: number } => {
    
    // 1. Custo do Material (Iterar sobre todos os filamentos usados no item)
    const wasteFactor = 1 + ((settings.materialWastePercent || 0) / 100);
    
    let materialCost = 0;

    if (item.filamentUsage && item.filamentUsage.length > 0) {
        item.filamentUsage.forEach(usage => {
            const filament = filaments.find(f => f.id === usage.filamentId);
            if (filament) {
                const pricePerGram = filament.pricePerSpool / filament.weightPerSpoolGrams;
                materialCost += (pricePerGram * usage.gramsUsed) * wasteFactor;
            }
        });
    }

    // 2. Custo Operacional (Tempo de impressão)
    const hourlyOpCost = calculateHourlyOperationalCost(settings);
    const operationalCost = hourlyOpCost * item.printTimeHours;

    return {
        materialCost,
        operationalCost,
        totalCost: materialCost + operationalCost
    };
};

export const calculateQuoteTotal = (
    items: QuoteItem[], 
    filaments: Filament[], 
    settings: Settings, 
    marginPercent: number,
    channel: SalesChannel = 'Direto',
    fees: MarketplaceFee[] = []
) => {
    let rawMaterialCost = 0;
    let rawOperationalCost = 0;
    let totalHours = 0;

    items.forEach(item => {
        const costs = calculateItemCost(item, filaments, settings);
        rawMaterialCost += costs.materialCost;
        rawOperationalCost += costs.operationalCost;
        totalHours += item.printTimeHours;
    });

    const rawProductionCost = rawMaterialCost + rawOperationalCost;

    // 3. Adiciona taxa de falha (Risco do projeto)
    const riskRate = (settings.failureRatePercent || 0) / 100;
    const riskCost = rawProductionCost * riskRate;
    const totalProductionCost = rawProductionCost + riskCost;

    // --- DETALHAMENTO (BREAKDOWN) ---
    const absorption = (settings.overheadAbsorptionPercent || 100) / 100;
    const fixedCostPerHour = ((settings.monthlyFixedExpenses || 0) / (settings.workHoursPerMonth || 1)) * absorption;
    const energyCostPerHour = ((settings.printerPowerWatts || 0) / 1000) * (settings.energyCostPerKwh || 0);
    const machineDepreciation = (settings.machineValue || 0) / (settings.machineLifespanHours || 1);
    const laborCost = (settings.laborRatePerHour || 0) * absorption;

    const breakdown = {
        material: rawMaterialCost,
        energy: energyCostPerHour * totalHours,
        fixed: fixedCostPerHour * totalHours,
        depreciation: machineDepreciation * totalHours,
        labor: laborCost * totalHours,
        risk: riskCost
    };

    // 4. Calcula preço BASE com margem de lucro desejada
    const safeMargin = Math.max(0, Math.min(99, marginPercent)); 
    const marginRate = safeMargin / 100;
    
    const basePrice = totalProductionCost / (1 - marginRate);

    const feeConfig = fees.find(f => f.channel === channel) || { percent: 0, fixed: 0 };
    const feeRate = feeConfig.percent / 100;
    const feeFixed = feeConfig.fixed;

    const divisor = 1 - feeRate;
    const finalPrice = divisor > 0 ? (basePrice + feeFixed) / divisor : basePrice;
    
    const totalTaxAmount = (finalPrice * feeRate) + feeFixed;
    const netValue = finalPrice - totalTaxAmount; 

    return {
        rawMaterialCost,
        rawOperationalCost,
        riskCost,
        breakdown, 
        totalCost: totalProductionCost,
        finalPrice, 
        taxAmount: totalTaxAmount,
        netValue, 
        marginValue: netValue - totalProductionCost
    };
};

export const getFilamentColor = (type: string): string => {
    switch(type) {
        case 'PLA': return '#4ade80'; // Green
        case 'ABS': return '#f87171'; // Red
        case 'PETG': return '#60a5fa'; // Blue
        case 'TPU': return '#c084fc'; // Purple
        case 'ASA': return '#fbbf24'; // Amber
        case 'RESIN': return '#2dd4bf'; // Teal
        default: return '#9ca3af'; // Gray
    }
};