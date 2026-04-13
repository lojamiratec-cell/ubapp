/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, Pause, Square, History, DollarSign, BarChart3, 
  Plus, ChevronRight, LogOut, Car, Timer, Fuel as FuelIcon, 
  TrendingUp, AlertCircle, CheckCircle2, Clock, MapPin, Sparkles, Calendar, User as UserIcon,
  Settings as SettingsIcon, Sun, Moon, Download, FileText, Edit2
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
  collection, doc, setDoc, addDoc, onSnapshot, query, where, orderBy, Timestamp, serverTimestamp, updateDoc, deleteDoc, getDocs, writeBatch
} from 'firebase/firestore';
import { format, differenceInSeconds, startOfDay, endOfDay, subDays, subMonths, isWithinInterval, isSameDay, isSameWeek, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Shift, Trip, Expense, ShiftStatus, Fuel, UserSettings } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20",
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
      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50 dark:bg-gray-800/50 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
    />
  </div>
);

const Select = ({ label, options, ...props }: { label: string, options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
    <select 
      {...props}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50 dark:bg-gray-800/50 dark:text-white"
    >
      {options.map(opt => <option key={opt} value={opt} className="dark:bg-gray-900">{opt}</option>)}
    </select>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'operation' | 'history' | 'costs' | 'insights' | 'settings'>('operation');
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
  const [showShiftFuelModal, setShowShiftFuelModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showPastShiftModal, setShowPastShiftModal] = useState(false);
  const [showEditShiftModal, setShowEditShiftModal] = useState(false);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [showEditFuelModal, setShowEditFuelModal] = useState(false);
  const [showEditTripModal, setShowEditTripModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<{shiftId: string, trip: Trip} | null>(null);
  const [tripToDelete, setTripToDelete] = useState<{shiftId: string, tripId: string} | null>(null);
  const [shiftToDeleteAllTrips, setShiftToDeleteAllTrips] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [shiftTrips, setShiftTrips] = useState<Record<string, Trip[]>>({});
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingFuel, setEditingFuel] = useState<Fuel | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const groupedShifts = useMemo(() => {
    const groups: Record<string, { date: Date, shifts: Shift[], totalRevenue: number, totalTime: number }> = {};
    shifts.forEach(shift => {
      const date = shift.startTime?.toDate() || new Date();
      const dateKey = format(date, 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = { date, shifts: [], totalRevenue: 0, totalTime: 0 };
      }
      groups[dateKey].shifts.push(shift);
      groups[dateKey].totalRevenue += shift.totalRevenue;
      groups[dateKey].totalTime += shift.activeTimeSeconds;
    });
    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [shifts]);

  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // AI State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [insightFilter, setInsightFilter] = useState<'day' | 'week' | 'month'>('month');

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
        const lastStarted = activeShift.lastStartedAt?.toDate() || new Date();
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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
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
        setAuthError('E-mail ou senha incorretos.');
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
        'Data do Turno', 'Início do Turno', 'Fim do Turno', 'Faturamento do Turno (R$)', 'Tempo Ativo do Turno', 
        'KM Inicial do Turno', 'KM Final do Turno', 'KM Trabalho do Turno', 'KM Pessoal do Turno', 'Consumo (KM/L)',
        'Data da Corrida', 'Hora da Corrida', 'Valor da Corrida (R$)', 'Duração da Corrida', 'Distância da Corrida (KM)'
      ];

      const rows: string[][] = [];

      shifts.forEach(s => {
        const shiftDate = format(s.startTime?.toDate() || new Date(), 'dd/MM/yyyy');
        const shiftStart = format(s.startTime?.toDate() || new Date(), 'HH:mm');
        const shiftEnd = s.endTime ? format(s.endTime.toDate(), 'HH:mm') : '--';
        const shiftRev = s.totalRevenue.toFixed(2);
        const shiftTime = formatTime(s.activeTimeSeconds);
        const shiftStartKm = s.startKm.toString();
        const shiftEndKm = s.endKm?.toString() || '--';
        const shiftWorkKm = s.totalWorkKm?.toFixed(1) || '--';
        const shiftPersonalKm = s.totalPersonalKm?.toFixed(1) || '--';
        const shiftCons = s.avgConsumption?.toFixed(1) || '--';

        const trips = allTrips[s.id] || [];
        
        if (trips.length === 0) {
          rows.push([
            shiftDate, shiftStart, shiftEnd, shiftRev, shiftTime, 
            shiftStartKm, shiftEndKm, shiftWorkKm, shiftPersonalKm, shiftCons,
            '--', '--', '--', '--', '--'
          ]);
        } else {
          trips.forEach(t => {
            rows.push([
              shiftDate, shiftStart, shiftEnd, shiftRev, shiftTime, 
              shiftStartKm, shiftEndKm, shiftWorkKm, shiftPersonalKm, shiftCons,
              format(t.timestamp?.toDate() || new Date(), 'dd/MM/yyyy'),
              format(t.timestamp?.toDate() || new Date(), 'HH:mm'),
              t.value.toFixed(2),
              formatTime(t.durationSeconds),
              t.distanceKm.toFixed(1)
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
      format(e.date?.toDate() || new Date(), 'dd/MM/yyyy'),
      e.category,
      e.value.toFixed(2),
      e.kmAtExpense,
      ''
    ]);

    const fuelRows = fuelRecords.map(f => [
      'Combustível',
      format(f.date?.toDate() || new Date(), 'dd/MM/yyyy'),
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
      await addDoc(collection(db, 'shifts'), {
        userId: user.uid,
        startTime: serverTimestamp(),
        startKm: km,
        startAutonomy: autonomy,
        status: 'active',
        activeTimeSeconds: 0,
        lastStartedAt: serverTimestamp(),
        totalRevenue: 0,
        totalTrips: 0,
        totalWorkKm: 0,
        totalPersonalKm: 0,
        lastKm: km
      });
      setShowStartModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    }
  };

  const pauseShift = async (revenue: number, km: number, autonomy: number) => {
    if (!activeShift) return;
    try {
      const now = new Date();
      const lastStarted = activeShift.lastStartedAt?.toDate() || new Date();
      const diffTime = differenceInSeconds(now, lastStarted);
      const newActiveTime = activeShift.activeTimeSeconds + diffTime;
      
      const diffKm = km - activeShift.lastKm;
      const newWorkKm = activeShift.totalWorkKm + Math.max(0, diffKm);

      await updateDoc(doc(db, 'shifts', activeShift.id), {
        status: 'paused',
        activeTimeSeconds: newActiveTime,
        totalRevenue: revenue,
        endKm: km,
        endAutonomy: autonomy,
        totalWorkKm: newWorkKm,
        lastKm: km
      });
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
        lastStartedAt: serverTimestamp()
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

  const finishShift = async (km: number, autonomy: number, avgCons: number, revenue: number, trips: number) => {
    if (!activeShift) return;
    try {
      const now = new Date();
      let finalActiveTime = activeShift.activeTimeSeconds;
      let finalWorkKm = activeShift.totalWorkKm;

      if (activeShift.status === 'active') {
        const lastStarted = activeShift.lastStartedAt?.toDate() || new Date();
        finalActiveTime += differenceInSeconds(now, lastStarted);
        finalWorkKm += Math.max(0, km - activeShift.lastKm);
      }

      await updateDoc(doc(db, 'shifts', activeShift.id), {
        status: 'finished',
        endTime: serverTimestamp(),
        endKm: km,
        endAutonomy: autonomy,
        avgConsumption: avgCons,
        totalRevenue: revenue,
        totalTrips: trips,
        activeTimeSeconds: finalActiveTime,
        totalWorkKm: finalWorkKm,
        lastKm: km
      });
      setShowFinishModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${activeShift.id}`);
    }
  };

  const addExpense = async (date: Date, category: any, value: number, km: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'expenses'), {
        userId: user.uid,
        date: Timestamp.fromDate(date),
        category,
        value,
        kmAtExpense: km
      });
      setShowExpenseModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'expenses');
    }
  };

  const addTrip = async (value: number, durationSeconds: number, distanceKm: number) => {
    if (!user || !selectedShiftId) return;
    try {
      await addDoc(collection(db, 'shifts', selectedShiftId, 'trips'), {
        userId: user.uid,
        shiftId: selectedShiftId,
        value,
        durationSeconds,
        distanceKm,
        timestamp: serverTimestamp()
      });
      setShowTripModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shifts/${selectedShiftId}/trips`);
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

  const addPastShift = async (start: Date, end: Date, startKm: number, endKm: number, revenue: number, trips: number, avgCons?: number) => {
    if (!user) return;
    try {
      const activeTime = differenceInSeconds(end, start);
      const workKm = endKm - startKm;
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
        totalPersonalKm: 0,
        lastKm: endKm
      });
      setShowPastShiftModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    }
  };

  const updateShift = async (id: string, data: Partial<Shift>) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'shifts', id);
      const existing = shifts.find(s => s.id === id);
      if (!existing) return;

      const updates: any = { ...data };
      
      if (data.startTime && data.endTime) {
        updates.activeTimeSeconds = differenceInSeconds(data.endTime.toDate(), data.startTime.toDate());
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

  const updateTrip = async (shiftId: string, tripId: string, data: Partial<Trip>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'shifts', shiftId, 'trips', tripId), data);
      setShowEditTripModal(false);
      setEditingTrip(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${shiftId}/trips/${tripId}`);
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

      const recentGroups = groupedShifts.slice(0, 14).map(g => {
        const turnosInfo = g.shifts.map(s => {
          const hour = s.startTime.toDate().getHours();
          const periodo = hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite';
          return `${periodo} (R$ ${s.totalRevenue.toFixed(2)})`;
        }).join(', ');
        return `${format(g.date, 'dd/MM')}: R$ ${g.totalRevenue.toFixed(2)} em ${formatTime(g.totalTime)} | Turnos: ${turnosInfo}`;
      }).join('\n        ');

      const prompt = `
        Atue como um especialista em performance para motoristas de aplicativo. 
        Analise os seguintes dados do período (${insightFilter}):
        
        - Faturamento: R$ ${metrics.totalRevenue.toFixed(2)}
        - KM Rodados (Trabalho): ${metrics.totalKmWork.toFixed(2)} km
        - Tempo Total: ${metrics.totalHours.toFixed(2)} horas
        - Qtd Viagens: ${metrics.totalTrips}
        - R$/Hora: R$ ${metrics.revenuePerHour.toFixed(2)}
        - Viagens/Hora: ${viagensPorHora}
        - R$/KM: R$ ${metrics.revenuePerKm.toFixed(2)}
        - Ticket Médio: R$ ${metrics.ticketMedio.toFixed(2)}
        
        Resumo dos dias trabalhados:
        ${recentGroups}
        
        Faça uma análise estratégica avaliando o R$/hora, média de viagens por hora e R$/km.
        Analise também os turnos trabalhados, indicando os melhores horários e dias até o momento.
        
        REGRAS IMPORTANTES:
        - A resposta DEVE ter NO MÁXIMO 500 caracteres. Seja muito conciso.
        - Seja extremamente direto e estratégico.
        - Use formatação em Markdown (negrito para números importantes).
        - Não use saudações.
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

  // --- Calculations ---

  const monthlySummary = useMemo(() => {
    const now = new Date();
    const currentMonthShifts = shifts.filter(s => s.status === 'finished' && isSameMonth(s.startTime.toDate(), now));
    const lastMonthShifts = shifts.filter(s => s.status === 'finished' && isSameMonth(s.startTime.toDate(), subMonths(now, 1)));

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
    
    shifts.filter(s => s.status === 'finished').forEach(s => {
      const day = s.startTime.toDate().getDay();
      revenueByDay[day] += s.totalRevenue;
      countByDay[day] += 1;
    });
    
    return days.map((name, i) => ({
      name,
      revenue: revenueByDay[i],
      avg: countByDay[i] > 0 ? revenueByDay[i] / countByDay[i] : 0
    }));
  }, [shifts]);

  const metrics = useMemo(() => {
    const now = new Date();
    let filteredShifts = shifts.filter(s => s.status === 'finished');
    let filteredExpenses = expenses;
    let filteredFuel = fuelRecords;

    if (insightFilter === 'day') {
      filteredShifts = filteredShifts.filter(s => isSameDay(s.startTime.toDate(), now));
      filteredExpenses = expenses.filter(e => isSameDay(e.date.toDate(), now));
      filteredFuel = fuelRecords.filter(f => isSameDay(f.date.toDate(), now));
    } else if (insightFilter === 'week') {
      filteredShifts = filteredShifts.filter(s => isSameWeek(s.startTime.toDate(), now, { weekStartsOn: 0 }));
      filteredExpenses = expenses.filter(e => isSameWeek(e.date.toDate(), now, { weekStartsOn: 0 }));
      filteredFuel = fuelRecords.filter(f => isSameWeek(f.date.toDate(), now, { weekStartsOn: 0 }));
    } else if (insightFilter === 'month') {
      filteredShifts = filteredShifts.filter(s => isSameMonth(s.startTime.toDate(), now));
      filteredExpenses = expenses.filter(e => isSameMonth(e.date.toDate(), now));
      filteredFuel = fuelRecords.filter(f => isSameMonth(f.date.toDate(), now));
    }

    if (filteredShifts.length === 0) return null;

    const totalRevenue = filteredShifts.reduce((acc, s) => acc + s.totalRevenue, 0);
    const totalKmWork = filteredShifts.reduce((acc, s) => acc + (s.totalWorkKm || ((s.endKm || 0) - s.startKm)), 0);
    const totalSeconds = filteredShifts.reduce((acc, s) => acc + s.activeTimeSeconds, 0);
    const totalTrips = filteredShifts.reduce((acc, s) => acc + s.totalTrips, 0);
    
    // Personal KM logic: Sum of totalPersonalKm within shifts + gaps between shifts
    let totalKmPersonal = filteredShifts.reduce((acc, s) => acc + (s.totalPersonalKm || 0), 0);
    const allFinishedShifts = shifts.filter(s => s.status === 'finished').sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
    for (let i = 0; i < allFinishedShifts.length - 1; i++) {
      const gap = allFinishedShifts[i+1].startKm - (allFinishedShifts[i].endKm || allFinishedShifts[i].startKm);
      if (gap > 0) {
        // Only count gap if the second shift is in the filtered period
        if (filteredShifts.some(s => s.id === allFinishedShifts[i+1].id)) {
          totalKmPersonal += gap;
        }
      }
    }

    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.value, 0);
    const totalFuelValue = filteredFuel.reduce((acc, f) => acc + f.totalValue, 0);
    const totalLiters = filteredFuel.reduce((acc, f) => acc + f.liters, 0);

    // Estimated costs based on user settings
    const currentAvgCons = settings?.avgConsumption || 12.0;
    const currentFuelPrice = settings?.defaultFuelPrice || 5.50;
    const currentMaintPercentage = settings?.maintenancePercentage ?? 10;

    const estimatedFuelCost = totalKmWork > 0 ? (totalKmWork / currentAvgCons) * currentFuelPrice : 0;
    const maintenanceCost = totalRevenue * (currentMaintPercentage / 100);

    return {
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
      totalCosts: estimatedFuelCost + maintenanceCost,
      dailyGoalProgress: settings ? (totalRevenue / settings.dailyRevenueGoal) * 100 : 0
    };
  }, [shifts, expenses, fuelRecords, insightFilter, settings]);

  const todayMetrics = useMemo(() => {
    const now = new Date();
    const todayShifts = shifts.filter(s => isSameDay(s.startTime.toDate(), now));
    
    const totalRevenue = todayShifts.reduce((acc, s) => acc + s.totalRevenue, 0);
    const totalTime = todayShifts.filter(s => s.id !== activeShift?.id).reduce((acc, s) => acc + s.activeTimeSeconds, 0) + (activeShift ? elapsedTime : 0);
    const totalTrips = todayShifts.reduce((acc, s) => acc + s.totalTrips, 0);
    
    const sortedTodayShifts = [...todayShifts].sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
    const startKm = sortedTodayShifts.length > 0 ? sortedTodayShifts[0].startKm : 0;

    return { totalRevenue, totalTime, totalTrips, startKm, shiftCount: todayShifts.length };
  }, [shifts, activeShift, elapsedTime]);

  const costsMetrics = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    
    const last30DaysShifts = shifts.filter(s => s.status === 'finished' && s.startTime.toDate() >= thirtyDaysAgo);
    const last30DaysExpenses = expenses.filter(e => e.date.toDate() >= thirtyDaysAgo);
    
    const totalRevenue30Days = last30DaysShifts.reduce((acc, s) => acc + s.totalRevenue, 0);
    const maintenancePercentage = settings?.maintenancePercentage ?? 10;
    const maintenanceReserve = totalRevenue30Days * (maintenancePercentage / 100);
    
    const spentOnTires = last30DaysExpenses.filter(e => e.category === 'Pneus').reduce((acc, e) => acc + e.value, 0);
    const spentOnOil = last30DaysExpenses.filter(e => e.category === 'Óleo').reduce((acc, e) => acc + e.value, 0);
    const spentOnMaintenance = last30DaysExpenses.filter(e => e.category === 'Manutenção').reduce((acc, e) => acc + e.value, 0);
    
    const totalSpentOnCar = spentOnTires + spentOnOil + spentOnMaintenance;
    const reserveBalance = maintenanceReserve - totalSpentOnCar;

    return {
      totalRevenue30Days,
      maintenanceReserve,
      spentOnTires,
      spentOnOil,
      spentOnMaintenance,
      totalSpentOnCar,
      reserveBalance,
      maintenancePercentage
    };
  }, [shifts, expenses, settings]);

  const chartData = useMemo(() => {
    const finishedShifts = shifts
      .filter(s => s.status === 'finished')
      .slice(0, 7)
      .reverse();

    return finishedShifts.map(s => {
      const dayExpenses = expenses
        .filter(e => format(e.date.toDate(), 'dd/MM') === format(s.startTime.toDate(), 'dd/MM'))
        .reduce((acc, e) => acc + e.value, 0);
      
      const dayFuel = fuelRecords
        .filter(f => format(f.date.toDate(), 'dd/MM') === format(s.startTime.toDate(), 'dd/MM'))
        .reduce((acc, f) => acc + f.totalValue, 0);

      return {
        date: format(s.startTime?.toDate() || new Date(), 'dd/MM'),
        revenue: s.totalRevenue,
        profit: s.totalRevenue - dayExpenses - dayFuel
      };
    });
  }, [shifts, expenses, fuelRecords]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-6 text-center transition-colors relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full relative z-10"
        >
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/30 dark:shadow-blue-900/40 rotate-3 hover:rotate-0 transition-transform duration-500">
            <Car className="text-white" size={48} strokeWidth={1.5} />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
            Driver<span className="text-blue-600 dark:text-blue-500">Ops</span>
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
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                <Timer size={18} className="text-blue-600 dark:text-blue-400" />
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
            
            <Button type="submit" className="w-full py-4 text-lg font-bold shadow-xl shadow-blue-200 dark:shadow-blue-900/20 rounded-2xl">
              {isLoginMode ? 'Entrar' : 'Criar Conta'}
            </Button>
          </form>

          <button 
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setAuthError('');
            }} 
            className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-6 hover:underline"
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24 font-sans text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-4 sticky top-0 z-30 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-blue-600 p-1.5 sm:p-2 rounded-xl">
            <Car className="text-white" size={18} />
          </div>
          <div>
            <span className="font-bold text-lg sm:text-xl tracking-tight block leading-tight">Driver Lucrativo</span>
            <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-mono uppercase tracking-widest">
              {format(currentTime, 'dd/MM/yyyy HH:mm:ss')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setDarkMode(!darkMode)} 
            className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-500 transition-colors"
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
              <Card className={cn(
                "relative overflow-hidden transition-all duration-500",
                activeShift?.status === 'active' ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-900"
              )}>
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className={cn("text-sm font-bold uppercase tracking-widest opacity-70", activeShift?.status === 'active' ? "text-blue-100" : "text-gray-400 dark:text-gray-500")}>
                      Status do Turno
                    </h2>
                    <p className="text-2xl font-bold mt-1 dark:text-white">
                      {activeShift ? (activeShift.status === 'active' ? 'Em Operação' : 'Pausado') : 'Offline'}
                    </p>
                  </div>
                  <div className={cn("p-3 rounded-2xl", activeShift?.status === 'active' ? "bg-white/20" : "bg-gray-100 dark:bg-gray-800")}>
                    <Timer size={24} className={activeShift?.status === 'active' ? "text-white" : "text-gray-400 dark:text-gray-500"} />
                  </div>
                </div>

                <div className="text-center py-6">
                  <div className="text-6xl font-mono font-bold tracking-tighter mb-2 dark:text-white">
                    {formatTime(elapsedTime)}
                  </div>
                  <p className="text-sm opacity-70 font-medium dark:text-gray-400">Tempo Efetivo de Trabalho</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                  <div className={cn("p-4 rounded-2xl", activeShift?.status === 'active' ? "bg-white/10" : "bg-gray-50 dark:bg-gray-800")}>
                    <p className="text-xs font-bold uppercase opacity-60 mb-1 dark:text-gray-400">Ganhos</p>
                    <p className="text-xl font-bold dark:text-white">R$ {activeShift?.totalRevenue.toFixed(2) || '0,00'}</p>
                  </div>
                  <div className={cn("p-4 rounded-2xl", activeShift?.status === 'active' ? "bg-white/10" : "bg-gray-50 dark:bg-gray-800")}>
                    <p className="text-xs font-bold uppercase opacity-60 mb-1 dark:text-gray-400">KM Inicial</p>
                    <p className="text-xl font-bold dark:text-white">{activeShift?.startKm || '--'} km</p>
                  </div>
                </div>

                {settings && (
                  <div className="mt-8 space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase opacity-70 dark:text-gray-400">
                      <span>Meta Diária</span>
                      <span>{Math.min(100, (todayMetrics.totalRevenue / settings.dailyRevenueGoal) * 100).toFixed(0)}%</span>
                    </div>
                    <div className={cn("h-2 rounded-full overflow-hidden", activeShift?.status === 'active' ? "bg-white/20" : "bg-gray-100 dark:bg-gray-800")}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (todayMetrics.totalRevenue / settings.dailyRevenueGoal) * 100)}%` }}
                        className={cn("h-full", activeShift?.status === 'active' ? "bg-white" : "bg-blue-600")}
                      />
                    </div>
                    <p className="text-[10px] opacity-60 text-center dark:text-gray-500">
                      Faltam R$ {Math.max(0, settings.dailyRevenueGoal - todayMetrics.totalRevenue).toFixed(2)} para bater a meta de R$ {settings.dailyRevenueGoal}
                    </p>
                  </div>
                )}
              </Card>

              {/* Resumo do Dia */}
              <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Resumo de Hoje</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Ganhos do Dia</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">R$ {todayMetrics.totalRevenue.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tempo Total</p>
                    <p className="text-lg font-bold dark:text-white">{formatTime(todayMetrics.totalTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Corridas Feitas</p>
                    <p className="text-lg font-bold dark:text-white">{todayMetrics.totalTrips}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">KM Inicial do Dia</p>
                    <p className="text-lg font-bold dark:text-white">{todayMetrics.startKm > 0 ? todayMetrics.startKm : '--'} km</p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4">
                {!activeShift ? (
                  <>
                    <Button onClick={() => setShowStartModal(true)} className="py-6 text-lg" icon={Play}>
                      Iniciar Turno
                    </Button>
                    <Button onClick={() => setShowPastShiftModal(true)} variant="outline" className="py-4" icon={Calendar}>
                      Registrar Turno Passado
                    </Button>
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeShift.status === 'active' ? (
                      <Button onClick={() => setShowPauseModal(true)} variant="secondary" className="py-6" icon={Pause}>
                        Pausar
                      </Button>
                    ) : (
                      <Button onClick={() => setShowResumeModal(true)} variant="primary" className="py-6" icon={Play}>
                        Retomar
                      </Button>
                    )}
                    <Button onClick={() => setShowFinishModal(true)} variant="danger" className="py-6" icon={Square}>
                      Finalizar
                    </Button>
                    {activeShift.status === 'active' && (
                      <Button onClick={() => setShowShiftFuelModal(true)} variant="outline" className="py-6 sm:col-span-2" icon={FuelIcon}>
                        Abastecer no Turno
                      </Button>
                    )}
                  </div>
                )}
              </div>

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
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Histórico</h2>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={exportShiftsToCSV} disabled={shifts.length === 0 || isExporting} icon={Download} variant="outline" className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">
                    {isExporting ? 'Exportando...' : 'Exportar'}
                  </Button>
                  <Button onClick={() => setShowPastShiftModal(true)} icon={Calendar} variant="outline" className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">Registrar</Button>
                </div>
              </div>
              {shifts.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Nenhum turno registrado ainda.</p>
                </div>
              ) : (
                groupedShifts.map(group => {
                  const dateKey = format(group.date, 'yyyy-MM-dd');
                  const isExpanded = !!expandedDays[dateKey]; // Default to collapsed
                  return (
                    <div key={dateKey} className="space-y-3 mb-8">
                      <div 
                        className="flex justify-between items-end mb-2 px-1 cursor-pointer group"
                        onClick={() => toggleDay(dateKey)}
                      >
                        <div>
                          <p className="text-lg font-bold dark:text-white capitalize flex items-center gap-2">
                            {format(group.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                            <ChevronRight size={16} className={cn("text-gray-400 transition-transform", isExpanded && "rotate-90")} />
                          </p>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                            <span className="flex items-center gap-1"><Clock size={14} /> {formatTime(group.totalTime)}</span>
                            <span className="w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><DollarSign size={14} /> R$ {group.totalRevenue.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-3 overflow-hidden"
                          >
                            {group.shifts.map((shift, index) => (
                              <Card key={shift.id} className="hover:border-blue-200 transition-colors cursor-pointer group/card p-0 overflow-hidden ml-2 sm:ml-4 border-l-4 border-l-blue-500">
                                <div className="p-4" onClick={() => setExpandedShiftId(expandedShiftId === shift.id ? null : shift.id)}>
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Turno {group.shifts.length - index}
                                      </p>
                                      <div className="flex items-center gap-4 mt-2">
                                        <div className="flex items-center gap-1 text-gray-900 dark:text-white font-bold">
                                          <DollarSign size={16} className="text-green-500" />
                                          R$ {shift.totalRevenue.toFixed(2)}
                                        </div>
                                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 font-medium">
                                          <Clock size={16} />
                                          {formatTime(shift.activeTimeSeconds)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button 
                                        variant="ghost" 
                                        className="p-2 text-blue-500" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingShift(shift);
                                          setShowEditShiftModal(true);
                                        }}
                                        title="Editar Turno"
                                      >
                                        <Plus size={18} className="rotate-45" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        className="p-2" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedShiftId(shift.id);
                                          setShowTripModal(true);
                                        }}
                                      >
                                        <Plus size={20} />
                                      </Button>
                                      <motion.div animate={{ rotate: expandedShiftId === shift.id ? 90 : 0 }}>
                                        <ChevronRight className="text-gray-300 group-hover/card:text-blue-500 transition-colors" />
                                      </motion.div>
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
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 transition-colors">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">KM Inicial</p>
                                            <p className="font-bold dark:text-white">{shift.startKm} km</p>
                                          </div>
                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 transition-colors">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">KM Final</p>
                                            <p className="font-bold dark:text-white">{shift.endKm || shift.lastKm || '--'} km</p>
                                          </div>
                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 transition-colors">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">KM Trabalho</p>
                                            <p className="font-bold dark:text-white">{shift.totalWorkKm?.toFixed(1) || ((shift.endKm || 0) - shift.startKm).toFixed(1)} km</p>
                                          </div>
                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 transition-colors">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">R$ / KM</p>
                                            <p className="font-bold dark:text-white">R$ {(shift.totalRevenue / (shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 1)).toFixed(2)}</p>
                                          </div>
                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 transition-colors">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">R$ / Hora</p>
                                            <p className="font-bold dark:text-white">R$ {(shift.totalRevenue / (shift.activeTimeSeconds / 3600)).toFixed(2)}</p>
                                          </div>
                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 transition-colors">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">Consumo Médio</p>
                                            <p className="font-bold dark:text-white">{shift.avgConsumption?.toFixed(1) || '0.0'} km/L</p>
                                          </div>
                                        </div>
                                        
                                        {shiftTrips[shift.id] && shiftTrips[shift.id].length > 0 && (
                                          <div className="space-y-2 mt-4">
                                            <div className="flex justify-between items-center">
                                              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">Lista de Corridas</p>
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setShiftToDeleteAllTrips(shift.id);
                                                }}
                                                className="text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-bold uppercase transition-colors"
                                              >
                                                Apagar Todas
                                              </button>
                                            </div>
                                            {shiftTrips[shift.id].map(trip => {
                                              const mins = Math.floor(trip.durationSeconds / 60);
                                              const secs = trip.durationSeconds % 60;
                                              return (
                                                <div key={trip.id} className="flex justify-between items-center bg-white dark:bg-gray-900 p-2 rounded-lg text-sm border border-gray-100 dark:border-gray-800 transition-colors">
                                                  <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    <span className="font-medium dark:text-white">R$ {trip.value.toFixed(2)}</span>
                                                  </div>
                                                  <div className="flex items-center gap-3 text-gray-400 text-xs">
                                                    <span>{mins}m {secs}s</span>
                                                    <span className="w-1 h-1 bg-gray-200 rounded-full" />
                                                    <span>{trip.distanceKm?.toFixed(2)} km</span>
                                                    <div className="flex items-center">
                                                      <button 
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setEditingTrip({ shiftId: shift.id, trip });
                                                          setShowEditTripModal(true);
                                                        }}
                                                        className="p-1 hover:text-blue-500 transition-colors"
                                                      >
                                                        <Edit2 size={14} />
                                                      </button>
                                                      <button 
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setTripToDelete({ shiftId: shift.id, tripId: trip.id });
                                                        }}
                                                        className="p-1 hover:text-red-500 transition-colors"
                                                      >
                                                        <Plus size={14} className="rotate-45" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </Card>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}

          {activeTab === 'costs' && (
            <motion.div 
              key="costs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Custos</h2>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={exportExpensesToCSV} disabled={expenses.length === 0 && fuelRecords.length === 0} icon={Download} variant="outline" className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">Exportar</Button>
                  <Button onClick={() => setShowFuelModal(true)} icon={FuelIcon} variant="outline" className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">Abastecer</Button>
                  <Button onClick={() => setShowExpenseModal(true)} icon={Plus} className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">Outro</Button>
                </div>
              </div>

              {/* Maintenance Reserve 30 Days */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Resumo de Manutenção (Últimos 30 Dias)</h3>
                <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white border-none shadow-xl overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <SettingsIcon size={64} />
                  </div>
                  <div className="relative z-10 space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm text-gray-400 font-medium mb-1">Reserva Ideal ({costsMetrics.maintenancePercentage}% do Faturamento)</p>
                        <p className="text-3xl font-bold">R$ {costsMetrics.maintenanceReserve.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/10">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Pneus</p>
                        <p className="font-bold text-sm text-red-400">R$ {costsMetrics.spentOnTires.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Óleo</p>
                        <p className="font-bold text-sm text-red-400">R$ {costsMetrics.spentOnOil.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Mecânica</p>
                        <p className="font-bold text-sm text-red-400">R$ {costsMetrics.spentOnMaintenance.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-between items-center">
                      <span className="text-sm text-gray-300">Saldo da Reserva</span>
                      <span className={cn(
                        "text-lg font-bold px-3 py-1 rounded-full",
                        costsMetrics.reserveBalance >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {costsMetrics.reserveBalance >= 0 ? '+' : ''}R$ {costsMetrics.reserveBalance.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      * O saldo positivo significa que você gastou menos do que o previsto com manutenção nos últimos 30 dias. Guarde esse valor para o futuro.
                    </p>
                  </div>
                </Card>
              </div>

              {fuelRecords.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Últimos Abastecimentos</h3>
                  {fuelRecords.slice(0, 5).map(fuel => (
                    <Card 
                      key={fuel.id} 
                      className="border-l-4 border-l-blue-500 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      onClick={() => {
                        setEditingFuel(fuel);
                        setShowEditFuelModal(true);
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">R$ {fuel.totalValue.toFixed(2)}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {format(fuel.date?.toDate() || new Date(), 'dd/MM HH:mm')} • {fuel.liters.toFixed(2)}L @ R${fuel.pricePerLiter.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{fuel.km} km</p>
                          </div>
                          <ChevronRight size={16} className="text-gray-300 dark:text-gray-700 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </div>
                    </Card>
                  ))}
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
                    className="flex justify-between items-center group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    onClick={() => {
                      setEditingExpense(expense);
                      setShowEditExpenseModal(true);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-2xl text-red-500 dark:text-red-400 transition-colors">
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{expense.category}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                          {format(expense.date?.toDate() || new Date(), 'dd/MM/yyyy')} • {expense.kmAtExpense} km
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-red-500 dark:text-red-400">- R$ {expense.value.toFixed(2)}</p>
                      <ChevronRight size={16} className="text-gray-300 dark:text-gray-700 group-hover:text-red-500 transition-colors" />
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
              <div className="flex flex-wrap bg-white dark:bg-gray-900 p-1 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                {(['day', 'week', 'month'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setInsightFilter(f)}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all",
                      insightFilter === f ? "bg-blue-600 text-white shadow-md" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    )}
                  >
                    {f === 'day' ? 'Hoje' : f === 'week' ? 'Semana' : 'Mês'}
                  </button>
                ))}
              </div>

              {!metrics ? (
                <div className="text-center py-20 space-y-4">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <BarChart3 className="text-gray-300" size={32} />
                  </div>
                  <p className="text-gray-500 font-medium">Nenhum dado para este período.</p>
                </div>
              ) : (
                <>
                  {/* Resumo do Período */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 transition-colors">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Faturamento</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">R$ {metrics.totalRevenue.toFixed(2)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 transition-colors">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">KM Trabalho</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{metrics.totalKmWork.toFixed(1)} km</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 transition-colors">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">KM Pessoal</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{metrics.totalKmPersonal.toFixed(1)} km</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 transition-colors">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Tempo Total</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{metrics.totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 sm:col-span-2 transition-colors">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 text-center">Total de Viagens</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white text-center">{metrics.totalTrips}</p>
                    </div>
                  </div>

                  {/* Métricas Principais */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Métricas Principais</h3>
                    
                    <Card className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4 sm:gap-0">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0",
                          metrics.revenuePerHour >= 35 ? "bg-green-50 dark:bg-green-900/20" : metrics.revenuePerHour >= 25 ? "bg-blue-50 dark:bg-blue-900/20" : "bg-red-50 dark:bg-red-900/20"
                        )}>
                          <Clock size={20} className={metrics.revenuePerHour >= 35 ? "text-green-600 dark:text-green-400" : metrics.revenuePerHour >= 25 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">R$ / Hora</p>
                          <p className="font-bold text-lg dark:text-white">R$ {metrics.revenuePerHour.toFixed(2)}/h</p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors self-start sm:self-auto",
                        metrics.revenuePerHour >= 35 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : metrics.revenuePerHour >= 25 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      )}>
                        {metrics.revenuePerHour >= 35 ? "Excelente" : metrics.revenuePerHour >= 25 ? "Bom" : "Baixo"}
                      </div>
                    </Card>

                    <Card className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4 sm:gap-0">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0",
                          metrics.revenuePerKm >= 2.5 ? "bg-green-50 dark:bg-green-900/20" : metrics.revenuePerKm >= 1.8 ? "bg-blue-50 dark:bg-blue-900/20" : "bg-red-50 dark:bg-red-900/20"
                        )}>
                          <MapPin size={20} className={metrics.revenuePerKm >= 2.5 ? "text-green-600 dark:text-green-400" : metrics.revenuePerKm >= 1.8 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">R$ / KM</p>
                          <p className="font-bold text-lg dark:text-white">R$ {metrics.revenuePerKm.toFixed(2)}/km</p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors self-start sm:self-auto",
                        metrics.revenuePerKm >= 2.5 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : metrics.revenuePerKm >= 1.8 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      )}>
                        {metrics.revenuePerKm >= 2.5 ? "Excelente" : metrics.revenuePerKm >= 1.8 ? "Bom" : "Baixo"}
                      </div>
                    </Card>

                    <Card className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4 sm:gap-0">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0",
                          metrics.ticketMedio >= 15 ? "bg-green-50 dark:bg-green-900/20" : metrics.ticketMedio >= 10 ? "bg-blue-50 dark:bg-blue-900/20" : "bg-red-50 dark:bg-red-900/20"
                        )}>
                          <DollarSign size={20} className={metrics.ticketMedio >= 15 ? "text-green-600 dark:text-green-400" : metrics.ticketMedio >= 10 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Ticket Médio</p>
                          <p className="font-bold text-lg dark:text-white">R$ {metrics.ticketMedio.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors self-start sm:self-auto",
                        metrics.ticketMedio >= 15 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : metrics.ticketMedio >= 10 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      )}>
                        {metrics.ticketMedio >= 15 ? "Excelente" : metrics.ticketMedio >= 10 ? "Bom" : "Baixo"}
                      </div>
                    </Card>
                  </div>

                  {/* Custos e Lucro */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Custos Estimados</h3>
                    <Card className="bg-gray-900 text-white p-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                          <span className="text-gray-400 text-sm">Combustível</span>
                          <span className="font-bold">R$ {metrics.estimatedFuelCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                          <span className="text-gray-400 text-sm">Manutenção (10%)</span>
                          <span className="font-bold">R$ {metrics.maintenanceCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-lg font-bold">Lucro Líquido</span>
                          <span className="text-2xl font-bold text-green-400">R$ {metrics.estimatedProfit.toFixed(2)}</span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Resumo Mensal Consolidado */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Comparativo Mensal</h3>
                    <Card className="p-5">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase">Faturamento Mensal</p>
                          <p className="text-2xl font-bold dark:text-white">R$ {monthlySummary.currentRevenue.toFixed(2)}</p>
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold self-start sm:self-auto",
                          monthlySummary.growth >= 0 ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                        )}>
                          {monthlySummary.growth >= 0 ? <TrendingUp size={14} /> : <TrendingUp size={14} className="rotate-180" />}
                          {Math.abs(monthlySummary.growth).toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                          <span>Mês Atual: {monthlySummary.currentCount} turnos</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700 shrink-0" />
                          <span>Mês Anterior: {monthlySummary.lastCount} turnos</span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* AI Analysis */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 ml-1">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Análise Inteligente</h3>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto text-blue-600 text-xs font-bold flex items-center gap-1 self-start sm:self-auto"
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
                          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-3xl p-6 relative overflow-hidden transition-colors"
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Sparkles size={40} className="text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="prose prose-sm max-w-none text-blue-900 dark:text-blue-100 font-medium leading-relaxed markdown-body">
                            <Markdown>{aiReport}</Markdown>
                          </div>
                          <Button variant="ghost" className="mt-4 text-xs text-blue-600 p-0" onClick={() => setAiReport(null)}>Fechar</Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Evolução */}
                  <Card className="p-0 overflow-hidden">
                    <div className="p-4 border-b border-gray-50 dark:border-gray-800 transition-colors">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Evolução Recente</h3>
                    </div>
                    <div className="h-48 w-full p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1f2937" : "#f0f0f0"} />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '12px', 
                              border: 'none', 
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                              backgroundColor: darkMode ? '#111827' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }}
                            itemStyle={{ color: darkMode ? '#ffffff' : '#000000' }}
                            cursor={{ fill: darkMode ? '#1f2937' : '#f3f4f6' }}
                          />
                          <Bar dataKey="revenue" name="Faturamento" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* Melhores Dias da Semana */}
                  <Card className="p-0 overflow-hidden">
                    <div className="p-4 border-b border-gray-50 dark:border-gray-800 transition-colors">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Desempenho por Dia</h3>
                    </div>
                    <div className="h-48 w-full p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bestDaysData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1f2937" : "#f0f0f0"} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '12px', 
                              border: 'none', 
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                              backgroundColor: darkMode ? '#111827' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }}
                            itemStyle={{ color: darkMode ? '#ffffff' : '#000000' }}
                            cursor={{ fill: darkMode ? '#1f2937' : '#f3f4f6' }}
                          />
                          <Bar dataKey="avg" name="Média R$" radius={[4, 4, 0, 0]}>
                            {bestDaysData.map((entry, index) => {
                              const maxAvg = Math.max(...bestDaysData.map(d => d.avg));
                              const isMax = entry.avg > 0 && entry.avg === maxAvg;
                              return <Cell key={`cell-${index}`} fill={isMax ? '#3b82f6' : '#9ca3af'} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="px-4 pb-4">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium text-center">
                        O gráfico mostra a média de faturamento por dia da semana.
                      </p>
                    </div>
                  </Card>
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
                <SettingsForm 
                  settings={settings} 
                  onSubmit={updateSettings} 
                  onBackup={exportAllDataToJSON}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-2 sm:px-6 py-3 flex justify-between items-center z-40 shadow-2xl transition-colors">
        <NavButton active={activeTab === 'operation'} onClick={() => setActiveTab('operation')} icon={Play} label="Turno" />
        <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={History} label="Histórico" />
        <NavButton active={activeTab === 'costs'} onClick={() => setActiveTab('costs')} icon={DollarSign} label="Custos" />
        <NavButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={BarChart3} label="Insights" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={SettingsIcon} label="Ajustes" />
      </nav>

      {/* Modals */}
      <Modal isOpen={showStartModal} onClose={() => setShowStartModal(false)} title="Iniciar Turno">
        <StartShiftForm onSubmit={startShift} />
      </Modal>

      <Modal isOpen={showPauseModal} onClose={() => setShowPauseModal(false)} title="Pausar Turno">
        <PauseShiftForm onSubmit={pauseShift} currentRevenue={activeShift?.totalRevenue || 0} />
      </Modal>

      <Modal isOpen={showResumeModal} onClose={() => setShowResumeModal(false)} title="Retomar Turno">
        <ResumeShiftForm onSubmit={resumeShift} />
      </Modal>

      <Modal isOpen={showFinishModal} onClose={() => setShowFinishModal(false)} title="Finalizar Turno">
        <FinishShiftForm 
          currentRevenue={activeShift?.totalRevenue || 0} 
          onSubmit={(km, autonomy, avgCons, revenue, trips) => finishShift(km, autonomy, avgCons, revenue, trips)} 
        />
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

      <Modal isOpen={showPastShiftModal} onClose={() => setShowPastShiftModal(false)} title="Registrar Turno Passado">
        <PastShiftForm onSubmit={addPastShift} />
      </Modal>

      <Modal isOpen={showEditShiftModal} onClose={() => { setShowEditShiftModal(false); setEditingShift(null); }} title="Editar Turno">
        {editingShift && (
          <PastShiftForm 
            initialData={editingShift} 
            onSubmit={(start, end, startKm, endKm, revenue, trips, avgCons) => 
              updateShift(editingShift.id, {
                startTime: Timestamp.fromDate(start),
                endTime: Timestamp.fromDate(end),
                startKm,
                endKm,
                totalRevenue: revenue,
                totalTrips: trips,
                avgConsumption: avgCons
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

      <Modal isOpen={showTripModal} onClose={() => setShowTripModal(false)} title="Detalhar Corridas">
        {selectedShiftId && (
          <TripBatchForm 
            shift={shifts.find(s => s.id === selectedShiftId)!}
            existingTripsCount={shiftTrips[selectedShiftId]?.length || 0}
            onSubmit={async (trips) => {
              for (const trip of trips) {
                await addDoc(collection(db, 'shifts', selectedShiftId, 'trips'), {
                  userId: user?.uid,
                  shiftId: selectedShiftId,
                  value: trip.value,
                  durationSeconds: trip.durationSeconds,
                  distanceKm: trip.distanceKm,
                  timestamp: serverTimestamp()
                });
              }
              setShowTripModal(false);
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

      <Modal isOpen={showEditTripModal} onClose={() => { setShowEditTripModal(false); setEditingTrip(null); }} title="Editar Corrida">
        {editingTrip && (
          <TripForm 
            initialData={editingTrip.trip}
            onSubmit={(data) => updateTrip(editingTrip.shiftId, editingTrip.trip.id, data)}
          />
        )}
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
        active ? "text-blue-600 scale-110" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
      )}
    >
      <Icon size={22} className="sm:w-6 sm:h-6" strokeWidth={active ? 2.5 : 2} />
      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-blue-600 rounded-full mt-0.5" />}
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
        className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl transition-colors"
      >
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-8 sm:hidden" />
        <h3 className="text-2xl font-bold mb-8 tracking-tight dark:text-white">{title}</h3>
        {children}
      </motion.div>
    </div>
  );
}

// --- Forms ---

function StartShiftForm({ onSubmit }: { onSubmit: (km: number, autonomy: number) => void }) {
  const [km, setKm] = useState('');
  const [autonomy, setAutonomy] = useState('');
  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Input label="KM Total do Painel" type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="Ex: 45000" />
      <Input label="Autonomia Restante (KM)" type="number" value={autonomy} onChange={e => setAutonomy(e.target.value)} placeholder="Ex: 185" />
      <Button onClick={() => onSubmit(Number(km), Number(autonomy))} className="w-full py-4">Iniciar Agora</Button>
    </div>
  );
}

function PauseShiftForm({ onSubmit, currentRevenue }: { onSubmit: (revenue: number, km: number, autonomy: number) => void, currentRevenue: number }) {
  const [revenue, setRevenue] = useState(currentRevenue.toString());
  const [km, setKm] = useState('');
  const [autonomy, setAutonomy] = useState('');
  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Input label="Faturamento Parcial (R$)" type="number" value={revenue} onChange={e => setRevenue(e.target.value)} />
      <Input label="KM Atual" type="number" value={km} onChange={e => setKm(e.target.value)} />
      <Input label="Autonomia Restante (KM)" type="number" value={autonomy} onChange={e => setAutonomy(e.target.value)} />
      <Button onClick={() => onSubmit(Number(revenue), Number(km), Number(autonomy))} className="w-full py-4">Pausar Turno</Button>
    </div>
  );
}

function ResumeShiftForm({ onSubmit }: { onSubmit: (km?: number, autonomy?: number) => void }) {
  const [moved, setMoved] = useState<boolean | null>(null);
  const [km, setKm] = useState('');
  const [autonomy, setAutonomy] = useState('');

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
        <Button onClick={() => onSubmit()} className="w-full py-4">Confirmar Retomada</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Input label="Nova KM" type="number" value={km} onChange={e => setKm(e.target.value)} />
      <Input label="Nova Autonomia (KM)" type="number" value={autonomy} onChange={e => setAutonomy(e.target.value)} />
      <Button onClick={() => onSubmit(Number(km), Number(autonomy))} className="w-full py-4">Retomar Turno</Button>
    </div>
  );
}

function FinishShiftForm({ onSubmit, currentRevenue }: { onSubmit: (km: number, autonomy: number, avgCons: number, revenue: number, trips: number) => void, currentRevenue: number }) {
  const [km, setKm] = useState('');
  const [autonomy, setAutonomy] = useState('');
  const [avgCons, setAvgCons] = useState('');
  const [revenue, setRevenue] = useState(currentRevenue.toString());
  const [trips, setTrips] = useState('');
  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="KM Final" type="number" value={km} onChange={e => setKm(e.target.value)} />
        <Input label="Autonomia Final (KM)" type="number" value={autonomy} onChange={e => setAutonomy(e.target.value)} />
      </div>
      <Input label="Média de Consumo (KM/L)" type="number" step="0.1" value={avgCons} onChange={e => setAvgCons(e.target.value)} placeholder="Ex: 12.5" />
      <Input label="Faturamento Total (R$)" type="number" value={revenue} onChange={e => setRevenue(e.target.value)} />
      <Input label="Qtd de Corridas" type="number" value={trips} onChange={e => setTrips(e.target.value)} />
      <Button onClick={() => onSubmit(Number(km), Number(autonomy), Number(avgCons), Number(revenue), Number(trips))} variant="danger" className="w-full py-4">Finalizar Turno</Button>
    </div>
  );
}

function ExpenseForm({ onSubmit, initialData, onDelete }: { 
  onSubmit: (date: Date, category: Expense['category'], value: number, km: number) => void,
  initialData?: Expense,
  onDelete?: () => void
}) {
  const [date, setDate] = useState(initialData ? format(initialData.date.toDate(), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [category, setCategory] = useState<Expense['category']>(initialData ? initialData.category : 'Manutenção');
  const [value, setValue] = useState(initialData ? initialData.value.toString() : '');
  const [km, setKm] = useState(initialData ? initialData.kmAtExpense.toString() : '');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const categories = ['Manutenção', 'Pneus', 'Óleo', 'Limpeza', 'Alimentação', 'Seguro', 'IPVA/Licenciamento', 'Multas', 'Estacionamento', 'Pedágio', 'Internet/Celular', 'Outros'];

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Input label="Data e Hora" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
      <Select label="Categoria" options={categories} value={category} onChange={e => setCategory(e.target.value as Expense['category'])} />
      <Input label="Valor (R$)" type="number" value={value} onChange={e => setValue(e.target.value)} />
      <Input label="KM do Carro" type="number" value={km} onChange={e => setKm(e.target.value)} />
      
      <div className="space-y-3">
        {!showConfirmDelete ? (
          <>
            <Button onClick={() => onSubmit(new Date(date), category, Number(value), Number(km))} className="w-full py-4">
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
      
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
        <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Litros Estimados</p>
        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
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
  const [date, setDate] = useState(initialData ? format(initialData.date.toDate(), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [km, setKm] = useState(initialData ? initialData.km.toString() : '');
  const [price, setPrice] = useState(initialData ? initialData.pricePerLiter.toString() : '');
  const [total, setTotal] = useState(initialData ? initialData.totalValue.toString() : '');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Input label="Data e Hora" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
      <Input label="KM do Painel" type="number" value={km} onChange={e => setKm(e.target.value)} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Preço/Litro (R$)" type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
        <Input label="Valor Total (R$)" type="number" value={total} onChange={e => setTotal(e.target.value)} />
      </div>
      <div className="bg-blue-50 p-4 rounded-xl">
        <p className="text-xs text-blue-600 font-bold uppercase">Litros Estimados</p>
        <p className="text-2xl font-bold text-blue-900">
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

function PastShiftForm({ onSubmit, initialData, onDelete }: { 
  onSubmit: (start: Date, end: Date, startKm: number, endKm: number, revenue: number, trips: number, avgCons?: number) => void,
  initialData?: Shift,
  onDelete?: () => void
}) {
  const [start, setStart] = useState(initialData ? format(initialData.startTime.toDate(), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [end, setEnd] = useState(initialData && initialData.endTime ? format(initialData.endTime.toDate(), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [startKm, setStartKm] = useState(initialData ? initialData.startKm.toString() : '');
  const [endKm, setEndKm] = useState(initialData ? (initialData.endKm || '').toString() : '');
  const [revenue, setRevenue] = useState(initialData ? initialData.totalRevenue.toString() : '');
  const [trips, setTrips] = useState(initialData ? initialData.totalTrips.toString() : '');
  const [avgCons, setAvgCons] = useState(initialData ? (initialData.avgConsumption || '').toString() : '');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  return (
    <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Início" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
        <Input label="Fim" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="KM Inicial" type="number" value={startKm} onChange={e => setStartKm(e.target.value)} />
        <Input label="KM Final" type="number" value={endKm} onChange={e => setEndKm(e.target.value)} />
      </div>
      <Input label="Média de Consumo (KM/L)" type="number" step="0.1" value={avgCons} onChange={e => setAvgCons(e.target.value)} />
      <Input label="Faturamento Total (R$)" type="number" value={revenue} onChange={e => setRevenue(e.target.value)} />
      <Input label="Qtd Corridas" type="number" value={trips} onChange={e => setTrips(e.target.value)} />
      
      <div className="space-y-3">
        {!showConfirmDelete ? (
          <>
            <Button onClick={() => onSubmit(new Date(start), new Date(end), Number(startKm), Number(endKm), Number(revenue), Number(trips), Number(avgCons))} className="w-full py-4">
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

function TripForm({ initialData, onSubmit }: { 
  initialData: Trip,
  onSubmit: (data: { value: number, durationSeconds: number, distanceKm: number }) => Promise<void> | void 
}) {
  const [value, setValue] = useState(initialData.value.toString());
  const [durationMin, setDurationMin] = useState(Math.floor(initialData.durationSeconds / 60).toString());
  const [durationSec, setDurationSec] = useState((initialData.durationSeconds % 60).toString());
  const [distance, setDistance] = useState(initialData.distanceKm.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
      <div className="grid grid-cols-1 gap-4">
        <Input 
          label="Valor (R$)" 
          type="number" 
          step="0.01"
          value={value} 
          onChange={e => setValue(e.target.value)} 
          placeholder="Ex: 9.80"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="Tempo (Min)" 
            type="number" 
            value={durationMin} 
            onChange={e => setDurationMin(e.target.value)} 
            placeholder="0"
          />
          <Input 
            label="Tempo (Seg)" 
            type="number" 
            value={durationSec} 
            onChange={e => setDurationSec(e.target.value)} 
            placeholder="0"
          />
        </div>
        <Input 
          label="Distância (KM)" 
          type="number" 
          step="0.01"
          value={distance} 
          onChange={e => setDistance(e.target.value)} 
          placeholder="Ex: 1.25"
        />
      </div>

      <Button 
        disabled={isSubmitting}
        onClick={async () => {
          setIsSubmitting(true);
          try {
            await onSubmit({ 
              value: Number(value), 
              durationSeconds: (Number(durationMin) * 60) + Number(durationSec),
              distanceKm: Number(distance)
            });
          } finally {
            setIsSubmitting(false);
          }
        }} 
        className="w-full py-4"
      >
        {isSubmitting ? 'Salvando...' : 'Atualizar Corrida'}
      </Button>
    </div>
  );
}

function TripBatchForm({ shift, existingTripsCount, onSubmit }: { 
  shift: Shift, 
  existingTripsCount: number,
  onSubmit: (trips: { value: number, durationSeconds: number, distanceKm: number }[]) => Promise<void> | void 
}) {
  const remainingTrips = Math.max(0, shift.totalTrips - existingTripsCount);
  const [trips, setTrips] = useState(Array(remainingTrips).fill({ value: '', durationMin: '', durationSec: '', distance: '' }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateTrip = (index: number, field: string, val: string) => {
    const newTrips = [...trips];
    newTrips[index] = { ...newTrips[index], [field]: val };
    setTrips(newTrips);
  };

  if (remainingTrips === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <CheckCircle2 size={48} className="mx-auto text-green-500" />
        <p className="text-gray-600">Todas as {shift.totalTrips} corridas deste turno já foram detalhadas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
      <p className="text-sm text-gray-500 mb-4">
        Você marcou {shift.totalTrips} corridas para este turno. Faltam detalhar {remainingTrips}.
      </p>
      
      {trips.map((trip, i) => (
        <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl space-y-4 border border-gray-100 dark:border-gray-700 transition-colors">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Corrida #{existingTripsCount + i + 1}</p>
          <div className="grid grid-cols-1 gap-4">
            <Input 
              label="Valor (R$)" 
              type="number" 
              step="0.01"
              value={trip.value} 
              onChange={e => updateTrip(i, 'value', e.target.value)} 
              placeholder="Ex: 9.80"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Tempo (Min)" 
                type="number" 
                value={trip.durationMin} 
                onChange={e => updateTrip(i, 'durationMin', e.target.value)} 
                placeholder="0"
              />
              <Input 
                label="Tempo (Seg)" 
                type="number" 
                value={trip.durationSec} 
                onChange={e => updateTrip(i, 'durationSec', e.target.value)} 
                placeholder="0"
              />
            </div>
            <Input 
              label="Distância (KM)" 
              type="number" 
              step="0.01"
              value={trip.distance} 
              onChange={e => updateTrip(i, 'distance', e.target.value)} 
              placeholder="Ex: 1.25"
            />
          </div>
        </div>
      ))}

      <Button 
        disabled={isSubmitting}
        onClick={async () => {
          setIsSubmitting(true);
          try {
            await onSubmit(trips.map(t => ({ 
              value: Number(t.value), 
              durationSeconds: (Number(t.durationMin) * 60) + Number(t.durationSec),
              distanceKm: Number(t.distance)
            })));
          } finally {
            setIsSubmitting(false);
          }
        }} 
        className="w-full py-4 sticky bottom-0 shadow-lg"
      >
        {isSubmitting ? 'Salvando...' : `Salvar ${remainingTrips} Corridas`}
      </Button>
    </div>
  );
}

function SettingsForm({ settings, onSubmit, onBackup }: { settings: UserSettings, onSubmit: (data: Partial<UserSettings>) => void, onBackup: () => void }) {
  const [maintPerc, setMaintPerc] = useState((settings.maintenancePercentage ?? 10).toString());
  const [goal, setGoal] = useState(settings.dailyRevenueGoal.toString());
  const [fuel, setFuel] = useState(settings.defaultFuelPrice.toString());
  const [cons, setCons] = useState(settings.avgConsumption.toString());
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
        <Input label="Meta de Faturamento Diário (R$)" type="number" value={goal} onChange={e => setGoal(e.target.value)} placeholder="Ex: 250" />
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
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Troca de Óleo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Intervalo (KM)" type="number" value={oilInt} onChange={e => setOilInt(e.target.value)} />
            <Input label="Última Troca (KM)" type="number" value={oilLast} onChange={e => setOilLast(e.target.value)} />
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Rodízio de Pneus</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Intervalo (KM)" type="number" value={tireInt} onChange={e => setTireInt(e.target.value)} />
            <Input label="Último Rodízio (KM)" type="number" value={tireLast} onChange={e => setTireLast(e.target.value)} />
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Correia Dentada</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Intervalo (KM)" type="number" value={beltInt} onChange={e => setBeltInt(e.target.value)} />
            <Input label="Última Troca (KM)" type="number" value={beltLast} onChange={e => setBeltLast(e.target.value)} />
          </div>
        </div>
      </Card>

      <Button 
        onClick={() => onSubmit({
          maintenancePercentage: Number(maintPerc),
          dailyRevenueGoal: Number(goal),
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
      
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 transition-colors">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>Dica:</strong> O custo de manutenção agora é calculado como uma porcentagem do seu faturamento. 
          Um valor comum é separar 10% de tudo que você ganha para manutenção (pneus, óleo, suspensão).
        </p>
      </div>
    </div>
  );
}

