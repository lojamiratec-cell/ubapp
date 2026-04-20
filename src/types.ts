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
  timestamp: Timestamp; // Creation time
  startTime?: Timestamp; // The time the trip actually started
  dynamicValue?: number; // Surge pricing amount included in value
}

export interface Expense {
  id: string;
  userId: string;
  date: Timestamp;
  category: 'Manutenção' | 'Pneus' | 'Óleo' | 'Limpeza' | 'Alimentação' | 'Seguro' | 'IPVA/Licenciamento' | 'Multas' | 'Estacionamento' | 'Pedágio' | 'Internet/Celular' | 'Taxa Bancária/Saque' | 'Outros';
  value: number;
  kmAtExpense: number;
  paymentMethod?: 'Pix' | 'Crédito';
  installments?: number;
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
  maintenancePercentage?: number; // % estimated for maintenance
  dailyRevenueGoal: number; // Used loosely before, can be kept
  monthlyNetGoal?: number; // Meta Líquida de Ganhos para o mês
  workDays?: number[]; // Dias de trabalho na semana (0=Dom, 1=Seg, ...)
  platformBalance?: number; // Saldo de Faturamento ainda na plataforma (Uber, 99)
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

export interface FixedExpense {
  id: string;
  userId: string;
  name: string;
  amount: number;
  dueDay: number; // 1-31
  active: boolean; // Ativo no cálculo de metas
  lastPaidMonth?: string; // Mês/Ano em que foi pago pela última vez 'YYYY-MM'
}

export interface Withdrawal {
  id: string;
  userId: string;
  date: Timestamp;
  amount: number;
  fee: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  preferredCurrency: string;
}
