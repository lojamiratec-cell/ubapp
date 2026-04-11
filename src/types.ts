import { Timestamp } from 'firebase/firestore';

export type ShiftStatus = 'active' | 'paused' | 'finished';

export interface Shift {
  id: string;
  userId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  startKm: number;
  endKm?: number;
  startAutonomy: number; // KM remaining in tank
  endAutonomy?: number; // KM remaining in tank
  avgConsumption?: number; // KM/L average from dashboard
  totalRevenue: number;
  totalTrips: number;
  status: ShiftStatus;
  activeTimeSeconds: number;
  lastStartedAt: Timestamp;
  totalWorkKm: number;
  totalPersonalKm: number;
  lastKm: number;
}

export interface Trip {
  id: string;
  userId: string;
  shiftId: string;
  value: number;
  durationSeconds: number;
  distanceKm: number;
  timestamp: Timestamp;
}

export interface Expense {
  id: string;
  userId: string;
  date: Timestamp;
  category: 'Manutenção' | 'Limpeza' | 'Alimentação' | 'Seguro' | 'IPVA/Licenciamento' | 'Multas' | 'Estacionamento' | 'Pedágio' | 'Internet/Celular' | 'Outros';
  value: number;
  kmAtExpense: number;
}

export interface Fuel {
  id: string;
  userId: string;
  date: Timestamp;
  km: number;
  pricePerLiter: number;
  totalValue: number;
  liters: number;
}

export interface UserSettings {
  userId: string;
  maintenanceCostPerKm: number;
  maintenancePercentage?: number;
  dailyRevenueGoal: number;
  defaultFuelPrice: number;
  avgConsumption: number;
  // Maintenance Intervals
  oilChangeInterval: number;
  lastOilChangeKm: number;
  tireRotationInterval: number;
  lastTireRotationKm: number;
  timingBeltInterval: number;
  lastTimingBeltKm: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  preferredCurrency: string;
}
