/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Settings } from './types';

// URL do Backend (Google Apps Script)
// ATENÇÃO: Se você reimplantou o script, gere um novo deployment e cole a URL aqui.
export const API_URL = 'https://script.google.com/macros/s/AKfycbyeB-fM95xjJLs1ZZ9thRUtLVdnA5aagkOdyegC-EWXVJiDxbYNuU-axvWStJHNUHQJkQ/exec';

export const DEFAULT_SETTINGS: Settings = {
    currency: 'BRL',
    energyCostPerKwh: 0.90, // Atualizado media Brasil
    printerPowerWatts: 300,
    failureRatePercent: 10,
    materialWastePercent: 5, // Default 5% waste
    monthlyFixedExpenses: 150, 
    workHoursPerMonth: 200, // Maquina rodando bastante
    laborRatePerHour: 1, // MUDANÇA: Valor baixo, pois a máquina trabalha sozinha. O lucro vem da margem.
    wearAndTearPerHour: 0, // Agora calculado via maquina
    machineValue: 4200,
    machineLifespanHours: 8000
};