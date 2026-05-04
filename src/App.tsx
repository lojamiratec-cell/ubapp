/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { NumericFormat } from 'react-number-format';
import { 
  Play, Pause, Square, History, DollarSign, BarChart3, 
  Plus, Compass, ChevronRight, ChevronLeft, LogOut, Car, Timer, Fuel as FuelIcon, ArrowRight,
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock, MapPin, Sparkles, Calendar, User as UserIcon, Target, Activity,
  Settings as SettingsIcon, Sun, Moon, Download, FileText, Edit2, Upload, Coffee, Users, X,
  Wallet, RefreshCw, ArrowDownLeft, ArrowUpRight, Calendar as CalendarIcon, Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, db, googleProvider, handleFirestoreError, OperationType 
} from './firebase';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { 
  signInWithPopup, signInWithRedirect, onAuthStateChanged, User, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, doc, setDoc, addDoc, onSnapshot, query, where, orderBy, Timestamp, serverTimestamp, updateDoc, deleteDoc, getDocs, writeBatch, increment
} from 'firebase/firestore';
import { format, differenceInSeconds, differenceInDays, startOfDay, endOfDay, subDays, subWeeks, subMonths, addDays, addWeeks, addMonths, isWithinInterval, isSameDay, isSameWeek, isSameMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Shift, Trip, Expense, ShiftStatus, ShiftState, Fuel, UserSettings, FixedExpense, Withdrawal } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const ensureDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string' || typeof timestamp === 'number') return new Date(timestamp);
  return new Date();
};

// --- Components ---

const Card = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void, key?: React.Key }) => (
  <div onClick={onClick} className={cn("bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 transition-colors", className)}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  disabled,
  icon: Icon,
  type = 'button',
  title
}: { 
  children: React.ReactNode, 
  onClick?: (e: React.MouseEvent) => void, 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline',
  className?: string,
  disabled?: boolean,
  icon?: any,
  type?: 'button' | 'submit' | 'reset',
  title?: string
}) => {
  const variants = {
    primary: "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/20",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800",
    outline: "bg-transparent border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
  };

  return (
    <button 
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100",
        variants[variant],
        className
      )}
    >
      {Icon && <Icon size={20} />}
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
    <input 
      {...props}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all bg-gray-50/50 dark:bg-gray-800/50 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
    />
  </div>
);

const CurrencyInput = ({ label, value, onValueChange, placeholder }: any) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
    <NumericFormat
      value={value}
      onValueChange={(values) => onValueChange(values.value)}
      thousandSeparator="."
      decimalSeparator=","
      prefix="R$ "
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      inputMode="decimal"
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all bg-gray-50/50 dark:bg-gray-800/50 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
    />
  </div>
);

const DistanceInput = ({ label, value, onValueChange, placeholder }: any) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
    <NumericFormat
      value={value}
      onValueChange={(values) => onValueChange(values.value)}
      thousandSeparator="."
      decimalSeparator=","
      suffix=" km"
      decimalScale={2}
      allowNegative={false}
      inputMode="decimal"
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all bg-gray-50/50 dark:bg-gray-800/50 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
    />
  </div>
);

const Select = ({ label, options, ...props }: { label: string, options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
    <select 
      {...props}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all bg-gray-50/50 dark:bg-gray-800/50 dark:text-white"
    >
      {options.map(opt => <option key={opt} value={opt} className="dark:bg-gray-900">{opt}</option>)}
    </select>
  </div>
);

// --- Performance Helpers ---
export function getRpkmTier(rpkm: number) {
   if (rpkm >= 2.50) return { label: 'Ótimo', color: 'text-blue-500', bg: 'bg-blue-500/10' };
   if (rpkm >= 2.00) return { label: 'Bom', color: 'text-green-500', bg: 'bg-green-500/10' };
   if (rpkm > 1.80) return { label: 'Mediano', color: 'text-orange-500', bg: 'bg-orange-500/10' };
   return { label: 'Ruim', color: 'text-red-500', bg: 'bg-red-500/10' };
}

export function getRphTier(rph: number) {
   if (rph >= 42) return { label: 'Ótimo', color: 'text-blue-500', bg: 'bg-blue-500/10' };
   if (rph >= 38) return { label: 'Bom', color: 'text-green-500', bg: 'bg-green-500/10' };
   if (rph > 32) return { label: 'Mediano', color: 'text-orange-500', bg: 'bg-orange-500/10' };
   return { label: 'Ruim', color: 'text-red-500', bg: 'bg-red-500/10' };
}

// --- Live Shift Analysis Component (Radar Estratégico) ---
function LiveShiftAnalysis({ 
  currentRph, 
  currentRpkm, 
  avgRph, 
  avgRpkm, 
  activeShift, 
  trips 
}: { 
  currentRph: number, 
  currentRpkm: number, 
  avgRph: number, 
  avgRpkm: number,
  activeShift: Shift | null,
  trips: Trip[]
}) {
  if (currentRph === 0 && currentRpkm === 0) return null;

  const rphTier = getRphTier(currentRph);
  const rpkmTier = getRpkmTier(currentRpkm);

  const overallTier = currentRph >= 42 && currentRpkm >= 2.50 ? 'Ótimo' :
                      currentRph >= 38 && currentRpkm >= 2.00 ? 'Bom' :
                      currentRph > 32 && currentRpkm > 1.80 ? 'Mediano' : 'Ruim';

  const tierColors = {
    'Ótimo': 'text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    'Bom': 'text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20',
    'Mediano': 'text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20',
    'Ruim': 'text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20'
  };

  const isRphAboveAvg = avgRph > 0 ? (currentRph >= avgRph) : true;
  const isRpkmAboveAvg = avgRpkm > 0 ? (currentRpkm >= avgRpkm) : true;

  // --- Fraction of Hour Math (Etapa 3) ---
  const shiftStartMs = activeShift?.startTime ? ensureDate(activeShift.startTime).getTime() : Date.now();
  const currentHourIndex = Math.floor(Math.max(0, Date.now() - shiftStartMs) / 3600000);
  
  let previousHourValue = 0;
  let previousHourKm = 0;
  let currentHourValue = 0;
  let currentHourKm = 0;

  if (activeShift && trips.length > 0) {
    trips.forEach(trip => {
      if (trip.isCancelled || trip.durationSeconds === 0) return;
      
      const tripEndMs = trip.timestamp ? ensureDate(trip.timestamp).getTime() : 
                        (trip.startTime ? ensureDate(trip.startTime).getTime() : Date.now());
      const differenceMs = tripEndMs - shiftStartMs;
      const hIndex = Math.floor(Math.max(0, differenceMs) / 3600000);
      
      if (hIndex === currentHourIndex) {
        currentHourValue += trip.value;
        currentHourKm += trip.distanceKm;
      } else if (hIndex === currentHourIndex - 1) {
        previousHourValue += trip.value;
        previousHourKm += trip.distanceKm;
      }
    });
  }

  const currentHourRpkm = currentHourKm > 0 ? currentHourValue / currentHourKm : 0;
  const previousHourRpkm = previousHourKm > 0 ? previousHourValue / previousHourKm : 0;

  // --- Alerts Logic ---
  const alerts: any[] = [];

  // Trend Alerts
  if (previousHourRpkm > 0 && currentHourRpkm < previousHourRpkm - 0.2) {
    alerts.push({
      type: 'bad',
      title: 'QUEDA DE RENDIMENTO NA HORA',
      text: `Seu ganho p/ KM caiu de R$ ${previousHourRpkm.toFixed(2)} na última hora para R$ ${currentHourRpkm.toFixed(2)}.`
    });
  }

  if (currentRpkm < 1.80) {
    alerts.push({
      type: 'bad',
      title: 'QUEDA DE KM',
      text: 'Seu ganho por KM caiu. Priorize corridas que paguem acima de R$2,00/km.'
    });
  } else if (currentRpkm >= 1.80 && currentRpkm < 2.00 && alerts.length === 0) {
    alerts.push({
      type: 'warning',
      title: 'KM NO LIMITE',
      text: 'Seu KM está mediano. Tente pegar viagens mais curtas e lucrativas.'
    });
  }

  if (currentRph < 32 && alerts.length < 2) {
    alerts.push({
      type: 'bad',
      title: 'QUEDA DE HORA',
      text: 'Seu faturamento por hora caiu. Evite corridas longas.'
    });
  } else if (currentRph >= 32 && currentRph < 38 && alerts.length < 2) {
    alerts.push({
      type: 'warning',
      title: 'HORA NO LIMITE',
      text: 'Ritmo por hora mediano. Se afaste de trânsito intenso.'
    });
  }

  if ((overallTier === 'Ótimo' || overallTier === 'Bom') && alerts.length === 0) {
    alerts.push({
      type: 'good',
      title: 'BOM MOMENTO',
      text: 'Alta performance hoje! Continue aceitando boas corridas nesse ritmo.'
    });
  }

  // --- Dynamic Tip (Etapa 4) ---
  let dynamicTip = null;
  if (overallTier === 'Ruim') {
     dynamicTip = {
       target: 'Mediano',
       msg: "Para voltar ao nível MEDIANO, sua próxima corrida precisa pagar no mínimo R$ 2,00/km."
     };
  } else if (overallTier === 'Mediano') {
     dynamicTip = {
       target: 'Bom',
       msg: "Para subir ao nível BOM, sua próxima corrida precisa pagar no mínimo R$ 2,20/km."
     };
  } else if (overallTier === 'Bom') {
     dynamicTip = {
       target: 'Ótimo',
       msg: "Para atingir ÓTIMO, filtre corridas acima de R$ 2,50/km."
     };
  } else {
     dynamicTip = {
       target: 'Manter',
       msg: "Mantenha o padrão premium: aceite somente corridas acima de R$ 2,50/km."
     };
  }

  const visibleAlerts = alerts.slice(0, 2);

  return (
    <div className="mt-6 p-5 rounded-3xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 flex flex-col gap-6 shadow-sm">
      {/* Bloco 1 - Status Atual & Comparação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
              Status Atual
            </p>
            <div className={cn("px-4 py-1.5 rounded-full border text-xs font-black uppercase tracking-widest inline-block shadow-sm", tierColors[overallTier])}>
              {overallTier}
            </div>
         </div>
         <div className="flex gap-6">
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Média R$/H</p>
               <div className={cn("text-xs font-bold flex items-center gap-1", isRphAboveAvg ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                 {isRphAboveAvg ? <TrendingUp size={14} /> : <TrendingDown size={14} />} 
                 {isRphAboveAvg ? 'Acima da média' : 'Abaixo da média'}
               </div>
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Média R$/KM</p>
               <div className={cn("text-xs font-bold flex items-center gap-1", isRpkmAboveAvg ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                 {isRpkmAboveAvg ? <TrendingUp size={14} /> : <TrendingDown size={14} />} 
                 {isRpkmAboveAvg ? 'Acima da média' : 'Abaixo da média'}
               </div>
            </div>
         </div>
      </div>

      <div className="h-px w-full bg-gray-200 dark:bg-white/10" />

      {/* Frações de Hora (Etapa 3) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-black/20 p-4 rounded-2xl border border-gray-200/60 dark:border-white/5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1">
            <Clock size={12} /> Hora H{currentHourIndex}
          </p>
          <div className="text-xl font-black text-gray-900 dark:text-white flex items-baseline gap-2">
            R$ {previousHourValue.toFixed(2)}
          </div>
          <p className="text-xs font-bold text-gray-400 mt-1">R$ {previousHourRpkm.toFixed(2)}/km</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2"><Sparkles size={16} className="text-green-500 opacity-20" /></div>
          <p className="text-[10px] font-bold text-green-600 dark:text-green-500 uppercase tracking-widest mb-2 flex items-center gap-1">
            <Activity size={12} /> Hora H{currentHourIndex + 1}
          </p>
          <div className="text-xl font-black text-green-700 dark:text-green-400 flex items-baseline gap-2">
            R$ {currentHourValue.toFixed(2)}
          </div>
          <p className="text-xs font-bold text-green-600/70 dark:text-green-500/70 mt-1">R$ {currentHourRpkm.toFixed(2)}/km</p>
        </div>
      </div>

      {/* Bloco 2 - Alertas Inteligentes */}
      <div className="space-y-3 mt-2">
        <div className="grid gap-3">
          {visibleAlerts.map((alert, idx) => (
            <div key={idx} className={cn("p-4 rounded-2xl border flex gap-3 items-start", 
              alert.type === 'bad' ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-900 dark:text-red-300' :
              alert.type === 'warning' ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20 text-orange-900 dark:text-orange-200' :
              'bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20 text-green-900 dark:text-green-300'
            )}>
              <div className="mt-0.5 p-1.5 rounded-lg bg-white/50 dark:bg-black/20">
                {alert.type === 'bad' ? <TrendingDown size={14} className="text-red-600 dark:text-red-400" /> : 
                 alert.type === 'warning' ? <AlertCircle size={14} className="text-orange-600 dark:text-orange-400" /> : 
                 <TrendingUp size={14} className="text-green-600 dark:text-green-400" />}
              </div>
              <div className="flex-1">
                 <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", 
                   alert.type === 'bad' ? 'text-red-600 dark:text-red-400' : 
                   alert.type === 'warning' ? 'text-orange-600 dark:text-orange-400' : 
                   'text-green-600 dark:text-green-400'
                 )}>
                   {alert.title}
                 </p>
                 <p className="text-xs font-medium leading-relaxed opacity-80">{alert.text}</p>
              </div>
            </div>
          ))}
          
          {/* Dynamic Tip (Etapa 4) */}
          <div className="p-4 rounded-2xl border bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-900 dark:text-blue-200 flex gap-3 items-start">
             <div className="mt-0.5 p-1.5 rounded-lg bg-white/50 dark:bg-black/20">
               <Target size={14} className="text-blue-600 dark:text-blue-400" />
             </div>
             <div className="flex-1">
                <p className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-1">Visando {dynamicTip.target}</p>
                <p className="text-xs font-medium leading-relaxed opacity-80">{dynamicTip.msg}</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'operation' | 'history' | 'wallet' | 'insights' | 'settings'>('operation');
  const [periodFilter, setPeriodFilter] = useState<'day' | 'week' | 'month'>('week');
  const [historyPendingOnly, setHistoryPendingOnly] = useState(false);
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fuelRecords, setFuelRecords] = useState<Fuel[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  // Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showFixedExpenseModal, setShowFixedExpenseModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showUpdateBalanceModal, setShowUpdateBalanceModal] = useState(false);
  const [showMonthlyGoalModal, setShowMonthlyGoalModal] = useState(false);
  const [showExpensesDetailsModal, setShowExpensesDetailsModal] = useState(false);
  const [showShiftFuelModal, setShowShiftFuelModal] = useState(false);
  const [showQuickTripModal, setShowQuickTripModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showPartialRevenueModal, setShowPartialRevenueModal] = useState(false);
  const [showPastShiftModal, setShowPastShiftModal] = useState(false);
  const [showEditShiftModal, setShowEditShiftModal] = useState(false);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [showEditFuelModal, setShowEditFuelModal] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<{shiftId: string, tripId: string} | null>(null);
  const [shiftToDeleteAllTrips, setShiftToDeleteAllTrips] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [initialTripIdForSequentialForm, setInitialTripIdForSequentialForm] = useState<string | null>(null);
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [shiftTrips, setShiftTrips] = useState<Record<string, Trip[]>>({});
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingFuel, setEditingFuel] = useState<Fuel | null>(null);
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportPreviewModal, setShowImportPreviewModal] = useState(false);
  const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showAiResultModal, setShowAiResultModal] = useState(false);
  const [analysisFilter, setAnalysisFilter] = useState<'day' | 'week' | 'month'>('week');
  const [selectedAnalysisDate, setSelectedAnalysisDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [analysisQuery, setAnalysisQuery] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRealtimeAiModal, setShowRealtimeAiModal] = useState(false);
  const [realtimeAiReport, setRealtimeAiReport] = useState<{ diag: string, filter: string, plan: string, tier: 'ruim' | 'mediano' | 'bom' | 'otimo' } | null>(null);
  const [isGeneratingRealtimeAi, setIsGeneratingRealtimeAi] = useState(false);
  const [parsedImportData, setParsedImportData] = useState<any[] | null>(null);
  const [importText, setImportText] = useState('');
  const [isImportingData, setIsImportingData] = useState(false);
  
  const lastRecordedKm = useMemo(() => {
    if (activeShift) return activeShift.lastKm || activeShift.startKm || 0;
    if (shifts.length > 0) return shifts[0].lastKm || shifts[0].endKm || shifts[0].startKm || 0;
    return 0;
  }, [shifts, activeShift]);

  const groupedShifts = useMemo(() => {
    const groups: Record<string, { date: Date, shifts: Shift[], totalRevenue: number, totalTime: number, totalWorkKm: number }> = {};
    
    let filteredShifts = shifts;
    if (periodFilter === 'day') {
      filteredShifts = shifts.filter(s => isSameDay(ensureDate(s.startTime), referenceDate));
    } else if (periodFilter === 'week') {
      filteredShifts = shifts.filter(s => isSameWeek(ensureDate(s.startTime), referenceDate, { weekStartsOn: 1 }));
    } else if (periodFilter === 'month') {
      filteredShifts = shifts.filter(s => isSameMonth(ensureDate(s.startTime), referenceDate));
    }

    if (historyPendingOnly) {
      filteredShifts = filteredShifts.filter(s => {
        const expectedTrips = s.totalTrips || 0;
        const registeredTrips = (shiftTrips[s.id] || []).filter(t => t.durationSeconds > 0 || t.isCancelled).length;
        return (expectedTrips > 0 && registeredTrips < expectedTrips) || (expectedTrips === 0 && s.totalRevenue > 0);
      });
    }

    filteredShifts.forEach(shift => {
      const date = ensureDate(shift.startTime);
      const dateKey = format(date, 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = { date, shifts: [], totalRevenue: 0, totalTime: 0, totalWorkKm: 0 };
      }
      groups[dateKey].shifts.push(shift);
      groups[dateKey].totalRevenue += shift.totalRevenue;
      groups[dateKey].totalTime += shift.activeTimeSeconds;
      groups[dateKey].totalWorkKm += (shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm));
    });
    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [shifts, periodFilter, referenceDate, historyPendingOnly, shiftTrips]);

  const periodRangeLabel = useMemo(() => {
    if (periodFilter === 'day') {
      if (isSameDay(referenceDate, new Date())) return { type: 'Dia', label: 'Hoje' };
      return { type: 'Dia', label: format(referenceDate, 'dd/MM/yyyy') };
    } else if (periodFilter === 'week') {
      const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
      if (isSameWeek(referenceDate, new Date(), { weekStartsOn: 1 })) return { type: 'Semana', label: 'Nesta Semana' };
      return { type: 'Semana', label: `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}` };
    }
    if (isSameMonth(referenceDate, new Date())) return { type: 'Mês', label: 'Neste Mês' };
    return { type: 'Mês', label: format(referenceDate, 'MMMM yyyy', { locale: ptBR }) };
  }, [periodFilter, referenceDate]);

  const prevPeriodRange = () => {
    if (periodFilter === 'day') setReferenceDate(prev => subDays(prev, 1));
    else if (periodFilter === 'week') setReferenceDate(prev => subWeeks(prev, 1));
    else if (periodFilter === 'month') setReferenceDate(prev => subMonths(prev, 1));
  };
  
  const nextPeriodRange = () => {
    if (periodFilter === 'day') setReferenceDate(prev => addDays(prev, 1));
    else if (periodFilter === 'week') setReferenceDate(prev => addWeeks(prev, 1));
    else if (periodFilter === 'month') setReferenceDate(prev => addMonths(prev, 1));
  };

  const historySummary = useMemo(() => {
    const totalRevenue = groupedShifts.reduce((acc, g) => acc + g.totalRevenue, 0);
    const totalTime = groupedShifts.reduce((acc, g) => acc + g.totalTime, 0);
    const totalKm = groupedShifts.reduce((acc, g) => acc + g.totalWorkKm, 0);
    
    const rph = totalTime > 0 ? totalRevenue / (totalTime / 3600) : 0;
    const rpkm = totalKm > 0 ? totalRevenue / totalKm : 0;
    
    return { totalRevenue, totalTime, totalKm, rph, rpkm };
  }, [groupedShifts]);

  const historyComparisonData = useMemo(() => {
    if (!shifts || shifts.length === 0) return null;

    const aggregateShifts = (filtered: Shift[]) => {
      const revenue = filtered.reduce((acc, s) => acc + s.totalRevenue, 0);
      const time = filtered.reduce((acc, s) => acc + (s.activeTimeSeconds || 0), 0);
      const km = filtered.reduce((acc, s) => acc + (s.totalWorkKm || ((s.endKm || 0) - s.startKm)), 0);
      return { 
        revenue, 
        time, 
        km, 
        rph: time > 0 ? revenue / (time / 3600) : 0, 
        rpkm: km > 0 ? revenue / km : 0 
      };
    };

    let current, previous, average;
    let labelPrev = '', labelAvg = '';

    if (periodFilter === 'week') {
      const currentShifts = shifts.filter(s => isSameWeek(ensureDate(s.startTime), referenceDate, { weekStartsOn: 1 }));
      current = aggregateShifts(currentShifts);

      const prevWeekDate = subWeeks(referenceDate, 1);
      const prevShifts = shifts.filter(s => isSameWeek(ensureDate(s.startTime), prevWeekDate, { weekStartsOn: 1 }));
      previous = aggregateShifts(prevShifts);
      labelPrev = 'Sema. Passada';

      let past4Rev = 0, past4Time = 0, past4Km = 0;
      for(let i=1; i<=4; i++) {
        const wDate = subWeeks(referenceDate, i);
        const wShifts = shifts.filter(s => isSameWeek(ensureDate(s.startTime), wDate, { weekStartsOn: 1 }));
        const agg = aggregateShifts(wShifts);
        past4Rev += agg.revenue;
        past4Time += agg.time;
        past4Km += agg.km;
      }
      average = {
        revenue: past4Rev / 4,
        time: past4Time / 4,
        km: past4Km / 4,
        rph: past4Time > 0 ? past4Rev / (past4Time / 3600) : 0,
        rpkm: past4Km > 0 ? past4Rev / past4Km : 0
      };
      labelAvg = 'Média das 4S Anteriores';
    } else {
      const currentShifts = shifts.filter(s => isSameMonth(ensureDate(s.startTime), referenceDate));
      current = aggregateShifts(currentShifts);

      const prevMonthDate = subMonths(referenceDate, 1);
      const prevShifts = shifts.filter(s => isSameMonth(ensureDate(s.startTime), prevMonthDate));
      previous = aggregateShifts(prevShifts);
      labelPrev = 'Mês Passado';

      let past3Rev = 0, past3Time = 0, past3Km = 0;
      for(let i=1; i<=3; i++) {
        const mDate = subMonths(referenceDate, i);
        const mShifts = shifts.filter(s => isSameMonth(ensureDate(s.startTime), mDate));
        const agg = aggregateShifts(mShifts);
        past3Rev += agg.revenue;
        past3Time += agg.time;
        past3Km += agg.km;
      }
      average = {
        revenue: past3Rev / 3,
        time: past3Time / 3,
        km: past3Km / 3,
        rph: past3Time > 0 ? past3Rev / (past3Time / 3600) : 0,
        rpkm: past3Km > 0 ? past3Rev / past3Km : 0
      };
      labelAvg = 'Média dos 3M Anteriores';
    }

    return { current, previous, average, labelPrev, labelAvg };
  }, [shifts, periodFilter, referenceDate]);

  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // AI State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
      const [isLoadingInsights, setIsLoadingInsights] = useState(false);

    useEffect(() => {
    if (!user) return;

    const targetDate = referenceDate;
    const filteredShiftsForLoading = shifts.filter(s => s.status === 'finished');
    let scopeShifts: typeof shifts = [];

    if (periodFilter === 'day') {
      scopeShifts = filteredShiftsForLoading.filter(s => isSameDay(ensureDate(s.startTime), targetDate));
    } else if (periodFilter === 'week') {
      scopeShifts = filteredShiftsForLoading.filter(s => isSameWeek(ensureDate(s.startTime), targetDate, { weekStartsOn: 1 }));
    } else if (periodFilter === 'month') {
      scopeShifts = filteredShiftsForLoading.filter(s => isSameMonth(ensureDate(s.startTime), targetDate));
    }

    const missingShifts = scopeShifts.filter(s => s.totalTrips > 0 && !shiftTrips[s.id]);
    
    if (missingShifts.length > 0) {
      setIsLoadingInsights(true);
      
      const fetchMissing = async () => {
        try {
          const newTripsObj: Record<string, Trip[]> = {};
          let changed = false;

          await Promise.all(missingShifts.map(async (shift) => {
            const q = query(
              collection(db, 'shifts', shift.id, 'trips'),
              where('userId', '==', user.uid)
            );
            const snap = await getDocs(q);
            newTripsObj[shift.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Trip));
            changed = true;
          }));

          if (changed) {
            setShiftTrips(prev => ({ ...prev, ...newTripsObj }));
          }
        } catch (e) {
          console.error("Failed to load insights trips", e);
        } finally {
          setIsLoadingInsights(false);
        }
      };

      fetchMissing();
    } else {
      setIsLoadingInsights(false);
    }
  }, [periodFilter, referenceDate, shifts, user]);

    
    useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const qShifts = query(collection(db, 'shifts'), where('userId', '==', user.uid), orderBy('startTime', 'desc'));
    const unsubShifts = onSnapshot(qShifts, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
      setShifts(data);
      const active = data.find(s => s.status === 'active' || s.status === 'paused');
      setActiveShift(active || null);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'shifts'));

    const qExpenses = query(collection(db, 'expenses'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    const unsubExpenses = onSnapshot(qExpenses, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    const qFuel = query(collection(db, 'fuel'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    const unsubFuel = onSnapshot(qFuel, (snap) => {
      setFuelRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as Fuel)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'fuel'));

    const qFixed = query(collection(db, 'fixed_expenses'), where('userId', '==', user.uid));
    const unsubFixed = onSnapshot(qFixed, (snap) => {
      setFixedExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as FixedExpense)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'fixed_expenses'));

    const qWithdrawals = query(collection(db, 'withdrawals'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    const unsubWithdrawals = onSnapshot(qWithdrawals, (snap) => {
      setWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Withdrawal)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals'));

    const unsubSettings = onSnapshot(doc(db, 'settings', user.uid), (snap) => {
      if (snap.exists()) {
        setSettings({ userId: snap.id, ...snap.data() } as UserSettings);
      } else {
        // Default settings
        setSettings({
          userId: user.uid,
          maintenanceCostPerKm: 0.15,
          maintenancePercentage: 10,
          dailyRevenueGoal: 250,
          monthlyNetGoal: 2000,
          platformBalance: 0,
          defaultFuelPrice: 5.50,
          avgConsumption: 12.0,
          oilChangeInterval: 10000,
          lastOilChangeKm: 0,
          tireRotationInterval: 10000,
          lastTireRotationKm: 0,
          timingBeltInterval: 50000,
          lastTimingBeltKm: 0
        });
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `settings/${user.uid}`));

    return () => {
      unsubShifts();
      unsubExpenses();
      unsubFuel();
      unsubFixed();
      unsubWithdrawals();
      unsubSettings();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !expandedShiftId) return;
    const qTrips = query(
      collection(db, 'shifts', expandedShiftId, 'trips'), 
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubTrips = onSnapshot(qTrips, (snap) => {
      setShiftTrips(prev => ({
        ...prev,
        [expandedShiftId]: snap.docs.map(d => ({ id: d.id, ...d.data() } as Trip))
      }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `shifts/${expandedShiftId}/trips`));

    return () => unsubTrips();
  }, [user, expandedShiftId]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeShift && activeShift.status === 'active') {
      interval = setInterval(() => {
        const now = new Date();
        const lastStarted = ensureDate(activeShift.lastStartedAt);
        const diff = differenceInSeconds(now, lastStarted);
        setElapsedTime(activeShift.activeTimeSeconds + diff);
      }, 1000);
    } else if (activeShift && activeShift.status === 'paused') {
      setElapsedTime(activeShift.activeTimeSeconds);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [activeShift]);

  const formatTime = (seconds: number) => {
    const s_val = Math.max(0, seconds);
    const h = Math.floor(s_val / 3600);
    const m = Math.floor((s_val % 3600) / 60);
    const s = Math.floor(s_val % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimeHuman = (seconds: number) => {
    const s_val = Math.max(0, seconds);
    const h = Math.floor(s_val / 3600);
    const m = Math.floor((s_val % 3600) / 60);
    if (h > 0) return `${h}H ${m}MIN`;
    return `${m}MIN`;
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setAuthError('Erro de credencial. Se estiver usando um navegador privado ou bloqueador de anúncios, tente desativá-los.');
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setAuthError('E-mail ou senha incorretos. Se você nunca criou uma conta com e-mail, tente o Login com Google.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setAuthError('O login por e-mail não está ativado. Use o Login com Google ou peça ao administrador para ativar.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setAuthError(err.message || 'Erro na autenticação');
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const handleImportData = async () => {
    if (!user || !importText.trim()) return;
    
    const apiKeyToUse = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKeyToUse) {
      alert("Chave API do Gemini não encontrada. Configure-a na aba Ajustes.");
      return;
    }

    setIsImportingData(true);
    try {
      const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
      
      const prompt = `
Você é um especialista em extração de dados. O usuário colou o seguinte texto contendo dados de turnos e corridas de um aplicativo de motorista.
O texto pode estar no formato CSV exportado pelo app ou em texto livre estruturado.

Sua tarefa é analisar esse texto e retornar um JSON estrito contendo um array de turnos.
Cada turno deve ter o seguinte formato exato (tipos de dados são importantes):
[
  {
    "startTime": "YYYY-MM-DDTHH:mm:ssZ", // Data e hora de início do turno (ISO 8601)
    "endTime": "YYYY-MM-DDTHH:mm:ssZ", // Data e hora de fim do turno (ISO 8601)
    "startKm": 10000, // Número
    "endKm": 10150, // Número
    "totalWorkKm": 150, // Número
    "totalPersonalKm": 0, // Número
    "totalRevenue": 250.50, // Número (Faturamento total do turno)
    "activeTimeSeconds": 28800, // Número (Tempo ativo em segundos)
    "avgConsumption": 10.5, // Número (Consumo médio, opcional, use 0 se não tiver)
    "trips": [ // Array de corridas daquele turno
      {
        "timestamp": "YYYY-MM-DDTHH:mm:ssZ", // Data e hora da corrida
        "distanceKm": 15.2, // Número
        "durationSeconds": 1200, // Número
        "value": 35.00 // Número
      }
    ]
  }
]

Regras:
1. Agrupe as corridas que pertencem ao mesmo turno. Se o CSV tiver várias linhas para o mesmo turno (mesma data/hora de início), agrupe-as em um único objeto de turno, colocando as corridas no array "trips".
2. Se não houver dados de corridas detalhadas, retorne o array "trips" vazio [].
3. Calcule ou extraia os valores corretamente.
4. Retorne APENAS o JSON válido, sem formatação markdown (sem \`\`\`json), sem explicações adicionais.

Dados fornecidos pelo usuário:
${importText}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let jsonStr = response.text || "[]";
      // Remove markdown formatting if present
      jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      
      const parsedShifts = JSON.parse(jsonStr);
      
      if (!Array.isArray(parsedShifts)) {
        throw new Error("O formato retornado não é um array válido.");
      }

      setParsedImportData(parsedShifts);
      setShowImportModal(false);
      setShowImportPreviewModal(true);
    } catch (error) {
      console.error("Erro ao importar dados:", error);
      alert("Ocorreu um erro ao analisar os dados. Verifique o formato e tente novamente.");
    } finally {
      setIsImportingData(false);
    }
  };

  const handleHistoryAIAnalysis = async () => {
    if (!analysisQuery.trim()) {
      alert("Por favor, digite uma pergunta.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const baseDate = new Date(selectedAnalysisDate + 'T12:00:00');
      let startDate: Date;
      let endDate: Date;

      if (analysisFilter === 'day') {
        startDate = startOfDay(baseDate);
        endDate = endOfDay(baseDate);
      } else if (analysisFilter === 'week') {
        startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
        endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
      } else {
        startDate = startOfMonth(baseDate);
        endDate = endOfMonth(baseDate);
      }

      // Filter shifts
      const relevantShifts = shifts.filter(s => {
        const d = ensureDate(s.startTime);
        return d >= startDate && d <= endDate;
      });

      if (relevantShifts.length === 0) {
        setAnalysisResult("Não encontrei dados de turnos para este período para analisar.");
        setIsAnalyzing(false);
        return;
      }

      // Prepare data for AI
      const dataForAi = relevantShifts.map(s => ({
        data: format(ensureDate(s.startTime), 'dd/MM/yyyy'),
        horario: `${format(ensureDate(s.startTime), 'HH:mm')} - ${s.endTime ? format(ensureDate(s.endTime), 'HH:mm') : 'Em andamento'}`,
        faturamento: s.totalRevenue,
        km_rodado: s.totalWorkKm || (s.endKm ? s.endKm - s.startKm : 0),
        viagens: s.totalTrips,
        consumo: s.avgConsumption,
        horas: s.activeTimeSeconds ? (s.activeTimeSeconds / 3600).toFixed(1) : '?',
        v_trips: shiftTrips[s.id]?.map(t => ({
          v: t.value,
          d: t.distanceKm,
          dur: (t.durationSeconds / 60).toFixed(0) + 'min'
        }))
      }));

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Você é um consultor especializado em motoristas de aplicativo.
Analise os seguintes dados do período (${analysisFilter === 'day' ? 'Dia' : analysisFilter === 'week' ? 'Semana' : 'Mês'}):
${JSON.stringify(dataForAi)}

O motorista perguntou: "${analysisQuery}"

Forneça uma análise resumida, direta e acionável. 
Fale sobre:
- Desempenho geral.
- Oportunidades de melhoria (melhores horários/dias).
- Rentabilidade (quais corridas foram boas ou ruins com base em R$/km e R$/hora).
- Sugestões para bater metas.

REGRAS CRÍTICAS:
- Responda em Português Brasileiro.
- Seja MUITO RESUMIDO.
- Máximo de 700 caracteres. Se a pergunta pedir um limite menor (ex: 200 caracteres), RESPEITE ESTRITAMENTE esse limite menor.
- Use bullet points se ajudar na brevidade.
- Não use introduções longas como "Com base nos dados...". Vá direto ao ponto.`;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      setAnalysisResult(result.text || "Não foi possível gerar a análise no momento.");
      setShowAiResultModal(true);
    } catch (error) {
      console.error("AI Analysis error:", error);
      setAnalysisResult("Ocorreu um erro ao processar sua análise. Tente novamente.");
      setShowAiResultModal(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const confirmImportData = async () => {
    if (!user || !parsedImportData) return;
    setIsImportingData(true);
    try {
      const batch = writeBatch(db);
      
      for (const shiftData of parsedImportData) {
        const shiftRef = doc(collection(db, 'shifts'));
        const shiftDoc = {
          userId: user.uid,
          startTime: Timestamp.fromDate(new Date(shiftData.startTime)),
          endTime: shiftData.endTime ? Timestamp.fromDate(new Date(shiftData.endTime)) : null,
          status: 'finished',
          startKm: Number(shiftData.startKm) || 0,
          endKm: Number(shiftData.endKm) || 0,
          lastKm: Number(shiftData.endKm) || Number(shiftData.startKm) || 0,
          totalWorkKm: Number(shiftData.totalWorkKm) || 0,
          totalPersonalKm: Number(shiftData.totalPersonalKm) || 0,
          totalRevenue: Number(shiftData.totalRevenue) || 0,
          activeTimeSeconds: Number(shiftData.activeTimeSeconds) || 0,
          totalTrips: Array.isArray(shiftData.trips) ? shiftData.trips.length : 0,
          avgConsumption: Number(shiftData.avgConsumption) || 0,
        };
        
        batch.set(shiftRef, shiftDoc);

        if (Array.isArray(shiftData.trips)) {
          for (const tripData of shiftData.trips) {
            const tripRef = doc(collection(db, 'shifts', shiftRef.id, 'trips'));
            const tripDoc = {
              userId: user.uid,
              shiftId: shiftRef.id,
              timestamp: Timestamp.fromDate(new Date(tripData.timestamp)),
              distanceKm: Number(tripData.distanceKm) || 0,
              durationSeconds: Number(tripData.durationSeconds) || 0,
              value: Number(tripData.value) || 0,
            };
            batch.set(tripRef, tripDoc);
          }
        }
      }

      await batch.commit();
      setShowImportPreviewModal(false);
      setParsedImportData(null);
      setImportText('');
      alert("Dados importados com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar dados importados:", error);
      alert("Ocorreu um erro ao salvar os dados.");
    } finally {
      setIsImportingData(false);
    }
  };

  const exportShiftsToCSV = async () => {
    if (shifts.length === 0 || !user) return;
    
    setIsExporting(true);
    try {
      const allTrips: Record<string, Trip[]> = {};
      
      for (const shift of shifts) {
        try {
          const qTrips = query(
            collection(db, 'shifts', shift.id, 'trips'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'asc')
          );
          const snap = await getDocs(qTrips);
          allTrips[shift.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Trip));
        } catch (err) {
          console.error(`Error fetching trips for shift ${shift.id}`, err);
          allTrips[shift.id] = [];
        }
      }

      const headers = [
        'ID do Turno', 'Data do Turno', 'Início do Turno', 'Fim do Turno', 
        'Faturamento do Turno (R$)', 'Tempo Ativo do Turno', 
        'KM Inicial do Turno', 'KM Final do Turno', 'KM Trabalho do Turno', 'KM Pessoal do Turno', 'Consumo (KM/L)',
        'Total de Corridas no Turno', 'Tempo Desperdiçado/Parado',
        '--- Dados da Corrida ---',
        'ID da Corrida', 'Status', 'Valor da Corrida (R$)', 'Dinâmico Adicional (R$)',
        'Data da Corrida', 'Hora da Corrida', 'Duração (Minutos)', 'Duração (Segundos)', 'Distância (KM)', 'Rentabilidade (R$/Hora)', 'Rentabilidade (R$/KM)'
      ];

      const rows: string[][] = [];

      shifts.forEach(s => {
        const shiftId = s.id;
        const shiftDate = format(ensureDate(s.startTime), 'dd/MM/yyyy');
        const shiftStart = format(ensureDate(s.startTime), 'HH:mm');
        const shiftEnd = s.endTime ? format(ensureDate(s.endTime), 'HH:mm') : '--';
        const shiftRev = s.totalRevenue.toFixed(2);
        const shiftTime = formatTime(s.activeTimeSeconds);
        const shiftStartKm = s.startKm.toString();
        const shiftEndKm = s.endKm?.toString() || '--';
        const shiftWorkKm = s.totalWorkKm?.toFixed(1) || '--';
        const shiftPersonalKm = s.totalPersonalKm?.toFixed(1) || '--';
        const shiftCons = s.avgConsumption?.toFixed(1) || '--';
        const totalTripsStr = s.totalTrips.toString();
        
        const totalRawSecs = s.endTime ? differenceInSeconds(ensureDate(s.endTime), ensureDate(s.startTime)) : 0;
        const wastedSecs = Math.max(0, totalRawSecs - s.activeTimeSeconds);
        const wastedStr = formatTime(wastedSecs);

        const trips = allTrips[s.id] || [];
        
        if (trips.length === 0) {
          rows.push([
            shiftId, shiftDate, shiftStart, shiftEnd, shiftRev, shiftTime, 
            shiftStartKm, shiftEndKm, shiftWorkKm, shiftPersonalKm, shiftCons, totalTripsStr, wastedStr,
            '', // separator
            '--', '--', '--', '--', '--', '--', '--', '--', '--', '--', '--'
          ]);
        } else {
          trips.forEach(t => {
            const isCancelled = t.isCancelled ? 'Cancelada' : 'Concluída';
            const dynamicVal = t.dynamicValue ? t.dynamicValue.toFixed(2) : '0.00';
            const mins = (t.durationSeconds / 60).toFixed(1);
            const rph = t.durationSeconds > 0 ? (t.value / (t.durationSeconds / 3600)).toFixed(2) : '0.00';
            const rpkm = t.distanceKm && t.distanceKm > 0 ? (t.value / t.distanceKm).toFixed(2) : '0.00';
            
            rows.push([
              shiftId, shiftDate, shiftStart, shiftEnd, shiftRev, shiftTime, 
              shiftStartKm, shiftEndKm, shiftWorkKm, shiftPersonalKm, shiftCons, totalTripsStr, wastedStr,
              '', // separator
              t.id, isCancelled, t.value.toFixed(2), dynamicVal,
              format(ensureDate(t.timestamp), 'dd/MM/yyyy'),
              format(ensureDate(t.timestamp), 'HH:mm'),
              mins, t.durationSeconds.toString(), (t.distanceKm || 0).toFixed(1), rph, rpkm
            ]);
          });
        }
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `historico_turnos_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  };

  const exportExpensesToCSV = () => {
    if (expenses.length === 0 && fuelRecords.length === 0) return;

    const headers = ['Tipo', 'Data', 'Categoria', 'Valor (R$)', 'KM', 'Detalhes'];
    
    const expenseRows = expenses.map(e => [
      'Despesa',
      format(ensureDate(e.date), 'dd/MM/yyyy'),
      e.category,
      e.value.toFixed(2),
      e.kmAtExpense,
      ''
    ]);

    const fuelRows = fuelRecords.map(f => [
      'Combustível',
      format(ensureDate(f.date), 'dd/MM/yyyy'),
      'Abastecimento',
      f.totalValue.toFixed(2),
      f.km,
      `${f.liters.toFixed(2)}L @ R$${f.pricePerLiter.toFixed(2)}`
    ]);

    const csvContent = [
      headers.join(','),
      ...expenseRows.map(r => r.join(',')),
      ...fuelRows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `custos_veiculo_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAllDataToJSON = () => {
    const data = {
      shifts,
      expenses,
      fuelRecords,
      settings,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `driverops_backup_${format(new Date(), 'yyyy-MM-dd')}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startShift = async (km: number, autonomy: number) => {
    if (!user) return;
    try {
      const personalKm = lastRecordedKm > 0 && km > lastRecordedKm ? km - lastRecordedKm : 0;
      await addDoc(collection(db, 'shifts'), {
        userId: user.uid,
        startTime: new Date(),
        startKm: km,
        startAutonomy: autonomy,
        status: 'active',
        activeTimeSeconds: 0,
        lastStartedAt: new Date(),
        totalRevenue: 0,
        totalTrips: 0,
        totalWorkKm: 0,
        totalPersonalKm: personalKm,
        lastKm: km,
        currentState: 'dispatch',
        stateLastChangedAt: new Date(),
        idleTimeSeconds: 0,
        dispatchTimeSeconds: 0,
        rideTimeSeconds: 0
      });
      setShowStartModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    }
  };

  const changeShiftState = async (newState: ShiftState) => {
    if (!activeShift) return;
    const now = new Date();
    
    let lastChanged: Date;
    if (activeShift.stateLastChangedAt === null) {
      lastChanged = now;
    } else if (activeShift.stateLastChangedAt) {
      lastChanged = ensureDate(activeShift.stateLastChangedAt);
    } else {
      lastChanged = ensureDate(activeShift.lastStartedAt);
    }
    
    const diffSeconds = Math.max(0, differenceInSeconds(now, lastChanged));
    
    const updates: any = {
      currentState: newState,
      stateLastChangedAt: new Date()
    };

    const prevState = activeShift.currentState || 'dispatch';
    if (prevState === 'idle') {
      updates.idleTimeSeconds = (activeShift.idleTimeSeconds || 0) + diffSeconds;
    } else if (prevState === 'dispatch') {
      updates.dispatchTimeSeconds = (activeShift.dispatchTimeSeconds || 0) + diffSeconds;
    } else if (prevState === 'ride') {
      updates.rideTimeSeconds = (activeShift.rideTimeSeconds || 0) + diffSeconds;
    }

    if (newState === 'ride' && prevState !== 'ride') {
      updates.totalTrips = (activeShift.totalTrips || 0) + 1;
      
      // Auto-create a pending trip to capture start time
      try {
        await addDoc(collection(db, 'shifts', activeShift.id, 'trips'), {
          userId: activeShift.userId,
          shiftId: activeShift.id,
          value: 0,
          durationSeconds: 0,
          distanceKm: 0,
          timestamp: serverTimestamp(),
          startTime: serverTimestamp()
        });
      } catch (err) {
        console.error("Error creating pending trip", err);
      }
    }

    try {
      await updateDoc(doc(db, 'shifts', activeShift.id), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${activeShift.id}`);
    }
  };

  const pauseShift = async (revenue: number, km: number, autonomy: number) => {
    if (!activeShift) return;
    try {
      const now = new Date();
      
      let lastStarted: Date;
      if (activeShift.lastStartedAt === null) lastStarted = now;
      else if (activeShift.lastStartedAt) lastStarted = ensureDate(activeShift.lastStartedAt);
      else lastStarted = now;
      
      const diffTime = Math.max(0, differenceInSeconds(now, lastStarted));
      const newActiveTime = activeShift.activeTimeSeconds + diffTime;
      
      const diffKm = km - activeShift.lastKm;
      const newWorkKm = activeShift.totalWorkKm + Math.max(0, diffKm);

      let lastStateChanged: Date;
      if (activeShift.stateLastChangedAt === null) lastStateChanged = now;
      else if (activeShift.stateLastChangedAt) lastStateChanged = ensureDate(activeShift.stateLastChangedAt);
      else lastStateChanged = lastStarted;
      
      const diffStateTime = Math.max(0, differenceInSeconds(now, lastStateChanged));
      const prevState = activeShift.currentState || 'dispatch';
      
      const updates: any = {
        status: 'paused',
        activeTimeSeconds: newActiveTime,
        totalRevenue: revenue,
        endKm: km,
        endAutonomy: autonomy,
        totalWorkKm: newWorkKm,
        lastKm: km
      };

      if (prevState === 'idle') {
        updates.idleTimeSeconds = (activeShift.idleTimeSeconds || 0) + diffStateTime;
      } else if (prevState === 'dispatch') {
        updates.dispatchTimeSeconds = (activeShift.dispatchTimeSeconds || 0) + diffStateTime;
      } else if (prevState === 'ride') {
        updates.rideTimeSeconds = (activeShift.rideTimeSeconds || 0) + diffStateTime;
      }

      await updateDoc(doc(db, 'shifts', activeShift.id), updates);
      setShowPauseModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${activeShift.id}`);
    }
  };

  const resumeShift = async (km?: number, autonomy?: number) => {
    if (!activeShift) return;
    try {
      const updates: any = {
        status: 'active',
        lastStartedAt: new Date(),
        stateLastChangedAt: new Date() // Reset state timer on resume
      };
      
      if (km !== undefined) {
        const personalDiff = km - activeShift.lastKm;
        updates.totalPersonalKm = activeShift.totalPersonalKm + Math.max(0, personalDiff);
        updates.lastKm = km;
      }

      if (autonomy !== undefined) updates.startAutonomy = autonomy;

      await updateDoc(doc(db, 'shifts', activeShift.id), updates);
      setShowResumeModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${activeShift.id}`);
    }
  };

  const updatePartialRevenue = async (newRevenueTotal: number, newKm: number) => {
    if (!activeShift || !user) return;
    try {
      const currentRevenue = activeShift.totalRevenue || 0;
      const currentKm = activeShift.lastKm || activeShift.startKm || 0;
      const currentWorkKm = activeShift.totalWorkKm || 0;

      const diffKm = newKm ? newKm - currentKm : 0;
      const newWorkKm = currentWorkKm + Math.max(0, diffKm);
      
      const updates: any = {
        totalRevenue: newRevenueTotal
      };
      
      const diffRevenue = newRevenueTotal - currentRevenue;
      if (diffRevenue !== 0) {
        const settingsRef = doc(db, 'settings', user.uid);
        const currentBalance = settings?.platformBalance || 0;
        await setDoc(settingsRef, {
          platformBalance: currentBalance + diffRevenue
        }, { merge: true });
      }
      
      if (newKm && diffKm >= 0) {
        updates.lastKm = newKm;
        if (activeShift.status === 'active') {
          updates.totalWorkKm = newWorkKm;
        } else if (activeShift.status === 'paused') {
          updates.totalPersonalKm = (activeShift.totalPersonalKm || 0) + Math.max(0, diffKm);
        }
      }
      
      await updateDoc(doc(db, 'shifts', activeShift.id), updates);
      setShowPartialRevenueModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${activeShift.id}`);
    }
  };

  const registerQuickTrip = async (estimatedValue: number) => {
    if (!activeShift) return;
    try {
      await addDoc(collection(db, 'shifts', activeShift.id, 'trips'), {
        userId: activeShift.userId,
        shiftId: activeShift.id,
        value: estimatedValue,
        durationSeconds: 0,
        distanceKm: 0,
        startTime: serverTimestamp(),
        timestamp: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'shifts', activeShift.id), {
        totalTrips: increment(1),
        totalRevenue: increment(estimatedValue)
      });
      
      if (user) {
        const settingsRef = doc(db, 'settings', user.uid);
        const currentBalance = settings?.platformBalance || 0;
        await setDoc(settingsRef, {
          platformBalance: currentBalance + estimatedValue
        }, { merge: true });
      }
      
      setShowQuickTripModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shifts/${activeShift.id}/trips`);
    }
  };

  const finishShift = async (km: number, autonomy: number, avgCons: number, revenue: number, trips: number) => {
    if (!activeShift) return;
    try {
      const now = new Date();
      let finalActiveTime = activeShift.activeTimeSeconds;
      let finalWorkKm = activeShift.totalWorkKm;
      
      let finalIdleTime = activeShift.idleTimeSeconds || 0;
      let finalDispatchTime = activeShift.dispatchTimeSeconds || 0;
      let finalRideTime = activeShift.rideTimeSeconds || 0;

      if (activeShift.status === 'active') {
        let lastStarted: Date;
        if (activeShift.lastStartedAt === null) lastStarted = now;
        else if (activeShift.lastStartedAt) lastStarted = ensureDate(activeShift.lastStartedAt);
        else lastStarted = now;
        
        finalActiveTime += Math.max(0, differenceInSeconds(now, lastStarted));
        finalWorkKm += Math.max(0, km - activeShift.lastKm);

        let lastStateChanged: Date;
        if (activeShift.stateLastChangedAt === null) lastStateChanged = now;
        else if (activeShift.stateLastChangedAt) lastStateChanged = ensureDate(activeShift.stateLastChangedAt);
        else lastStateChanged = lastStarted;
        
        const diffStateTime = Math.max(0, differenceInSeconds(now, lastStateChanged));
        const prevState = activeShift.currentState || 'dispatch';
        
        if (prevState === 'idle') finalIdleTime += diffStateTime;
        else if (prevState === 'dispatch') finalDispatchTime += diffStateTime;
        else if (prevState === 'ride') finalRideTime += diffStateTime;
      }

      // Normalize state times to match finalActiveTime
      let totalStateTime = finalIdleTime + finalDispatchTime + finalRideTime;
      if (totalStateTime > 0 && finalActiveTime > 0 && Math.abs(totalStateTime - finalActiveTime) > 5) {
        const scale = finalActiveTime / totalStateTime;
        finalIdleTime *= scale;
        finalDispatchTime *= scale;
        finalRideTime *= scale;
        totalStateTime = finalActiveTime;
      }

      // Calculate proportional KMs
      let productiveKm = 0;
      let unproductiveKm = 0;
      let idleKm = 0;

      if (totalStateTime > 0) {
        productiveKm = finalWorkKm * (finalRideTime / totalStateTime);
        unproductiveKm = finalWorkKm * (finalDispatchTime / totalStateTime);
        idleKm = finalWorkKm * (finalIdleTime / totalStateTime);
      }

      // Calculate revenue difference to add to balance
      const diffRevenue = revenue - (activeShift.totalRevenue || 0);

      await updateDoc(doc(db, 'shifts', activeShift.id), {
        status: 'finished',
        endTime: new Date(),
        endKm: km,
        endAutonomy: autonomy,
        avgConsumption: avgCons,
        totalRevenue: revenue,
        totalTrips: trips,
        activeTimeSeconds: finalActiveTime,
        totalWorkKm: finalWorkKm,
        lastKm: km,
        idleTimeSeconds: finalIdleTime,
        dispatchTimeSeconds: finalDispatchTime,
        rideTimeSeconds: finalRideTime,
        productiveKm,
        unproductiveKm,
        idleKm
      });
      
      if (diffRevenue !== 0) {
        const currentBalance = settings?.platformBalance || 0;
        await setDoc(doc(db, 'settings', user.uid), {
          platformBalance: currentBalance + diffRevenue
        }, { merge: true });
      }

      setShowFinishModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${activeShift?.id}`);
    }
  };

  const addExpense = async (date: Date, category: any, value: number, km: number, paymentMethod: 'Pix' | 'Crédito', installments: number) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      const installmentValue = value / installments;

      for (let i = 0; i < installments; i++) {
        const expenseDate = new Date(date);
        expenseDate.setMonth(expenseDate.getMonth() + i);

        const newExpenseRef = doc(collection(db, 'expenses'));
        batch.set(newExpenseRef, {
          userId: user.uid,
          date: Timestamp.fromDate(expenseDate),
          category,
          value: installmentValue,
          kmAtExpense: km,
          paymentMethod,
          installments: installments > 1 ? installments : undefined
        });
      }
      
      await batch.commit();
      setShowExpenseModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'expenses');
    }
  };

  const addTrip = async (value: number, durationSeconds: number, distanceKm: number) => {
    if (!user || !selectedShiftId || !settings) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Add trip
      const newTripRef = doc(collection(db, 'shifts', selectedShiftId, 'trips'));
      batch.set(newTripRef, {
        userId: user.uid,
        shiftId: selectedShiftId,
        value,
        durationSeconds,
        distanceKm,
        timestamp: serverTimestamp()
      });

      // 2. Update platform balance in settings
      const settingsRef = doc(db, 'settings', user.uid);
      batch.set(settingsRef, {
        platformBalance: (settings.platformBalance || 0) + value
      }, { merge: true });

      // 3. Update shift totalRevenue (Optimistic/Synchronous update for the shift)
      const shiftRef = doc(db, 'shifts', selectedShiftId);
      // Note: We don't have the current shift revenue here easily without another get, 
      // but we can use increment if we want, or just let the trips subcollection fetchers do their job.
      // However, App.tsx usually has shifts in state.
      const currentShift = shifts.find(s => s.id === selectedShiftId);
      if (currentShift) {
        batch.update(shiftRef, {
          totalRevenue: (currentShift.totalRevenue || 0) + value,
          totalTrips: (currentShift.totalTrips || 0) + 1
        });
      }

      await batch.commit();
      setShowTripModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shifts/${selectedShiftId}/trips_batch`);
    }
  };

  const addFuel = async (date: Date, km: number, price: number, total: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'fuel'), {
        userId: user.uid,
        date: Timestamp.fromDate(date),
        km,
        pricePerLiter: price,
        totalValue: total,
        liters: total / price
      });
      setShowFuelModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fuel');
    }
  };

  const addShiftFuel = async (date: Date, km: number, price: number, total: number, autonomyBefore: number, autonomyAfter: number) => {
    if (!user || !activeShift) return;
    try {
      const addedAutonomy = autonomyAfter - autonomyBefore;
      
      await addDoc(collection(db, 'fuel'), {
        userId: user.uid,
        shiftId: activeShift.id,
        date: Timestamp.fromDate(date),
        km,
        pricePerLiter: price,
        totalValue: total,
        liters: total / price,
        autonomyBefore,
        autonomyAfter
      });

      await updateDoc(doc(db, 'shifts', activeShift.id), {
        addedAutonomy: (activeShift.addedAutonomy || 0) + addedAutonomy,
        fuelExpense: (activeShift.fuelExpense || 0) + total
      });

      setShowShiftFuelModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fuel');
    }
  };

  const addPastShift = async (start: Date, end: Date, startKm: number, endKm: number, revenue: number, trips: number, avgCons?: number, activeSecs?: number) => {
    if (!user) return;
    try {
      const activeTime = activeSecs !== undefined ? activeSecs : Math.max(0, differenceInSeconds(end, start));
      const workKm = Math.max(0, endKm - startKm);
      
      const previousShift = shifts.find(s => s.endTime && ensureDate(s.endTime) < start);
      const prevKm = previousShift ? (previousShift.endKm || previousShift.lastKm || previousShift.startKm) : 0;
      const personalKm = prevKm > 0 && startKm > prevKm ? startKm - prevKm : 0;

      await addDoc(collection(db, 'shifts'), {
        userId: user.uid,
        startTime: Timestamp.fromDate(start),
        endTime: Timestamp.fromDate(end),
        startKm,
        endKm,
        totalRevenue: revenue,
        totalTrips: trips,
        status: 'finished',
        activeTimeSeconds: activeTime,
        lastStartedAt: Timestamp.fromDate(start),
        startAutonomy: 0,
        endAutonomy: 0,
        avgConsumption: avgCons || 0,
        totalWorkKm: Math.max(0, workKm),
        totalPersonalKm: personalKm,
        lastKm: endKm
      });
      setShowPastShiftModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    }
  };

  const addFixedExpense = async (name: string, amount: number, dueDay: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'fixed_expenses'), {
        userId: user.uid,
        name,
        amount,
        dueDay,
        active: true
      });
      setShowFixedExpenseModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fixed_expenses');
    }
  };

  const updateFixedExpense = async (id: string, name: string, amount: number, dueDay: number) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'fixed_expenses', id), {
        name,
        amount,
        dueDay
      });
      setShowFixedExpenseModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fixed_expenses/${id}`);
    }
  };

  const deleteFixedExpense = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'fixed_expenses', id));
      setShowFixedExpenseModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fixed_expenses/${id}`);
    }
  };

  const payFixedExpense = async (fe: FixedExpense) => {
    if (!user || !settings) return;
    try {
      const currentMonthStr = format(new Date(), 'yyyy-MM');
      const batch = writeBatch(db);
      
      const feRef = doc(db, 'fixed_expenses', fe.id);
      batch.update(feRef, { lastPaidMonth: currentMonthStr });
      
      const settingsRef = doc(db, 'settings', user.uid);
      batch.set(settingsRef, {
        platformBalance: (settings.platformBalance || 0) - fe.amount
      }, { merge: true });
      
      await batch.commit();
      setSettings(prev => prev ? { ...prev, platformBalance: (prev.platformBalance || 0) - fe.amount } : null);
      
      // Update local state directly to be responsive
      setFixedExpenses(prev => prev.map(item => item.id === fe.id ? { ...item, lastPaidMonth: currentMonthStr } : item));
      
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fixed_expenses/${fe.id}`);
    }
  };

  const addWithdrawal = async (amount: number, date: Date, fee: number) => {
    if (!user || !settings) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Create withdrawal record
      const newWithdrawalRef = doc(collection(db, 'withdrawals'));
      batch.set(newWithdrawalRef, {
        userId: user.uid,
        date: Timestamp.fromDate(date),
        amount,
        fee
      });

      // 2. Subtract from platform balance
      const newBalance = (settings.platformBalance || 0) - amount;
      const settingsRef = doc(db, 'settings', user.uid);
      batch.set(settingsRef, {
        platformBalance: newBalance
      }, { merge: true });

      // 3. If there is a fee, record it as a "Taxa Bancária/Saque" expense
      if (fee > 0) {
        const newExpenseRef = doc(collection(db, 'expenses'));
        batch.set(newExpenseRef, {
          userId: user.uid,
          date: Timestamp.fromDate(date),
          category: 'Taxa Bancária/Saque',
          value: fee,
          kmAtExpense: lastRecordedKm || 0,
          paymentMethod: 'Pix'
        });
      }

      await batch.commit();
      setShowWithdrawalModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'withdrawals/batch');
    }
  };

  const updatePlatformBalance = async (newBalance: number) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'settings', user.uid), {
        platformBalance: newBalance
      }, { merge: true });
      setShowUpdateBalanceModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `settings/${user.uid}`);
    }
  };

  const updateShift = async (id: string, data: Partial<Shift>) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'shifts', id);
      const existing = shifts.find(s => s.id === id);
      if (!existing) return;

      const updates: any = { ...data };
      
      if (data.activeTimeSeconds !== undefined) {
        updates.activeTimeSeconds = data.activeTimeSeconds;
      } else if (data.startTime && data.endTime) {
        const oldStartTime = ensureDate(existing.startTime);
        const oldEndTime = ensureDate(existing.endTime);
        const newStartTime = data.startTime instanceof Timestamp ? ensureDate(data.startTime) : new Date();
        const newEndTime = data.endTime instanceof Timestamp ? ensureDate(data.endTime) : new Date();
        
        const oldTotalDuration = differenceInSeconds(oldEndTime, oldStartTime);
        const newTotalDuration = Math.max(0, differenceInSeconds(newEndTime, newStartTime));
        const durationDiff = newTotalDuration - oldTotalDuration;
        
        if (durationDiff !== 0) {
          updates.activeTimeSeconds = Math.max(0, (existing.activeTimeSeconds || oldTotalDuration) + durationDiff);
        }
      }
      
      if (data.startKm !== undefined && data.endKm !== undefined) {
        updates.totalWorkKm = Math.max(0, data.endKm - data.startKm);
        updates.lastKm = data.endKm;
      } else if (data.endKm !== undefined) {
        updates.totalWorkKm = Math.max(0, data.endKm - existing.startKm);
        updates.lastKm = data.endKm;
      } else if (data.startKm !== undefined) {
        updates.totalWorkKm = Math.max(0, (existing.endKm || existing.startKm) - data.startKm);
      }

      await updateDoc(docRef, updates);
      setShowEditShiftModal(false);
      setEditingShift(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${id}`);
    }
  };

  const updateExpense = async (id: string, data: Partial<Expense>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'expenses', id), data);
      setShowEditExpenseModal(false);
      setEditingExpense(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `expenses/${id}`);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      setShowEditExpenseModal(false);
      setEditingExpense(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const updateFuel = async (id: string, data: Partial<Fuel>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'fuel', id), data);
      setShowEditFuelModal(false);
      setEditingFuel(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fuel/${id}`);
    }
  };

  const deleteFuel = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'fuel', id));
      setShowEditFuelModal(false);
      setEditingFuel(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fuel/${id}`);
    }
  };

  const deleteTrip = async (shiftId: string, tripId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'shifts', shiftId, 'trips', tripId));
      // No need to manually update state, onSnapshot handles it
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shifts/${shiftId}/trips/${tripId}`);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'settings', user.uid), {
        ...settings,
        ...newSettings,
        userId: user.uid
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `settings/${user.uid}`);
    }
  };
  const deleteAllTrips = async (shiftId: string) => {
    if (!user) return;
    try {
      const tripsRef = collection(db, 'shifts', shiftId, 'trips');
      const q = query(tripsRef, where('userId', '==', user.uid));
      const tripsSnap = await getDocs(q);
      
      if (!tripsSnap.empty) {
        const batch = writeBatch(db);
        tripsSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shifts/${shiftId}/trips`);
    }
  };

  const deleteShift = async (id: string) => {
    if (!user) return;
    try {
      const tripsRef = collection(db, 'shifts', id, 'trips');
      const q = query(tripsRef, where('userId', '==', user.uid));
      const tripsSnap = await getDocs(q);
      
      if (!tripsSnap.empty) {
        const batch = writeBatch(db);
        tripsSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      await deleteDoc(doc(db, 'shifts', id));
      setShowEditShiftModal(false);
      setEditingShift(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shifts/${id}`);
    }
  };

  const generateAiReport = async () => {
    if (!user || !metrics) return;
    setIsGeneratingAi(true);
    try {
      const apiKeyToUse = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKeyToUse) {
        setAiReport("Chave API do Gemini não encontrada. Configure-a na aba Ajustes para usar no celular.");
        setIsGeneratingAi(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey: apiKeyToUse });

      const viagensPorHora = metrics.totalHours > 0 ? (metrics.totalTrips / metrics.totalHours).toFixed(2) : '0.00';

    const targetDate = referenceDate;
    let filteredShiftsForAi = shifts;
    if (periodFilter === 'day') {
        filteredShiftsForAi = filteredShiftsForAi.filter(s => isSameDay(ensureDate(s.startTime), targetDate));
      } else if (periodFilter === 'week') {
        filteredShiftsForAi = filteredShiftsForAi.filter(s => isSameWeek(ensureDate(s.startTime), targetDate, { weekStartsOn: 1 }));
      } else if (periodFilter === 'month') {
        filteredShiftsForAi = filteredShiftsForAi.filter(s => isSameMonth(ensureDate(s.startTime), targetDate));
      }

      const recentShifts = filteredShiftsForAi
        .sort((a, b) => (ensureDate(b.startTime).getTime()) - (ensureDate(a.startTime).getTime()))
        .slice(0, 100);

      const shiftsDataForAI = recentShifts.map(s => {
        const duration = s.activeTimeSeconds / 3600;
        const rph = duration > 0 ? s.totalRevenue / duration : 0;
        const rpkm = s.totalWorkKm > 0 ? s.totalRevenue / s.totalWorkKm : 0;
        const date = format(ensureDate(s.startTime), 'dd/MM HH:mm');
        return `[${date}] R$${s.totalRevenue.toFixed(2)} | ${duration.toFixed(1)}h | ${s.totalWorkKm.toFixed(1)}km | ${s.totalTrips} viagens | R$/h: ${rph.toFixed(2)} | R$/km: ${rpkm.toFixed(2)}`;
      }).join('\n');

      const filterDescription = periodFilter === 'day' 
        ? (isSameDay(referenceDate, new Date()) ? 'Hoje' : format(referenceDate, 'dd/MM')) 
        : periodFilter === 'week' 
          ? (isSameWeek(referenceDate, new Date(), { weekStartsOn: 1 }) ? 'Nesta Semana' : 'Dessa Semana')
          : (isSameMonth(referenceDate, new Date()) ? 'Neste Mês' : format(referenceDate, 'MMMM', { locale: ptBR }));

      const allTimeContext = allTimeMetrics ? `
        --- MÉDIAS HISTÓRICAS (GERAL - TODA A CONTA) ---
        - R$/Hora Médio Geral: R$ ${allTimeMetrics.revenuePerHour.toFixed(2)}
        - R$/KM Médio Geral: R$ ${allTimeMetrics.revenuePerKm.toFixed(2)}
        - Ticket Médio Geral: R$ ${allTimeMetrics.ticketMedio.toFixed(2)}
        - Total de Turnos: ${shifts.filter(s => s.status === 'finished').length}
      ` : '';

      const prompt = `
        Atue como um Cientista de Dados e Conselheiro Estratégico de Alta Performance para motoristas de app, focado em otimização agressiva de lucros (Maximizando R$/KM e R$/Hora).
        Analise os seguintes dados recentes (${filterDescription} / até 100 turnos):
        
        ${allTimeContext}

        RESUMO DO PERÍODO SELECIONADO (${filterDescription}):
        - Faturamento Total: R$ ${metrics.totalRevenue.toFixed(2)}
        - KM Rodados (Trabalho): ${metrics.totalKmWork.toFixed(2)} km
        - Tempo Total Ativo: ${metrics.totalHours.toFixed(2)} horas
        - Qtd Viagens: ${metrics.totalTrips}
        - R$/Hora Médio: R$ ${metrics.revenuePerHour.toFixed(2)}
        - Viagens/Hora: ${viagensPorHora}
        - R$/KM Médio: R$ ${metrics.revenuePerKm.toFixed(2)}
        - Ticket Médio: R$ ${metrics.ticketMedio.toFixed(2)}
        - Faturamento com Dinâmico: R$ ${metrics.totalDynamicValue.toFixed(2)}
        - Ganhos com Taxas de Cancelamento: R$ ${metrics.totalCancelledValue.toFixed(2)} (${metrics.totalCancelledTrips} canceladas)
        - Melhor Dia P/ Trabalho: ${metrics.bestDayInfo.day !== -1 ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][metrics.bestDayInfo.day] : 'N/A'} (R$ ${metrics.bestDayInfo.rph.toFixed(2)}/h)
        - Melhor Horário P/ Trabalho: ${metrics.bestHourInfo.hour !== -1 ? `${metrics.bestHourInfo.hour}:00` : 'N/A'} (R$ ${metrics.bestHourInfo.rph.toFixed(2)}/h)
        
        DADOS DIÁRIOS/TURNOS DO PERÍODO:
        ${shiftsDataForAI}
        
        SUA TAREFA - FORNEÇA UM RELATÓRIO ESTRUTURADO NESTES 3 PILARES:

        1. 🔍 DIAGNÓSTICO E COMPARAÇÃO: Analise o desempenho do período selecionado em relação às médias históricas gerais. O motorista está acima ou abaixo da sua média habitual? Fale sobre o ticket médio e pontue se o motorista está ou não tirando bom proveito de Dinâmicos e Cancelamentos.
        2. 🏆 META IDEAL (OS MELHORES 20%): Encontre os 20% melhores turnos nesse histórico recente. Quais foram os valores de R$/KM, R$/Hora e ticket médio nesses dias de pico? Defina esses números agressivamente como o NOVO PADRÃO IDEAL diário.
        3. ⚡ PLANO DE AÇÃO TÁTICO: Dê 3 diretrizes pragmáticas baseadas nos dias analisados para que o motorista atinja os melhores resultados de todos os tempos. Identifique os períodos mais e menos lucrativos.

        REGRAS IMPORTANTES:
        - A resposta DEVE ter NO MÁXIMO 1500 caracteres, mas precisa ser densa, inteligente e baseada rigidamente nos dados acima.
        - Fale como uma máquina de alta performance. Seja extremamente direto, analítico e estratégico.
        - Use formatação em Markdown (negrito para números vitais).
        - Não use saudações, vá direto ao ponto.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiReport(response.text || "Não foi possível gerar o relatório.");
    } catch (err) {
      console.error(err);
      setAiReport("Erro ao conectar com a IA. Verifique sua chave API nos Ajustes.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const generateAIPlanning = async () => {
    if (!user || !planningMetrics) return;
    setIsGeneratingAi(true);
    try {
      const apiKeyToUse = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKeyToUse) {
        setAiReport("Configuração Necessária: Para usar a IA, adicione sua chave Gemini nas configurações.");
        setShowAiResultModal(true);
        return;
      }

      const activeAi = new GoogleGenAI({ apiKey: apiKeyToUse });

      const prompt = `
        Aja como um estrategista financeiro e mentor para motoristas de aplicativo.
        Baseado nos dados atuais do mês:
        - Meta de Lucro Líquido DESEJADA: R$ ${planningMetrics.monthlyNetGoal.toFixed(2)}
        - Custos Fixos (Contas): R$ ${planningMetrics.totalFixed.toFixed(2)}
        - Faturamento Total Necessário (incluindo combustível e manutenção): R$ ${planningMetrics.revenueNeededTotal.toFixed(2)}
        - Faturado até agora: R$ ${planningMetrics.revenueSoFar.toFixed(2)}
        - Faturamento RESTANTE: R$ ${planningMetrics.revenueRemaining.toFixed(2)}
        - Dias restantes no mês: ${planningMetrics.daysRemaining} dias
        
        PERFORMANCE ATUAL:
        - Média de ganhos por hora: R$ ${planningMetrics.avgRph.toFixed(2)}/h
        - Média de ganhos por KM: R$ ${planningMetrics.avgRpkm.toFixed(2)}/km
        - Horas totais necessárias estimadas: ${planningMetrics.totalHoursRemaining.toFixed(1)}h
        - Horas necessárias por dia: ${(planningMetrics.totalHoursRemaining / Math.max(1, planningMetrics.daysRemaining)).toFixed(1)}h
        
        ${metrics ? `
        DADOS EXTRAS IDENTIFICADOS:
        - Valor extra salvo por Tarifas Dinâmicas neste período: R$ ${metrics.totalDynamicValue.toFixed(2)}
        - Lucro passivo por Taxas de Cancelamento (viagens não executadas): R$ ${metrics.totalCancelledValue.toFixed(2)}
        - Melhor Horário p/ trabalho: ${metrics.bestHourInfo.hour !== -1 ? `${metrics.bestHourInfo.hour.toString().padStart(2, '0')}:00 com R$ ${metrics.bestHourInfo.rph.toFixed(2)}/h` : 'Indisponível'}
        - Melhor Dia p/ trabalho: ${metrics.bestDayInfo.day !== -1 ? `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][metrics.bestDayInfo.day]} com R$ ${metrics.bestDayInfo.rph.toFixed(2)}/h` : 'Indisponível'}
        ` : ''}

        Crie um planejamento estratégico detalhado e motivador. 
        1. Analise se a meta é realista com base na performance atual.
        2. Avalie as "Métricas Avançadas" acima para orientar em quais horários ou dias ele deve focar e como as tarifas dinâmicas o ajudam.
        3. Dê dicas de como aumentar a eficiência (R$/km e R$/h).
        4. Organize uma sugestão de jornada diária otimizada.
        5. Incentive o motorista.
        
        Responda em Markdown, use emojis e seja direto.
      `;

      const response = await activeAi.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAnalysisResult(response.text || "Não foi possível gerar o plano no momento.");
      setShowAiResultModal(true);
    } catch (err: any) {
      console.error(err);
      setAnalysisResult("Erro ao gerar planejamento. Verifique sua conexão e chave API.");
      setShowAiResultModal(true);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const generateRealtimeAiAnalysis = async () => {
    if (!user || !activeShift) return;
    setIsGeneratingRealtimeAi(true);
    setRealtimeAiReport(null);

    try {
      const apiKeyToUse = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKeyToUse) {
        setRealtimeAiReport({ diag: "Chave API do Gemini não encontrada nos Ajustes.", filter: "", plan: "", tier: "ruim" });
        setIsGeneratingRealtimeAi(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey: apiKeyToUse });

      // Current shift metrics
      const currentHours = elapsedTime / 3600;
      const currentRpkm = activeShift.lastKm && activeShift.lastKm > activeShift.startKm 
        ? activeShift.totalRevenue / (activeShift.lastKm - activeShift.startKm) 
        : 0;
      const currentRph = currentHours > 0 ? activeShift.totalRevenue / currentHours : 0;
      const qtdTrips = activeShift.totalTrips || 0;
      
      const now = new Date();
      const currentHour = now.getHours();
      const nextHour = (currentHour + 1) % 24;

      // Extract all historical trips from the last 30 days with startTime
      const thrityDaysAgo = subMonths(now, 1);
      const allHistoricalTrips = Object.values(shiftTrips)
        .flat()
        .filter(t => t.startTime && ensureDate(t.startTime) >= thrityDaysAgo);

      // Helper to calculate average R$/h for a specific hour across history
      const getStatsForHour = (targetHour: number) => {
        const tripsInHour = allHistoricalTrips.filter(t => ensureDate(t.startTime).getHours() === targetHour);
        const totalValue = tripsInHour.reduce((acc, t) => acc + t.value, 0);
        const totalDurationSecs = tripsInHour.reduce((acc, t) => acc + t.durationSeconds, 0);
        const totalDistance = tripsInHour.reduce((acc, t) => acc + (t.distanceKm || 0), 0);
        
        const rph = totalDurationSecs > 0 ? totalValue / (totalDurationSecs / 3600) : 0;
        const rpkm = totalDistance > 0 ? totalValue / totalDistance : 0;
        return { rph, rpkm, count: tripsInHour.length };
      };

      const histCurrent = getStatsForHour(currentHour);
      const histNext = getStatsForHour(nextHour);

      const prompt = `Você é uma IA de Painel Esportivo em Tempo Real para um motorista de aplicativo. 
Fale de forma enérgica, analítica e de resposta rápida (Estilo telemetria da Fórmula 1).

[TELEMETRIA DO TURNO]
- Rodando há: ${currentHours.toFixed(1)}h
- Eficiência / Volume: ${qtdTrips} corridas feitas
- Faturamento Atual: R$ ${activeShift.totalRevenue.toFixed(2)}
- Ritmo Financeiro (Atual): R$ ${currentRph.toFixed(2)}/Hora  &  R$ ${currentRpkm.toFixed(2)}/Km

[REGRA DE TIER DE DESEMPENHO]
- ruim (Vermelho): <= R$ 1.80/km e/ou <= R$ 32/hr
- mediano (Laranja): 1.80 a 2.00/km e/ou 32 a 38/hr
- bom (Verde): 2.00 a 2.50/km e/ou 38 a 42/hr 
- otimo (Azul): > 2.50/km e/ou > 42/hr

[TENDÊNCIA HISTÓRICA DO HORÁRIO (Últ. 30 dias)]
- Hora Atual (${currentHour}h): Média Histórica de R$ ${histCurrent.rph.toFixed(2)}/h (Base: ${histCurrent.count} corridas)
- Próxima Hora (${nextHour}h): Média Histórica de R$ ${histNext.rph.toFixed(2)}/h (Base: ${histNext.count} corridas)

SUA MISSÃO: Retorne um objeto JSON estrito com as chaves "diag", "filter", "plan" e "tier".

- "diag": Diagnóstico do momento (max 120 chars). Se baseie no Ritmo Financeiro e nas Regras de Tier.
- "filter": O filtro rígido de R$/KM e R$/H sugerido para agora (max 100 chars).
- "plan": MANTER RITMO, AUMENTAR RIGOR, PAUSAR PARA RECUPERAR, ou DESLOGAR E DESCANSAR.
- "tier": Uma das strings exatas com base no Ritmo Atual: "ruim", "mediano", "bom", ou "otimo".

Exemplo de retorno:
{
  "diag": "Ritmo P1! R$ 51.52/h é agressivo. Sem histórico para comparar...",
  "filter": "Exija > R$ 2.10/km para blindar o lucro.",
  "plan": "MANTER RITMO",
  "tier": "otimo"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      if (response.text) {
        setRealtimeAiReport(JSON.parse(response.text));
      } else {
        setRealtimeAiReport({ diag: "Erro ao gerar análise.", filter: "", plan: "", tier: "ruim" });
      }
    } catch (err) {
      console.error(err);
      setRealtimeAiReport({ diag: "Erro de comunicação com a IA.", filter: "", plan: "", tier: "ruim" });
    } finally {
      setIsGeneratingRealtimeAi(false);
    }
  };

  // --- Calculations ---

  const monthlySummary = useMemo(() => {
    const now = new Date();
    const currentMonthShifts = shifts.filter(s => s.status === 'finished' && isSameMonth(ensureDate(s.startTime), now));
    const lastMonthShifts = shifts.filter(s => s.status === 'finished' && isSameMonth(ensureDate(s.startTime), subMonths(now, 1)));

    const currentRevenue = currentMonthShifts.reduce((acc, s) => acc + s.totalRevenue, 0);
    const lastRevenue = lastMonthShifts.reduce((acc, s) => acc + s.totalRevenue, 0);
    
    const growth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;

    return {
      currentRevenue,
      lastRevenue,
      growth,
      currentCount: currentMonthShifts.length,
      lastCount: lastMonthShifts.length
    };
  }, [shifts]);

  const maintenanceAlerts = useMemo(() => {
    if (!settings) return [];
    
    let currentKm = 0;
    if (activeShift?.lastKm) {
      currentKm = Math.max(currentKm, activeShift.lastKm);
    }
    if (shifts.length > 0) {
      const maxShiftKm = Math.max(...shifts.map(s => s.endKm || s.startKm || 0));
      currentKm = Math.max(currentKm, maxShiftKm);
    }
    if (fuelRecords.length > 0) {
      const maxFuelKm = Math.max(...fuelRecords.map(f => f.km));
      currentKm = Math.max(currentKm, maxFuelKm);
    }
    if (expenses.length > 0) {
      const maxExpenseKm = Math.max(...expenses.map(e => e.kmAtExpense || 0));
      currentKm = Math.max(currentKm, maxExpenseKm);
    }
    
    if (currentKm === 0) return [];

    const alerts = [];
    
    // Oil Change
    const oilDue = (settings.lastOilChangeKm || 0) + (settings.oilChangeInterval || 10000);
    if (currentKm >= oilDue - 500) {
      alerts.push({
        id: 'oil',
        title: 'Troca de Óleo',
        message: currentKm >= oilDue ? 'Vencida!' : `Faltam ${oilDue - currentKm} km`,
        severity: currentKm >= oilDue ? 'critical' : 'warning',
        progress: Math.min(100, ((currentKm - (settings.lastOilChangeKm || 0)) / (settings.oilChangeInterval || 10000)) * 100)
      });
    }
    
    // Tire Rotation
    const tireDue = (settings.lastTireRotationKm || 0) + (settings.tireRotationInterval || 10000);
    if (currentKm >= tireDue - 500) {
      alerts.push({
        id: 'tire',
        title: 'Rodízio de Pneus',
        message: currentKm >= tireDue ? 'Vencido!' : `Faltam ${tireDue - currentKm} km`,
        severity: currentKm >= tireDue ? 'critical' : 'warning',
        progress: Math.min(100, ((currentKm - (settings.lastTireRotationKm || 0)) / (settings.tireRotationInterval || 10000)) * 100)
      });
    }
    
    // Timing Belt
    const beltDue = (settings.lastTimingBeltKm || 0) + (settings.timingBeltInterval || 50000);
    if (currentKm >= beltDue - 1000) {
      alerts.push({
        id: 'belt',
        title: 'Correia Dentada',
        message: currentKm >= beltDue ? 'Vencida!' : `Faltam ${beltDue - currentKm} km`,
        severity: currentKm >= beltDue ? 'critical' : 'warning',
        progress: Math.min(100, ((currentKm - (settings.lastTimingBeltKm || 0)) / (settings.timingBeltInterval || 50000)) * 100)
      });
    }
    
    return alerts;
  }, [settings, shifts]);

  const bestDaysData = useMemo(() => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const revenueByDay = new Array(7).fill(0);
    const countByDay = new Array(7).fill(0);
    const hoursByDay = new Array(7).fill(0);
    
    shifts.filter(s => s.status === 'finished').forEach(s => {
      const day = ensureDate(s.startTime).getDay();
      revenueByDay[day] += s.totalRevenue;
      countByDay[day] += 1;
      hoursByDay[day] += s.activeTimeSeconds / 3600;
    });
    
    return days.map((name, i) => ({
      name,
      revenue: revenueByDay[i],
      avgPerShift: countByDay[i] > 0 ? revenueByDay[i] / countByDay[i] : 0,
      avgPerHour: hoursByDay[i] > 0 ? revenueByDay[i] / hoursByDay[i] : 0
    }));
  }, [shifts]);

  const bestHoursData = useMemo(() => {
    const hours = new Array(24).fill(0).map(() => ({ revenue: 0, count: 0, seconds: 0 }));
    
    shifts.filter(s => s.status === 'finished').forEach(s => {
      const startHour = ensureDate(s.startTime).getHours();
      const endHour = s.endTime ? ensureDate(s.endTime).getHours() : startHour;
      const revenue = s.totalRevenue;
      const activeSeconds = s.activeTimeSeconds;
      
      // If shift is within the same day, distribute evenly
      if (s.endTime && ensureDate(s.startTime).getDate() === ensureDate(s.endTime).getDate()) {
         const durationHours = Math.max(1, endHour - startHour + 1);
         const revPerHour = revenue / durationHours;
         const secPerHour = activeSeconds / durationHours;
         for (let i = startHour; i <= endHour; i++) {
           hours[i].revenue += revPerHour;
           hours[i].seconds += secPerHour;
           hours[i].count += 1;
         }
      } else {
         // Fallback to just start hour
         hours[startHour].revenue += revenue;
         hours[startHour].seconds += activeSeconds;
         hours[startHour].count += 1;
      }
    });
    
    return hours.map((h, i) => ({
      hour: i,
      label: `${i}h`,
      avgPerHour: h.seconds > 0 ? h.revenue / (h.seconds / 3600) : 0,
      total: h.revenue
    }));
  }, [shifts]);

  const hourlyData = useMemo(() => {
    const targetDate = referenceDate;
    let filteredShifts = shifts.filter(s => s.status === 'finished');
    if (periodFilter === 'day') {
      filteredShifts = filteredShifts.filter(s => isSameDay(ensureDate(s.startTime), targetDate));
    } else if (periodFilter === 'week') {
      filteredShifts = filteredShifts.filter(s => isSameWeek(ensureDate(s.startTime), targetDate, { weekStartsOn: 1 }));
    } else if (periodFilter === 'month') {
      filteredShifts = filteredShifts.filter(s => isSameMonth(ensureDate(s.startTime), targetDate));
    }

    const stats: Record<number, { revenue: number, seconds: number }> = {};
    for (let h = 6; h <= 23; h++) {
       stats[h] = { revenue: 0, seconds: 0 };
    }

    filteredShifts.forEach(s => {
       const startHour = ensureDate(s.startTime).getHours();
       const endHour = s.endTime ? ensureDate(s.endTime).getHours() : startHour;
       const durationHours = Math.max(1, (endHour < startHour ? endHour + 24 : endHour) - startHour + 1);
       const revenuePerHour = s.totalRevenue / durationHours;
       const secondsPerHour = s.activeTimeSeconds / durationHours;

       for(let i = 0; i < durationHours; i++) {
          const h = (startHour + i) % 24;
          if (h >= 6 && h <= 23) {
             stats[h].revenue += revenuePerHour;
             stats[h].seconds += secondsPerHour;
          }
       }
    });

    const data = [];
    let best = { h: -1, val: -1 };
    let worst = { h: -1, val: 999999 };
    let sum = 0, count = 0;
    
    for (let h = 6; h <= 23; h++) {
       const avg = stats[h].seconds > 0 ? stats[h].revenue / (stats[h].seconds / 3600) : 0;
       
       if (avg > 0) {
         sum += avg;
         count++;
         if (avg > best.val) best = { h, val: avg };
         if (avg < worst.val) worst = { h, val: avg };
       }
       data.push({ hour: h, hrString: `${h}h`, val: avg });
    }
    const generalAvg = count > 0 ? sum / count : 0;

    const processedData = data.map(d => ({
       ...d,
       color: d.val === 0 ? '#e5e7eb' : (d.val > generalAvg * 1.05 ? '#22c55e' : (d.val >= generalAvg * 0.9 ? '#eab308' : '#ef4444'))
    }));

    let insightMsg = "Estude seus horários para encontrar o melhor padrão.";
    if (count > 0 && best.val > 0 && generalAvg > 0) {
      if (best.h >= 17 && best.h <= 21) insightMsg = `Você ganha ${Math.max(1, (best.val/generalAvg*100 - 100)).toFixed(0)}% a mais durante à noite (${best.h}h).`;
      else if (best.h >= 6 && best.h <= 10) insightMsg = `Sua manhã tem ótima performance! Pico de ganhos às ${best.h}h.`;
      else insightMsg = `Seu horário mais lucrativo é às ${best.h}h (R$ ${best.val.toFixed(0)}/h), acima da sua média.`;
    } else if (count === 0) {
      insightMsg = "Registre turnos para obter análise de horários.";
    }

    return {
       data: processedData,
       best: best.val > 0 ? best : null,
       worst: worst.val < 999999 ? worst : null,
       generalAvg,
       insightMsg
    };

  }, [shifts, periodFilter]);

  const consumptionTrendConfig = useMemo(() => {
    const targetDate = referenceDate;
    
    let startDate: Date;
    let endDate: Date;
    
    if (periodFilter === 'month') {
      startDate = startOfMonth(targetDate);
      endDate = endOfMonth(targetDate);
    } else if (periodFilter === 'week') {
      startDate = startOfWeek(targetDate, { weekStartsOn: 1 });
      endDate = endOfWeek(targetDate, { weekStartsOn: 1 });
    } else {
      startDate = startOfDay(targetDate);
      endDate = endOfDay(targetDate);
    }
    
    const recentShifts = shifts.filter(s => s.status === 'finished' && ensureDate(s.startTime) >= startDate && ensureDate(s.startTime) <= endDate);
    const byDate: Record<string, { km: number, l: number }> = {};
    const resultArr: { date: string, kmL: number, millis: number }[] = [];
    
    recentShifts.forEach(s => {
       const stDate = ensureDate(s.startTime);
       const dStr = format(stDate, 'dd/MM');
       const wKm = s.totalWorkKm || ((s.endKm || 0) - s.startKm) || 0;
       const cons = s.avgConsumption || settings?.avgConsumption || 12;
       const liters = wKm / cons;
       
       if (!byDate[dStr]) byDate[dStr] = { km: 0, l: 0 };
       byDate[dStr].km += wKm;
       byDate[dStr].l += liters;
    });

    let best = { date: '', val: -1 };
    let worst = { date: '', val: 999999 };
    
    let validDaysCount = 0;
    
    // Sort keys logically by Date
    Object.keys(byDate).forEach(dStr => {
      const [dz, mz] = dStr.split('/');
      // Assumption: current year logic for sorting close dates is enough
      const tmpDate = new Date();
      tmpDate.setMonth(parseInt(mz) - 1, parseInt(dz));
      const stat = byDate[dStr];
      if (stat.km > 1 && stat.l > 0) { 
        const kmL = stat.km / stat.l;
        resultArr.push({ date: dStr, kmL, millis: tmpDate.getTime() });
        validDaysCount++;
        if (kmL > best.val) best = { date: dStr, val: kmL };
        if (kmL < worst.val) worst = { date: dStr, val: kmL };
      }
    });

    const finalData = resultArr.sort((a,b) => a.millis - b.millis).map(d => ({ date: d.date, kmL: d.kmL }));

    const generalAvg = validDaysCount > 0 ? finalData.reduce((acc, curr) => acc + curr.kmL, 0) / validDaysCount : (settings?.avgConsumption || 12);
    const lastDayVal = validDaysCount > 0 ? finalData[finalData.length - 1].kmL : generalAvg;
    const diffToAvg = generalAvg > 0 ? ((lastDayVal - generalAvg) / generalAvg) * 100 : 0;
    
    let insightMsg = "Registre corridas para avaliar suas médias recentes.";
    if (validDaysCount > 1) {
      if (diffToAvg > 5) insightMsg = `⬆️ +${diffToAvg.toFixed(1)}% eficiência recente. Associado a corridas longas ou melhora do trânsito.`;
      else if (diffToAvg < -5) insightMsg = `⚠️ Redução de ${Math.abs(diffToAvg).toFixed(1)}% no consumo recente. Verifique trafêgo intenso.`;
      else insightMsg = `✔️ Eficiência estabilizada perto de ${generalAvg.toFixed(1)} km/L.`;
      
      if (best.date) {
        insightMsg += ` Melhor dia: ${best.date}.`;
      }
    }

    return {
       data: finalData,
       generalAvg,
       diffToAvg,
       bestDate: best.date,
       worstDate: worst.date,
       insightMsg
    };
  }, [shifts, periodFilter, settings]);

  const tripProfile = useMemo(() => {
    const profile = {
      short: { revenue: 0, trips: 0 },
      medium: { revenue: 0, trips: 0 },
      long: { revenue: 0, trips: 0 }
    };
    
    const finishedShifts = shifts.filter(s => s.status === 'finished');
    let totalTripsEver = 0;

    finishedShifts.forEach(s => {
      if (s.totalTrips > 0) {
        const avgDistance = (s.totalWorkKm || ((s.endKm || 0) - s.startKm)) / s.totalTrips;
        let bucket;
        if (avgDistance < 5) bucket = profile.short;
        else if (avgDistance < 12) bucket = profile.medium;
        else bucket = profile.long;

        bucket.revenue += s.totalRevenue;
        bucket.trips += s.totalTrips;
        totalTripsEver += s.totalTrips;
      }
    });

    return {
      shortPerc: totalTripsEver > 0 ? (profile.short.trips / totalTripsEver) * 100 : 0,
      shortAvgVal: profile.short.trips > 0 ? profile.short.revenue / profile.short.trips : 0,
      mediumPerc: totalTripsEver > 0 ? (profile.medium.trips / totalTripsEver) * 100 : 0,
      mediumAvgVal: profile.medium.trips > 0 ? profile.medium.revenue / profile.medium.trips : 0,
      longPerc: totalTripsEver > 0 ? (profile.long.trips / totalTripsEver) * 100 : 0,
      longAvgVal: profile.long.trips > 0 ? profile.long.revenue / profile.long.trips : 0
    };
  }, [shifts]);

  const topShifts = useMemo(() => {
    const now = new Date();
    const finished = shifts.filter(s => s.status === 'finished' && isSameMonth(ensureDate(s.startTime), now));
    return {
      revenue: [...finished].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 3),
      rph: [...finished].sort((a, b) => {
        const rphA = a.activeTimeSeconds > 0 ? a.totalRevenue / (a.activeTimeSeconds / 3600) : 0;
        const rphB = b.activeTimeSeconds > 0 ? b.totalRevenue / (b.activeTimeSeconds / 3600) : 0;
        return rphB - rphA;
      }).slice(0, 3),
      rpkm: [...finished].sort((a, b) => {
        const kmA = a.totalWorkKm || (a.endKm - a.startKm);
        const kmB = b.totalWorkKm || (b.endKm - b.startKm);
        const rpkA = kmA > 0 ? a.totalRevenue / kmA : 0;
        const rpkB = kmB > 0 ? b.totalRevenue / kmB : 0;
        return rpkB - rpkA;
      }).slice(0, 3)
    };
  }, [shifts]);

  const chartsData = useMemo(() => {
    const targetDate = referenceDate;
    let filteredShifts = shifts;
    
    if (periodFilter === 'day') {
      filteredShifts = filteredShifts.filter(s => isSameDay(ensureDate(s.startTime), targetDate));
      // For a single day, we might want to show revenue per hour
      const byHour: Record<string, number> = {};
      filteredShifts.forEach(s => {
         const shiftTripsList = shiftTrips[s.id] || [];
         shiftTripsList.forEach(t => {
            if (t.isCancelled) return;
            const h = ensureDate(t.startTime || t.timestamp).getHours();
            const hStr = `${h.toString().padStart(2, '0')}:00`;
            if (!byHour[hStr]) byHour[hStr] = 0;
            byHour[hStr] += t.value;
         });
      });
      // If no trips, distribute shift revenue among active hours
      if (Object.keys(byHour).length === 0) {
        filteredShifts.forEach(s => {
           const startH = ensureDate(s.startTime).getHours();
           const endH = s.endTime ? ensureDate(s.endTime).getHours() : startH;
           const durationH = Math.max(1, (s.activeTimeSeconds || 0) / 3600);
           const valPerH = s.totalRevenue / durationH;
           
           if (startH <= endH) {
             for (let h = startH; h <= endH; h++) {
               const hStr = `${h.toString().padStart(2, '0')}:00`;
               if (!byHour[hStr]) byHour[hStr] = 0;
               byHour[hStr] += valPerH;
             }
           } else {
             const hStr = `${startH.toString().padStart(2, '0')}:00`;
             if (!byHour[hStr]) byHour[hStr] = 0;
             byHour[hStr] += s.totalRevenue;
           }
        });
      }
      return {
        barData: Object.entries(byHour).map(([key, val]) => ({ name: key, value: val })).sort((a,b) => a.name.localeCompare(b.name)),
        pieData: [] // Calculated below using metrics
      };
    } else {
      if (periodFilter === 'week') {
        filteredShifts = filteredShifts.filter(s => isSameWeek(ensureDate(s.startTime), targetDate, { weekStartsOn: 1 }));
      } else if (periodFilter === 'month') {
        filteredShifts = filteredShifts.filter(s => isSameMonth(ensureDate(s.startTime), targetDate));
      }
      const byDay: Record<string, number> = {};
      filteredShifts.forEach(s => {
         const dStr = format(ensureDate(s.startTime), 'dd/MM');
         if (!byDay[dStr]) byDay[dStr] = 0;
         byDay[dStr] += s.totalRevenue;
      });
      
      const sortedDates = Object.keys(byDay).sort((a, b) => {
         const [da, ma] = a.split('/').map(Number);
         const [db, mb] = b.split('/').map(Number);
         if (ma !== mb) return ma - mb;
         return da - db;
      });
      
      return {
        barData: sortedDates.map(dStr => ({ name: dStr, value: byDay[dStr] })),
        pieData: []
      };
    }
  }, [shifts, shiftTrips, periodFilter, referenceDate]);

  const allTimeMetrics = useMemo(() => {
    const finished = shifts.filter(s => s.status === 'finished');
    if (finished.length === 0) return null;

    const totalRevenue = finished.reduce((acc, s) => acc + s.totalRevenue, 0);
    const totalKm = finished.reduce((acc, s) => acc + (s.totalWorkKm || ((s.endKm || 0) - s.startKm)), 0);
    const totalSeconds = finished.reduce((acc, s) => acc + s.activeTimeSeconds, 0);
    const totalTrips = finished.reduce((acc, s) => acc + s.totalTrips, 0);

    return {
      revenuePerHour: totalSeconds > 0 ? totalRevenue / (totalSeconds / 3600) : 0,
      revenuePerKm: totalKm > 0 ? totalRevenue / totalKm : 0,
      ticketMedio: totalTrips > 0 ? totalRevenue / totalTrips : 0,
      totalHours: totalSeconds / 3600,
      totalKm,
      totalTrips,
      totalRevenue
    };
  }, [shifts]);

  const metrics = useMemo(() => {
    const targetDate = referenceDate;
    let filteredShifts = shifts;
    let filteredExpenses = expenses;
    let filteredFuel = fuelRecords;

    if (periodFilter === 'day') {
      filteredShifts = filteredShifts.filter(s => isSameDay(ensureDate(s.startTime), targetDate));
      filteredExpenses = expenses.filter(e => isSameDay(ensureDate(e.date), targetDate));
      filteredFuel = fuelRecords.filter(f => isSameDay(ensureDate(f.date), targetDate));
    } else if (periodFilter === 'week') {
      filteredShifts = filteredShifts.filter(s => isSameWeek(ensureDate(s.startTime), targetDate, { weekStartsOn: 1 }));
      filteredExpenses = expenses.filter(e => isSameWeek(ensureDate(e.date), targetDate, { weekStartsOn: 1 }));
      filteredFuel = fuelRecords.filter(f => isSameWeek(ensureDate(f.date), targetDate, { weekStartsOn: 1 }));
    } else if (periodFilter === 'month') {
      filteredShifts = filteredShifts.filter(s => isSameMonth(ensureDate(s.startTime), targetDate));
      filteredExpenses = expenses.filter(e => isSameMonth(ensureDate(e.date), targetDate));
      filteredFuel = fuelRecords.filter(f => isSameMonth(ensureDate(f.date), targetDate));
    }

    if (filteredShifts.length === 0) return null;

    const totalRevenue = filteredShifts.reduce((acc, s) => acc + s.totalRevenue, 0);
    const totalKmWork = filteredShifts.reduce((acc, s) => acc + (s.totalWorkKm || ((s.endKm || 0) - s.startKm)), 0);
    const totalSeconds = filteredShifts.reduce((acc, s) => acc + s.activeTimeSeconds, 0);
    const totalTrips = filteredShifts.reduce((acc, s) => acc + s.totalTrips, 0);
    
    // Personal KM logic: Sum of totalPersonalKm within shifts, and calculate gaps for old shifts
    const allFinishedShifts = shifts.filter(s => s.status === 'finished').sort((a, b) => (ensureDate(a.startTime).getTime()) - (ensureDate(b.startTime).getTime()));
    let totalKmPersonal = 0;
    
    filteredShifts.forEach(filteredShift => {
      const index = allFinishedShifts.findIndex(s => s.id === filteredShift.id);
      let personalKmForThisShift = filteredShift.totalPersonalKm || 0;

      // If it doesn't have personalKm recorded (old shift), calculate it from the previous shift
      if (!filteredShift.totalPersonalKm && index > 0) {
        const prevShift = allFinishedShifts[index - 1];
        const prevKm = prevShift.endKm || prevShift.lastKm || prevShift.startKm;
        const gap = filteredShift.startKm - prevKm;
        if (gap > 0) {
          personalKmForThisShift = gap;
        }
      }
      totalKmPersonal += personalKmForThisShift;
    });

    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.value, 0);
    const totalFuelValue = filteredFuel.reduce((acc, f) => acc + f.totalValue, 0);
    const totalLiters = filteredFuel.reduce((acc, f) => acc + f.liters, 0);

    // Estimated costs based on user settings
    const currentAvgCons = settings?.avgConsumption || 12.0;
    const currentFuelPrice = settings?.defaultFuelPrice || 5.50;
    const currentMaintPercentage = settings?.maintenancePercentage ?? 10;

    const estimatedFuelCost = totalKmWork > 0 ? (totalKmWork / currentAvgCons) * currentFuelPrice : 0;
    const maintenanceCost = totalRevenue * (currentMaintPercentage / 100);
    
    const personalFuelCost = totalKmPersonal > 0 ? (totalKmPersonal / currentAvgCons) * currentFuelPrice : 0;
    const personalFuelLiters = totalKmPersonal > 0 ? (totalKmPersonal / currentAvgCons) : 0;

    // Gather trips for all filtered shifts to calculate advanced metrics
    let totalDynamicValue = 0;
    let totalCancelledTrips = 0;
    let totalCancelledValue = 0;
    let allTripsInPeriod: Trip[] = [];
    const shiftsMissingTrips: string[] = [];

    filteredShifts.forEach(shift => {
      const trips = shiftTrips[shift.id] || [];
      if (trips.length === 0 && shift.totalRevenue > 0) {
        const dayStr = format(ensureDate(shift.startTime), 'dd/MM');
        if (!shiftsMissingTrips.includes(dayStr)) {
          shiftsMissingTrips.push(dayStr);
        }
      }
      
      allTripsInPeriod = allTripsInPeriod.concat(trips);
      trips.forEach(t => {
        if (t.dynamicValue) totalDynamicValue += t.dynamicValue;
        if (t.isCancelled) {
          totalCancelledTrips += 1;
          totalCancelledValue += t.value;
        }
      });
    });

    // Phase 2: Top Trips Ranking & Time Mapping
    const validTrips = allTripsInPeriod.filter(t => !t.isCancelled && t.durationSeconds > 0 && t.value > 0);
    const tripsWithRph = validTrips.map(t => ({
      ...t,
      rph: t.value / (t.durationSeconds / 3600)
    }));
    
    // Hall of Fame & Shame
    const sortedByRph = [...tripsWithRph].sort((a, b) => b.rph - a.rph);
    const top3BestTrips = sortedByRph.slice(0, 3);
    const top3WorstTrips = sortedByRph.length >= 3 ? sortedByRph.slice(-3).reverse() : [];

    // Hour Heatmap Analysis
    const hourStats: Record<number, { count: number, totalVal: number, totalSecs: number }> = {};
    validTrips.forEach(t => {
      if (t.startTime || t.timestamp) {
        const hour = ensureDate(t.startTime || t.timestamp).getHours();
        if (!hourStats[hour]) hourStats[hour] = { count: 0, totalVal: 0, totalSecs: 0 };
        hourStats[hour].count += 1;
        hourStats[hour].totalVal += t.value;
        hourStats[hour].totalSecs += t.durationSeconds;
      }
    });

    let bestHourInfo = { hour: -1, rph: 0 };
    Object.keys(hourStats).forEach(hStr => {
      const h = parseInt(hStr);
      const stat = hourStats[h];
      const rph = stat.totalSecs > 0 ? stat.totalVal / (stat.totalSecs / 3600) : 0;
      if (rph > bestHourInfo.rph && stat.count >= 2) { 
        bestHourInfo = { hour: h, rph };
      }
    });

    // Best Day Analysis
    const dayStats: Record<number, { count: number, totalVal: number, totalSecs: number }> = {};
    validTrips.forEach(t => {
      if (t.startTime || t.timestamp) {
        const day = ensureDate(t.startTime || t.timestamp).getDay(); 
        if (!dayStats[day]) dayStats[day] = { count: 0, totalVal: 0, totalSecs: 0 };
        dayStats[day].count += 1;
        dayStats[day].totalVal += t.value;
        dayStats[day].totalSecs += t.durationSeconds;
      }
    });

    let bestDayInfo = { day: -1, rph: 0 };
    Object.keys(dayStats).forEach(dStr => {
      const d = parseInt(dStr);
      const stat = dayStats[d];
      const rph = stat.totalSecs > 0 ? stat.totalVal / (stat.totalSecs / 3600) : 0;
      if (rph > bestDayInfo.rph && stat.count >= 2) {
        bestDayInfo = { day: d, rph };
      }
    });

    const netProfit = totalRevenue - estimatedFuelCost - maintenanceCost - personalFuelCost;
    
    // Build Pie Data
    const pieData = [
      { name: "Lucro Líquido", value: Math.max(0, netProfit), color: "#16A34A" }, // green-600
      { name: "Combustível Trabalhado", value: estimatedFuelCost, color: "#3B82F6" }, // blue-500
      { name: "Manutenção e Degradação", value: maintenanceCost, color: "#F59E0B" }, // amber-500
      { name: "Combustível Pessoal", value: personalFuelCost, color: "#EF4444" }, // red-500
    ].filter(i => i.value > 0);

    return {
      top3BestTrips,
      top3WorstTrips,
      bestHourInfo,
      bestDayInfo,
      revenuePerKm: totalKmWork > 0 ? totalRevenue / totalKmWork : 0,
      revenuePerHour: totalSeconds > 0 ? totalRevenue / (totalSeconds / 3600) : 0,
      ticketMedio: totalTrips > 0 ? totalRevenue / totalTrips : 0,
      netProfit: totalRevenue - totalExpenses - totalFuelValue,
      estimatedProfit: totalRevenue - estimatedFuelCost - maintenanceCost,
      totalRevenue,
      totalTrips,
      totalExpenses: totalExpenses + totalFuelValue,
      totalKmWork,
      totalKmPersonal,
      totalHours: totalSeconds / 3600,
      avgConsumption: totalKmWork > 0 && totalLiters > 0 ? totalKmWork / totalLiters : 0,
      estimatedFuelCost,
      maintenanceCost,
      personalFuelCost,
      personalFuelLiters,
      totalFuelValue,
      totalLiters,
      totalCosts: estimatedFuelCost + maintenanceCost,
      maintenancePercentage: currentMaintPercentage,
      dailyGoalProgress: settings ? (totalRevenue / settings.dailyRevenueGoal) * 100 : 0,
      totalDynamicValue,
      totalCancelledTrips,
      totalCancelledValue,
      allTripsInPeriod,
      shiftsMissingTrips,
      pieData
    };
  }, [shifts, expenses, fuelRecords, periodFilter, settings, shiftTrips, referenceDate]);

  const activeShiftMetrics = useMemo(() => {
    if (!activeShift) return null;
    const now = new Date();
    
    let lastStarted: Date;
    if (activeShift.lastStartedAt === null) lastStarted = now;
    else if (activeShift.lastStartedAt) lastStarted = ensureDate(activeShift.lastStartedAt);
    else lastStarted = ensureDate(activeShift.startTime);

    let lastStateChanged: Date;
    if (activeShift.stateLastChangedAt === null) lastStateChanged = now;
    else if (activeShift.stateLastChangedAt) lastStateChanged = ensureDate(activeShift.stateLastChangedAt);
    else lastStateChanged = lastStarted;
    
    const diffStateTime = activeShift.status === 'active' ? Math.max(0, differenceInSeconds(now, lastStateChanged)) : 0;
    const prevState = activeShift.currentState || 'dispatch';

    let idleTime = (activeShift.idleTimeSeconds || 0) + (prevState === 'idle' ? diffStateTime : 0);
    let dispatchTime = (activeShift.dispatchTimeSeconds || 0) + (prevState === 'dispatch' ? diffStateTime : 0);
    let rideTime = (activeShift.rideTimeSeconds || 0) + (prevState === 'ride' ? diffStateTime : 0);
    let totalStateTime = idleTime + dispatchTime + rideTime;

    const currentActiveTime = activeShift.activeTimeSeconds + (activeShift.status === 'active' ? Math.max(0, differenceInSeconds(now, lastStarted)) : 0);
    
    // Normalize to fix any past corrupted data
    if (totalStateTime > 0 && currentActiveTime > 0 && Math.abs(totalStateTime - currentActiveTime) > 5) {
      const scale = currentActiveTime / totalStateTime;
      idleTime *= scale;
      dispatchTime *= scale;
      rideTime *= scale;
      totalStateTime = currentActiveTime;
    }

    const efficiency = totalStateTime > 0 ? (rideTime / totalStateTime) * 100 : 0;
    const rphProdutivo = rideTime > 0 ? activeShift.totalRevenue / (rideTime / 3600) : 0;

    return { idleTime, dispatchTime, rideTime, totalStateTime, efficiency, rphProdutivo };
  }, [activeShift, elapsedTime]);

  const todayMetrics = useMemo(() => {
    const now = new Date();
    const todayShifts = shifts.filter(s => {
      const shiftDate = ensureDate(s.startTime);
      return isSameDay(shiftDate, now);
    });
    
    // Ensure activeShift is included and has latest data
    const otherTodayShifts = todayShifts.filter(s => s.id !== activeShift?.id);
    const allTodayShifts = activeShift && isSameDay(ensureDate(activeShift.startTime), now) 
      ? [...otherTodayShifts, activeShift] 
      : todayShifts;

    const totalRevenue = allTodayShifts.reduce((acc, s) => acc + (Number(s.totalRevenue) || 0), 0);
    const totalTime = allTodayShifts.filter(s => s.id !== activeShift?.id).reduce((acc, s) => acc + (Number(s.activeTimeSeconds) || 0), 0) + (activeShift ? elapsedTime : 0);
    const totalTrips = allTodayShifts.reduce((acc, s) => acc + (Number(s.totalTrips) || 0), 0);
    
    const sortedTodayShifts = [...allTodayShifts].sort((a, b) => (ensureDate(a.startTime).getTime()) - (ensureDate(b.startTime).getTime()));
    const startKm = sortedTodayShifts.length > 0 ? sortedTodayShifts[0].startKm : 0;

    const maxKm = allTodayShifts.length > 0 
      ? Math.max(...allTodayShifts.map(s => s.lastKm || s.endKm || s.startKm || 0)) 
      : 0;

    const totalWorkKm = allTodayShifts.reduce((acc, s) => acc + (Number(s.totalWorkKm) || 0), 0);
    const totalPersonalKm = allTodayShifts.reduce((acc, s) => acc + (Number(s.totalPersonalKm) || 0), 0);
    const totalKmDrivenToday = totalWorkKm + totalPersonalKm;
    const avgTripValue = totalTrips > 0 ? totalRevenue / totalTrips : 0;
    const currentRph = totalTime > 0 ? (totalRevenue / (totalTime / 3600)) : 0;
    const currentRpkm = totalWorkKm > 0 ? (totalRevenue / totalWorkKm) : 0;

    return { 
      totalRevenue, 
      totalTime, 
      totalTrips, 
      avgTripValue,
      currentRph,
      currentRpkm,
      startKm, 
      maxKm,
      totalWorkKm,
      totalPersonalKm,
      totalKmDrivenToday,
      shiftCount: allTodayShifts.length 
    };
  }, [shifts, activeShift, elapsedTime]);

  const costsMetrics = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    
    const last30DaysShifts = shifts.filter(s => s.status === 'finished' && ensureDate(s.startTime) >= thirtyDaysAgo);
    const last30DaysExpenses = expenses.filter(e => ensureDate(e.date) >= thirtyDaysAgo);
    const last30DaysFuel = fuelRecords.filter(f => ensureDate(f.date) >= thirtyDaysAgo);
    
    const totalRevenue30Days = last30DaysShifts.reduce((acc, s) => acc + s.totalRevenue, 0);
    const maintenancePercentage = settings?.maintenancePercentage ?? 10;
    const maintenanceReserve = totalRevenue30Days * (maintenancePercentage / 100);
    
    const spentOnTires = last30DaysExpenses.filter(e => e.category === 'Pneus').reduce((acc, e) => acc + e.value, 0);
    const spentOnOil = last30DaysExpenses.filter(e => e.category === 'Óleo').reduce((acc, e) => acc + e.value, 0);
    const spentOnMaintenance = last30DaysExpenses.filter(e => e.category === 'Manutenção').reduce((acc, e) => acc + e.value, 0);
    
    const totalSpentOnCar = spentOnTires + spentOnOil + spentOnMaintenance;
    const reserveBalance = maintenanceReserve - totalSpentOnCar;

    const totalFuelValue30Days = last30DaysFuel.reduce((acc, f) => acc + f.totalValue, 0);
    const totalLiters30Days = last30DaysFuel.reduce((acc, f) => acc + f.liters, 0);
    const totalExpenses30Days = last30DaysExpenses.reduce((acc, e) => acc + e.value, 0);

    return {
      totalRevenue30Days,
      maintenanceReserve,
      spentOnTires,
      spentOnOil,
      spentOnMaintenance,
      totalSpentOnCar,
      reserveBalance,
      maintenancePercentage,
      totalFuelValue30Days,
      totalLiters30Days,
      totalExpenses30Days
    };
  }, [shifts, expenses, fuelRecords, settings]);

  const planningMetrics = useMemo(() => {
    if (!settings) return null;
    const now = new Date();
    const startOfM = startOfMonth(now);
    const endOfM = endOfMonth(now);

    const thisMonthShifts = shifts.filter(s => {
      const d = ensureDate(s.startTime);
      return isWithinInterval(d, { start: startOfM, end: endOfM });
    });

    const revenueSoFar = thisMonthShifts.reduce((acc, s) => acc + s.totalRevenue, 0) + (activeShift?.totalRevenue || 0);

    const totalFixed = fixedExpenses.reduce((acc, fe) => acc + (fe.active ? fe.amount : 0), 0);
    
    // Calculate extra expenses for this month to discount from net correctly
    const thisMonthExpenses = expenses.filter(e => isWithinInterval(ensureDate(e.date), { start: startOfM, end: endOfM }));
    const totalExtraExpenses = thisMonthExpenses.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
    
    const monthlyNetGoal = settings.monthlyNetGoal || 2000;
    const workDays = settings.workDays || [1, 2, 3, 4, 5, 6]; // default mon-sat
    
    // Logic for remaining workdays based on selected days in array
    let daysRemaining = 0;
    for (let d = new Date(startOfDay(now)); d <= endOfM; d.setDate(d.getDate() + 1)) {
       if (workDays.includes(d.getDay())) daysRemaining++;
    }
    // Prevent division by zero
    daysRemaining = Math.max(1, daysRemaining);
    
    // Performance Projections (Last 30 days)
    const thirtyDaysAgo = subDays(now, 30);
    const last30Shifts = shifts.filter(s => s.status === 'finished' && ensureDate(s.startTime) >= thirtyDaysAgo);
    
    const totalRev30 = last30Shifts.reduce((acc, s) => acc + s.totalRevenue, 0);
    const totalHrs30 = last30Shifts.reduce((acc, s) => acc + (s.activeTimeSeconds / 3600), 0);
    const totalKm30 = last30Shifts.reduce((acc, s) => acc + (s.totalWorkKm || (s.endKm ? s.endKm - s.startKm : 0) || 0), 0);

    const avgRph = totalHrs30 > 0 ? totalRev30 / totalHrs30 : 40; 
    const avgRpkm = totalKm30 > 0 ? totalRev30 / totalKm30 : 2.5;

    // Fuel Estimation Algorithm requested by user
    const fuelPrice = settings.defaultFuelPrice || 5.50;
    const avgCons = (settings.avgConsumption > 0) ? settings.avgConsumption : 12; // km/L
    const fuelCostPerKm = fuelPrice / avgCons;
    const estimatedFuelRatio = avgRpkm > 0 ? (fuelCostPerKm / avgRpkm) : 0.25;
    const safeFuelRatio = Math.min(0.5, Math.max(0.05, estimatedFuelRatio)); // keeps it between 5% and 50%
    
    // Margin calculation
    const marginRatio = 1 - safeFuelRatio;
    
    // Total Revenue Goal = (Net Profit Goal + Fixed Costs + Extra Expenses) / Margin Ratio
    // Because Revenue - FuelCost_for_that_revenue - Fixed - Extra = Net Profit
    // R - R*ratio - Fixed - Extra = Net Profit
    const revenueNeededTotal = (monthlyNetGoal + totalFixed + totalExtraExpenses) / marginRatio;
    
    // Total estimated fuel cost to achieve this total revenue goal
    const totalEstimatedFuelForGoal = revenueNeededTotal * safeFuelRatio;

    // How much revenue is left to make
    const revenueRemaining = Math.max(0, revenueNeededTotal - revenueSoFar);
    
    const dailyNeeded = revenueRemaining / daysRemaining;

    // Projections for remaining effort
    const totalHoursRemaining = revenueRemaining / avgRph;
    const totalKmRemaining = revenueRemaining / avgRpkm;
    
    const litersRemaining = avgCons > 0 ? totalKmRemaining / avgCons : 0;
    const estimatedFuelCostRemaining = litersRemaining * fuelPrice;

    const progressPerc = Math.min(100, (revenueSoFar / revenueNeededTotal) * 100);

    return {
      totalFixed,
      totalExtraExpenses,
      monthlyNetGoal,
      revenueNeededTotal,
      totalEstimatedFuelForGoal,
      revenueSoFar,
      revenueRemaining,
      dailyNeeded,
      progressPerc,
      daysRemaining,
      avgRph,
      avgRpkm,
      avgConsumption: avgCons,
      safeFuelRatio,
      workDays,
      totalHoursRemaining,
      totalKmRemaining,
      litersRemaining,
      estimatedFuelCostRemaining,
      fuelPrice
    };
  }, [fixedExpenses, settings, fuelRecords, shifts, activeShift, expenses]);

  const goalsProjection = useMemo(() => {
    if (!settings) return null;
    const now = new Date();
    const daysRemainingInWeek = 7 - (now.getDay() === 0 ? 7 : now.getDay()); // Assuming week ends on Sun
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    const weeklyShifts = shifts.filter(s => {
      const d = ensureDate(s.startTime);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    });
    
    const weeklyRevenue = weeklyShifts.reduce((acc, s) => acc + s.totalRevenue, 0) + (activeShift?.totalRevenue || 0);
    
    // Logic: If planning metrics are available, use the dailyNeeded * 7 as the goal for a "standard" week
    // To keep it balanced with monthly goal defined in "Meu Caixa"
    const weeklyGoal = planningMetrics 
      ? planningMetrics.dailyNeeded * 7 
      : (settings.dailyRevenueGoal * 6);

    const remaining = Math.max(0, weeklyGoal - weeklyRevenue);
    const workdaySlotsRemaining = Math.max(1, daysRemainingInWeek);
    const requiredDaily = remaining / workdaySlotsRemaining;
    
    return {
      weeklyRevenue,
      weeklyGoal,
      remaining,
      requiredDaily,
      daysRemaining: workdaySlotsRemaining
    };
  }, [shifts, activeShift, settings, planningMetrics]);

  const chartData = useMemo(() => {
    const finishedShifts = shifts
      .filter(s => s.status === 'finished')
      .slice(0, 7)
      .reverse();

    return finishedShifts.map(s => {
      const dayExpenses = expenses
        .filter(e => format(ensureDate(e.date), 'dd/MM') === format(ensureDate(s.startTime), 'dd/MM'))
        .reduce((acc, e) => acc + e.value, 0);
      
      const dayFuel = fuelRecords
        .filter(f => format(ensureDate(f.date), 'dd/MM') === format(ensureDate(s.startTime), 'dd/MM'))
        .reduce((acc, f) => acc + f.totalValue, 0);

      return {
        date: format(ensureDate(s.startTime), 'dd/MM'),
        revenue: s.totalRevenue,
        profit: s.totalRevenue - dayExpenses - dayFuel
      };
    });
  }, [shifts, expenses, fuelRecords]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-6 text-center transition-colors relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-green-500/10 dark:bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-green-500/10 dark:bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full relative z-10"
        >
          <div className="bg-gradient-to-br from-green-500 to-green-700 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-green-500/30 dark:shadow-green-900/40 rotate-3 hover:rotate-0 transition-transform duration-500">
            <Car className="text-white" size={48} strokeWidth={1.5} />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
            Driver<span className="text-green-600 dark:text-green-500">Ops</span>
          </h1>
          
          <p className="text-gray-500 dark:text-gray-400 mb-10 text-lg leading-relaxed max-w-sm mx-auto">
            Gestão inteligente de turnos, custos e manutenção para motoristas profissionais.
          </p>

          <div className="space-y-4 mb-8 text-left bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                <TrendingUp size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium dark:text-gray-300">Acompanhe seus lucros reais</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                <Timer size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium dark:text-gray-300">Controle o tempo de trabalho</p>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-left">
            <Input 
              label="E-mail" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="seu@email.com"
              required 
            />
            <Input 
              label="Senha" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
            {authError && <p className="text-red-500 text-sm font-medium text-center">{authError}</p>}
            
            <Button type="submit" className="w-full py-4 text-lg font-bold shadow-xl shadow-green-200 dark:shadow-green-900/20 rounded-2xl">
              {isLoginMode ? 'Entrar' : 'Criar Conta'}
            </Button>
          </form>

          <button 
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setAuthError('');
            }} 
            className="text-sm text-green-600 dark:text-green-400 font-medium mb-6 hover:underline"
          >
            {isLoginMode ? 'Não tem uma conta? Crie agora' : 'Já tem uma conta? Entre aqui'}
          </button>

          <div className="relative flex items-center py-2 mb-6">
            <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-gray-500 text-sm">ou</span>
            <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
          </div>

          <Button 
            onClick={handleLogin} 
            variant="outline"
            className="w-full py-4 text-base font-bold rounded-2xl flex items-center justify-center gap-3 bg-white dark:bg-gray-900"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </Button>
          
          <p className="mt-8 text-xs text-gray-400 dark:text-gray-600">
            Seus dados são salvos com segurança na nuvem.
          </p>

        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-32 font-sans text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-[#111827] border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 pb-3 pt-safe sticky top-0 z-30 flex items-center justify-between transition-colors relative">
        <div className="flex items-center gap-2 sm:gap-3 z-10">
          <div className="bg-green-600 p-1.5 sm:p-2 rounded-xl">
            <Car className="text-white" size={20} />
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center w-[60%] pointer-events-none z-0">
          <span className="font-black text-2xl sm:text-3xl tracking-tighter text-gray-900 dark:text-white uppercase leading-none">
            Driver<span className="text-green-500">Lucrativo</span>
          </span>
          <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-bold tracking-widest mt-1 uppercase">
            {format(currentTime, 'dd/MM/yyyy HH:mm:ss')}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 z-10">
          <button 
            onClick={() => setDarkMode(!darkMode)} 
            className="p-1.5 sm:p-2 text-gray-400 hover:text-green-500 transition-colors"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={handleLogout} className="p-1.5 sm:p-2 text-gray-400 hover:text-red-500 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="p-6 pb-28 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'operation' && (
            <motion.div 
              key="operation"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="space-y-5">
                {!activeShift ? (
                  <div className="grid grid-cols-1 gap-3">
                    <Button onClick={() => setShowStartModal(true)} className="py-7 text-xl font-black tracking-wide uppercase bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] border-none rounded-2xl" icon={Play}>
                      Iniciar Turno
                    </Button>
                    <Button onClick={() => setShowPastShiftModal(true)} variant="outline" className="py-5 font-bold uppercase tracking-wider text-xs border-[#1F2937] text-gray-400 hover:text-white hover:bg-white/5 rounded-2xl" icon={Calendar}>
                      Registrar Turno Passado
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {activeShift.status === 'active' ? (
                      <Button onClick={() => setShowPauseModal(true)} variant="secondary" className="py-5 font-bold uppercase tracking-wider text-xs bg-[#1F2937] hover:bg-gray-700 text-white border-none rounded-2xl" icon={Pause}>
                        Pausar
                      </Button>
                    ) : (
                      <Button onClick={() => setShowResumeModal(true)} className="py-5 font-bold uppercase tracking-wider text-xs bg-green-600 hover:bg-green-500 text-white border-none rounded-2xl" icon={Play}>
                        Retomar
                      </Button>
                    )}
                    <Button onClick={() => setShowFinishModal(true)} variant="danger" className="py-5 font-bold uppercase tracking-wider text-xs bg-red-600 hover:bg-red-500 text-white border-none shadow-[0_0_15px_rgba(239,68,68,0.3)] rounded-2xl" icon={Square}>
                      Finalizar
                    </Button>
                  </div>
                )}
              </div>

              <div className={cn(
                "relative overflow-hidden rounded-3xl transition-all duration-500 border p-6",
                activeShift?.status === 'active' 
                  ? "bg-gradient-to-b from-[#0B0F14] to-[#111827] border-green-500/20 shadow-[0_0_40px_rgba(37,99,235,0.05)]" 
                  : "bg-white dark:bg-[#0B0F14] border-gray-200 dark:border-[#1F2937]"
              )}>
                {activeShift?.status === 'active' && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full" />
                )}
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {activeShift?.status === 'active' && (
                        <span className="flex w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                      )}
                      <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-500">
                        Status da Operação
                      </h2>
                    </div>
                    <p className={cn("text-2xl font-black mt-1", activeShift?.status === 'active' ? "text-white" : "text-gray-900 dark:text-gray-400")}>
                      {activeShift ? (activeShift.status === 'active' ? 'Em Andamento' : 'Pausado') : 'Offline'}
                    </p>
                  </div>
                  <div className={cn("p-3.5 rounded-2xl shadow-sm border", activeShift?.status === 'active' ? "bg-white/5 border-white/10 backdrop-blur-md text-green-400" : "bg-gray-100 dark:bg-[#1F2937] border-transparent text-gray-400")}>
                    <Timer size={24} />
                  </div>
                </div>

                <div className="text-center py-5 relative z-10">
                  <div className={cn(
                    "text-5xl sm:text-6xl leading-none font-mono font-black tracking-tighter mb-2",
                    activeShift?.status === 'active' ? "text-white drop-shadow-md" : "text-gray-900 dark:text-gray-300"
                  )}>
                    {formatTime(elapsedTime)}
                  </div>
                  <p className="text-xs uppercase tracking-widest font-bold text-gray-400">Tempo Ativo de Direção</p>
                </div>

                {activeShift?.status === 'active' && (
                  <div className="mt-8 relative z-10">
                    <Button 
                      onClick={() => setShowQuickTripModal(true)} 
                      variant="outline"
                      className="w-full py-7 text-lg font-black tracking-wide uppercase border border-green-500/30 transition-all duration-300 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white rounded-2xl shadow-[0_0_20px_rgba(34,197,94,0.15)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]" 
                      icon={Plus}
                    >
                      Nova Corrida
                    </Button>
                  </div>
                )}

                {activeShift?.status === 'active' && (
                  <>
                    <div className="grid grid-cols-2 gap-3 mt-6 relative z-10 pt-6 border-t border-white/10">
                      <Button 
                        onClick={() => setShowPartialRevenueModal(true)} 
                        variant="outline" 
                        className={cn(
                          "w-full py-5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-500",
                          elapsedTime >= 3600 && (elapsedTime % 3600) < 300 
                            ? "animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)] border-red-500/50 bg-red-500/10 text-red-400" 
                            : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                        )}
                        icon={Wallet}
                      >
                        Caixa Parcial
                      </Button>
                      <Button 
                        onClick={() => generateRealtimeAiAnalysis()} 
                        variant="outline" 
                        className="w-full py-5 text-xs font-bold uppercase tracking-wider rounded-xl border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white shadow-[0_0_15px_rgba(37,99,235,0.1)] transition-all"
                        icon={Sparkles}
                        disabled={isGeneratingRealtimeAi}
                      >
                        {isGeneratingRealtimeAi ? "Analisando..." : "Copiloto IA"}
                      </Button>
                    </div>
                    
                    {realtimeAiReport && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, height: 0 }} 
                        animate={{ opacity: 1, y: 0, height: 'auto' }} 
                        className={cn(
                          "mt-4 p-4 rounded-2xl border flex flex-col gap-3 relative z-10",
                          realtimeAiReport.tier === 'otimo' ? 'bg-blue-500/10 border-blue-500/20' :
                          realtimeAiReport.tier === 'bom' ? 'bg-green-500/10 border-green-500/20' :
                          realtimeAiReport.tier === 'mediano' ? 'bg-orange-500/10 border-orange-500/20' :
                          'bg-red-500/10 border-red-500/20'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <Sparkles size={16} className={cn(
                                 realtimeAiReport.tier === 'otimo' ? 'text-blue-400' :
                                 realtimeAiReport.tier === 'bom' ? 'text-green-400' :
                                 realtimeAiReport.tier === 'mediano' ? 'text-orange-400' :
                                 'text-red-400'
                             )} />
                             <span className={cn(
                               "text-[10px] uppercase font-black tracking-widest",
                                 realtimeAiReport.tier === 'otimo' ? 'text-blue-400' :
                                 realtimeAiReport.tier === 'bom' ? 'text-green-400' :
                                 realtimeAiReport.tier === 'mediano' ? 'text-orange-400' :
                                 'text-red-400'
                             )}>Análise em Tempo Real</span>
                          </div>
                          <button onClick={() => setRealtimeAiReport(null)} className="text-gray-400 hover:text-white">
                             <X size={14} />
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-xs text-white leading-relaxed">
                            <span className="font-bold opacity-70 uppercase text-[10px] mr-1">🎯 Diag:</span> 
                            {realtimeAiReport.diag}
                          </p>
                          <p className="text-xs text-white leading-relaxed">
                            <span className="font-bold opacity-70 uppercase text-[10px] mr-1">🚀 Filtro:</span> 
                            {realtimeAiReport.filter}
                          </p>
                          <p className="text-xs text-white leading-relaxed">
                            <span className="font-bold opacity-70 uppercase text-[10px] mr-1">🚦 Plano:</span> 
                            <span className="font-black">{realtimeAiReport.plan}</span>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </>
                )}
              </div>

              {settings && planningMetrics && (
                <div className="bg-gradient-to-br from-indigo-900 via-[#0B0F14] to-black rounded-3xl p-6 border border-indigo-500/20 shadow-xl overflow-hidden relative">
                  {/* Decorative faint glow */}
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-[60px] rounded-full pointer-events-none" />
                  
                  <h3 className="text-[11px] font-black text-indigo-300/80 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Target size={12} className="text-indigo-400" /> Meta Diária Agressiva
                  </h3>
                  
                  <div className="space-y-6 relative z-10">
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <p className={cn("text-5xl font-black leading-none tracking-tighter", (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) >= 1 ? "text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]" : "text-white")}>
                          {Math.min(100, (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) * 100).toFixed(0)}<span className="text-2xl text-indigo-300 ml-1 opacity-60">%</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-indigo-300/80 uppercase tracking-widest mb-1.5">Progresso Real</p>
                        <p className="font-bold text-sm text-white bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                          <span className="text-green-400">R$ {todayMetrics.totalRevenue.toFixed(2)}</span> <span className="text-indigo-400 opacity-60 mx-1">/</span> <span className="text-indigo-200">R$ {planningMetrics.dailyNeeded.toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="relative pt-2 pb-1">
                       <div className="h-6 rounded-full bg-black/60 w-full overflow-hidden relative border border-indigo-500/20 backdrop-blur-sm">
                         {/* Track Grid */}
                         <div className="absolute inset-0 w-full flex pointer-events-none">
                            {[25, 50, 75].map(mark => (
                              <div key={mark} className="flex-1 border-r border-indigo-400/20 z-20 last:border-0" />
                            ))}
                         </div>
                         
                         {/* Progress Fill */}
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${Math.min(100, (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) * 100)}%` }}
                           transition={{ duration: 1.5, type: "spring", stiffness: 40 }}
                           className={cn(
                             "h-full absolute left-0 top-0 bottom-0 z-10 transition-colors duration-500 rounded-full", 
                             (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) >= 1 
                               ? "bg-gradient-to-r from-green-500 to-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]" 
                               : "bg-gradient-to-r from-indigo-500 to-indigo-400"
                           )}
                         >
                            <div className="absolute inset-0 bg-white/30" style={{ transform: 'skewX(-20deg)', width: '200%', animation: 'slide-right 2s linear infinite' }} />
                         </motion.div>
                       </div>
                    </div>
                    
                    <div className="bg-indigo-950/40 p-4 rounded-2xl border border-indigo-500/20 backdrop-blur-md">
                      <p className="text-[11px] text-indigo-200 font-medium leading-relaxed uppercase tracking-wide">
                        <span className="text-green-400 font-black">Faltam R$ {Math.max(0, planningMetrics.dailyNeeded - todayMetrics.totalRevenue).toFixed(2)}</span> para o green. 
                        {todayMetrics.totalTime > 0 && todayMetrics.totalRevenue > 0 ? (
                           <> No ritmo atual de <span className="text-white font-bold bg-indigo-500/30 px-1.5 py-0.5 rounded text-[10px]">R$ {(todayMetrics.totalRevenue / (todayMetrics.totalTime / 3600)).toFixed(2)}/h</span>, meta atingida em <span className="font-black text-white">{formatTimeHuman(Math.max(0, planningMetrics.dailyNeeded - todayMetrics.totalRevenue) / ((todayMetrics.totalRevenue / (todayMetrics.totalTime / 3600)) / 3600))}</span>.</>
                        ) : ' Inicie o trajeto para prever ETA de lucro.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Resumo do Dia */}
              <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800" />
                
                <div className="p-6 pb-4">
                   <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Desempenho Real (Dia)</h3>
                   <div className="grid grid-cols-2 gap-4">
                     <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><DollarSign size={12} className="text-gray-400" /> Ganhos</p>
                        <p className="text-2xl font-black text-green-600 dark:text-green-500">R$ {todayMetrics.totalRevenue.toFixed(2)}</p>
                     </div>
                     <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Clock size={12} className="text-gray-400" /> Tempo</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{formatTime(todayMetrics.totalTime)}</p>
                     </div>
                     
                     <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                        <div className="flex gap-2 items-center mb-2">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Activity size={12} className="text-gray-400" /> R$ / Hora</p>
                        </div>
                        <p className={cn("text-xl font-black mb-1.5", todayMetrics.currentRph > 0 ? getRphTier(todayMetrics.currentRph).color : "text-gray-900 dark:text-white")}>
                          R$ {todayMetrics.currentRph.toFixed(2)}
                        </p>
                        {todayMetrics.currentRph > 0 && <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase inline-block", getRphTier(todayMetrics.currentRph).bg, getRphTier(todayMetrics.currentRph).color)}>{getRphTier(todayMetrics.currentRph).label}</span>}
                     </div>
                     
                     <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                        <div className="flex gap-2 items-center mb-2">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={12} className="text-gray-400" /> R$ / KM</p>
                        </div>
                        <p className={cn("text-xl font-black mb-1.5", todayMetrics.currentRpkm > 0 ? getRpkmTier(todayMetrics.currentRpkm).color : "text-gray-900 dark:text-white")}>
                          R$ {todayMetrics.currentRpkm.toFixed(2)}
                        </p>
                        {todayMetrics.currentRpkm > 0 && <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase inline-block", getRpkmTier(todayMetrics.currentRpkm).bg, getRpkmTier(todayMetrics.currentRpkm).color)}>{getRpkmTier(todayMetrics.currentRpkm).label}</span>}
                     </div>
                     
                     <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Users size={12} className="text-gray-400" /> Corridas</p>
                        <p className="text-xl font-black text-gray-900 dark:text-white">{todayMetrics.totalTrips}</p>
                     </div>
                     
                     <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Wallet size={12} className="text-gray-400" /> Ticket Méd.</p>
                        <p className="text-xl font-black text-green-600 dark:text-green-500">R$ {todayMetrics.avgTripValue.toFixed(2)}</p>
                     </div>
                   </div>
                   
                   <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                     <div className="flex items-center justify-between mb-2">
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp size={12} /> Trabalho Realizado</p>
                       <span className="text-[10px] font-bold text-gray-400">{todayMetrics.startKm > 0 ? todayMetrics.startKm : '--'} km inicial ➔ {todayMetrics.maxKm > 0 ? todayMetrics.maxKm : '--'} km atual</span>
                     </div>
                     <p className="text-2xl font-black text-gray-900 dark:text-white">{todayMetrics.totalWorkKm.toFixed(1)} <span className="text-sm font-bold text-gray-400 uppercase">km</span></p>
                   </div>
                </div>
                
                {todayMetrics.currentRph > 0 && todayMetrics.currentRpkm > 0 && (
                   <div className="px-6 pb-6 mt-auto">
                     <LiveShiftAnalysis 
                       currentRph={todayMetrics.currentRph} 
                       currentRpkm={todayMetrics.currentRpkm} 
                       avgRph={planningMetrics?.avgRph || 0}
                       avgRpkm={planningMetrics?.avgRpkm || 0}
                       activeShift={activeShift}
                       trips={activeShift ? (shiftTrips[activeShift.id] || []) : []}
                     />
                   </div>
                )}
              </div>

              {activeShift?.status === 'active' && (
                <Button onClick={() => setShowShiftFuelModal(true)} variant="outline" className="w-full py-6 font-bold uppercase tracking-wider text-xs bg-white dark:bg-[#0B0F14] border-gray-200 dark:border-[#1F2937] text-gray-500 dark:text-gray-400 hover:text-white hover:bg-gray-800 rounded-2xl transition-all" icon={FuelIcon}>
                  Abastecer no Turno
                </Button>
              )}

              {activeShift && (
                <Card className="border-dashed border-2 bg-gray-50/50">
                  <div className="flex items-center gap-3 text-gray-500">
                    <AlertCircle size={20} />
                    <p className="text-sm font-medium">Lembre-se de registrar suas corridas no final do turno para insights precisos.</p>
                  </div>
                </Card>
              )}

              {/* Maintenance Alerts */}
              {maintenanceAlerts.length > 0 && (
                <div className="space-y-3 mt-8">
                  <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Avisos de Manutenção</h3>
                  {maintenanceAlerts.map(alert => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-4 rounded-2xl border flex items-center gap-4 transition-colors",
                        alert.severity === 'critical' 
                          ? "bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800" 
                          : "bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        alert.severity === 'critical' ? "bg-red-100 dark:bg-red-800" : "bg-amber-100 dark:bg-amber-800"
                      )}>
                        <AlertCircle size={20} className={alert.severity === 'critical' ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <p className={cn("font-bold text-sm", alert.severity === 'critical' ? "text-red-900 dark:text-red-100" : "text-amber-900 dark:text-amber-100")}>
                            {alert.title}
                          </p>
                          <span className="text-[10px] font-bold uppercase opacity-60 dark:text-white">{alert.message}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${alert.progress}%` }}
                            className={cn(
                              "h-full rounded-full",
                              alert.severity === 'critical' ? "bg-red-500" : "bg-amber-500"
                            )}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}


            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <h2 className="text-2xl font-black dark:text-white uppercase tracking-wider">Histórico</h2>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                  <div className="flex bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded-[20px] w-full sm:w-auto border border-gray-200/50 dark:border-gray-700/50">
                    {(['day', 'week', 'month'] as const).map((f) => (
                      <button 
                        key={f}
                        onClick={() => setPeriodFilter(f)} 
                        className={cn("flex-1 py-3 px-6 text-xs uppercase tracking-widest font-black rounded-2xl transition-all duration-300", periodFilter === f ? "bg-white dark:bg-[#22C55E] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200")}
                      >
                        {f === 'day' ? 'Dia' : f === 'week' ? 'Semana' : 'Mês'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between sm:justify-start gap-4 bg-white dark:bg-gray-800/50 p-1.5 rounded-[20px] border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
                      <button 
                        onClick={prevPeriodRange}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="text-center min-w-[140px]">
                        <p className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none mb-1.5">{periodRangeLabel.type}</p>
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100 capitalize truncate">{periodRangeLabel.label}</p>
                      </div>
                      <button 
                        onClick={nextPeriodRange}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                </div>

                {shifts.length > 0 && (
                  <div className="bg-[#0B0B0C] dark:bg-[#111827]/80 rounded-[24px] border border-gray-800/80 shadow-2xl relative overflow-hidden mb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#22C55E]/5 to-transparent pointer-events-none" />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 relative z-10">
                      <div className="relative z-10">
                        <p className="text-[9px] uppercase font-black text-[#22C55E] tracking-widest mb-1.5 flex items-center gap-1.5"><DollarSign size={12} />Total Faturado</p>
                        <p className="text-2xl lg:text-3xl font-black text-white tracking-tighter">R$ {historySummary.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="relative z-10">
                        <p className="text-[9px] uppercase font-black text-gray-400 tracking-widest mb-1.5 flex items-center gap-1.5"><Clock size={12} />Horas Direção</p>
                        <p className="text-2xl font-bold text-gray-200 tracking-tighter">
                          {Math.floor(historySummary.totalTime / 3600)}<span className="text-sm font-medium text-gray-500 mx-0.5">h</span>{Math.floor((historySummary.totalTime % 3600) / 60)}<span className="text-sm font-medium text-gray-500 ml-0.5">m</span>
                        </p>
                      </div>
                      <div className="relative z-10">
                        <p className="text-[9px] uppercase font-black text-emerald-400 tracking-widest mb-1.5 flex items-center gap-1.5"><Activity size={12} />R$/Hora Médio</p>
                        <p className="text-2xl font-bold text-gray-200 tracking-tighter"><span className="text-emerald-400">R$ {historySummary.rph.toFixed(2)}</span> /h</p>
                      </div>
                      <div className="relative z-10">
                        <p className="text-[9px] uppercase font-black text-indigo-400 tracking-widest mb-1.5 flex items-center gap-1.5"><MapPin size={12} />R$/KM Médio</p>
                        <p className="text-2xl font-bold text-gray-200 tracking-tighter"><span className="text-indigo-400">R$ {historySummary.rpkm.toFixed(2)}</span> /km</p>
                      </div>
                    </div>
                    <div className="px-5 pb-5 pt-1 relative z-10">
                       <button 
                         onClick={() => setShowComparisonModal(true)}
                         className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-white text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                       >
                         <BarChart3 size={16} /> Ver Comparativo Completo
                       </button>
                    </div>
                  </div>
                )}
              </div>
              {shifts.length === 0 ? (
                <div className="text-center py-20 text-gray-400 bg-white dark:bg-[#111827] rounded-3xl border border-gray-100 dark:border-gray-800">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium text-sm">Nenhum histórico registrado no período.</p>
                </div>
              ) : (
                groupedShifts.map(group => {
                  const dateKey = format(group.date, 'yyyy-MM-dd');
                  const isExpanded = !!expandedDays[dateKey]; // Default to collapsed
                  const rph = group.totalTime > 0 ? group.totalRevenue / (group.totalTime / 3600) : 0;
                  const rpkm = group.totalWorkKm > 0 ? group.totalRevenue / group.totalWorkKm : 0;
                  
                  // Day Trip Completeness Check
                  const totalExpectedDayTrips = group.shifts.reduce((sum, s) => sum + (s.totalTrips || 0), 0);
                  const totalRegisteredDayTrips = group.shifts.reduce((sum, s) => sum + ((shiftTrips[s.id] || []).filter(t => t.durationSeconds > 0 || t.isCancelled).length), 0);
                  
                  let dayTripStatusColor = null;
                  let dayTripStatusTitle = "";
                  if (totalExpectedDayTrips > 0 || totalRegisteredDayTrips > 0) {
                    if (totalRegisteredDayTrips >= totalExpectedDayTrips && totalExpectedDayTrips > 0) {
                       dayTripStatusColor = "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]";
                       dayTripStatusTitle = "Todas corridas detalhadas";
                    } else {
                       dayTripStatusColor = "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]";
                       dayTripStatusTitle = "Falta detalhar corridas";
                    }
                  } else if (group.totalRevenue > 0) {
                       dayTripStatusColor = "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]";
                       dayTripStatusTitle = "Falta detalhar corridas";
                  }

                  return (
                    <div key={dateKey} className="mb-4">
                      <div 
                        className={cn("bg-white dark:bg-[#1a2133]/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100 dark:border-gray-800/60 rounded-[28px] overflow-hidden cursor-pointer transition-all duration-400 group", isExpanded ? "ring-2 ring-[#22C55E]/20" : "hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-gray-200 dark:hover:border-gray-700")}
                        onClick={() => toggleDay(dateKey)}
                      >
                        <div className="p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="flex items-center gap-4 w-full">
                            <div className={cn("w-2 h-16 rounded-full shrink-0 shadow-sm", dayTripStatusColor || 'bg-green-500/30')} title={dayTripStatusTitle} />
                            <div className="flex-1">
                              <p className="text-xl sm:text-2xl font-black dark:text-white capitalize flex items-center gap-2 mb-1">
                                {format(group.date, "EEEE, d", { locale: ptBR })} 
                                <span className="text-gray-400 dark:text-gray-500 font-bold text-sm tracking-widest uppercase">
                                  {format(group.date, "MMMM", { locale: ptBR })}
                                </span>
                              </p>
                              <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-2">
                                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-widest uppercase text-gray-500 dark:text-gray-400">
                                  <Clock size={12} /> {formatTime(group.totalTime)}
                                </div>
                                <div className="flex items-center gap-1.5 bg-green-50 dark:bg-[#22C55E]/10 border border-green-100 dark:border-[#22C55E]/20 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-widest uppercase text-green-600 dark:text-[#22C55E]">
                                  <DollarSign size={12} /> R$ {group.totalRevenue.toFixed(2)}
                                </div>
                                <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-widest uppercase", getRphTier(rph).bg, getRphTier(rph).color)}>
                                  <TrendingUp size={12} /> R$ {rph.toFixed(2)}/h
                                </div>
                                <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-widest uppercase", getRpkmTier(rpkm).bg, getRpkmTier(rpkm).color)}>
                                  <MapPin size={12} /> R$ {rpkm.toFixed(2)}/km
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="w-full sm:w-auto flex justify-end">
                            <div className={cn("p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 transition-transform duration-500 ease-in-out", isExpanded && "rotate-180 bg-green-50 dark:bg-green-900/20")}>
                              <ChevronRight size={20} className={cn("text-gray-400 transition-colors", isExpanded && "text-[#22C55E]")} />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-4 overflow-hidden pt-4 px-2"
                          >
                            {group.shifts.map((shift, index) => {
                              const shiftTripsCount = (shiftTrips[shift.id] || []).filter(t => t.durationSeconds > 0 || t.isCancelled).length;
                              const expectedTrips = shift.totalTrips || 0;
                              
                              let shiftStatusColor = null;
                              let shiftStatusTitle = "";
                              
                              if (expectedTrips > 0 || shiftTripsCount > 0) {
                                if (shiftTripsCount >= expectedTrips && expectedTrips > 0) {
                                   shiftStatusColor = "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]";
                                   shiftStatusTitle = "Todas corridas cadastradas";
                                } else {
                                   shiftStatusColor = "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]";
                                   shiftStatusTitle = "Faltam corridas para cadastrar";
                                }
                              } else if (shift.totalRevenue > 0) {
                                   shiftStatusColor = "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]";
                                   shiftStatusTitle = "Faltam corridas para cadastrar";
                              }

                              return (
                              <div key={shift.id} className={cn("bg-white dark:bg-[#111827]/80 rounded-[24px] border border-gray-100 dark:border-gray-800/80 shadow-sm overflow-hidden mb-4", shiftStatusColor?.includes('green') ? 'border-l-[6px] border-l-[#22C55E]' : shiftStatusColor?.includes('red') ? 'border-l-[6px] border-l-red-500' : 'border-l-[6px] border-l-[#22C55E]')}>
                                <div className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a2133]/50 transition-colors" onClick={() => setExpandedShiftId(expandedShiftId === shift.id ? null : shift.id)}>
                                  <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", shiftStatusColor?.includes('green') ? 'bg-green-500/10 text-green-500' : shiftStatusColor?.includes('red') ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500')}>
                                        <Car size={18} />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          {shiftStatusColor && (
                                            <div className={cn("w-2 h-2 rounded-full shrink-0", shiftStatusColor)} title={shiftStatusTitle} />
                                          )}
                                          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">
                                            Turno {group.shifts.length - index}
                                          </p>
                                        </div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                          <Clock size={12} className="text-gray-400" />
                                          {format(ensureDate(shift.startTime), 'HH:mm')} - {shift.endTime ? format(ensureDate(shift.endTime), 'HH:mm') : 'Agora'}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-end gap-1.5">
                                      <span className="text-xl font-black text-gray-900 dark:text-white leading-none">
                                        R$ {shift.totalRevenue.toFixed(2)}
                                      </span>
                                      <div className={cn("p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 transition-transform duration-300", expandedShiftId === shift.id && "rotate-180 bg-green-50 dark:bg-green-900/20")}>
                                        <ChevronRight size={14} className={cn("text-gray-400", expandedShiftId === shift.id && "text-green-500")} />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2 mb-4">
                                    <div className="flex items-center gap-1.5 text-xs font-bold bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg">
                                      <Clock size={12} />
                                      {formatTime(shift.activeTimeSeconds)}
                                    </div>
                                    {shift.totalTrips > 0 && (
                                      <div className="flex items-center gap-1.5 text-xs font-bold bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-500/20">
                                        <Users size={12} />
                                        {shift.totalTrips} Corridas
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                                      <MapPin size={12} />
                                      {(shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 0).toFixed(1)} km
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-4">
                                      <div className={cn("flex items-center gap-1.5 text-xs font-black uppercase tracking-wider", shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) > 0 ? getRpkmTier(shift.totalRevenue / ((shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 1))).color : "text-gray-500")}>
                                        {shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) > 0 ? `R$ ${(shift.totalRevenue / ((shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 1))).toFixed(2)}` : 'R$ 0.00'}/km
                                      </div>
                                      <div className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                                      <div className={cn("flex items-center gap-1.5 text-xs font-black uppercase tracking-wider", shift.activeTimeSeconds > 0 ? getRphTier(shift.totalRevenue / (shift.activeTimeSeconds / 3600)).color : "text-gray-500")}>
                                        {shift.activeTimeSeconds > 0 ? `R$ ${(shift.totalRevenue / (shift.activeTimeSeconds / 3600)).toFixed(2)}` : 'R$ 0.00'}/h
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                      <button 
                                        className="flex-1 sm:flex-none h-10 px-4 flex items-center justify-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-green-500 hover:bg-white dark:hover:bg-[#1F2937] transition-all font-bold text-xs uppercase tracking-wider"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingShift(shift);
                                          setShowEditShiftModal(true);
                                        }}
                                        title="Editar Turno"
                                      >
                                        <Edit2 size={14} /> Editar
                                      </button>
                                      
                                      <button 
                                        className="flex-1 sm:flex-none h-10 px-4 flex items-center justify-center gap-2 rounded-xl bg-[#22C55E] hover:bg-[#16a34a] text-white transition-all font-bold text-xs uppercase tracking-wider shadow-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedShiftId(shift.id);
                                          setInitialTripIdForSequentialForm(null);
                                          setShowTripModal(true);
                                        }}
                                        title="Adicionar Corrida"
                                      >
                                        <Plus size={16} strokeWidth={3} /> Corrida
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                
                                <AnimatePresence>
                                  {expandedShiftId === shift.id && (
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 transition-colors"
                                    >
                                      <div className="p-4 space-y-3">
                                        <div className="flex justify-between text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                          <span>Detalhes do Turno</span>
                                          <span>{shift.totalTrips} Corridas</span>
                                        </div>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                          <div className="bg-white dark:bg-[#1F2937] p-3.5 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5"><MapPin size={10} />Odômetro</p>
                                            <div className="flex items-center justify-between text-sm font-bold dark:text-gray-200">
                                              <span>{shift.startKm}</span>
                                              <ArrowRight size={12} className="text-gray-400" />
                                              <span>{shift.endKm || shift.lastKm || '--'}</span>
                                            </div>
                                          </div>
                                          
                                          <div className="bg-white dark:bg-[#1F2937] p-3.5 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5"><TrendingUp size={10} />Distância Real</p>
                                            <p className="text-lg font-black dark:text-white mt-auto">{(shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm)).toFixed(1)} <span className="text-[10px] font-bold text-gray-500">km</span></p>
                                          </div>

                                          <div className="bg-white dark:bg-[#1F2937] p-3.5 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5"><DollarSign size={10} />Rentabilidade</p>
                                            <div className="space-y-2 mt-auto">
                                              <div className="flex justify-between items-center text-sm font-bold bg-green-50/50 dark:bg-green-500/10 p-1.5 rounded-lg border border-green-100/50 dark:border-green-500/20">
                                                <span className="text-green-600 dark:text-green-400">R$ {(shift.totalRevenue / (shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 1)).toFixed(2)}</span>
                                                <span className="text-[10px] text-green-500/70 border-l border-green-200 dark:border-green-800 pl-2">/ km</span>
                                              </div>
                                              <div className="flex justify-between items-center text-sm font-bold bg-green-50/50 dark:bg-green-500/10 p-1.5 rounded-lg border border-green-100/50 dark:border-green-500/20">
                                                <span className="text-green-600 dark:text-green-400">R$ {(shift.totalRevenue / (shift.activeTimeSeconds / 3600)).toFixed(2)}</span>
                                                <span className="text-[10px] text-green-500/70 border-l border-green-200 dark:border-green-800 pl-2">/ h</span>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#1F2937] dark:to-[#111827] p-3.5 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5 line-clamp-1"><Activity size={10} />Consumo ({shift.avgConsumption?.toFixed(1) || '0.0'} km/L)</p>
                                            <div className="space-y-1 mt-auto">
                                              <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 font-medium">
                                                <span>Gasto Est.:</span>
                                                <span className="font-bold text-gray-900 dark:text-gray-200">~{((shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 0) / (shift.avgConsumption || 1)).toFixed(1)}L</span>
                                              </div>
                                              <div className="flex justify-between items-center text-xs text-red-500 dark:text-red-400 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                                                <span>Custo:</span>
                                                <span className="font-bold">-R$ {(((shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 0) / (shift.avgConsumption || 1)) * (settings?.defaultFuelPrice || 0)).toFixed(2)}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {shiftTrips[shift.id] && shiftTrips[shift.id].length > 0 && (
                                          <div className="space-y-3 mt-6 border-t border-gray-200/50 dark:border-gray-700/50 pt-5">
                                            <div className="flex justify-between items-center">
                                              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-1.5"><MapPin size={10} /> Lista de Corridas</p>
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setShiftToDeleteAllTrips(shift.id);
                                                }}
                                                className="text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-bold uppercase transition-colors px-2 py-1 relative z-10 bg-red-50 dark:bg-red-900/10 rounded-md border border-red-100 dark:border-red-900/30"
                                              >
                                                Apagar Todas
                                              </button>
                                            </div>
                                            <div className="grid gap-2">
                                              {shiftTrips[shift.id].map(trip => {
                                                const mins = Math.floor(trip.durationSeconds / 60);
                                                const secs = Math.floor(trip.durationSeconds % 60);
                                                const tripHour = trip.startTime ? format(ensureDate(trip.startTime), 'HH:mm') : null;
                                                const tripRph = trip.value / (trip.durationSeconds / 3600);
                                                
                                                let bgColorClass = "bg-red-50/80 dark:bg-red-900/10 border-red-200/50 dark:border-red-900/30";
                                                let textColorClass = "text-red-700 dark:text-red-400";
                                                let badgeClass = "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
                                                
                                                if (trip.isCancelled) {
                                                  bgColorClass = "bg-gray-100/50 dark:bg-[#1F2937] border-gray-200/50 dark:border-gray-700/50 opacity-75";
                                                  textColorClass = "text-gray-500 dark:text-gray-400";
                                                  badgeClass = "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
                                                } else if (tripRph > 42) {
                                                  bgColorClass = "bg-green-50/80 dark:bg-green-900/10 border-green-200/50 dark:border-green-900/30"; // Verde Claro
                                                  textColorClass = "text-green-700 dark:text-green-400 font-black";
                                                  badgeClass = "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
                                                } else if (tripRph > 37) {
                                                  bgColorClass = "bg-emerald-50/80 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-900/30"; // Verde Escuro
                                                  textColorClass = "text-emerald-700 dark:text-emerald-400";
                                                  badgeClass = "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400";
                                                } else if (tripRph > 33) {
                                                  bgColorClass = "bg-orange-50/80 dark:bg-orange-900/10 border-orange-200/50 dark:border-orange-900/30"; // Laranja
                                                  textColorClass = "text-orange-700 dark:text-orange-400";
                                                  badgeClass = "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400";
                                                }

                                                return (
                                                  <div key={trip.id} className={cn("flex justify-between items-center px-4 py-3 rounded-2xl text-sm border shadow-sm transition-all relative overflow-hidden group", bgColorClass)}>
                                                    {/* Soft background gradient overlay for styling */}
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-black/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    
                                                    <div className="flex items-center gap-3 w-full relative z-10">
                                                      <div className="flex items-center gap-3 sm:gap-4 w-full flex-wrap sm:flex-nowrap">
                                                         {tripHour && <span className={cn("text-xs font-bold tabular-nums w-12 shrink-0 px-2 py-1 rounded-lg text-center", badgeClass)}>{tripHour}</span>}
                                                         
                                                         <div className="flex flex-col">
                                                           <span className={cn("font-black text-[15px] leading-none mb-1", textColorClass)}>R$ {trip.value.toFixed(2)}</span>
                                                           {!trip.isCancelled && (
                                                             <div className="flex items-center gap-2">
                                                               <span className={cn("text-[11px] font-bold tabular-nums opacity-80", textColorClass)}>
                                                                 {mins > 0 ? `${mins}m ` : ''}{secs}s
                                                               </span>
                                                               <div className="h-2 w-px bg-current opacity-20"></div>
                                                               <span className={cn("text-[11px] font-bold tabular-nums opacity-90", textColorClass)}>
                                                                 {trip.distanceKm ? `${trip.distanceKm.toFixed(1)} km` : '--'}
                                                               </span>
                                                               {trip.dynamicValue && trip.dynamicValue > 0 && (
                                                                 <span className="text-[9px] px-1.5 py-0.5 ml-1 bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 rounded-md font-bold shrink-0 border border-teal-200 dark:border-teal-800">
                                                                   + R$ {trip.dynamicValue.toFixed(2)} dinâmico
                                                                 </span>
                                                               )}
                                                             </div>
                                                           )}
                                                           {trip.isCancelled && (
                                                             <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-md mt-1 w-max border", "bg-red-500 text-white border-red-600 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800")}>Cancelada</span>
                                                           )}
                                                         </div>
                                                      </div>
                                                    </div>
                                                    <div className="flex gap-1.5 ml-3 shrink-0 relative z-10 border-l border-current opacity-50 pl-3">
                                                      <button 
                                                        className="p-1.5 text-current opacity-70 hover:opacity-100 hover:bg-white/50 dark:hover:bg-black/20 rounded-xl transition-all active:scale-95"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setSelectedShiftId(shift.id);
                                                          setInitialTripIdForSequentialForm(trip.id);
                                                          setShowTripModal(true);
                                                        }}
                                                        title="Editar Corrida"
                                                      >
                                                        <Edit2 size={16} />
                                                      </button>
                                                      <button 
                                                        className="p-1.5 text-current opacity-70 hover:opacity-100 hover:bg-white/50 dark:hover:bg-black/20 rounded-xl transition-all active:scale-95"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setTripToDelete({ shiftId: shift.id, tripId: trip.id });
                                                        }}
                                                        title="Apagar Corrida"
                                                      >
                                                        <X size={16} />
                                                      </button>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}

              {/* Ações do Histórico ao fim da página */}
              <div className="pt-6 pb-20">
                <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button 
                      onClick={() => setShowAiAnalysisModal(true)}
                      className="w-full py-6 rounded-2xl bg-gradient-to-r from-green-600 to-indigo-600 hover:from-green-700 hover:to-indigo-700 text-white shadow-xl shadow-green-200 dark:shadow-none transition-all group overflow-hidden relative border-none"
                    >
                      <motion.div
                        className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        initial={false}
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                      <div className="flex items-center justify-center gap-3 relative z-10">
                        <div className="bg-white/20 p-2 rounded-xl">
                          <Sparkles size={20} className="text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-1">Inteligência Artificial</p>
                          <p className="text-base font-bold">Análise de IA</p>
                        </div>
                      </div>
                    </Button>

                    <Button 
                      onClick={() => setShowPastShiftModal(true)} 
                      icon={Calendar} 
                      className="w-full py-6 rounded-2xl bg-green-600 hover:bg-green-500 text-white shadow-sm border-none flex items-center justify-center gap-3"
                    >
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-1">Lançamento</p>
                        <p className="text-base font-bold">Registrar Turno</p>
                      </div>
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Button 
                      onClick={() => setShowImportModal(true)} 
                      icon={Upload} 
                      variant="outline" 
                      className="py-4 px-4 text-xs font-bold uppercase rounded-xl border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors bg-gray-50 dark:bg-black/20"
                    >
                      Importar
                    </Button>
                    <Button 
                      onClick={exportShiftsToCSV} 
                      disabled={shifts.length === 0 || isExporting} 
                      icon={Download} 
                      variant="outline" 
                      className="py-4 px-4 text-xs font-bold uppercase rounded-xl border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors bg-gray-50 dark:bg-black/20"
                    >
                      {isExporting ? 'Exportando...' : 'Exportar CSV'}
                    </Button>
                  </div>

                  <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 font-medium uppercase tracking-tighter">
                    Gerencie seu histórico e analise seu desempenho com IA
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'wallet' && (
            <motion.div 
              key="wallet"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-bold dark:text-white mb-2">Meu Caixa</h2>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setShowUpdateBalanceModal(true)} icon={RefreshCw} variant="outline" className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">Atualizar Saldo</Button>
                  <Button onClick={() => setShowWithdrawalModal(true)} icon={ArrowDownLeft} className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">Saque</Button>
                  <Button onClick={() => setShowFuelModal(true)} icon={FuelIcon} variant="outline" className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">Abastecer</Button>
                  <Button onClick={() => setShowExpenseModal(true)} icon={Plus} variant="outline" className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">Despesa</Button>
                </div>
              </div>

              {/* Total Balance Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-600 to-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-green-500/20 relative overflow-hidden">
                  <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-4 -translate-y-4">
                    <Wallet size={120} />
                  </div>
                  <p className="text-sm font-medium text-green-100 mb-1">Saldo Plataforma (Uber)</p>
                  <h3 className="text-4xl font-black tracking-tight relative z-10">R$ {settings?.platformBalance?.toFixed(2) || '0.00'}</h3>
                </div>

                {planningMetrics && (
                  <Card className="bg-white dark:bg-gray-900 border-indigo-100 dark:border-indigo-900/50 shadow-2xl relative overflow-hidden p-0 border-0">
                    <div className="bg-gradient-to-br from-indigo-700 to-violet-800 p-6 text-white relative">
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <Target size={100} />
                      </div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-0.5">Meta Dinâmica do Mês (1)</p>
                            <h3 className="text-3xl font-black">R$ {planningMetrics.revenueNeededTotal.toFixed(0)} <span className="text-xs font-medium opacity-70">Faturamento Bruto</span></h3>
                          </div>
                          <button 
                            onClick={() => setShowMonthlyGoalModal(true)}
                            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm"
                            title="Editar Lucro Desejado"
                          >
                            <Edit2 size={18} />
                          </button>
                        </div>

                        {/* Progresso de Faturamento */}
                        <div className="space-y-3 mb-6 bg-black/10 p-4 rounded-2xl border border-white/10">
                          <div className="flex justify-between items-end">
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold uppercase text-indigo-200">Faturado no Mês (2)</p>
                              <p className="text-xl font-bold text-green-300">R$ {planningMetrics.revenueSoFar.toFixed(0)}</p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-[10px] font-semibold uppercase text-indigo-200">Falta para Meta (3)</p>
                              <p className="text-xl font-bold text-yellow-300">R$ {planningMetrics.revenueRemaining.toFixed(0)}</p>
                            </div>
                          </div>
                          
                          <div className="h-3 bg-black/30 rounded-full overflow-hidden border border-white/10">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${planningMetrics.progressPerc}%` }}
                              className="h-full bg-gradient-to-r from-green-400 to-green-300 rounded-full shadow-[0_0_15px_rgba(74,222,128,0.5)]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Meta Diária (4) */}
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/40 flex items-center justify-between">
                         <div>
                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Passo a Passo (4)</p>
                            <h4 className="text-2xl font-black text-indigo-900 dark:text-indigo-100">R$ {planningMetrics.dailyNeeded.toFixed(0)} <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">/dia</span></h4>
                            <p className="text-[10px] font-bold text-indigo-500/70 mt-1 uppercase">{planningMetrics.daysRemaining} {planningMetrics.daysRemaining === 1 ? 'dia útil restante' : 'dias úteis restantes'}</p>
                         </div>
                         <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <CalendarIcon size={24} />
                         </div>
                      </div>

                      {/* Esforço Faltante (5) */}
                      <div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-2xl border border-violet-100 dark:border-violet-800/40">
                         <div className="flex items-center gap-2 mb-4">
                            <Clock size={16} className="text-violet-600 dark:text-violet-400" />
                            <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Esforço estimado para conclusão (5)</p>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                               <p className="text-lg font-black text-violet-900 dark:text-violet-100">~{planningMetrics.totalHoursRemaining.toFixed(0)} <span className="text-sm opacity-70">horas</span></p>
                               <p className="text-[10px] font-medium text-violet-500 mt-0.5">Base: R$ {planningMetrics.avgRph.toFixed(0)}/h</p>
                            </div>
                            <div>
                               <p className="text-lg font-black text-violet-900 dark:text-violet-100">~{planningMetrics.totalKmRemaining.toFixed(0)} <span className="text-sm opacity-70">km</span></p>
                               <p className="text-[10px] font-medium text-violet-500 mt-0.5">Base: R$ {planningMetrics.avgRpkm.toFixed(2)}/km</p>
                            </div>
                         </div>
                         
                         <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-violet-100 dark:border-violet-800/50 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                               <FuelIcon size={14} />
                               <span className="text-xs font-bold">Gasto com Gasolina:</span>
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-black text-gray-900 dark:text-white">R$ {planningMetrics.estimatedFuelCostRemaining.toFixed(0)} <span className="text-[10px] font-medium opacity-60">(~{planningMetrics.litersRemaining.toFixed(0)}L)</span></p>
                            </div>
                         </div>
                      </div>

                      {/* Info de Base (Desconstruindo a Meta) */}
                      <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                        <div className="flex items-center gap-2 mb-3">
                          <Activity size={14} className="text-gray-500" />
                          <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Como essa meta é composta?</p>
                        </div>
                        <ul className="space-y-2 text-[11px] text-gray-600 dark:text-gray-400 font-medium">
                          <li className="flex justify-between"><span>💰 Lucro Desejado (Bolso):</span> <span className="font-bold text-gray-900 dark:text-white">R$ {planningMetrics.monthlyNetGoal.toFixed(0)}</span></li>
                          <li className="flex justify-between"><span>📄 Custos Fixos & Contas:</span> <span className="font-bold text-gray-900 dark:text-white">R$ {planningMetrics.totalFixed.toFixed(0)}</span></li>
                          <li className="flex justify-between"><span>🍔 Despesas do Mês:</span> <span className="font-bold text-gray-900 dark:text-white">R$ {planningMetrics.totalExtraExpenses.toFixed(0)}</span></li>
                          <li className="flex justify-between"><span>⛽ Combustível Total (Estimado):</span> <span className="font-bold text-gray-900 dark:text-white">R$ {planningMetrics.totalEstimatedFuelForGoal.toFixed(0)}</span></li>
                        </ul>
                        
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                           <Button 
                             onClick={generateAIPlanning} 
                             variant="primary" 
                             className="w-full py-2 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 rounded-xl"
                             icon={Sparkles}
                             disabled={isGeneratingAi}
                           >
                             {isGeneratingAi ? 'Analisando...' : 'Obter Plano IA'}
                           </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Fixed Expenses Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Contas Fixas</h3>
                  <button 
                    onClick={() => setShowFixedExpenseModal(true)}
                    className="text-green-600 dark:text-green-400 text-sm font-bold hover:underline"
                  >
                    + Adicionar
                  </button>
                </div>
                
                {fixedExpenses.length === 0 ? (
                  <Card className="text-center py-6 text-gray-500">
                    <AlertCircle className="mx-auto mb-2 opacity-20" size={32} />
                    <p className="text-sm">Nenhuma conta fixa cadastrada.</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {fixedExpenses.map(fe => {
                      const today = new Date().getDate();
                      let daysUntilDue = fe.dueDay - today;
                      if (daysUntilDue < 0) {
                        // next month
                        const now = new Date();
                        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, fe.dueDay);
                        daysUntilDue = differenceInDays(nextMonth, now);
                      }
                      const currentMonthStr = format(new Date(), 'yyyy-MM');
                      const isPaid = fe.lastPaidMonth === currentMonthStr;

                      return (
                        <Card key={fe.id} className={cn("flex flex-col justify-between items-start group relative overflow-hidden gap-3 p-4", isPaid && "opacity-50 grayscale")}>
                          {daysUntilDue <= 3 && daysUntilDue >= 0 && !isPaid && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 shadow-[1px_0_5px_rgba(239,68,68,0.3)]" />
                          )}
                          <div className="flex items-center gap-3 w-full">
                            <div className={cn("p-2.5 rounded-xl transition-all shadow-sm", daysUntilDue <= 3 && daysUntilDue >= 0 && !isPaid ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400")}>
                               <CalendarIcon size={18} />
                            </div>
                            <div className="flex-1">
                               <p className="font-bold text-base text-gray-900 dark:text-white leading-tight mb-0.5">{fe.name}</p>
                               <p className={cn("text-xs font-medium", daysUntilDue <= 3 && daysUntilDue >= 0 && !isPaid ? "text-red-600" : "text-gray-500 dark:text-gray-400")}>
                                 {isPaid ? 'Pago este mês ✔️' : `Vence dia ${fe.dueDay} (em ${daysUntilDue} dias)`}
                               </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between w-full pt-3 border-t border-gray-100 dark:border-gray-800/50">
                            <div>
                               <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Valor da Conta</p>
                               <p className="font-bold text-lg dark:text-white tracking-tight">R$ {fe.amount.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {!isPaid && (
                                <button
                                  onClick={() => payFixedExpense(fe)}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold transition-all hover:bg-green-700 active:scale-95 shadow-md shadow-green-500/20"
                                >
                                  Pagar
                                </button>
                              )}
                              <button 
                                className="p-2 text-gray-400 hover:text-green-500 bg-gray-50 dark:bg-gray-800/50 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-all border border-gray-100 dark:border-gray-700/50"
                                onClick={() => {
                                  setEditingFixedExpense(fe);
                                  setShowFixedExpenseModal(true);
                                }}
                              >
                                <Edit2 size={16} />
                              </button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Withdrawals History */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Últimos Saques</h3>
                {withdrawals.length === 0 ? (
                  <Card className="text-center py-6 text-gray-500">
                    <p className="text-sm">Nenhum saque registrado.</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {withdrawals.slice(0, 5).map(w => (
                      <Card key={w.id} className="flex justify-between items-center p-4">
                        <div className="flex items-center gap-3">
                           <div className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 p-2 rounded-xl shadow-sm border border-green-100 dark:border-green-900/30">
                              <ArrowUpRight size={18} />
                           </div>
                           <div>
                             <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">Transferência</p>
                             <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">{format(ensureDate(w.date), 'dd/MM/yyyy • HH:mm')}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-bold text-base text-gray-900 dark:text-white tracking-tight">R$ {w.amount.toFixed(2)}</p>
                           {w.fee > 0 && <p className="text-[10px] font-bold text-red-500 mt-0.5">Taxa: R$ {w.fee.toFixed(2)}</p>}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {fuelRecords.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Últimos Abastecimentos</h3>
                  {[...fuelRecords].sort((a, b) => b.km - a.km).map((fuel, index, sortedRecords) => {
                    const nextFuel = sortedRecords[index + 1];
                    const kmDriven = nextFuel ? fuel.km - nextFuel.km : 0;
                    return (
                      <Card 
                        key={fuel.id} 
                        className="bg-white dark:bg-gray-900 border-l-[4px] border-l-green-500 p-4 group cursor-pointer hover:bg-green-50/30 dark:hover:bg-green-900/10 transition-all border border-gray-100 dark:border-gray-800"
                        onClick={() => {
                          setEditingFuel(fuel);
                          setShowEditFuelModal(true);
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <div className="space-y-1">
                            <p className="font-bold text-base text-gray-900 dark:text-white tracking-tight">R$ {fuel.totalValue.toFixed(2)}</p>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex flex-wrap gap-1.5">
                              <span>{format(ensureDate(fuel.date), 'dd/MM HH:mm')}</span>
                              <span className="opacity-30">•</span>
                              <span>{fuel.liters.toFixed(2)}L</span>
                              <span className="opacity-30">•</span>
                              <span className="text-green-600 dark:text-green-400">R${fuel.pricePerLiter.toFixed(2)}/L</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600 dark:text-green-400">{fuel.km} km</p>
                              {kmDriven > 0 && (
                                <p className="text-[10px] text-green-600 dark:text-green-500 font-bold mt-0.5">{kmDriven} km rod.</p>
                              )}
                            </div>
                            <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg group-hover:bg-green-100 dark:group-hover:bg-green-900/40 transition-colors">
                              <ChevronRight size={16} className="text-gray-400 group-hover:text-green-600 transition-colors" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Outras Despesas</h3>
              {expenses.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-gray-600">
                  <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Nenhuma outra despesa registrada.</p>
                </div>
              ) : (
                expenses.map(expense => (
                  <Card 
                    key={expense.id} 
                    className="flex justify-between items-center p-4 group cursor-pointer hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-all border border-gray-100 dark:border-gray-800"
                    onClick={() => {
                      setEditingExpense(expense);
                      setShowEditExpenseModal(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-red-50 dark:bg-red-900/30 p-2.5 rounded-xl text-red-500 dark:text-red-400 border border-red-100 dark:border-red-900/30 shadow-sm transition-all">
                        <AlertCircle size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{expense.category}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                          {format(ensureDate(expense.date), 'dd/MM/yyyy')} • <span className="text-red-500/80">{expense.kmAtExpense} km</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-base text-red-500 dark:text-red-400 tracking-tight">- R$ {expense.value.toFixed(2)}</p>
                      </div>
                      <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-colors">
                        <ChevronRight size={16} className="text-gray-400 group-hover:text-red-500 transition-colors" />
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'insights' && (
            <motion.div 
              key="insights"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-3 bg-white dark:bg-gray-900 p-2 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors relative overflow-hidden">
                <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/50 p-1 rounded-xl">
                    {(['day', 'week', 'month'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setPeriodFilter(f)}
                        className={cn(
                          "flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all",
                          periodFilter === f ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        )}
                      >
                        {f === 'day' ? 'Dia' : f === 'week' ? 'Semana' : 'Mês'}
                      </button>
                    ))}
                </div>
                <div className="flex items-center justify-between px-2 pb-1">
                  <button 
                    onClick={prevPeriodRange}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-center font-black text-sm dark:text-white capitalize">
                    {periodRangeLabel.label}
                  </div>
                  <button 
                    onClick={nextPeriodRange}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                {isLoadingInsights && (
                  <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden absolute bottom-0 left-0">
                    <motion.div 
                      className="h-full bg-green-500"
                      initial={{ width: "0%", x: "-100%" }}
                      animate={{ width: "50%", x: "200%" }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    />
                  </div>
                )}
              </div>

              {!metrics || isLoadingInsights ? (
                <div className="text-center py-20 space-y-4">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    {isLoadingInsights ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      >
                        <Car className="text-green-500" size={32} />
                      </motion.div>
                    ) : (
                      <BarChart3 className="text-gray-300" size={32} />
                    )}
                  </div>
                  <p className="text-gray-500 font-medium">
                    {isLoadingInsights ? "Carregando dados das corridas..." : "Nenhum dado para este período."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Resumo do Período */}
                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 dark:from-blue-600 dark:via-indigo-600 dark:to-purple-600" />
                    
                    <div className="p-6 pb-4">
                      <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Resumo do Período</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><DollarSign size={12} className="text-gray-400" /> Faturamento</p>
                          <p className="text-2xl font-black text-green-600 dark:text-green-500">R$ {metrics.totalRevenue.toFixed(2)}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><MapPin size={12} className="text-gray-400" /> KM Trabalho</p>
                          <p className="text-2xl font-black text-gray-900 dark:text-white">{metrics.totalKmWork.toFixed(1)}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><MapPin size={12} className="text-gray-400" /> KM Pessoal</p>
                          <p className="text-2xl font-black text-gray-900 dark:text-white">{metrics.totalKmPersonal.toFixed(1)}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Clock size={12} className="text-gray-400" /> Tempo Total</p>
                          <p className="text-2xl font-black text-gray-900 dark:text-white">{metrics.totalHours.toFixed(1)}h</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5 col-span-2">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5"><Activity size={12} className="text-gray-400" /> Total de Viagens</p>
                          <p className="text-3xl font-black text-gray-900 dark:text-white text-center font-mono tracking-tighter">{metrics.totalTrips}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {allTimeMetrics && (
                    <Card className="bg-gray-50/50 dark:bg-black/20 border-gray-100 dark:border-white/5 p-6">
                      <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <History size={12} /> Média Histórica Geral
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">R$/Hora Médio</p>
                          <p className="text-xl font-black text-gray-900 dark:text-white">R$ {allTimeMetrics.revenuePerHour.toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">R$/KM Médio</p>
                          <p className="text-xl font-black text-gray-900 dark:text-white">R$ {allTimeMetrics.revenuePerKm.toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Ticket Médio</p>
                          <p className="text-xl font-black text-gray-900 dark:text-white">R$ {allTimeMetrics.ticketMedio.toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Geral</p>
                          <p className="text-xl font-black text-gray-900 dark:text-white">R$ {allTimeMetrics.totalRevenue.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-4 italic font-medium flex items-center gap-1.5">
                        <Sparkles size={10} className="text-blue-500" /> Comparação com todo seu histórico registrado.
                      </p>
                    </Card>
                  )}

                  {/* Gráfico de Faturamento */}
                  {chartsData.barData.length > 0 && (
                    <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                      <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Evolução de Faturamento</h3>
                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartsData.barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }} dy={10} minTickGap={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(value) => `R$${value}`} width={40} />
                            <Tooltip 
                              cursor={{ fill: 'transparent' }}
                              contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                              itemStyle={{ color: '#22C55E' }}
                              formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Faturamento']}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {chartsData.barData.map((e, idx) => (
                                 <Cell key={`cell-${idx}`} fill="#16A34A" />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Métricas Principais */}
                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                    <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Eficiência e Qualidade</h3>
                    <div className="space-y-4">
                      
                      <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0",
                            metrics.revenuePerHour >= 35 ? "bg-green-50 dark:bg-green-900/20" : metrics.revenuePerHour >= 25 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"
                          )}>
                            <Activity size={20} className={metrics.revenuePerHour >= 35 ? "text-green-600 dark:text-green-400" : metrics.revenuePerHour >= 25 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">R$ / Hora</p>
                            <p className="font-bold text-base text-gray-900 dark:text-white tracking-tight">R$ {metrics.revenuePerHour.toFixed(2)}/h</p>
                          </div>
                        </div>
                        <div className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors self-start sm:self-auto shadow-sm",
                          metrics.revenuePerHour >= 35 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : metrics.revenuePerHour >= 25 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        )}>
                          {metrics.revenuePerHour >= 35 ? "Excelente" : metrics.revenuePerHour >= 25 ? "Bom" : "Baixo"}
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0",
                            metrics.revenuePerKm >= 2.5 ? "bg-green-50 dark:bg-green-900/20" : metrics.revenuePerKm >= 1.8 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"
                          )}>
                            <MapPin size={20} className={metrics.revenuePerKm >= 2.5 ? "text-green-600 dark:text-green-400" : metrics.revenuePerKm >= 1.8 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">R$ / KM</p>
                            <p className="font-bold text-base text-gray-900 dark:text-white tracking-tight">R$ {metrics.revenuePerKm.toFixed(2)}/km</p>
                          </div>
                        </div>
                        <div className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors self-start sm:self-auto shadow-sm",
                          metrics.revenuePerKm >= 2.5 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : metrics.revenuePerKm >= 1.8 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        )}>
                          {metrics.revenuePerKm >= 2.5 ? "Excelente" : metrics.revenuePerKm >= 1.8 ? "Bom" : "Baixo"}
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0",
                            metrics.ticketMedio >= 15 ? "bg-green-50 dark:bg-green-900/20" : metrics.ticketMedio >= 10 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"
                          )}>
                            <DollarSign size={20} className={metrics.ticketMedio >= 15 ? "text-green-600 dark:text-green-400" : metrics.ticketMedio >= 10 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Ticket Médio</p>
                            <p className="font-bold text-base text-gray-900 dark:text-white tracking-tight">R$ {metrics.ticketMedio.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors self-start sm:self-auto shadow-sm",
                          metrics.ticketMedio >= 15 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : metrics.ticketMedio >= 10 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        )}>
                          {metrics.ticketMedio >= 15 ? "Excelente" : metrics.ticketMedio >= 10 ? "Bom" : "Baixo"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secao Cofre Inteligente (Bento Grid) */}
                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                    <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Inteligência Estratégica</h3>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 rounded-2xl col-span-1 flex flex-col justify-center">
                          <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-2 tracking-widest flex items-center gap-1.5"><Clock size={12} /> Melhor Horário</p>
                          <p className="text-2xl font-black text-purple-700 dark:text-purple-300">
                            {metrics.bestHourInfo.hour !== -1 ? `${metrics.bestHourInfo.hour.toString().padStart(2, '0')}:00` : '--:--'}
                          </p>
                          {metrics.bestHourInfo.rph > 0 && (
                            <p className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-1 line-clamp-2">
                               Picos de R$ {metrics.bestHourInfo.rph.toFixed(2)}/h
                            </p>
                          )}
                       </div>
                       <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl col-span-1 flex flex-col justify-center">
                          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-2 tracking-widest flex items-center gap-1.5"><Calendar size={12} /> Melhor Dia</p>
                          <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                            {metrics.bestDayInfo.day !== -1 ? ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][metrics.bestDayInfo.day] : '---'}
                          </p>
                          {metrics.bestDayInfo.rph > 0 && (
                            <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-1 line-clamp-2">
                               Média de R$ {metrics.bestDayInfo.rph.toFixed(2)}/h
                            </p>
                          )}
                       </div>

                       {metrics.shiftsMissingTrips.length > 0 && (
                         <div className="col-span-2 mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-xl flex gap-3 items-start">
                           <div className="text-yellow-600 dark:text-yellow-400 mt-0.5"><Sparkles size={16} /></div>
                           <p className="text-[11px] text-yellow-800 dark:text-yellow-300 font-medium leading-relaxed">
                             Cadastre os detalhes das suas corridas nos turnos dos dias <span className="font-bold">{metrics.shiftsMissingTrips.length > 3 ? metrics.shiftsMissingTrips.slice(0, 3).join(', ') + ' e outros' : metrics.shiftsMissingTrips.join(', ')}</span> para uma análise estratégica mais profunda e exata.
                           </p>
                         </div>
                       )}
                    </div>
                  </div>

                  {/* Hall of Fame - Top Trips */}
                  {metrics.top3BestTrips.length > 0 && (
                    <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                      <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">⭐ Hall da Fama (Top 3 Viagens)</h3>
                      <div className="space-y-2">
                        {metrics.top3BestTrips.map((t, idx) => (
                          <div key={t.id} className="flex justify-between items-center px-4 py-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30">
                             <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-green-200 dark:bg-green-900/50 flex items-center justify-center">
                                  <span className="text-xs font-black text-green-700 dark:text-green-400">#{idx + 1}</span>
                                </div>
                                <div>
                                  <p className="font-bold text-green-700 dark:text-green-400">R$ {t.value.toFixed(2)}</p>
                                  <p className="text-xs text-green-600/70 dark:text-green-400/70">
                                    {(t.durationSeconds / 60).toFixed(0)}m • {t.distanceKm}km {t.dynamicValue ? `(Dinâmico ${t.dynamicValue})` : ''}
                                  </p>
                                </div>
                             </div>
                             <div className="text-right">
                               <p className="text-sm font-black text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-lg">R$ {(t.value / (t.durationSeconds / 3600)).toFixed(0)}/h</p>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hall of Shame - Worst Trips */}
                  {metrics.top3WorstTrips.length > 0 && (
                    <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                      <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">⚠️ Fuga Imediata (Piores Viagens)</h3>
                      <div className="space-y-2">
                        {metrics.top3WorstTrips.map((t, idx) => (
                          <div key={t.id} className="flex justify-between items-center px-4 py-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 opacity-80 hover:opacity-100 transition-opacity">
                             <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-red-200 dark:bg-red-900/50 flex items-center justify-center">
                                  <span className="text-xs font-black text-red-700 dark:text-red-400">!</span>
                                </div>
                                <div>
                                  <p className="font-bold text-red-700 dark:text-red-400">R$ {t.value.toFixed(2)}</p>
                                  <p className="text-xs text-red-600/70 dark:text-red-400/70">
                                    {(t.durationSeconds / 60).toFixed(0)}m • {t.distanceKm}km
                                  </p>
                                </div>
                             </div>
                             <div className="text-right">
                               <p className="text-sm font-black text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-lg">R$ {(t.value / (t.durationSeconds / 3600)).toFixed(0)}/h</p>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Secao Dinheiro Extra */}
                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                    <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Análise de Receita Extra</h3>
                    <div className="grid grid-cols-2 gap-3">
                       <Card className="p-4 bg-teal-50 dark:bg-teal-900/10 border-teal-100 dark:border-teal-900/20 col-span-1 shadow-sm">
                          <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase mb-1 tracking-widest">Dinâmicos Salvos</p>
                          <p className="text-2xl font-black text-teal-700 dark:text-teal-300">R$ {metrics.totalDynamicValue.toFixed(2)}</p>
                          <p className="text-[10px] text-teal-600/70 dark:text-teal-400/70 mt-1 line-clamp-2">
                             Dinheiros "grátis" na alta.
                          </p>
                       </Card>
                       <Card className="p-4 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 col-span-1 shadow-sm">
                          <div className="flex justify-between items-start">
                             <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-widest">Taxas Canceladas</p>
                                <p className="text-2xl font-black text-gray-800 dark:text-gray-200">R$ {metrics.totalCancelledValue.toFixed(2)}</p>
                             </div>
                             <span className="text-xs font-bold text-white bg-gray-400 dark:bg-gray-600 px-2 rounded-full">{metrics.totalCancelledTrips}x</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">
                             Ganhos sem rodar.
                          </p>
                       </Card>
                    </div>
                  </div>

                  {/* Custos e Lucro (Bento Grid) */}
                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                    <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Custos & Lucro (Período Atual)</h3>
                    
                    {metrics.pieData.length > 0 && (
                      <>
                        <div className="h-[200px] w-full mb-6 flex items-center justify-center relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={metrics.pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                              >
                                {metrics.pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Receita Bruta</span>
                              <span className="text-sm font-bold dark:text-white">R$ {metrics.totalRevenue.toFixed(0)}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap justify-center gap-3 mb-6">
                          {metrics.pieData.map((entry, idx) => (
                             <div key={idx} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 dark:text-gray-400">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                {entry.name}
                             </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                      {/* Top Bar - Resumo Liquido */}
                      <div className="p-5 bg-gradient-to-r from-green-600/20 to-green-600/10 border-b border-gray-800">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Lucro Líquido Final Estimado</p>
                        <div className="flex justify-between items-baseline">
                           <p className="text-3xl font-black text-white tracking-tighter">R$ {metrics.estimatedProfit.toFixed(2)}</p>
                           {metrics.totalRevenue > 0 && (
                              <div className="text-xs font-bold text-green-400 px-2 py-1 bg-green-400/10 rounded-lg">
                                 {((metrics.estimatedProfit / metrics.totalRevenue) * 100).toFixed(0)}% de Margem
                              </div>
                           )}
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-2 divide-x divide-y divide-gray-800 border-b border-gray-800 text-sm">
                         <div className="p-4 bg-gray-900/50">
                            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Combustível Trabalho</p>
                            <p className="font-bold text-gray-200">R$ {metrics.estimatedFuelCost.toFixed(2)}</p>
                         </div>
                         <div className="p-4 bg-gray-900/50">
                            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Reserva Manut. ({metrics.maintenancePercentage}%)</p>
                            <p className="font-bold text-orange-400">R$ {metrics.maintenanceCost.toFixed(2)}</p>
                         </div>
                      </div>
                      
                      <div className="p-4">
                         <div className="flex justify-between items-center text-xs">
                             <span className="text-gray-500 font-bold uppercase tracking-wide text-[10px]">Prejuízo Pessoal (Uso Fora do App)</span>
                             <span className="font-bold text-red-400 line-through">R$ {metrics.personalFuelCost.toFixed(2)}</span>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Custos Reais */}
                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                    <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6 border-transparent">Custos Reais (Últimos 30 Dias)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <FuelIcon size={16} className="text-red-600 dark:text-red-400" />
                          </div>
                          <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">Abastecimentos</p>
                        </div>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">R$ {costsMetrics.totalFuelValue30Days.toFixed(2)}</p>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">{costsMetrics.totalLiters30Days.toFixed(1)} Litros abastecidos</p>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 rounded-2xl flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <SettingsIcon size={16} className="text-orange-600 dark:text-orange-400" />
                          </div>
                          <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase">Outras Despesas</p>
                        </div>
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">R$ {costsMetrics.totalExpenses30Days.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Resumo Mensal Consolidado */}
                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                    <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Comparativo Mensal</h3>
                    <div className="p-5 border border-gray-100 dark:border-white/5 rounded-2xl bg-gray-50 dark:bg-black/20">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Faturamento Mensal</p>
                          <p className="text-2xl font-black dark:text-white mt-1">R$ {monthlySummary.currentRevenue.toFixed(2)}</p>
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold self-start sm:self-auto",
                          monthlySummary.growth >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          {monthlySummary.growth >= 0 ? <TrendingUp size={14} /> : <TrendingUp size={14} className="rotate-180" />}
                          {Math.abs(monthlySummary.growth).toFixed(1)}% {monthlySummary.growth >= 0 ? 'Maior' : 'Menor'}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                          <span className="font-medium">Atual: {monthlySummary.currentCount} turnos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-700 shrink-0" />
                          <span className="font-medium">Anterior: {monthlySummary.lastCount} turnos</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Projeção de Metas */}
                  {goalsProjection && (
                    <div className="mt-4">
                      <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-3xl p-6 relative overflow-hidden shadow-[0_10px_40px_-10px_rgba(34,197,94,0.4)]">
                        <div className="absolute -right-10 -bottom-10 opacity-10 blur-sm pointer-events-none">
                          <Target size={160} />
                        </div>
                        <h3 className="text-[11px] font-black text-green-200/80 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">🎯 Projeção de Meta Semanal</h3>
                        <div className="relative z-10 space-y-5">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-green-100 text-[10px] font-bold uppercase tracking-widest mb-1">Acumulado na Semana</p>
                              <p className="text-3xl font-black text-white">R$ {goalsProjection.weeklyRevenue.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-green-100 text-[10px] font-bold uppercase tracking-widest mb-1">Meta Semanal</p>
                              <p className="text-xl font-bold text-white/90">R$ {goalsProjection.weeklyGoal.toFixed(0)}</p>
                              {planningMetrics && (
                                <span className="text-[8px] bg-black/20 text-green-100 px-2 py-0.5 rounded-md uppercase font-bold tracking-widest mt-1.5 inline-block">Sincronizada</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="w-full bg-black/20 h-4 rounded-full overflow-hidden border border-white/10 backdrop-blur-sm relative">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (goalsProjection.weeklyRevenue / goalsProjection.weeklyGoal) * 100)}%` }}
                              className="bg-white h-full relative"
                            >
                               <div className="absolute inset-0 bg-black/10" style={{ transform: 'skewX(-20deg)', width: '200%', animation: 'slide-right 2s linear infinite' }} />
                            </motion.div>
                          </div>

                          <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="bg-white/10 p-2.5 rounded-xl text-yellow-300">
                                <Sparkles size={20} />
                              </div>
                              <div>
                                <p className="text-[10px] text-green-200 font-bold uppercase tracking-widest">Para bater a meta</p>
                                <p className="text-sm font-bold text-white mt-0.5">
                                  Precisa de <span className="text-yellow-300 bg-black/30 px-1.5 rounded">R$ {goalsProjection.requiredDaily.toFixed(2)}/dia</span>
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] text-green-200 font-bold uppercase tracking-widest">Dias Rest.</p>
                               <p className="text-xl font-black text-white leading-none mt-1">{goalsProjection.daysRemaining}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resumo de Ganhos por Hora */}
                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Análise de Horários (Ganhos)</h3>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Bloco 1: Resumo Rápido */}
                      <div className="p-5 border border-gray-100 dark:border-white/5 rounded-2xl bg-gray-50 dark:bg-black/20 flex flex-col justify-center">
                         <div className="flex items-center gap-3 mb-6">
                           <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center shrink-0">
                             <Clock size={20} className="text-green-600 dark:text-green-400" />
                           </div>
                           <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest leading-tight">Resumo de<br/>Horários</h4>
                         </div>
                         <div className="space-y-5">
                           <div className="relative pl-4">
                             <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-full" />
                             <div className="flex items-center justify-between">
                               <div>
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Melhor Horário</p>
                                 <p className="text-base font-black dark:text-gray-200">{hourlyData.best ? `${hourlyData.best.h}h - ${hourlyData.best.h + 1}h` : '--'}</p>
                               </div>
                               <div className="text-right">
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Média</p>
                                 <p className="text-base font-black text-green-600 dark:text-green-400">R$ {hourlyData.best ? hourlyData.best.val.toFixed(0) : '0'}/h</p>
                               </div>
                             </div>
                           </div>
                           <div className="relative pl-4">
                             <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-full" />
                             <div className="flex items-center justify-between">
                               <div>
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Pior Horário</p>
                                 <p className="text-base font-black dark:text-gray-200">{hourlyData.worst ? `${hourlyData.worst.h}h - ${hourlyData.worst.h + 1}h` : '--'}</p>
                               </div>
                               <div className="text-right">
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Média</p>
                                 <p className="text-base font-black text-red-500 dark:text-red-400">R$ {hourlyData.worst ? hourlyData.worst.val.toFixed(0) : '0'}/h</p>
                               </div>
                             </div>
                           </div>
                         </div>
                      </div>
                      
                      {/* Bloco 2: Gráfico de Barras e Contexto */}
                      <div className="p-5 border border-gray-100 dark:border-white/5 rounded-2xl bg-gray-50 dark:bg-black/20 lg:col-span-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2"><Activity size={12} /> Evolução por Hora (R$/h)</p>
                            <p className="text-xs font-bold text-gray-500">{hourlyData.insightMsg}</p>
                          </div>
                        </div>
                        <div className="h-[200px] w-full pt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={hourlyData.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                              <XAxis dataKey="hrString" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }} dy={10} interval="preserveStartEnd" minTickGap={10} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }} tickFormatter={(v) => `R$${v}`} />
                              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-gray-900 border border-gray-800 text-white p-4 rounded-xl shadow-2xl backdrop-blur-xl">
                                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{data.hrString} às {data.hour+1}h</p>
                                      <p className="text-xl font-black text-white">R$ {data.val.toFixed(2)}<span className="text-xs font-bold text-gray-500">/h</span></p>
                                      <p className={cn("text-[10px] font-bold mt-2", data.val > hourlyData.generalAvg ? "text-green-400" : "text-yellow-500")}>
                                        {data.val > hourlyData.generalAvg ? 'Acima' : 'Abaixo'} da sua média (R$ {hourlyData.generalAvg.toFixed(0)})
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}/>
                              <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                                {hourlyData.data.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tendência de Consumo */}
                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4 mb-4">
                      <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Tendência de Consumo</h3>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                         <div>
                           <div className="flex items-center gap-2 mb-2">
                             <div className="bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 p-2 rounded-xl">
                               <Activity size={18} className="text-gray-600 dark:text-gray-400" />
                             </div>
                             <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">EFICÁCIA RECENTE</h4>
                           </div>
                           <p className="text-2xl font-black dark:text-white mt-1">{consumptionTrendConfig.generalAvg.toFixed(1)} <span className="text-xs font-bold text-gray-400">KM/L (Média)</span></p>
                           <p className="text-xs font-bold mt-1.5 text-gray-500">{consumptionTrendConfig.insightMsg}</p>
                         </div>
                      </div>

                      {consumptionTrendConfig.data.length > 1 ? (
                        <div className="h-[200px] w-full mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={consumptionTrendConfig.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }} dy={10} minTickGap={10} />
                              <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }} tickFormatter={(v) => v.toFixed(1)} />
                              <Tooltip cursor={{ stroke: '#4B5563', strokeWidth: 1, strokeDasharray: '3 3' }} content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const isBest = data.date === consumptionTrendConfig.bestDate;
                                  const isWorst = data.date === consumptionTrendConfig.worstDate;
                                  return (
                                    <div className="bg-gray-900 border border-gray-800 text-white p-4 rounded-xl shadow-2xl backdrop-blur-xl">
                                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{data.date}</p>
                                      <p className="text-xl font-black text-green-400">{data.kmL.toFixed(1)} <span className="text-[10px] font-medium text-gray-400">km/L</span></p>
                                      {(isBest || isWorst) && (
                                         <p className={cn("text-[10px] font-bold mt-2", isBest ? "text-green-400" : "text-red-400")}>
                                           {isBest ? '⭐ Melhor Consumo' : '⚠️ Pior Consumo'}
                                         </p>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              }}/>
                              <Line type="monotone" dataKey={() => consumptionTrendConfig.generalAvg} stroke="#9CA3AF" strokeDasharray="3 3" strokeWidth={1} dot={false} activeDot={false} />
                              <Line type="monotone" dataKey="kmL" stroke="#3B82F6" strokeWidth={3} dot={(props: any) => {
                                 const { cx, cy, payload } = props;
                                 const isBest = payload.date === consumptionTrendConfig.bestDate;
                                 const isWorst = payload.date === consumptionTrendConfig.worstDate;
                                 if (isBest) return <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={6} fill="#22c55e" stroke="#fff" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' }} />;
                                 if (isWorst) return <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
                                 return <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={3} fill="#3B82F6" stroke="#fff" strokeWidth={1} />;
                              }} activeDot={{ r: 6, fill: '#60A5FA', stroke: '#fff', strokeWidth: 2 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 mt-4">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center px-4">Dados insuficientes para gerar a tendência<br/><span className="text-[9px] text-gray-500 mt-1 block">Mínimo de 2 dias na janela selecionada.</span></p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                    <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Perfil de Corridas</h3>
                    <div className="p-5 border border-gray-100 dark:border-white/5 rounded-2xl bg-gray-50 dark:bg-black/20">
                        <div className="flex justify-between items-center mb-6">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Baseado no seu Histórico</p>
                          <div className="bg-white dark:bg-gray-800 shadow-sm p-2 rounded-xl">
                            <MapPin size={18} className="text-gray-600 dark:text-gray-400" />
                          </div>
                        </div>
                        
                        <div className="space-y-5">
                          {[
                            { label: 'Curtas (< 5km)', val: tripProfile.shortPerc, avg: tripProfile.shortAvgVal, color: 'bg-green-400' },
                            { label: 'Médias (5-12km)', val: tripProfile.mediumPerc, avg: tripProfile.mediumAvgVal, color: 'bg-green-600' },
                            { label: 'Longas (> 12km)', val: tripProfile.longPerc, avg: tripProfile.longAvgVal, color: 'bg-green-800' }
                          ].map(p => (
                            <div key={p.label} className="space-y-2">
                              <div className="flex justify-between text-[10px] items-end">
                                <div className="space-y-1">
                                  <span className="block font-black uppercase text-gray-500 tracking-widest">{p.label}</span>
                                  <span className="text-gray-400 dark:text-gray-500 font-bold tracking-widest">
                                    MÉDIA: R$ {p.avg.toFixed(2)}
                                  </span>
                                </div>
                                <span className="text-sm font-black dark:text-gray-200">{p.val.toFixed(0)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden shadow-inner">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${p.val}%` }}
                                  className={cn("h-full", p.color)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                  {/* Top Turnos - Ranking */}
                  <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6 mt-4">
                    <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">🏆 Hall da Fama (Mês Atual)</h3>
                    <div className="p-5 border border-gray-100 dark:border-white/5 rounded-2xl bg-gray-50 dark:bg-black/20">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
                        {/* Melhor Faturamento */}
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5 border-b border-green-200 dark:border-green-900/30 pb-2"><DollarSign size={12}/> Top Faturamento</p>
                          <div className="space-y-3">
                            {topShifts.revenue.length === 0 ? (
                              <p className="text-[11px] font-bold text-gray-400 text-center py-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">Sem dados no mês</p>
                            ) : topShifts.revenue.map((s, i) => (
                              <div key={s.id} className="bg-white dark:bg-gray-900 shadow-sm rounded-xl p-3 flex items-center justify-between border border-gray-100 dark:border-gray-800 transition-transform hover:-translate-y-0.5">
                                <div className="flex items-center gap-3">
                                  <span className={cn(
                                    "w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black shadow-inner",
                                    i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : "bg-orange-100 text-orange-700"
                                  )}>{i+1}º</span>
                                  <span className="text-[11px] font-bold text-gray-500">{format(ensureDate(s.startTime), 'dd/MM')}</span>
                                </div>
                                <p className="text-sm font-black text-green-600 dark:text-green-400">R$ {s.totalRevenue.toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Melhor R$/Hora */}
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5 border-b border-green-200 dark:border-green-900/30 pb-2"><Clock size={12}/> Top R$ / Hora</p>
                          <div className="space-y-3">
                            {topShifts.rph.length === 0 ? (
                              <p className="text-[11px] font-bold text-gray-400 text-center py-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">Sem dados no mês</p>
                            ) : topShifts.rph.map((s, i) => (
                              <div key={s.id} className="bg-white dark:bg-gray-900 shadow-sm rounded-xl p-3 flex items-center justify-between border border-gray-100 dark:border-gray-800 transition-transform hover:-translate-y-0.5">
                                <div className="flex items-center gap-3">
                                  <span className={cn(
                                    "w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black shadow-inner",
                                    i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : "bg-orange-100 text-orange-700"
                                  )}>{i+1}º</span>
                                  <span className="text-[11px] font-bold text-gray-500">{format(ensureDate(s.startTime), 'dd/MM')}</span>
                                </div>
                                <p className="text-sm font-black text-green-600 dark:text-green-400">R$ {(s.totalRevenue / (s.activeTimeSeconds / 3600)).toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Melhor R$/KM */}
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5 border-b border-purple-200 dark:border-purple-900/30 pb-2"><MapPin size={12}/> Top R$ / KM</p>
                          <div className="space-y-3">
                            {topShifts.rpkm.length === 0 ? (
                              <p className="text-[11px] font-bold text-gray-400 text-center py-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">Sem dados no mês</p>
                            ) : topShifts.rpkm.map((s, i) => {
                              const km = s.totalWorkKm || (s.endKm - s.startKm);
                              return (
                                <div key={s.id} className="bg-white dark:bg-gray-900 shadow-sm rounded-xl p-3 flex items-center justify-between border border-gray-100 dark:border-gray-800 transition-transform hover:-translate-y-0.5">
                                  <div className="flex items-center gap-3">
                                    <span className={cn(
                                      "w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black shadow-inner",
                                      i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : "bg-orange-100 text-orange-700"
                                    )}>{i+1}º</span>
                                    <span className="text-[11px] font-bold text-gray-500">{format(ensureDate(s.startTime), 'dd/MM')}</span>
                                  </div>
                                  <p className="text-sm font-black text-purple-600 dark:text-purple-400">R$ {(km > 0 ? s.totalRevenue / km : 0).toFixed(2)}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Analysis */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 ml-1">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Análise Inteligente</h3>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto text-green-600 text-xs font-bold flex items-center gap-1 self-start sm:self-auto"
                        onClick={generateAiReport}
                        disabled={isGeneratingAi}
                      >
                        <Sparkles size={14} className={isGeneratingAi ? "animate-pulse" : ""} />
                        {isGeneratingAi ? "Analisando..." : "Gerar Nova Análise"}
                      </Button>
                    </div>

                    <AnimatePresence>
                      {aiReport && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-3xl p-6 relative overflow-hidden transition-colors"
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Sparkles size={40} className="text-green-600 dark:text-green-400" />
                          </div>
                          <div className="prose prose-sm max-w-none text-green-900 dark:text-green-100 font-medium leading-relaxed markdown-body">
                            <Markdown>{aiReport}</Markdown>
                          </div>
                          <Button variant="ghost" className="mt-4 text-xs text-green-600 p-0" onClick={() => setAiReport(null)}>Fechar</Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold dark:text-white">Configurações</h2>
              {settings && (
                <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col p-6">
                  <SettingsForm 
                    settings={settings} 
                    onSubmit={updateSettings} 
                    onBackup={exportAllDataToJSON}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-2 sm:px-6 pt-3 flex justify-between items-center z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] transition-colors pb-safe">
        <NavButton active={activeTab === 'operation'} onClick={() => setActiveTab('operation')} icon={Play} label="Turno" />
        <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={History} label="Histórico" />
        <NavButton active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} icon={Wallet} label="Meu Caixa" />
        <NavButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={BarChart3} label="Insights" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={SettingsIcon} label="Ajustes" />
      </nav>

      {/* Modals */}
      <Modal isOpen={showExpensesDetailsModal} onClose={() => setShowExpensesDetailsModal(false)} title="Detalhamento de Despesas do Mês">
        <div className="space-y-6">
           <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl flex items-center justify-between border border-red-100 dark:border-red-800/50">
             <div>
               <p className="text-[10px] text-red-600/70 dark:text-red-400/70 font-black uppercase tracking-widest mb-1">Total Estimado</p>
               <p className="text-2xl font-black text-red-700 dark:text-red-400">R$ {planningMetrics ? (planningMetrics.estimatedFuelCostRemaining + planningMetrics.totalFixed + planningMetrics.totalExtraExpenses).toFixed(2) : '0.00'}</p>
             </div>
             <Wallet size={32} className="text-red-300 dark:text-red-800" />
           </div>

           <div className="space-y-4">
             <div className="space-y-2">
               <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Estimativa Combustível (Restante do Mês)</h4>
               <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex justify-between items-center">
                 <div className="flex items-center gap-3">
                   <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-lg text-orange-600 dark:text-orange-400"><TrendingUp size={16} /></div>
                   <div>
                     <p className="font-bold text-sm dark:text-white">Combustível</p>
                     <p className="text-[10px] text-gray-500 font-medium">Base p/ alcançar a meta calculada</p>
                   </div>
                 </div>
                 <p className="font-bold text-gray-900 dark:text-white">R$ {planningMetrics?.estimatedFuelCostRemaining.toFixed(2) || '0.00'}</p>
               </div>
             </div>

             <div className="space-y-2">
               <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Contas Fixas (Ativas)</h4>
               {fixedExpenses.filter(fe => fe.active).length === 0 ? (
                 <p className="text-xs text-gray-500 pl-1">Nenhuma conta fixa ativa.</p>
               ) : (
                 fixedExpenses.filter(fe => fe.active).map(fe => (
                   <div key={fe.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex justify-between items-center">
                     <div className="flex items-center gap-3">
                       <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded-lg text-green-600 dark:text-green-400"><Calendar size={16} /></div>
                       <div>
                         <p className="font-bold text-sm dark:text-white">{fe.name}</p>
                         <p className="text-[10px] text-gray-500 font-medium">Venc. Dia {fe.dueDay}</p>
                       </div>
                     </div>
                     <p className="font-bold text-gray-900 dark:text-white">R$ {fe.amount.toFixed(2)}</p>
                   </div>
                 ))
               )}
             </div>

             <div className="space-y-2">
               <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Despesas Avulsas (Este Mês)</h4>
               {expenses.filter(e => {
                  const d = e.date ? ensureDate(e.date) : new Date();
                  const currentMonthStr = format(new Date(), 'yyyy-MM');
                  return format(d, 'yyyy-MM') === currentMonthStr;
               }).length === 0 ? (
                 <p className="text-xs text-gray-500 pl-1">Nenhuma despesa extra lançada este mês.</p>
               ) : (
                 expenses.filter(e => {
                  const d = e.date ? ensureDate(e.date) : new Date();
                  const currentMonthStr = format(new Date(), 'yyyy-MM');
                  return format(d, 'yyyy-MM') === currentMonthStr;
                 }).map(e => (
                   <div key={e.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex justify-between items-center">
                     <div className="flex items-center gap-3">
                       <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-lg text-red-600 dark:text-red-400"><FileText size={16} /></div>
                       <div>
                         <p className="font-bold text-sm dark:text-white">{e.category}</p>
                         <p className="text-[10px] text-gray-500 font-medium">{format(ensureDate(e.date), "dd/MM/yyyy")}</p>
                       </div>
                     </div>
                     <p className="font-bold text-gray-900 dark:text-white">R$ {e.value.toFixed(2)}</p>
                   </div>
                 ))
               )}
             </div>
           </div>
        </div>
      </Modal>

      <Modal isOpen={showAiAnalysisModal} onClose={() => setShowAiAnalysisModal(false)} title="Análise de IA">
        <div className="space-y-6">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl flex items-center gap-3 border border-green-100 dark:border-green-800/50">
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl text-green-600 dark:text-green-400">
              <Sparkles size={18} />
            </div>
            <p className="text-xs text-green-800 dark:text-green-200 font-medium">
              Escolha um período e pergunte qualquer coisa sobre seu histórico de trabalho.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-widest text-gray-400 dark:text-gray-500 ml-1">Período de Análise</label>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                  {(['day', 'week', 'month'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setAnalysisFilter(f)}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                        analysisFilter === f ? "bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-sm" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                      )}
                    >
                      {f === 'day' ? 'Dia' : f === 'week' ? 'Semana' : 'Mês'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-widest text-gray-400 dark:text-gray-500 ml-1">Referência</label>
                <input 
                  type="date" 
                  value={selectedAnalysisDate}
                  onChange={(e) => setSelectedAnalysisDate(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-xl p-2 text-xs font-bold dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black tracking-widest text-gray-400 dark:text-gray-500 ml-1">Sua Pergunta</label>
              <textarea 
                placeholder="Ex: Como foi minha semana? O que posso melhorar? Quais corridas foram ruins?"
                value={analysisQuery}
                onChange={(e) => setAnalysisQuery(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-2xl p-4 text-sm dark:text-white h-24 focus:ring-2 focus:ring-green-500 transition-all resize-none"
              />
            </div>

            <Button 
              onClick={handleHistoryAIAnalysis}
              disabled={isAnalyzing || !analysisQuery.trim()}
              className="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Gerar Análise</span>
                </>
              )}
            </Button>
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-2">Exemplos de perguntas:</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Como faturar mais?",
                "Sugestão de horários",
                "Faltou quanto p/ meta?",
                "Análise de lucro"
              ].map(q => (
                <button
                  key={q}
                  onClick={() => setAnalysisQuery(q)}
                  className="bg-gray-100 dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 text-[10px] font-bold py-1 px-3 rounded-lg text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showComparisonModal} onClose={() => setShowComparisonModal(false)} title="Comparativo de Desempenho">
        {historyComparisonData && historyComparisonData.current ? (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl flex flex-col gap-1 border border-gray-100 dark:border-gray-800">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center mb-4">Visão Geral: {periodRangeLabel.type}</p>
              
              <div className="grid grid-cols-1 gap-4">
                <ComparisonCard 
                  title="Total Faturado"
                  icon={<DollarSign size={16} />}
                  current={historyComparisonData.current.revenue}
                  prev={historyComparisonData.previous.revenue}
                  avg={historyComparisonData.average.revenue}
                  format={(v: number) => `R$ ${v.toFixed(2)}`}
                  labelPrev={historyComparisonData.labelPrev}
                  labelAvg={historyComparisonData.labelAvg}
                  higherIsBetter={true}
                />
                <ComparisonCard 
                  title="R$/Hora Médio"
                  icon={<Activity size={16} />}
                  current={historyComparisonData.current.rph}
                  prev={historyComparisonData.previous.rph}
                  avg={historyComparisonData.average.rph}
                  format={(v: number) => `R$ ${v.toFixed(2)}/h`}
                  labelPrev={historyComparisonData.labelPrev}
                  labelAvg={historyComparisonData.labelAvg}
                  higherIsBetter={true}
                />
                <ComparisonCard 
                  title="R$/KM Médio"
                  icon={<MapPin size={16} />}
                  current={historyComparisonData.current.rpkm}
                  prev={historyComparisonData.previous.rpkm}
                  avg={historyComparisonData.average.rpkm}
                  format={(v: number) => `R$ ${v.toFixed(2)}/km`}
                  labelPrev={historyComparisonData.labelPrev}
                  labelAvg={historyComparisonData.labelAvg}
                  higherIsBetter={true}
                />
                <ComparisonCard 
                  title="Horas de Direção"
                  icon={<Clock size={16} />}
                  current={historyComparisonData.current.time}
                  prev={historyComparisonData.previous.time}
                  avg={historyComparisonData.average.time}
                  format={(v: number) => `${Math.floor(v/3600)}h${Math.floor((v%3600)/60).toString().padStart(2, '0')}m`}
                  labelPrev={historyComparisonData.labelPrev}
                  labelAvg={historyComparisonData.labelAvg}
                  higherIsBetter={true}
                />
              </div>
            </div>
            
            {(periodFilter === 'week' && planningMetrics) && (
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 p-4 rounded-2xl">
                 <p className="text-[10px] text-green-700 dark:text-green-400 font-black uppercase tracking-widest mb-2 flex items-center justify-between"><span>Progresso da Meta Mensal</span> <span>{Math.min(100, (planningMetrics.revenueSoFar / planningMetrics.revenueNeededTotal) * 100).toFixed(1)}%</span></p>
                 <div className="w-full bg-green-200 dark:bg-green-900/40 h-2.5 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-green-500 transition-all duration-1000"
                      style={{ width: `${Math.min(100, (planningMetrics.revenueSoFar / Math.max(1, planningMetrics.revenueNeededTotal)) * 100)}%` }}
                    />
                 </div>
                 <p className="text-xs text-green-800 dark:text-green-300 font-medium mt-3">Você faturou <strong>R$ {planningMetrics.revenueSoFar.toFixed(2)}</strong> do objetivo total de <strong>R$ {planningMetrics.revenueNeededTotal.toFixed(2)}</strong>.</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-gray-500 py-10">Dados insuficientes para comparação.</p>
        )}
      </Modal>

      <Modal isOpen={showAiResultModal} onClose={() => setShowAiResultModal(false)} title="Insights da IA">
        <div className="space-y-6">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl flex items-center gap-3 border border-green-100 dark:border-green-800/50">
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl text-green-600 dark:text-green-400">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-green-600 dark:text-green-400">Análise Concluída</p>
              <p className="text-xs text-green-800 dark:text-green-200 font-medium">
                {analysisFilter === 'day' ? 'Relatório Diário' : analysisFilter === 'week' ? 'Relatório Semanal' : 'Relatório Mensal'}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 transition-colors">
            <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 font-medium leading-relaxed markdown-body">
              <Markdown>{analysisResult || ''}</Markdown>
            </div>
          </div>

          <div className="flex gap-3">
             <Button variant="outline" className="flex-1" onClick={() => setShowAiResultModal(false)}>Fechar</Button>
             <Button className="flex-1" onClick={() => { setShowAiResultModal(false); setShowAiAnalysisModal(true); }}>Nova Pergunta</Button>
          </div>

          <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 uppercase font-bold tracking-tight">
            Esta análise é baseada exclusivamente nos dados do seu histórico.
          </p>
        </div>
      </Modal>

      <Modal isOpen={showStartModal} onClose={() => setShowStartModal(false)} title="Iniciar Turno">
        <StartShiftForm onSubmit={startShift} initialKm={lastRecordedKm} />
      </Modal>

      <Modal isOpen={showPauseModal} onClose={() => setShowPauseModal(false)} title="Pausar Turno">
        <PauseShiftForm onSubmit={pauseShift} currentRevenue={activeShift?.totalRevenue || 0} initialKm={lastRecordedKm} />
      </Modal>

      <Modal isOpen={showResumeModal} onClose={() => setShowResumeModal(false)} title="Retomar Turno">
        <ResumeShiftForm onSubmit={resumeShift} />
      </Modal>

      <Modal isOpen={showFinishModal} onClose={() => setShowFinishModal(false)} title="Finalizar Turno">
        <FinishShiftForm 
          currentRevenue={activeShift?.totalRevenue || 0} 
          initialKm={lastRecordedKm}
          todayTripsSoFar={todayMetrics.totalTrips - (activeShift?.totalTrips || 0)}
          currentShiftTrips={activeShift?.totalTrips || 0}
          onSubmit={(km, autonomy, avgCons, revenue, trips) => finishShift(km, autonomy, avgCons, revenue, trips)} 
        />
      </Modal>

      <Modal isOpen={showQuickTripModal} onClose={() => setShowQuickTripModal(false)} title="Registrar Corrida">
        <QuickTripForm onSubmit={registerQuickTrip} />
      </Modal>

      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Novo Gasto">
        <ExpenseForm onSubmit={addExpense} />
      </Modal>

      <Modal isOpen={showFuelModal} onClose={() => setShowFuelModal(false)} title="Abastecimento">
        <FuelForm onSubmit={addFuel} />
      </Modal>

      <Modal isOpen={showShiftFuelModal} onClose={() => setShowShiftFuelModal(false)} title="Abastecer no Turno">
        <ShiftFuelForm onSubmit={addShiftFuel} />
      </Modal>

      <Modal isOpen={showPartialRevenueModal} onClose={() => setShowPartialRevenueModal(false)} title="Faturamento Parcial">
        <PartialRevenueForm onSubmit={updatePartialRevenue} currentRevenue={activeShift?.totalRevenue || 0} initialKm={lastRecordedKm} />
      </Modal>

      <Modal isOpen={showPastShiftModal} onClose={() => setShowPastShiftModal(false)} title="Registrar Turno Passado">
        <PastShiftForm onSubmit={addPastShift} />
      </Modal>

      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Importar Histórico">
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl text-sm text-green-800 dark:text-green-200">
            <p className="font-bold mb-2">Como importar seus dados:</p>
            <p className="mb-2">Cole na caixa abaixo os dados dos seus turnos anteriores. A inteligência artificial do app vai ler o texto e cadastrar tudo automaticamente.</p>
            <p><strong>Dica:</strong> Se você exportou os dados deste app anteriormente, basta abrir o arquivo CSV, copiar todo o conteúdo e colar aqui. O formato será reconhecido perfeitamente!</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dados para Importação</label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white h-48 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
              placeholder="Cole seus dados aqui..."
            />
          </div>
          <Button 
            onClick={handleImportData} 
            disabled={isImportingData || !importText.trim()} 
            className="w-full py-4"
          >
            {isImportingData ? 'Analisando Dados...' : 'Analisar e Importar'}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showImportPreviewModal} onClose={() => setShowImportPreviewModal(false)} title="Pré-visualização da Importação">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            A inteligência artificial encontrou <strong>{parsedImportData?.length || 0}</strong> turnos. Verifique os dados abaixo antes de salvar.
          </p>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {parsedImportData?.map((shift, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between font-bold mb-2">
                  <span className="dark:text-white">{format(new Date(shift.startTime), 'dd/MM/yyyy')}</span>
                  <span className="text-green-600 dark:text-green-400">R$ {Number(shift.totalRevenue).toFixed(2)}</span>
                </div>
                <div className="text-gray-600 dark:text-gray-400 grid grid-cols-2 gap-2 text-xs">
                  <span>Início: {format(new Date(shift.startTime), 'HH:mm')}</span>
                  <span>Fim: {shift.endTime ? format(new Date(shift.endTime), 'HH:mm') : '--'}</span>
                  <span>KM Rodado: {shift.totalWorkKm} km</span>
                  <span>Corridas: {shift.trips?.length || 0}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={() => {
                setShowImportPreviewModal(false);
                setShowImportModal(true);
              }} 
              variant="outline" 
              className="flex-1"
              disabled={isImportingData}
            >
              Voltar
            </Button>
            <Button 
              onClick={confirmImportData} 
              disabled={isImportingData} 
              className="flex-1"
            >
              {isImportingData ? 'Salvando...' : 'Confirmar e Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEditShiftModal} onClose={() => { setShowEditShiftModal(false); setEditingShift(null); }} title="Editar Turno">
        {editingShift && (
          <PastShiftForm 
            initialData={editingShift} 
            onSubmit={(start, end, startKm, endKm, revenue, trips, avgCons, activeSecs) => 
              updateShift(editingShift.id, {
                startTime: Timestamp.fromDate(start),
                endTime: Timestamp.fromDate(end),
                startKm,
                endKm,
                totalRevenue: revenue,
                totalTrips: trips,
                avgConsumption: avgCons,
                activeTimeSeconds: activeSecs
              })
            } 
            onDelete={() => deleteShift(editingShift.id)}
          />
        )}
      </Modal>

      <Modal isOpen={showEditExpenseModal} onClose={() => { setShowEditExpenseModal(false); setEditingExpense(null); }} title="Editar Despesa">
        {editingExpense && (
          <ExpenseForm 
            initialData={editingExpense}
            onSubmit={(date, cat, val, km) => updateExpense(editingExpense.id, { date: Timestamp.fromDate(date), category: cat, value: val, kmAtExpense: km })}
            onDelete={() => deleteExpense(editingExpense.id)}
          />
        )}
      </Modal>

      <Modal isOpen={showEditFuelModal} onClose={() => { setShowEditFuelModal(false); setEditingFuel(null); }} title="Editar Abastecimento">
        {editingFuel && (
          <FuelForm 
            initialData={editingFuel}
            onSubmit={(date, km, price, total) => updateFuel(editingFuel.id, { date: Timestamp.fromDate(date), km, pricePerLiter: price, totalValue: total, liters: total / price })}
            onDelete={() => deleteFuel(editingFuel.id)}
          />
        )}
      </Modal>

      <Modal isOpen={showFixedExpenseModal} onClose={() => { setShowFixedExpenseModal(false); setEditingFixedExpense(null); }} title={editingFixedExpense ? "Editar Conta Fixa" : "Nova Conta Fixa"}>
        <FixedExpenseForm 
          initialData={editingFixedExpense} 
          onSubmit={(name, amount, dueDay) => 
            editingFixedExpense 
              ? updateFixedExpense(editingFixedExpense.id, name, amount, dueDay) 
              : addFixedExpense(name, amount, dueDay)
          } 
          onDelete={editingFixedExpense ? () => deleteFixedExpense(editingFixedExpense.id) : undefined}
        />
      </Modal>

      <Modal isOpen={showWithdrawalModal} onClose={() => setShowWithdrawalModal(false)} title="Novo Saque">
        <WithdrawalForm onSubmit={addWithdrawal} platformBalance={settings?.platformBalance || 0} />
      </Modal>

      <Modal isOpen={showUpdateBalanceModal} onClose={() => setShowUpdateBalanceModal(false)} title="Atualizar Saldo">
        <UpdateBalanceForm onSubmit={updatePlatformBalance} currentBalance={settings?.platformBalance || 0} />
      </Modal>

      <Modal isOpen={showMonthlyGoalModal} onClose={() => setShowMonthlyGoalModal(false)} title="Definir Meta de Lucro">
        <MonthlyGoalForm 
          currentGoal={settings?.monthlyNetGoal || 2000} 
          currentWorkDays={settings?.workDays || [1, 2, 3, 4, 5, 6]}
          onSubmit={async (newGoal, newWorkDays) => {
            if (user) {
               await updateSettings({ monthlyNetGoal: newGoal, workDays: newWorkDays });
            }
            setShowMonthlyGoalModal(false);
          }} 
        />
      </Modal>

      <Modal isOpen={showTripModal} onClose={() => { setShowTripModal(false); setInitialTripIdForSequentialForm(null); }} title="Adicionar / Editar Corridas">
        {selectedShiftId && (
          <SequentialTripForm 
            shift={shifts.find(s => s.id === selectedShiftId)!}
            existingTrips={shiftTrips[selectedShiftId] || []}
            initialTripId={initialTripIdForSequentialForm}
            onClose={() => { setShowTripModal(false); setInitialTripIdForSequentialForm(null); }}
            onSave={async (tripId, data) => {
              const currentShift = shifts.find(s => s.id === selectedShiftId);
              if (!currentShift) return;
              
              const batch = writeBatch(db);

              if (tripId) {
                batch.update(doc(db, 'shifts', selectedShiftId, 'trips', tripId), {
                  value: data.value,
                  dynamicValue: data.dynamicValue,
                  durationSeconds: data.durationSeconds,
                  distanceKm: data.distanceKm,
                  startTime: data.startTime ? Timestamp.fromDate(data.startTime) : null,
                  isCancelled: data.isCancelled || false
                });
              } else {
                const newTripRef = doc(collection(db, 'shifts', selectedShiftId, 'trips'));
                batch.set(newTripRef, {
                  userId: user?.uid,
                  shiftId: selectedShiftId,
                  value: data.value,
                  dynamicValue: data.dynamicValue,
                  durationSeconds: data.durationSeconds,
                  distanceKm: data.distanceKm,
                  timestamp: serverTimestamp(),
                  startTime: data.startTime ? Timestamp.fromDate(data.startTime) : null,
                  isCancelled: data.isCancelled || false
                });
                // DONT update Shift's total trips or revenue. User manages shift totals independently of detailed trips.
              }

              await batch.commit();
            }}
            onDelete={async (tripId) => {
              const currentShift = shifts.find(s => s.id === selectedShiftId);
              if (!currentShift) return;

              const batch = writeBatch(db);
              
              batch.delete(doc(db, 'shifts', selectedShiftId, 'trips', tripId));
              // DONT update Shift's total trips or revenue. User manages shift totals independently of detailed trips.
              
              await batch.commit();
            }}
          />
        )}
      </Modal>

      <Modal isOpen={!!tripToDelete} onClose={() => setTripToDelete(null)} title="Excluir Corrida">
        <div className="space-y-6">
          <p className="text-gray-600 dark:text-gray-400 text-center">
            Tem certeza que deseja excluir esta corrida? Esta ação não pode ser desfeita.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setTripToDelete(null)} className="w-full">Cancelar</Button>
            <Button 
              onClick={() => {
                if (tripToDelete) {
                  deleteTrip(tripToDelete.shiftId, tripToDelete.tripId);
                  setTripToDelete(null);
                }
              }} 
              variant="danger" 
              className="w-full"
            >
              Sim, Excluir
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!shiftToDeleteAllTrips} onClose={() => setShiftToDeleteAllTrips(null)} title="Excluir Todas as Corridas">
        <div className="space-y-6">
          <p className="text-gray-600 dark:text-gray-400 text-center">
            Tem certeza que deseja excluir <strong>todas</strong> as corridas detalhadas deste turno? Esta ação não pode ser desfeita.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setShiftToDeleteAllTrips(null)} className="w-full">Cancelar</Button>
            <Button 
              onClick={() => {
                if (shiftToDeleteAllTrips) {
                  deleteAllTrips(shiftToDeleteAllTrips);
                  setShiftToDeleteAllTrips(null);
                }
              }} 
              variant="danger" 
              className="w-full"
            >
              Sim, Excluir Todas
            </Button>
          </div>
        </div>
      </Modal>



    </div>
  );
}

// --- Helper Components ---

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300 px-1 sm:px-2",
        active ? "text-green-600 scale-110" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
      )}
    >
      <Icon size={22} className="sm:w-6 sm:h-6" strokeWidth={active ? 2.5 : 2} />
      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-green-600 rounded-full mt-0.5" />}
    </button>
  );
}

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl transition-colors max-h-[90dvh] flex flex-col"
      >
        <div className="w-12 h-1.5 shrink-0 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden" />
        <h3 className="text-2xl shrink-0 font-bold mb-6 tracking-tight dark:text-white">{title}</h3>
        <div className="overflow-y-auto -mx-2 px-2 pb-safe">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// --- Forms ---

function StartShiftForm({ onSubmit, initialKm }: { onSubmit: (km: number, autonomy: number) => void, initialKm: number }) {
  const [km, setKm] = useState(initialKm ? initialKm.toString() : '');
  const [autonomy, setAutonomy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Input label="KM Total do Painel" type="number" inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} placeholder="Ex: 45000" />
      <Input label="Autonomia Restante (KM)" type="number" inputMode="numeric" value={autonomy} onChange={e => setAutonomy(e.target.value)} placeholder="Ex: 185" />
      <Button 
        onClick={async () => {
          setIsSubmitting(true);
          try {
            await onSubmit(Number(km), Number(autonomy));
          } finally {
            setIsSubmitting(false);
          }
        }} 
        disabled={isSubmitting || !km}
        className="w-full py-4"
      >
        {isSubmitting ? 'Iniciando...' : 'Iniciar Agora'}
      </Button>
    </div>
  );
}

function QuickTripForm({ onSubmit }: { onSubmit: (value: number) => void }) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  return (
    <div className="space-y-6">
      <CurrencyInput label="Valor Estimado da Corrida (R$)" value={value} onValueChange={setValue} />
      <Button 
        onClick={async () => {
          setIsSubmitting(true);
          try {
            await onSubmit(Number(value));
          } finally {
            setIsSubmitting(false);
          }
        }} 
        className="w-full py-4 bg-green-600 hover:bg-green-500 text-white"
        disabled={!value || Number(value) <= 0 || isSubmitting}
      >
        {isSubmitting ? 'Salvando...' : 'Salvar Nova Corrida'}
      </Button>
    </div>
  );
}

function PauseShiftForm({ onSubmit, currentRevenue, initialKm }: { onSubmit: (revenue: number, km: number, autonomy: number) => void, currentRevenue: number, initialKm: number }) {
  const [revenue, setRevenue] = useState(currentRevenue?.toString() || '0');
  const [km, setKm] = useState(initialKm ? initialKm.toString() : '');
  const [autonomy, setAutonomy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <CurrencyInput label="Faturamento Parcial (R$)" value={revenue} onValueChange={setRevenue} />
      <Input label="KM Atual" type="number" inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} />
      <Input label="Autonomia Restante (KM)" type="number" inputMode="numeric" value={autonomy} onChange={e => setAutonomy(e.target.value)} />
      <Button 
        onClick={async () => {
          setIsSubmitting(true);
          try {
             await onSubmit(Number(revenue), Number(km), Number(autonomy));
          } finally {
             setIsSubmitting(false);
          }
        }} 
        disabled={isSubmitting || !km}
        className="w-full py-4"
      >
        {isSubmitting ? 'Pausando...' : 'Pausar Turno'}
      </Button>
    </div>
  );
}

function ResumeShiftForm({ onSubmit }: { onSubmit: (km?: number, autonomy?: number) => void }) {
  const [moved, setMoved] = useState<boolean | null>(null);
  const [km, setKm] = useState('');
  const [autonomy, setAutonomy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (moved === null) {
    return (
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400 font-medium">O veículo rodou durante a pausa?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button variant="outline" onClick={() => setMoved(false)}>Não</Button>
          <Button onClick={() => setMoved(true)}>Sim</Button>
        </div>
      </div>
    );
  }

  if (moved === false) {
    return (
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400">Apenas retomando o cronômetro...</p>
        <Button 
          onClick={async () => {
             setIsSubmitting(true);
             try {
                await onSubmit();
             } finally {
                setIsSubmitting(false);
             }
          }} 
          disabled={isSubmitting}
          className="w-full py-4"
        >
          {isSubmitting ? 'Retomando...' : 'Confirmar Retomada'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Input label="Nova KM" type="number" value={km} onChange={e => setKm(e.target.value)} />
      <Input label="Nova Autonomia (KM)" type="number" value={autonomy} onChange={e => setAutonomy(e.target.value)} />
      <Button 
        onClick={async () => {
           setIsSubmitting(true);
           try {
              await onSubmit(Number(km), Number(autonomy));
           } finally {
              setIsSubmitting(false);
           }
        }} 
        disabled={!km || isSubmitting} 
        className="w-full py-4"
      >
        {isSubmitting ? 'Retomando...' : 'Retomar Turno'}
      </Button>
    </div>
  );
}

function PartialRevenueForm({ onSubmit, currentRevenue, initialKm }: { onSubmit: (revenue: number, km: number) => void, currentRevenue: number, initialKm: number }) {
  const [revenue, setRevenue] = useState(currentRevenue > 0 ? currentRevenue.toString() : '');
  const [km, setKm] = useState('');

  // Use initialKm when modal opens if "km" is empty, but we let the user edit
  useEffect(() => {
    if (!km && initialKm) {
        setKm(initialKm.toString());
    }
  }, [initialKm, km]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRevenue = revenue === '' ? currentRevenue : Number(revenue);
    const finalKm = km === '' ? initialKm : Number(km);
    
    if (finalRevenue >= 0 && finalKm >= 0) {
      onSubmit(finalRevenue, finalKm);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl mb-4">
        <p className="text-sm text-green-600 dark:text-green-400 font-medium">Ganhos atuais registrados</p>
        <p className="text-2xl font-bold text-green-700 dark:text-green-300">R$ {currentRevenue.toFixed(2)}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Total Atualizado (R$)"
          value={revenue}
          onValueChange={setRevenue}
          placeholder={`Ex: ${currentRevenue > 0 ? currentRevenue : '50.00'}`}
        />
        <Input 
          label="KM Atual do Painel" 
          type="number" 
          inputMode="numeric"
          value={km} 
          onChange={e => setKm(e.target.value)} 
          placeholder={`Ex: ${initialKm || '45050'}`}
        />
      </div>
      <Button 
        type="submit" 
        className="w-full py-4" 
        disabled={(revenue === '' && currentRevenue === 0) && (km === '' && initialKm === 0)}
      >
        Atualizar Faturamento e KM
      </Button>
      <p className="text-[10px] text-gray-400 text-center uppercase font-bold tracking-widest">
        Dica: Se deixar vazio, os valores atuais serão mantidos.
      </p>
    </form>
  );
}

function FinishShiftForm({ onSubmit, currentRevenue, initialKm, todayTripsSoFar, currentShiftTrips }: { onSubmit: (km: number, autonomy: number, avgCons: number, revenue: number, trips: number) => void, currentRevenue: number, initialKm: number, todayTripsSoFar: number, currentShiftTrips: number }) {
  const [km, setKm] = useState(initialKm ? initialKm.toString() : '');
  const [autonomy, setAutonomy] = useState('');
  const [avgCons, setAvgCons] = useState('');
  const [revenue, setRevenue] = useState(currentRevenue?.toString() || '0');
  const [totalDayTrips, setTotalDayTrips] = useState(((todayTripsSoFar || 0) + (currentShiftTrips || 0)).toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const calculatedShiftTrips = Math.max(0, Number(totalDayTrips) - todayTripsSoFar);

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="KM Final" type="number" inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} />
        <Input label="Autonomia Final (KM)" type="number" inputMode="numeric" value={autonomy} onChange={e => setAutonomy(e.target.value)} />
      </div>
      <Input label="Média de Consumo (KM/L)" type="number" inputMode="decimal" step="0.1" value={avgCons} onChange={e => setAvgCons(e.target.value)} placeholder="Ex: 12.5" />
      <CurrencyInput label="Faturamento Total (R$)" value={revenue} onValueChange={setRevenue} />
      
      <div className="space-y-2">
        <Input label="Total de Corridas do Dia (App)" type="number" inputMode="numeric" value={totalDayTrips} onChange={e => setTotalDayTrips(e.target.value)} />
        <p className="text-xs text-gray-500 font-medium">Corridas deste turno: {calculatedShiftTrips}</p>
      </div>

      <Button 
        onClick={async () => {
           setIsSubmitting(true);
           try {
              await onSubmit(Number(km), Number(autonomy), Number(avgCons), Number(revenue), calculatedShiftTrips);
           } finally {
              setIsSubmitting(false);
           }
        }} 
        variant="danger" 
        className="w-full py-4 text-white"
        disabled={!km || isSubmitting}
      >
        {isSubmitting ? 'Finalizando...' : 'Finalizar Turno'}
      </Button>
    </div>
  );
}

function ExpenseForm({ onSubmit, initialData, onDelete }: { 
  onSubmit: (date: Date, category: Expense['category'], value: number, km: number, paymentMethod: 'Pix' | 'Crédito', installments: number) => void,
  initialData?: Expense,
  onDelete?: () => void
}) {
  const [date, setDate] = useState(initialData ? format(ensureDate(initialData.date), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [category, setCategory] = useState<Expense['category']>(initialData ? initialData.category : 'Manutenção');
  const [value, setValue] = useState(initialData?.value?.toString() || '');
  const [km, setKm] = useState(initialData?.kmAtExpense?.toString() || '');
  const [paymentMethod, setPaymentMethod] = useState<'Pix' | 'Crédito'>(initialData?.paymentMethod || 'Pix');
  const [installments, setInstallments] = useState(initialData?.installments?.toString() || '1');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const categories = ['Manutenção', 'Pneus', 'Óleo', 'Limpeza', 'Alimentação', 'Seguro', 'IPVA/Licenciamento', 'Multas', 'Estacionamento', 'Pedágio', 'Internet/Celular', 'Outros'];

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Input label="Data e Hora da 1ª Parcela" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
      <Select label="Categoria" options={categories} value={category} onChange={e => setCategory(e.target.value as Expense['category'])} />
      <CurrencyInput label="Valor Total (R$)" value={value} onValueChange={setValue} />
      <Input label="KM do Carro" type="number" inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} />
      
      <div className="space-y-3">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Forma de Pagamento</label>
        <div className="grid grid-cols-2 gap-3">
          <Button variant={paymentMethod === 'Pix' ? 'primary' : 'outline'} onClick={() => setPaymentMethod('Pix')}>Pix</Button>
          <Button variant={paymentMethod === 'Crédito' ? 'primary' : 'outline'} onClick={() => setPaymentMethod('Crédito')}>Crédito</Button>
        </div>
      </div>

      {paymentMethod === 'Crédito' && (
        <Input label="Parcelas" type="number" value={installments} onChange={e => setInstallments(e.target.value)} />
      )}
      
      <div className="space-y-3">
        {!showConfirmDelete ? (
          <>
            <Button onClick={() => onSubmit(new Date(date), category, Number(value), Number(km), paymentMethod, Number(installments))} className="w-full py-4">
              {initialData ? 'Atualizar Despesa' : 'Salvar Despesa'}
            </Button>
            {onDelete && (
              <Button onClick={() => setShowConfirmDelete(true)} variant="ghost" className="w-full text-red-500 hover:bg-red-50">Excluir Registro</Button>
            )}
          </>
        ) : (
          <div className="bg-red-50 p-4 rounded-2xl space-y-4 border border-red-100">
            <p className="text-sm text-red-700 font-medium text-center">Excluir este registro permanentemente?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowConfirmDelete(false)} className="w-full">Cancelar</Button>
              <Button onClick={onDelete} variant="danger" className="w-full">Sim, Excluir</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShiftFuelForm({ onSubmit }: { 
  onSubmit: (date: Date, km: number, price: number, total: number, autonomyBefore: number, autonomyAfter: number) => void
}) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [km, setKm] = useState('');
  const [autonomyBefore, setAutonomyBefore] = useState('');
  const [price, setPrice] = useState('');
  const [total, setTotal] = useState('');
  const [autonomyAfter, setAutonomyAfter] = useState('');

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Input label="Data e Hora" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="KM do Painel" type="number" value={km} onChange={e => setKm(e.target.value)} />
        <Input label="Autonomia ANTES (KM)" type="number" value={autonomyBefore} onChange={e => setAutonomyBefore(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Preço/Litro (R$)" type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
        <Input label="Valor Total (R$)" type="number" value={total} onChange={e => setTotal(e.target.value)} />
      </div>
      <Input label="Autonomia DEPOIS (KM)" type="number" value={autonomyAfter} onChange={e => setAutonomyAfter(e.target.value)} />
      
      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl">
        <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase">Litros Estimados</p>
        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
          {Number(price) > 0 ? (Number(total) / Number(price)).toFixed(2) : '0.00'} L
        </p>
      </div>
      
      <Button onClick={() => onSubmit(new Date(date), Number(km), Number(price), Number(total), Number(autonomyBefore), Number(autonomyAfter))} className="w-full py-4">
        Registrar Abastecimento
      </Button>
    </div>
  );
}

function FuelForm({ onSubmit, initialData, onDelete }: { 
  onSubmit: (date: Date, km: number, price: number, total: number) => void,
  initialData?: Fuel,
  onDelete?: () => void
}) {
  const [date, setDate] = useState(initialData ? format(ensureDate(initialData.date), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [km, setKm] = useState(initialData ? initialData.km.toString() : '');
  const [price, setPrice] = useState(initialData ? initialData.pricePerLiter.toString() : '');
  const [total, setTotal] = useState(initialData ? initialData.totalValue.toString() : '');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Input label="Data e Hora" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
      <Input label="KM do Painel" type="number" inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput label="Preço/Litro (R$)" value={price} onValueChange={setPrice} />
        <CurrencyInput label="Valor Total (R$)" value={total} onValueChange={setTotal} />
      </div>
      <div className="bg-green-50 p-4 rounded-xl">
        <p className="text-xs text-green-600 font-bold uppercase">Litros Estimados</p>
        <p className="text-2xl font-bold text-green-900">
          {Number(price) > 0 ? (Number(total) / Number(price)).toFixed(2) : '0.00'} L
        </p>
      </div>
      
      <div className="space-y-3">
        {!showConfirmDelete ? (
          <>
            <Button onClick={() => onSubmit(new Date(date), Number(km), Number(price), Number(total))} className="w-full py-4">
              {initialData ? 'Atualizar Abastecimento' : 'Registrar Abastecimento'}
            </Button>
            {onDelete && (
              <Button onClick={() => setShowConfirmDelete(true)} variant="ghost" className="w-full text-red-500 hover:bg-red-50">Excluir Registro</Button>
            )}
          </>
        ) : (
          <div className="bg-red-50 p-4 rounded-2xl space-y-4 border border-red-100">
            <p className="text-sm text-red-700 font-medium text-center">Excluir este registro permanentemente?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowConfirmDelete(false)} className="w-full">Cancelar</Button>
              <Button onClick={onDelete} variant="danger" className="w-full">Sim, Excluir</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonCard({ title, icon, current, prev, avg, format, labelPrev, labelAvg, higherIsBetter }: any) {
  const getDiff = (a: number, b: number) => {
    if (b === 0) return { pct: 0, str: '0%', good: true };
    const diff = ((a - b) / b) * 100;
    const isGood = higherIsBetter ? diff >= 0 : diff <= 0;
    return { pct: diff, str: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`, good: isGood };
  };

  const diffPrev = getDiff(current, prev);
  const diffAvg = getDiff(current, avg);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-gray-400 dark:text-gray-500">{icon}</div>
        <p className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{title}</p>
      </div>
      
      <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-4">{format(current)}</p>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg text-[11px] font-bold">
           <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vs. {labelPrev}</span>
           <div className="flex items-center gap-2">
             <span className="text-gray-400 font-medium tabular-nums">{format(prev)}</span>
             {prev > 0 ? (
               <span className={cn("px-1.5 py-0.5 rounded flex items-center gap-0.5", diffPrev.good ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                 {diffPrev.good ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                 {diffPrev.str}
               </span>
             ) : <span className="text-gray-400 font-medium tracking-wide">Sem dados</span>}
           </div>
        </div>
        
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg text-[11px] font-bold">
           <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vs. {labelAvg}</span>
           <div className="flex items-center gap-2">
             <span className="text-gray-400 font-medium tabular-nums">{format(avg)}</span>
             {avg > 0 ? (
               <span className={cn("px-1.5 py-0.5 rounded flex items-center gap-0.5", diffAvg.good ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                 {diffAvg.good ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                 {diffAvg.str}
               </span>
             ) : <span className="text-gray-400 font-medium tracking-wide">Sem dados</span>}
           </div>
        </div>
      </div>
    </div>
  );
}

function PastShiftForm({ onSubmit, initialData, onDelete }: { 
  onSubmit: (start: Date, end: Date, startKm: number, endKm: number, revenue: number, trips: number, avgCons?: number, activeTimeSeconds?: number) => void,
  initialData?: Shift,
  onDelete?: () => void
}) {
  const [start, setStart] = useState(initialData ? format(ensureDate(initialData.startTime), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [end, setEnd] = useState(initialData && initialData.endTime ? format(ensureDate(initialData.endTime), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [startKm, setStartKm] = useState(initialData ? initialData.startKm.toString() : '');
  const [endKm, setEndKm] = useState(initialData ? (initialData.endKm || '').toString() : '');
  const [revenue, setRevenue] = useState(initialData ? initialData.totalRevenue.toString() : '');
  const [trips, setTrips] = useState(initialData ? initialData.totalTrips.toString() : '');
  const [avgCons, setAvgCons] = useState(initialData ? (initialData.avgConsumption || '').toString() : '');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const [activeTimeStr, setActiveTimeStr] = useState(() => {
    if (!initialData) return '';
    const secs = initialData.activeTimeSeconds || Math.max(0, differenceInSeconds(ensureDate(initialData.endTime), ensureDate(initialData.startTime)));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });

  return (
    <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Início" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
        <Input label="Fim" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Tempo Trabalhado (HH:mm)" type="text" placeholder="Ex: 05:30" value={activeTimeStr} onChange={e => setActiveTimeStr(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="KM Inicial" type="number" inputMode="numeric" value={startKm} onChange={e => setStartKm(e.target.value)} />
        <Input label="KM Final" type="number" inputMode="numeric" value={endKm} onChange={e => setEndKm(e.target.value)} />
      </div>
      <Input label="Média de Consumo (KM/L)" type="number" inputMode="decimal" step="0.1" value={avgCons} onChange={e => setAvgCons(e.target.value)} />
      <CurrencyInput label="Faturamento Total (R$)" value={revenue} onValueChange={setRevenue} />
      <Input label="Qtd Corridas" type="number" inputMode="numeric" value={trips} onChange={e => setTrips(e.target.value)} />
      
      <div className="space-y-3">
        {!showConfirmDelete ? (
          <>
            <Button onClick={() => {
              let activeSecs: number | undefined;
              if (activeTimeStr && activeTimeStr.includes(':')) {
                const parts = activeTimeStr.split(':');
                if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                  activeSecs = (Number(parts[0]) * 3600) + (Number(parts[1]) * 60);
                }
              }
              onSubmit(new Date(start), new Date(end), Number(startKm), Number(endKm), Number(revenue), Number(trips), Number(avgCons), activeSecs);
            }} className="w-full py-4">
              {initialData ? 'Atualizar Turno' : 'Salvar Turno'}
            </Button>
            {onDelete && (
              <Button onClick={() => setShowConfirmDelete(true)} variant="ghost" className="w-full text-red-500 hover:bg-red-50">Excluir Turno</Button>
            )}
          </>
        ) : (
          <div className="bg-red-50 p-4 rounded-2xl space-y-4 border border-red-100">
            <p className="text-sm text-red-700 font-medium text-center">Tem certeza que deseja excluir este turno? Esta ação não pode ser desfeita.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowConfirmDelete(false)} className="w-full">Cancelar</Button>
              <Button onClick={onDelete} variant="danger" className="w-full">Sim, Excluir</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



function SequentialTripForm({ shift, existingTrips, initialTripId, onSave, onDelete, onClose }: { 
  shift: Shift, 
  existingTrips: Trip[],
  initialTripId?: string | null,
  onSave: (tripId: string | undefined, data: any) => Promise<void>,
  onDelete: (tripId: string) => Promise<void>,
  onClose: () => void
}) {
  const [viewMode, setViewMode] = useState<'new'|'edit'>('new');
  const [editIndex, setEditIndex] = useState(0);

  const [timeStr, setTimeStr] = useState("");
  const [valueStr, setValueStr] = useState("");
  const [durationStr, setDurationStr] = useState("");
  const [distanceStr, setDistanceStr] = useState("");
  const [isDynamic, setIsDynamic] = useState(false);
  const [dynamicValueStr, setDynamicValueStr] = useState("");
  const [isCancelled, setIsCancelled] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sorting trips chronologically
  const sortedTrips = useMemo(() => {
    return [...existingTrips].sort((a, b) => {
      const timeA = a.startTime ? a.startTime.toMillis() : a.timestamp.toMillis();
      const timeB = b.startTime ? b.startTime.toMillis() : b.timestamp.toMillis();
      return timeA - timeB;
    });
  }, [existingTrips]);

  useEffect(() => {
    if (initialTripId) {
      const idx = sortedTrips.findIndex(t => t.id === initialTripId);
      if (idx !== -1) {
        setViewMode('edit');
        setEditIndex(idx);
      } else {
        setViewMode('new');
      }
    } else {
      setViewMode('new');
    }
  }, [initialTripId, sortedTrips.length]);

  useEffect(() => {
    if (viewMode === 'edit') {
       const trip = sortedTrips[editIndex];
      if (trip) {
         setTimeStr(trip.startTime ? format(ensureDate(trip.startTime), "HH:mm") : (trip.timestamp ? format(ensureDate(trip.timestamp), "HH:mm") : ""));
         setValueStr((trip.value || 0).toString());
         setDistanceStr((trip.distanceKm || 0).toString());
         const duration = trip.durationSeconds || 0;
         const mins = Math.floor(duration / 60);
         const secs = Math.floor(duration % 60);
         setDurationStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
         if (trip.dynamicValue && trip.dynamicValue > 0) {
           setIsDynamic(true);
           setDynamicValueStr(trip.dynamicValue.toString());
         } else {
           setIsDynamic(false);
           setDynamicValueStr("");
         }
         setIsCancelled(trip.isCancelled || false);
       } else {
         setViewMode('new');
       }
    }
  }, [viewMode, editIndex, sortedTrips]);

  const clearNewForm = () => {
    setTimeStr("");
    setValueStr("");
    setDurationStr("");
    setDistanceStr("");
    setIsDynamic(false);
    setDynamicValueStr("");
    setIsCancelled(false);
  };

  const handleCancelToggle = (checked: boolean) => {
    setIsCancelled(checked);
    if (checked) {
      // Auto-pre-fill for canceled
      setValueStr("3.50");
      setDurationStr("00:00");
      setDistanceStr("0");
    }
  };

  const handleDurationMask = (val: string) => {
    let clean = val.replace(/\D/g, "");
    if (clean.length > 4) clean = clean.substring(0, 4);
    if (clean.length >= 3) {
      clean = clean.substring(0, clean.length - 2) + ":" + clean.substring(clean.length - 2);
    }
    setDurationStr(clean);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      let startTimeDate: Date | null = null;
      if (timeStr) {
        const shiftDate = ensureDate(shift.startTime);
        const [hh, mm] = timeStr.split(':');
        startTimeDate = new Date(shiftDate);
        startTimeDate.setHours(parseInt(hh, 10));
        startTimeDate.setMinutes(parseInt(mm, 10));
        startTimeDate.setSeconds(0);
      }
      
      const totalVal = parseFloat(valueStr || '0');
      const dynVal = isDynamic ? parseFloat(dynamicValueStr || '0') : 0;
      const distVal = parseFloat(distanceStr || '0');
      
      let sec = 0;
      if (durationStr) {
         const parts = durationStr.split(":");
         if (parts.length === 2) {
           sec = (parseInt(parts[0] || '0') * 60) + parseInt(parts[1] || '0');
         } else {
           sec = parseInt(durationStr || '0');
         }
      }

      const tripData = {
        value: totalVal,
        dynamicValue: dynVal,
        durationSeconds: sec,
        distanceKm: distVal,
        startTime: startTimeDate,
        isCancelled
      };

      if (viewMode === 'new') {
        await onSave(undefined, tripData);
        clearNewForm();
      } else {
        const trip = sortedTrips[editIndex];
        if (trip) {
           await onSave(trip.id, tripData);
        }
        
        if (editIndex < sortedTrips.length - 1) {
          setEditIndex(editIndex + 1);
        } else {
          onClose(); // Automatically close when finished with the sequence
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
     if (viewMode === 'new') {
        if (sortedTrips.length > 0) {
           setViewMode('edit');
           setEditIndex(sortedTrips.length - 1);
        }
     } else if (editIndex > 0) {
        setEditIndex(editIndex - 1);
     }
  };

  const handleGoForward = () => {
     if (viewMode === 'edit') {
        if (editIndex < sortedTrips.length - 1) {
           setEditIndex(editIndex + 1);
        } else {
           setViewMode('new');
           clearNewForm();
        }
     }
  };

  const handleDelete = async () => {
     if (viewMode === 'edit' && sortedTrips[editIndex]) {
        setIsSubmitting(true);
        try {
          await onDelete(sortedTrips[editIndex].id);
          if (editIndex > 0) {
             setEditIndex(editIndex - 1);
          } else {
             setViewMode('new');
             clearNewForm();
          }
        } finally {
          setIsSubmitting(false);
        }
     }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <button 
          onClick={handleGoBack} 
          disabled={viewMode === 'edit' && editIndex === 0}
          className="p-2 text-gray-500 hover:text-green-600 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
          {viewMode === 'new' ? 'Nova Corrida' : `Editando Corrida ${editIndex + 1}/${sortedTrips.length}`}
        </span>
        <button 
          onClick={handleGoForward} 
          disabled={viewMode === 'new'}
          className="p-2 text-gray-500 hover:text-green-600 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {isCancelled && (
        <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl mb-4 text-xs font-bold text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 flex items-center justify-center">
          ⚠️ Corrida Cancelada Selecionada
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl space-y-4 border border-gray-100 dark:border-gray-700 relative">
        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Hora (HH:MM)" 
            type="time" 
            value={timeStr} 
            onChange={e => setTimeStr(e.target.value)} 
          />
          <Input 
            label="Duração (MM:SS)" 
            type="text" 
            value={durationStr} 
            onChange={e => handleDurationMask(e.target.value)} 
            placeholder="00:00"
            disabled={isCancelled}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <CurrencyInput label={isCancelled ? "Taxa Cancelamento (R$)" : "Valor Total (R$)"} value={valueStr} onValueChange={setValueStr} />
          <Input 
            label="Distância (KM)" 
            type="number" 
            step="0.01"
            value={distanceStr} 
            onChange={e => setDistanceStr(e.target.value)} 
            placeholder="Ex: 5.2"
            disabled={isCancelled}
          />
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <label className="flex items-center justify-between w-full cursor-pointer">
            <span className="text-sm font-bold text-red-600 dark:text-red-400">Corrida Cancelada?</span>
            <div className={cn("w-12 h-6 rounded-full transition-colors relative", isCancelled ? "bg-red-500" : "bg-gray-300 dark:bg-gray-600")}>
              <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 transition-all", isCancelled ? "left-7" : "left-1")} />
            </div>
            <input type="checkbox" className="hidden" checked={isCancelled} onChange={(e) => handleCancelToggle(e.target.checked)} />
          </label>

          {!isCancelled && (
            <>
              <label className="flex items-center justify-between w-full cursor-pointer">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Teve Tarifa Dinâmica?</span>
                <div className={cn("w-12 h-6 rounded-full transition-colors relative", isDynamic ? "bg-teal-500" : "bg-gray-300 dark:bg-gray-600")}>
                  <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 transition-all", isDynamic ? "left-7" : "left-1")} />
                </div>
                <input type="checkbox" className="hidden" checked={isDynamic} onChange={(e) => setIsDynamic(e.target.checked)} />
              </label>
              
              {isDynamic && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                  <CurrencyInput label="Valor do Dinâmico (R$)" value={dynamicValueStr} onValueChange={setDynamicValueStr} />
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        {viewMode === 'edit' && (
          <Button 
            disabled={isSubmitting} 
            onClick={handleDelete} 
            variant="ghost" 
             className="w-1/3 py-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-100 dark:border-red-900/30"
          >
            Apagar
          </Button>
        )}
        <Button 
          disabled={isSubmitting || !valueStr}
          onClick={handleSave} 
          className="flex-1 py-4 shadow-lg"
        >
          {isSubmitting ? 'Salvando...' : 'Salvar Corrida'}
        </Button>
      </div>
    </div>
  );
}

function MonthlyGoalForm({ onSubmit, currentGoal, currentWorkDays }: { onSubmit: (goal: number, workDays: number[]) => void, currentGoal: number, currentWorkDays: number[] }) {
  const [goal, setGoal] = useState(currentGoal.toString());
  const [workDays, setWorkDays] = useState<number[]>(currentWorkDays);

  const toggleDay = (day: number) => {
    setWorkDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day].sort()
    );
  };

  const daysOfWeek = [
    { label: 'Dom', value: 0 },
    { label: 'Seg', value: 1 },
    { label: 'Ter', value: 2 },
    { label: 'Qua', value: 3 },
    { label: 'Qui', value: 4 },
    { label: 'Sex', value: 5 },
    { label: 'Sáb', value: 6 }
  ];

  return (
    <div className="space-y-6">
      <CurrencyInput label="Meta de Lucro Mensal Líquido (R$)" value={goal} onValueChange={setGoal} />
      <p className="text-xs text-gray-500 italic mb-4">O lucro líquido é o que sobra após pagar combustível e contas fixas.</p>
      
      <div>
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Dias Trabalhados</label>
        <div className="flex flex-wrap gap-2">
          {daysOfWeek.map(day => (
            <button
              key={day.value}
              onClick={() => toggleDay(day.value)}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-none",
                workDays.includes(day.value) 
                  ? "bg-green-600 text-white shadow-md" 
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              {day.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">Usaremos esses dias para calcular a sua meta diária proporcional, ignorando as suas folgas.</p>
      </div>

      <Button onClick={() => onSubmit(Number(goal), workDays)} disabled={workDays.length === 0} className="w-full py-4 mt-6">Salvar Configuração</Button>
    </div>
  );
}

function FixedExpenseForm({ onSubmit, initialData, onDelete }: { 
  onSubmit: (name: string, amount: number, dueDay: number) => void,
  initialData?: FixedExpense,
  onDelete?: () => void
}) {
  const [name, setName] = useState(initialData?.name || '');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [dueDay, setDueDay] = useState(initialData?.dueDay?.toString() || '10');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Input label="Nome da Conta (Ex: Prestação Carro)" type="text" value={name} onChange={e => setName(e.target.value)} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput label="Valor Mensal (R$)" value={amount} onValueChange={setAmount} />
        <Input label="Dia de Vencimento" type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} />
      </div>
      
      <div className="space-y-3">
        {!showConfirmDelete ? (
          <>
            <Button onClick={() => onSubmit(name, Number(amount), Number(dueDay))} disabled={!name || !amount || !dueDay} className="w-full py-4">
              {initialData ? 'Atualizar Conta Fixa' : 'Salvar Conta Fixa'}
            </Button>
            {onDelete && (
              <Button onClick={() => setShowConfirmDelete(true)} variant="ghost" className="w-full text-red-500 hover:bg-red-50">Excluir Conta</Button>
            )}
          </>
        ) : (
          <div className="bg-red-50 p-4 rounded-2xl space-y-4 border border-red-100">
            <p className="text-sm text-red-700 font-medium text-center">Excluir esta conta fixa permanentemente?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowConfirmDelete(false)} className="w-full">Cancelar</Button>
              <Button onClick={onDelete} variant="danger" className="w-full">Sim, Excluir</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WithdrawalForm({ onSubmit, platformBalance }: { 
  onSubmit: (amount: number, date: Date, fee: number) => void,
  platformBalance: number
}) {
  const [amount, setAmount] = useState(platformBalance > 0 ? platformBalance.toString() : '');
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [fee, setFee] = useState('0');
  const [hasFee, setHasFee] = useState(false);

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl mb-4">
        <p className="text-sm text-green-600 dark:text-green-400 font-medium">Saldo Disponível na Plataforma</p>
        <p className="text-2xl font-bold text-green-700 dark:text-green-300">R$ {platformBalance.toFixed(2)}</p>
      </div>

      <CurrencyInput label="Valor do Saque/Transferência (R$)" value={amount} onValueChange={setAmount} />
      <Input label="Data e Hora do Saque" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
      
      <div className="space-y-3">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Houve taxa de saque?</label>
        <div className="grid grid-cols-2 gap-3">
          <Button variant={!hasFee ? 'primary' : 'outline'} onClick={() => { setHasFee(false); setFee('0'); }}>Não</Button>
          <Button variant={hasFee ? 'primary' : 'outline'} onClick={() => setHasFee(true)}>Sim</Button>
        </div>
      </div>

      {hasFee && (
         <CurrencyInput label="Valor da Taxa (R$)" value={fee} onValueChange={setFee} placeholder="Ex: 4.50" />
      )}
      
      <Button disabled={!amount || Number(amount) <= 0} onClick={() => onSubmit(Number(amount), new Date(date), Number(fee))} className="w-full py-4">
        Confirmar Saque
      </Button>
    </div>
  );
}

function UpdateBalanceForm({ onSubmit, currentBalance }: { 
  onSubmit: (newBalance: number) => void,
  currentBalance: number
}) {
  const [balance, setBalance] = useState(currentBalance.toString());

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl mb-4 border border-gray-100 dark:border-gray-700">
        <p className="text-sm text-gray-500 font-medium">Saldo Atual Registrado</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">R$ {currentBalance.toFixed(2)}</p>
      </div>

      <CurrencyInput label="Novo Saldo da Plataforma (R$)" value={balance} onValueChange={setBalance} />
      
      <Button disabled={balance === ''} onClick={() => onSubmit(Number(balance))} className="w-full py-4">
        Atualizar Saldo Manulamente
      </Button>
    </div>
  );
}

function SettingsForm({ settings, onSubmit, onBackup }: { settings: UserSettings, onSubmit: (data: Partial<UserSettings>) => void, onBackup: () => void }) {
  const [maintPerc, setMaintPerc] = useState((settings.maintenancePercentage ?? 10).toString());
  const [monthlyNet, setMonthlyNet] = useState((settings.monthlyNetGoal || 2000).toString());
  const [fuel, setFuel] = useState((settings.defaultFuelPrice || 5.50).toString());
  const [cons, setCons] = useState((settings.avgConsumption || 12).toString());
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey || '');
  
  const [oilInt, setOilInt] = useState((settings.oilChangeInterval || 10000).toString());
  const [oilLast, setOilLast] = useState((settings.lastOilChangeKm || 0).toString());
  const [tireInt, setTireInt] = useState((settings.tireRotationInterval || 10000).toString());
  const [tireLast, setTireLast] = useState((settings.lastTireRotationKm || 0).toString());
  const [beltInt, setBeltInt] = useState((settings.timingBeltInterval || 50000).toString());
  const [beltLast, setBeltLast] = useState((settings.lastTimingBeltKm || 0).toString());

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Card className="space-y-6">
        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Geral</h3>
        <Input label="Custo de Manutenção (% do Faturamento)" type="number" step="1" value={maintPerc} onChange={e => setMaintPerc(e.target.value)} placeholder="Ex: 10" />
        <Input label="Meta Mensal Líquida Desejada (R$)" type="number" value={monthlyNet} onChange={e => setMonthlyNet(e.target.value)} placeholder="Ex: 2000" />
        <Input label="Preço Médio do Combustível (R$)" type="number" step="0.01" value={fuel} onChange={e => setFuel(e.target.value)} placeholder="Ex: 5.50" />
        <Input label="Consumo Médio do Carro (KM/L)" type="number" step="0.1" value={cons} onChange={e => setCons(e.target.value)} placeholder="Ex: 12.0" />
      </Card>

      <Card className="space-y-6">
        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Inteligência Artificial</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Para usar a análise de IA no seu celular (fora do AI Studio), você precisa gerar uma chave gratuita no Google AI Studio e colar aqui.
        </p>
        <Input label="Chave API do Gemini (Opcional)" type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIzaSy..." />
      </Card>

      <Card className="space-y-6">
        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Intervalos de Manutenção</h3>
        
        <div className="space-y-4">
          <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase">Troca de Óleo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Intervalo (KM)" type="number" value={oilInt} onChange={e => setOilInt(e.target.value)} />
            <Input label="Última Troca (KM)" type="number" value={oilLast} onChange={e => setOilLast(e.target.value)} />
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase">Rodízio de Pneus</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Intervalo (KM)" type="number" value={tireInt} onChange={e => setTireInt(e.target.value)} />
            <Input label="Último Rodízio (KM)" type="number" value={tireLast} onChange={e => setTireLast(e.target.value)} />
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase">Correia Dentada</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Intervalo (KM)" type="number" value={beltInt} onChange={e => setBeltInt(e.target.value)} />
            <Input label="Última Troca (KM)" type="number" value={beltLast} onChange={e => setBeltLast(e.target.value)} />
          </div>
        </div>
      </Card>

      <Button 
        onClick={() => onSubmit({
          maintenancePercentage: Number(maintPerc),
          monthlyNetGoal: Number(monthlyNet),
          defaultFuelPrice: Number(fuel),
          avgConsumption: Number(cons),
          geminiApiKey: geminiKey,
          oilChangeInterval: Number(oilInt),
          lastOilChangeKm: Number(oilLast),
          tireRotationInterval: Number(tireInt),
          lastTireRotationKm: Number(tireLast),
          timingBeltInterval: Number(beltInt),
          lastTimingBeltKm: Number(beltLast)
        })} 
        className="w-full py-4"
      >
        Salvar Configurações
      </Button>

      <Card className="space-y-4">
        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Segurança e Dados</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Baixe uma cópia completa de todos os seus dados (turnos, despesas e configurações) em formato JSON.
        </p>
        <Button 
          variant="outline" 
          onClick={onBackup}
          icon={FileText}
          className="w-full py-4"
        >
          Fazer Backup Completo
        </Button>
      </Card>
      
      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-800 transition-colors">
        <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed">
          <strong>Dica:</strong> O custo de manutenção agora é calculado como uma porcentagem do seu faturamento. 
          Um valor comum é separar 10% de tudo que você ganha para manutenção (pneus, óleo, suspensão).
        </p>
      </div>
    </div>
  );
}

