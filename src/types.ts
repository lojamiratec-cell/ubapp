import { Timestamp } from 'firebase/firestore';

export type ShiftStatus = 'active' | 'paused' | 'finished';
export type ShiftState = 'idle' | 'dispatch' | 'ride';

export interface Shift {
  id: string;
  userId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  startKm: number;
  endKm?: number;
  startAutonomy: number; // KM remaining in tank
  endAutonomy?: number; // KM remaining in tank
  addedAutonomy?: number; // Autonomy added during the shift via fueling
  fuelExpense?: number; // Total fuel expense during the shift
  avgConsumption?: number; // KM/L average from dashboard
  totalRevenue: number;
  totalTrips: number;
  status: ShiftStatus;
  activeTimeSeconds: number;
  lastStartedAt: Timestamp;
  totalWorkKm: number;
  totalPersonalKm: number;
  lastKm: number;
  
  // State tracking
  currentState?: ShiftState;
  stateLastChangedAt?: Timestamp;
  idleTimeSeconds?: number;
  dispatchTimeSeconds?: number;
  rideTimeSeconds?: number;
  productiveKm?: number;
  unproductiveKm?: number;
  idleKm?: number;
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
  category: 'Manutenção' | 'Pneus' | 'Óleo' | 'Limpeza' | 'Alimentação' | 'Seguro' | 'IPVA/Licenciamento' | 'Multas' | 'Estacionamento' | 'Pedágio' | 'Internet/Celular' | 'Outros';
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
  shiftId?: string;
  autonomyBefore?: number;
  autonomyAfter?: number;
}

export interface UserSettings {
  userId: string;
  maintenanceCostPerKm: number;
  maintenancePercentage?: number;
  dailyRevenueGoal: number;
  defaultFuelPrice: number;
  avgConsumption: number;
  geminiApiKey?: string;
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
