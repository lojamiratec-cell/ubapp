/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { NumericFormat } from 'react-number-format';
import { 
  Play, Pause, Square, History, DollarSign, BarChart3, 
  Plus, ChevronRight, ChevronLeft, LogOut, Car, Timer, Fuel as FuelIcon, ArrowRight,
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
  collection, doc, setDoc, addDoc, onSnapshot, query, where, orderBy, Timestamp, serverTimestamp, updateDoc, deleteDoc, getDocs, writeBatch
} from 'firebase/firestore';
import { format, differenceInSeconds, differenceInDays, startOfDay, endOfDay, subDays, subWeeks, subMonths, addWeeks, addMonths, isWithinInterval, isSameDay, isSameWeek, isSameMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
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
      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50 dark:bg-gray-800/50 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
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
  const [activeTab, setActiveTab] = useState<'operation' | 'history' | 'wallet' | 'insights' | 'settings'>('operation');
  const [historyFilter, setHistoryFilter] = useState<'week' | 'month' | 'all'>('week');
  const [historyReferenceDate, setHistoryReferenceDate] = useState(new Date());
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
  const [showTripModal, setShowTripModal] = useState(false);
  const [showPartialRevenueModal, setShowPartialRevenueModal] = useState(false);
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
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportPreviewModal, setShowImportPreviewModal] = useState(false);
  const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);
  const [showAiResultModal, setShowAiResultModal] = useState(false);
  const [analysisFilter, setAnalysisFilter] = useState<'day' | 'week' | 'month'>('week');
  const [selectedAnalysisDate, setSelectedAnalysisDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [analysisQuery, setAnalysisQuery] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRealtimeAiModal, setShowRealtimeAiModal] = useState(false);
  const [realtimeAiReport, setRealtimeAiReport] = useState<string | null>(null);
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
    if (historyFilter === 'week') {
      filteredShifts = shifts.filter(s => isSameWeek(ensureDate(s.startTime), historyReferenceDate, { weekStartsOn: 1 }));
    } else if (historyFilter === 'month') {
      filteredShifts = shifts.filter(s => isSameMonth(ensureDate(s.startTime), historyReferenceDate));
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
  }, [shifts, historyFilter, historyReferenceDate]);

  const historyRangeLabel = useMemo(() => {
    if (historyFilter === 'all') return { type: 'Todo o Período', label: 'Todos os Turnos' };
    if (historyFilter === 'week') {
      const start = startOfWeek(historyReferenceDate, { weekStartsOn: 1 });
      const end = endOfWeek(historyReferenceDate, { weekStartsOn: 1 });
      return { 
        type: 'Semana', 
        label: `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`
      };
    }
    return {
      type: 'Mês',
      label: format(historyReferenceDate, 'MMMM yyyy', { locale: ptBR })
    };
  }, [historyFilter, historyReferenceDate]);

  const prevHistoryRange = () => {
    if (historyFilter === 'week') setHistoryReferenceDate(prev => subWeeks(prev, 1));
    else if (historyFilter === 'month') setHistoryReferenceDate(prev => subMonths(prev, 1));
  };
  
  const nextHistoryRange = () => {
    if (historyFilter === 'week') setHistoryReferenceDate(prev => addWeeks(prev, 1));
    else if (historyFilter === 'month') setHistoryReferenceDate(prev => addMonths(prev, 1));
  };

  const historySummary = useMemo(() => {
    const totalRevenue = groupedShifts.reduce((acc, g) => acc + g.totalRevenue, 0);
    const totalTime = groupedShifts.reduce((acc, g) => acc + g.totalTime, 0);
    const totalKm = groupedShifts.reduce((acc, g) => acc + g.totalWorkKm, 0);
    
    const rph = totalTime > 0 ? totalRevenue / (totalTime / 3600) : 0;
    const rpkm = totalKm > 0 ? totalRevenue / totalKm : 0;
    
    return { totalRevenue, totalTime, totalKm, rph, rpkm };
  }, [groupedShifts]);

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
        const d = s.startTime.toDate();
        return d >= startDate && d <= endDate;
      });

      if (relevantShifts.length === 0) {
        setAnalysisResult("Não encontrei dados de turnos para este período para analisar.");
        setIsAnalyzing(false);
        return;
      }

      // Prepare data for AI
      const dataForAi = relevantShifts.map(s => ({
        data: format(s.startTime.toDate(), 'dd/MM/yyyy'),
        horario: `${format(s.startTime.toDate(), 'HH:mm')} - ${s.endTime ? format(s.endTime.toDate(), 'HH:mm') : 'Em andamento'}`,
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
        'Data do Turno', 'Início do Turno', 'Fim do Turno', 'Faturamento do Turno (R$)', 'Tempo Ativo do Turno', 
        'KM Inicial do Turno', 'KM Final do Turno', 'KM Trabalho do Turno', 'KM Pessoal do Turno', 'Consumo (KM/L)',
        'Data da Corrida', 'Hora da Corrida', 'Valor da Corrida (R$)', 'Duração da Corrida', 'Distância da Corrida (KM)'
      ];

      const rows: string[][] = [];

      shifts.forEach(s => {
        const shiftDate = format(s.startTime?.toDate() || new Date(), 'dd/MM/yyyy');
        const shiftStart = format(s.startTime?.toDate() || new Date(), 'HH:mm');
        const shiftEnd = s.endTime ? format((s.endTime?.toDate() || new Date()), 'HH:mm') : '--';
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
      else if (activeShift.lastStartedAt) lastStarted = activeShift.lastStartedAt.toDate();
      else lastStarted = now;
      
      const diffTime = Math.max(0, differenceInSeconds(now, lastStarted));
      const newActiveTime = activeShift.activeTimeSeconds + diffTime;
      
      const diffKm = km - activeShift.lastKm;
      const newWorkKm = activeShift.totalWorkKm + Math.max(0, diffKm);

      let lastStateChanged: Date;
      if (activeShift.stateLastChangedAt === null) lastStateChanged = now;
      else if (activeShift.stateLastChangedAt) lastStateChanged = activeShift.stateLastChangedAt.toDate();
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
        await updateDoc(settingsRef, {
          platformBalance: currentBalance + diffRevenue
        });
      }
      
      if (newKm && diffKm >= 0) {
        updates.lastKm = newKm;
        updates.totalWorkKm = newWorkKm;
      }
      
      await updateDoc(doc(db, 'shifts', activeShift.id), updates);
      setShowPartialRevenueModal(false);
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
      
      let finalIdleTime = activeShift.idleTimeSeconds || 0;
      let finalDispatchTime = activeShift.dispatchTimeSeconds || 0;
      let finalRideTime = activeShift.rideTimeSeconds || 0;

      if (activeShift.status === 'active') {
        let lastStarted: Date;
        if (activeShift.lastStartedAt === null) lastStarted = now;
        else if (activeShift.lastStartedAt) lastStarted = activeShift.lastStartedAt.toDate();
        else lastStarted = now;
        
        finalActiveTime += Math.max(0, differenceInSeconds(now, lastStarted));
        finalWorkKm += Math.max(0, km - activeShift.lastKm);

        let lastStateChanged: Date;
        if (activeShift.stateLastChangedAt === null) lastStateChanged = now;
        else if (activeShift.stateLastChangedAt) lastStateChanged = activeShift.stateLastChangedAt.toDate();
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
        await updateDoc(doc(db, 'settings', user.uid), {
          platformBalance: currentBalance + diffRevenue
        });
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
      batch.update(settingsRef, {
        platformBalance: (settings.platformBalance || 0) + value
      });

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

  const addPastShift = async (start: Date, end: Date, startKm: number, endKm: number, revenue: number, trips: number, avgCons?: number) => {
    if (!user) return;
    try {
      const activeTime = differenceInSeconds(end, start);
      const workKm = endKm - startKm;
      
      const previousShift = shifts.find(s => s.endTime && (s.endTime?.toDate() || new Date()) < start);
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
      batch.update(settingsRef, {
        platformBalance: (settings.platformBalance || 0) - fe.amount
      });
      
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
      batch.update(settingsRef, {
        platformBalance: newBalance
      });

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
      await updateDoc(doc(db, 'settings', user.uid), {
        platformBalance: newBalance
      });
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
      
      if (data.startTime && data.endTime) {
        updates.activeTimeSeconds = differenceInSeconds((data.endTime?.toDate() || new Date()), (data.startTime?.toDate() || new Date()));
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

      const now = new Date();
      let filteredShiftsForAi = shifts.filter(s => s.status === 'finished');
      if (insightFilter === 'day') {
        filteredShiftsForAi = filteredShiftsForAi.filter(s => isSameDay((s.startTime?.toDate() || new Date()), now));
      } else if (insightFilter === 'week') {
        filteredShiftsForAi = filteredShiftsForAi.filter(s => isSameWeek((s.startTime?.toDate() || new Date()), now, { weekStartsOn: 1 }));
      } else if (insightFilter === 'month') {
        filteredShiftsForAi = filteredShiftsForAi.filter(s => isSameMonth((s.startTime?.toDate() || new Date()), now));
      }

      const recentShifts = filteredShiftsForAi
        .sort((a, b) => (b.startTime?.toMillis() || 0) - (a.startTime?.toMillis() || 0))
        .slice(0, 100);

      const shiftsDataForAI = recentShifts.map(s => {
        const duration = s.activeTimeSeconds / 3600;
        const rph = duration > 0 ? s.totalRevenue / duration : 0;
        const rpkm = s.totalWorkKm > 0 ? s.totalRevenue / s.totalWorkKm : 0;
        const date = format((s.startTime?.toDate() || new Date()), 'dd/MM HH:mm');
        return `[${date}] R$${s.totalRevenue.toFixed(2)} | ${duration.toFixed(1)}h | ${s.totalWorkKm.toFixed(1)}km | ${s.totalTrips} viagens | R$/h: ${rph.toFixed(2)} | R$/km: ${rpkm.toFixed(2)}`;
      }).join('\n');

      const filterDescription = insightFilter === 'day' ? 'Hoje' : insightFilter === 'week' ? 'Nesta Semana' : 'Neste Mês';

      const prompt = `
        Atue como um Conselheiro Estratégico de Alta Performance para motoristas de aplicativo. 
        Analise os seguintes dados recentes (${filterDescription} / até 100 turnos):
        
        RESUMO GERAL:
        - Faturamento: R$ ${metrics.totalRevenue.toFixed(2)}
        - KM Rodados (Trabalho): ${metrics.totalKmWork.toFixed(2)} km
        - Tempo Total: ${metrics.totalHours.toFixed(2)} horas
        - Qtd Viagens: ${metrics.totalTrips}
        - R$/Hora Médio: R$ ${metrics.revenuePerHour.toFixed(2)}
        - Viagens/Hora: ${viagensPorHora}
        - R$/KM Médio: R$ ${metrics.revenuePerKm.toFixed(2)}
        - Ticket Médio: R$ ${metrics.ticketMedio.toFixed(2)}
        
        DADOS DOS TURNOS RECENTES:
        ${shiftsDataForAI}
        
        Sua tarefa é fornecer uma consultoria avançada seguindo EXATAMENTE esta estrutura:

        1. ANÁLISE DE PERFIL: Identifique se a estratégia atual foca mais em corridas curtas (volume) ou longas (ticket maior), baseado no ticket médio, viagens/hora e R$/km.
        2. A META IDEAL (TOP 20): Isole os 20% melhores turnos desta lista (avaliando R$/KM e R$/Hora) e calcule a média deles. Apresente essa média como a "Meta Ideal" que o motorista deve buscar todos os dias.
        3. DICAS ESTRATÉGICAS ACIONÁVEIS: Dê 2 ou 3 dicas exatas e práticas baseadas nos melhores dias e horários identificados. Exemplo: "Sábado à noite é o seu melhor momento. Procure corridas acima de R$ 25 pagando mais de R$ 2,50 o km".
        
        REGRAS IMPORTANTES:
        - A resposta DEVE ter NO MÁXIMO 1200 caracteres.
        - Seja extremamente direto, analítico e estratégico.
        - Use formatação em Markdown (negrito para números importantes).
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
        - Horas necessárias por dia: ${planningMetrics.hoursPerDay.toFixed(1)}h
        
        Crie um planejamento estratégico detalhado e motivador. 
        1. Analise se a meta é realista com base na performance atual.
        2. Dê dicas de como aumentar a eficiência (R$/km e R$/h).
        3. Organize uma sugestão de jornada diária (ex: turnos quebrados, melhores horários).
        4. Incentive o motorista.
        
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
    setShowRealtimeAiModal(true);
    setRealtimeAiReport(null);

    try {
      const apiKeyToUse = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKeyToUse) {
        setRealtimeAiReport("Chave API do Gemini não encontrada nos Ajustes.");
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
        .filter(t => t.startTime && t.startTime.toDate() >= thrityDaysAgo);

      // Helper to calculate average R$/h for a specific hour across history
      const getStatsForHour = (targetHour: number) => {
        const tripsInHour = allHistoricalTrips.filter(t => t.startTime!.toDate().getHours() === targetHour);
        const totalValue = tripsInHour.reduce((acc, t) => acc + t.value, 0);
        const totalDurationSecs = tripsInHour.reduce((acc, t) => acc + t.durationSeconds, 0);
        const totalDistance = tripsInHour.reduce((acc, t) => acc + (t.distanceKm || 0), 0);
        
        const rph = totalDurationSecs > 0 ? totalValue / (totalDurationSecs / 3600) : 0;
        const rpkm = totalDistance > 0 ? totalValue / totalDistance : 0;
        return { rph, rpkm, count: tripsInHour.length };
      };

      const histCurrent = getStatsForHour(currentHour);
      const histNext = getStatsForHour(nextHour);

      const prompt = `Você é o estrategista de alta performance de um motorista de aplicativo. Use tom direto e focado em resultado.

[DADOS DO TURNO ATUAL]
- Rodando há: ${currentHours.toFixed(1)}h
- Corridas feitas: ${qtdTrips}
- Faturamento Atual: R$ ${activeShift.totalRevenue.toFixed(2)}
- R$/Hora atual: R$ ${currentRph.toFixed(2)}
- R$/Km atual: R$ ${currentRpkm.toFixed(2)}

[HISTÓRICO NOS ÚLTIMOS 30 DIAS]
- Nesta hora (${currentHour}h): Média de R$ ${histCurrent.rph.toFixed(2)}/h (Baseado em ${histCurrent.count} corridas)
- Na PRÓXIMA HORA (${nextHour}h): Média de R$ ${histNext.rph.toFixed(2)}/h (Baseado em ${histNext.count} corridas)

[SUA MISSÃO E REGRAS MATEMÁTICAS]
1. Ideal: >= R$ 40/h | Aceitável: R$ 35 a R$ 39/h | Ruim: R$ 30 a R$ 34/h | Crítico: < R$ 30/h.
2. Analise a hora atual e a previsão da próxima hora. Se a atual estiver ruim mas a próxima costuma ser excelente, motive-o a continuar. Se ambas forem ruins, sugira pausa/término.
3. Use NO MÁXIMO 250 caracteres (seja super breve).
4. Siga este exato formato com bullet points curtos:
* 🎯 Diagnóstico: [Avalie o agora e a próxima hora]
* 🛣️ Ação: [Continuar / Pausar / Parar]
* 💡 Foco Agora: [Dica exata de corrida ex: "Até 5km, max 20min, min R$12"]`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setRealtimeAiReport(response.text || "Erro ao gerar análise.");
    } catch (err) {
      console.error(err);
      setRealtimeAiReport("Erro de comunicação com a IA.");
    } finally {
      setIsGeneratingRealtimeAi(false);
    }
  };

  // --- Calculations ---

  const monthlySummary = useMemo(() => {
    const now = new Date();
    const currentMonthShifts = shifts.filter(s => s.status === 'finished' && isSameMonth((s.startTime?.toDate() || new Date()), now));
    const lastMonthShifts = shifts.filter(s => s.status === 'finished' && isSameMonth((s.startTime?.toDate() || new Date()), subMonths(now, 1)));

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
      const day = (s.startTime?.toDate() || new Date()).getDay();
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
      const startHour = (s.startTime?.toDate() || new Date()).getHours();
      const endHour = s.endTime ? (s.endTime?.toDate() || new Date()).getHours() : startHour;
      const revenue = s.totalRevenue;
      const activeSeconds = s.activeTimeSeconds;
      
      // If shift is within the same day, distribute evenly
      if (s.endTime && (s.startTime?.toDate() || new Date()).getDate() === (s.endTime?.toDate() || new Date()).getDate()) {
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

  const heatmapData = useMemo(() => {
    const days = [0, 1, 2, 3, 4, 5, 6]; // Dom to Sáb
    const stats: { [key: string]: { revenue: number, seconds: number } } = {};
    let minH = 23;
    let maxH = 0;
    
    shifts.filter(s => s.status === 'finished').forEach(s => {
      const date = ensureDate(s.startTime);
      const day = date.getDay();
      const startHour = date.getHours();
      const endHour = s.endTime ? ensureDate(s.endTime).getHours() : startHour;
      
      const revenue = s.totalRevenue;
      const activeSeconds = s.activeTimeSeconds;
      const durationHours = Math.max(1, (endHour < startHour ? endHour + 24 : endHour) - startHour + 1);
      
      for (let i = 0; i < durationHours; i++) {
        const h = (startHour + i) % 24;
        const key = `${day}-${h}`;
        if (!stats[key]) stats[key] = { revenue: 0, seconds: 0 };
        stats[key].revenue += revenue / durationHours;
        stats[key].seconds += activeSeconds / durationHours;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    });

    // Provide some padding or default bounds if too narrow
    if (minH > maxH) { minH = 5; maxH = 22; }
    else {
      minH = Math.max(0, minH - 1);
      maxH = Math.min(23, maxH + 1);
    }

    const result: { day: number, hour: number, avgPerHour: number }[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = minH; h <= maxH; h++) {
        const key = `${d}-${h}`;
        result.push({
          day: d,
          hour: h,
          avgPerHour: stats[key] && stats[key].seconds > 0 ? stats[key].revenue / (stats[key].seconds / 3600) : 0
        });
      }
    }
    return { data: result, minH, maxH };
  }, [shifts]);

  const fuelTrends = useMemo(() => {
    const sortedFuel = [...fuelRecords].sort((a, b) => ensureDate(a.date).getTime() - ensureDate(b.date).getTime());
    if (sortedFuel.length < 2) return null;
    
    const consumptionHistory: { date: string, kmL: number }[] = [];
    
    for (let i = 1; i < sortedFuel.length; i++) {
      const current = sortedFuel[i];
      const prev = sortedFuel[i-1];
      const dist = current.km - prev.km;
      if (dist > 0 && current.liters > 0) {
        consumptionHistory.push({
          date: format(ensureDate(current.date), 'dd/MM'),
          kmL: dist / current.liters
        });
      }
    }
    
    const recent = consumptionHistory.slice(-5);
    const avgRecent = recent.length > 0 ? recent.reduce((acc, val) => acc + val.kmL, 0) / recent.length : 0;
    const baseline = settings?.avgConsumption || 12;
    const diff = baseline > 0 ? ((avgRecent - baseline) / baseline) * 100 : 0;
    
    return {
      history: consumptionHistory,
      avgRecent,
      diff,
      status: diff < -5 ? 'bad' : diff > 5 ? 'good' : 'stable'
    };
  }, [fuelRecords, settings]);

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

  const metrics = useMemo(() => {
    const now = new Date();
    let filteredShifts = shifts.filter(s => s.status === 'finished');
    let filteredExpenses = expenses;
    let filteredFuel = fuelRecords;

    if (insightFilter === 'day') {
      filteredShifts = filteredShifts.filter(s => isSameDay((s.startTime?.toDate() || new Date()), now));
      filteredExpenses = expenses.filter(e => isSameDay((e.date?.toDate() || new Date()), now));
      filteredFuel = fuelRecords.filter(f => isSameDay((f.date?.toDate() || new Date()), now));
    } else if (insightFilter === 'week') {
      filteredShifts = filteredShifts.filter(s => isSameWeek((s.startTime?.toDate() || new Date()), now, { weekStartsOn: 1 }));
      filteredExpenses = expenses.filter(e => isSameWeek((e.date?.toDate() || new Date()), now, { weekStartsOn: 1 }));
      filteredFuel = fuelRecords.filter(f => isSameWeek((f.date?.toDate() || new Date()), now, { weekStartsOn: 1 }));
    } else if (insightFilter === 'month') {
      filteredShifts = filteredShifts.filter(s => isSameMonth((s.startTime?.toDate() || new Date()), now));
      filteredExpenses = expenses.filter(e => isSameMonth((e.date?.toDate() || new Date()), now));
      filteredFuel = fuelRecords.filter(f => isSameMonth((f.date?.toDate() || new Date()), now));
    }

    if (filteredShifts.length === 0) return null;

    const totalRevenue = filteredShifts.reduce((acc, s) => acc + s.totalRevenue, 0);
    const totalKmWork = filteredShifts.reduce((acc, s) => acc + (s.totalWorkKm || ((s.endKm || 0) - s.startKm)), 0);
    const totalSeconds = filteredShifts.reduce((acc, s) => acc + s.activeTimeSeconds, 0);
    const totalTrips = filteredShifts.reduce((acc, s) => acc + s.totalTrips, 0);
    
    // Personal KM logic: Sum of totalPersonalKm within shifts, and calculate gaps for old shifts
    const allFinishedShifts = shifts.filter(s => s.status === 'finished').sort((a, b) => (a.startTime?.toMillis() || 0) - (b.startTime?.toMillis() || 0));
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
      personalFuelCost,
      personalFuelLiters,
      totalFuelValue,
      totalLiters,
      totalCosts: estimatedFuelCost + maintenanceCost,
      maintenancePercentage: currentMaintPercentage,
      dailyGoalProgress: settings ? (totalRevenue / settings.dailyRevenueGoal) * 100 : 0
    };
  }, [shifts, expenses, fuelRecords, insightFilter, settings]);

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

    const totalKmDriven = allTodayShifts.reduce((acc, s) => {
      const workKm = s.totalWorkKm || (s.endKm ? s.endKm - s.startKm : (s.lastKm ? s.lastKm - s.startKm : 0));
      return acc + (Number(workKm) || 0);
    }, 0);

    return { 
      totalRevenue, 
      totalTime, 
      totalTrips, 
      startKm, 
      maxKm,
      totalKmDriven,
      shiftCount: allTodayShifts.length 
    };
  }, [shifts, activeShift, elapsedTime]);

  const costsMetrics = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    
    const last30DaysShifts = shifts.filter(s => s.status === 'finished' && (s.startTime?.toDate() || new Date()) >= thirtyDaysAgo);
    const last30DaysExpenses = expenses.filter(e => (e.date?.toDate() || new Date()) >= thirtyDaysAgo);
    const last30DaysFuel = fuelRecords.filter(f => (f.date?.toDate() || new Date()) >= thirtyDaysAgo);
    
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

    // Fuel Estimation
    const last30Fuel = fuelRecords.filter(f => ensureDate(f.date) >= thirtyDaysAgo);
    const totalFuel30 = last30Fuel.reduce((acc, f) => acc + (Number(f.totalValue) || 0), 0);
    
    const rawFuelRatio = totalRev30 > 0 ? (totalFuel30 / totalRev30) : 0.25;
    const safeFuelRatio = Math.min(0.5, Math.max(0.05, rawFuelRatio)); // keeps it between 5% and 50%
    
    // Margin calculation
    const marginRatio = 1 - safeFuelRatio;
    
    // Gross Goal = (Net + Fixed + Extra Expense) / Margem
    const revenueNeededTotal = (monthlyNetGoal + totalFixed + totalExtraExpenses) / marginRatio;
    const revenueRemaining = Math.max(0, revenueNeededTotal - revenueSoFar);
    
    const dailyNeeded = revenueRemaining / daysRemaining;

    // Projections
    const hoursPerDay = dailyNeeded / avgRph;
    const kmPerDay = dailyNeeded / avgRpkm;
    
    const totalHoursRemaining = revenueRemaining / avgRph;
    const estimatedFuelCostRemaining = revenueRemaining * safeFuelRatio;

    const progressPerc = Math.min(100, (revenueSoFar / revenueNeededTotal) * 100);

    return {
      totalFixed,
      totalExtraExpenses,
      monthlyNetGoal,
      revenueNeededTotal,
      revenueSoFar,
      revenueRemaining,
      dailyNeeded,
      hoursPerDay,
      kmPerDay,
      progressPerc,
      daysRemaining,
      avgRph,
      avgRpkm,
      totalHoursRemaining,
      estimatedFuelCostRemaining,
      safeFuelRatio,
      workDays
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
        .filter(e => format((e.date?.toDate() || new Date()), 'dd/MM') === format((s.startTime?.toDate() || new Date()), 'dd/MM'))
        .reduce((acc, e) => acc + e.value, 0);
      
      const dayFuel = fuelRecords
        .filter(f => format((f.date?.toDate() || new Date()), 'dd/MM') === format((s.startTime?.toDate() || new Date()), 'dd/MM'))
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
                  </div>
                )}
              </div>

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

                {activeShift?.status === 'active' && (
                  <div className="mt-8">
                    <Button 
                      onClick={() => changeShiftState(activeShift.currentState === 'ride' ? 'idle' : 'ride')} 
                      variant="outline"
                      className={cn(
                        "w-full py-6 border-none transition-all duration-300", 
                        activeShift.currentState === 'ride' 
                          ? "bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.6)] scale-100" 
                          : "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.6)] hover:bg-blue-500 scale-100"
                      )} 
                      icon={activeShift.currentState === 'ride' ? CheckCircle2 : Users}
                    >
                      {activeShift.currentState === 'ride' ? 'Finalizar Corrida' : 'Com Passageiro'}
                    </Button>
                  </div>
                )}

                {activeShift?.status === 'active' && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <Button 
                      onClick={() => setShowPartialRevenueModal(true)} 
                      variant="outline" 
                      className={cn(
                        "w-full py-4 text-xs sm:text-sm transition-all duration-500",
                        elapsedTime >= 3600 && (elapsedTime % 3600) < 300 
                          ? "animate-pulse-red shadow-[0_0_15px_rgba(239,68,68,0.5)] z-10" 
                          : "bg-white/10 text-white/90 border-white/20 hover:bg-white/20"
                      )}
                    >
                      Ganhos (parcial)
                    </Button>
                    <Button 
                      onClick={() => generateRealtimeAiAnalysis()} 
                      variant="outline" 
                      className="w-full py-4 bg-white/10 text-white/90 border-white/20 hover:bg-white/20 text-xs sm:text-sm"
                      icon={Sparkles}
                    >
                      IA: Devo Continuar?
                    </Button>
                  </div>
                )}
              </Card>

              {settings && planningMetrics && (
                <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                  <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 text-center uppercase tracking-widest mb-6">Meta Diária</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{Math.min(100, (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) * 100).toFixed(0)}<span className="text-xl text-gray-400">%</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-500 uppercase">Progresso</p>
                        <p className="font-bold text-gray-900 dark:text-white">R$ {todayMetrics.totalRevenue.toFixed(2)} / <span className="text-gray-400">R$ {planningMetrics.dailyNeeded.toFixed(2)}</span></p>
                      </div>
                    </div>
                    
                    <div className="relative pt-2 pb-2">
                       <div className="h-10 rounded-full bg-gray-100 dark:bg-gray-800 w-full overflow-hidden relative border border-gray-200 dark:border-gray-700 shadow-inner">
                         {/* Track Grid */}
                         <div className="absolute inset-0 w-full flex pointer-events-none">
                            {[25, 50, 75].map(mark => (
                              <div key={mark} className="flex-1 border-r border-gray-300 dark:border-gray-600 opacity-40 z-10 last:border-0" />
                            ))}
                         </div>
                         
                         {/* Progress Fill */}
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${Math.min(100, (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) * 100)}%` }}
                           transition={{ duration: 1, type: "spring", stiffness: 50 }}
                           className={cn(
                             "h-full absolute left-0 top-0 bottom-0 z-10 transition-colors duration-500", 
                             (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) >= 1 
                               ? "bg-green-500" 
                               : (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) >= 0.75
                               ? "bg-sky-500"
                               : (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) >= 0.5
                               ? "bg-yellow-500"
                               : "bg-blue-600"
                           )}
                         >
                            <div className="absolute inset-0 bg-white/20" style={{ transform: 'skewX(-20deg)', width: '200%', animation: 'slide-right 2s linear infinite' }} />
                         </motion.div>

                         {/* End Flag */}
                         <div className="absolute right-3 top-0 bottom-0 flex items-center justify-center z-10">
                           <span className="text-xl drop-shadow opacity-90 grayscale">🏁</span>
                         </div>
                         
                         {/* The moving car inside the bar bounds */}
                         <motion.div 
                           initial={{ left: '0%', x: '0%' }}
                           animate={{ 
                             left: `${Math.min(100, (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) * 100)}%`,
                             x: `-${Math.min(100, (todayMetrics.totalRevenue / planningMetrics.dailyNeeded) * 100)}%`
                           }}
                           transition={{ duration: 1, type: "spring", stiffness: 50 }}
                           className="absolute top-0 bottom-0 flex items-center justify-center z-20 px-1 drop-shadow-md"
                         >
                           <span className="text-3xl block" style={{ transform: 'scaleX(-1) translateY(1px)' }}>🚕</span>
                         </motion.div>
                       </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mt-4">
                      <p className="text-xs text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
                        Faltam <span className="font-bold">R$ {Math.max(0, planningMetrics.dailyNeeded - todayMetrics.totalRevenue).toFixed(2)}</span> para bater a meta de R$ {planningMetrics.dailyNeeded.toFixed(2)}. 
                        {todayMetrics.totalTime > 0 && todayMetrics.totalRevenue > 0 ? (
                           <> Com base no seu R$/hora atual (R$ {(todayMetrics.totalRevenue / (todayMetrics.totalTime / 3600)).toFixed(2)}/h), mais <span className="font-bold">{formatTime(Math.max(0, planningMetrics.dailyNeeded - todayMetrics.totalRevenue) / ((todayMetrics.totalRevenue / (todayMetrics.totalTime / 3600)) / 3600))}</span> trabalhando sua meta é atingida.</>
                        ) : ' Faça algumas corridas para analisarmos a precisão e tempo de término.'}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

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
                    <p className="text-xs text-gray-500 dark:text-gray-400">R$ / Hora Atual</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">R$ {todayMetrics.totalTime > 0 ? (todayMetrics.totalRevenue / (todayMetrics.totalTime / 3600)).toFixed(2) : '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Corridas Feitas</p>
                    <p className="text-lg font-bold dark:text-white">{todayMetrics.totalTrips}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">KM Atual do Turno</p>
                    <p className="text-lg font-bold dark:text-white">{todayMetrics.maxKm > 0 ? todayMetrics.maxKm : '--'} km</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">R$ / KM Parcial</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">R$ {todayMetrics.totalKmDriven > 0 ? (todayMetrics.totalRevenue / todayMetrics.totalKmDriven).toFixed(2) : '0.00'}</p>
                  </div>
                </div>
              </Card>

              {activeShift?.status === 'active' && (
                <Button onClick={() => setShowShiftFuelModal(true)} variant="outline" className="w-full py-6 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800" icon={FuelIcon}>
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

              {activeShift?.status === 'active' && (
                <div className="mt-8">
                  <Button 
                    onClick={() => {
                        setAnalysisFilter('day');
                        setAnalysisQuery('Devo continuar rodando agora? Faça uma análise de custo/benefício rápida (max 200 caracteres), estou rodando agora.');
                        handleHistoryAIAnalysis();
                    }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-200 dark:shadow-none transition-all group overflow-hidden relative flex items-center justify-center gap-2"
                  >
                    <Sparkles size={18} />
                    <span>IA: Devo Continuar?</span>
                  </Button>
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
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <h2 className="text-2xl font-bold dark:text-white">Histórico</h2>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setShowImportModal(true)} icon={Upload} variant="outline" className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">
                      Importar
                    </Button>
                    <Button onClick={exportShiftsToCSV} disabled={shifts.length === 0 || isExporting} icon={Download} variant="outline" className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">
                      {isExporting ? 'Exportando...' : 'Exportar'}
                    </Button>
                    <Button onClick={() => setShowPastShiftModal(true)} icon={Calendar} variant="outline" className="py-2 px-3 text-sm flex-1 sm:flex-none justify-center">Registrar</Button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-auto">
                    <button onClick={() => setHistoryFilter('week')} className={cn("flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all", historyFilter === 'week' ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600")}>Semana</button>
                    <button onClick={() => setHistoryFilter('month')} className={cn("flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all", historyFilter === 'month' ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600")}>Mês</button>
                    <button onClick={() => setHistoryFilter('all')} className={cn("flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all", historyFilter === 'all' ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600")}>Tudo</button>
                  </div>

                  {historyFilter !== 'all' && (
                    <div className="flex items-center justify-between sm:justify-start gap-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                      <button 
                        onClick={prevHistoryRange}
                        className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-none hover:shadow-sm"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="text-center min-w-[120px]">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none mb-0.5">{historyRangeLabel.type}</p>
                        <p className="text-xs font-bold dark:text-white capitalize">{historyRangeLabel.label}</p>
                      </div>
                      <button 
                        onClick={nextHistoryRange}
                        className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-none hover:shadow-sm"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {shifts.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 opacity-70 mb-0.5">Faturamento</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-200 tracking-tight">R$ {historySummary.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 opacity-70 mb-0.5">Tempo Total</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-200 tracking-tight">
                        {Math.floor(historySummary.totalTime / 3600)}h {Math.floor((historySummary.totalTime % 3600) / 60)}m
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 opacity-70 mb-0.5">Média R$/Hora</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-200 tracking-tight">R$ {historySummary.rph.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 opacity-70 mb-0.5">Média R$/KM</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-200 tracking-tight">R$ {historySummary.rpkm.toFixed(2)}</p>
                    </div>
                  </div>
                )}
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
                  const rph = group.totalTime > 0 ? group.totalRevenue / (group.totalTime / 3600) : 0;
                  const rpkm = group.totalWorkKm > 0 ? group.totalRevenue / group.totalWorkKm : 0;
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
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                            <span className="flex items-center gap-1"><Clock size={14} /> {formatTime(group.totalTime)}</span>
                            <span className="w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><DollarSign size={14} /> R$ {group.totalRevenue.toFixed(2)}</span>
                            <span className="w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full hidden sm:block" />
                            <span className="flex items-center gap-1"><TrendingUp size={14} /> R$ {rph.toFixed(2)}/h</span>
                            <span className="w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full hidden sm:block" />
                            <span className="flex items-center gap-1"><MapPin size={14} /> R$ {rpkm.toFixed(2)}/km</span>
                          </div>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-3 overflow-hidden px-1"
                          >
                            {group.shifts.map((shift, index) => (
                              <Card key={shift.id} className="hover:border-blue-200 transition-all duration-300 cursor-pointer group/card p-0 overflow-hidden ml-2 sm:ml-4 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 focus-within:ring-2 focus-within:ring-blue-500">
                                <div className="p-4" onClick={() => setExpandedShiftId(expandedShiftId === shift.id ? null : shift.id)}>
                                  <div className="flex justify-between items-center sm:items-start">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg flex items-center justify-center shrink-0">
                                            <Car size={18} className="text-blue-600 dark:text-blue-400" />
                                          </div>
                                          <p className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none">
                                            Turno {group.shifts.length - index}
                                          </p>
                                        </div>
                                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                          <Clock size={12} className="inline mr-1 opacity-70 mb-0.5" />
                                          {format(ensureDate(shift.startTime), 'HH:mm')} - {shift.endTime ? format(ensureDate(shift.endTime), 'HH:mm') : 'Agora'}
                                        </p>
                                      </div>
                                      
                                      <div className="flex items-baseline gap-1 mb-3">
                                        <span className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                                          R$ {shift.totalRevenue.toFixed(2)}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 text-xs font-bold bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                                          <Clock size={14} className="opacity-70 text-gray-400" />
                                          {formatTime(shift.activeTimeSeconds)}
                                        </div>
                                        {shift.totalTrips > 0 && (
                                          <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5 rounded-lg border border-blue-100/50 dark:border-blue-800/30">
                                            <Users size={14} className="opacity-70 text-blue-500" />
                                            {shift.totalTrips} Corridas
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1.5 rounded-lg border border-indigo-100/50 dark:border-indigo-800/30">
                                          <MapPin size={14} className="opacity-70 text-indigo-500" />
                                          {(shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 0).toFixed(1)} km
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                                        <div className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                                          <span className="text-blue-600 dark:text-blue-400">{shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) > 0 ? `R$ ${(shift.totalRevenue / ((shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 1))).toFixed(2)}` : 'R$ 0.00'}</span>/km
                                        </div>
                                        <div className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                                          <span className="text-green-600 dark:text-green-400">{shift.activeTimeSeconds > 0 ? `R$ ${(shift.totalRevenue / (shift.activeTimeSeconds / 3600)).toFixed(2)}` : 'R$ 0.00'}</span>/h
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4 self-center sm:self-start">
                                      <button 
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all active:scale-95 shadow-sm" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedShiftId(shift.id);
                                          setShowTripModal(true);
                                        }}
                                        title="Adicionar Corrida"
                                      >
                                        <Plus size={20} strokeWidth={3} />
                                      </button>
                                      
                                      <button 
                                        className="flex w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingShift(shift);
                                          setShowEditShiftModal(true);
                                        }}
                                        title="Editar Turno"
                                      >
                                        <Edit2 size={16} />
                                      </button>

                                      <motion.div 
                                        animate={{ rotate: expandedShiftId === shift.id ? 90 : 0 }}
                                        className="w-8 h-8 flex items-center justify-center text-gray-300 dark:text-gray-600"
                                      >
                                        <ChevronRight size={24} />
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
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-100 dark:border-gray-800/60 shadow-sm transition-colors">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-widest mb-1">Trajeto (KM)</p>
                                            <div className="flex items-center justify-between text-sm font-bold dark:text-white">
                                              <span>{shift.startKm}</span>
                                              <ArrowRight size={12} className="text-gray-300" />
                                              <span>{shift.endKm || shift.lastKm || '--'}</span>
                                            </div>
                                          </div>
                                          
                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-100 dark:border-gray-800/60 shadow-sm transition-colors">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-widest mb-1">Distância Real</p>
                                            <p className="text-sm font-bold dark:text-white">{(shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm)).toFixed(1)} <span className="text-[10px] font-medium text-gray-400">km</span></p>
                                          </div>

                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-100 dark:border-gray-800/60 shadow-sm transition-colors">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-widest mb-1">Rentabilidade</p>
                                            <div className="space-y-1">
                                              <p className="text-sm font-bold text-blue-600 dark:text-blue-400 leading-none">R$ {(shift.totalRevenue / (shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 1)).toFixed(2)}/km</p>
                                              <p className="text-sm font-bold text-green-600 dark:text-green-400 leading-none">R$ {(shift.totalRevenue / (shift.activeTimeSeconds / 3600)).toFixed(2)}/h</p>
                                            </div>
                                          </div>

                                          <div className="bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-100 dark:border-gray-800/60 shadow-sm transition-colors flex flex-col justify-between">
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-widest mb-1">Carro / Consumo</p>
                                            <p className="text-sm font-bold dark:text-white mb-2">{shift.avgConsumption?.toFixed(1) || '0.0'} <span className="text-[10px] font-medium text-gray-400">km/L</span></p>
                                            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded-lg space-y-1 text-xs">
                                              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                                                <span>Gasto est.:</span>
                                                <span className="font-bold">~{((shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 0) / (shift.avgConsumption || 1)).toFixed(1)}L</span>
                                              </div>
                                              <div className="flex justify-between items-center text-red-500 dark:text-red-400">
                                                <span>Custo est.:</span>
                                                <span className="font-bold">-R$ {(((shift.totalWorkKm || ((shift.endKm || 0) - shift.startKm) || 0) / (shift.avgConsumption || 1)) * (settings?.defaultFuelPrice || 0)).toFixed(2)}</span>
                                              </div>
                                            </div>
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
                                              const tripHour = trip.startTime ? format(ensureDate(trip.startTime), 'HH:mm') : null;
                                              const tripRph = trip.value / (trip.durationSeconds / 3600);
                                              
                                              let dotColor = "bg-red-600"; // <30
                                              if (tripRph > 40) {
                                                dotColor = "bg-green-500";
                                              } else if (tripRph > 35) {
                                                dotColor = "bg-yellow-500";
                                              } else if (tripRph >= 30) {
                                                dotColor = "bg-orange-500";
                                              }

                                              return (
                                                <div key={trip.id} className="flex justify-between items-center bg-white dark:bg-gray-900 px-3 py-2.5 rounded-xl text-sm border border-gray-100 dark:border-gray-800 shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition-all hover:border-blue-100 dark:hover:border-blue-900 group/trip">
                                                  <div className="flex items-center gap-1 sm:gap-3 w-full">
                                                    <div className="flex flex-col items-center min-w-[32px]">
                                                      <div className={cn("w-2.5 h-2.5 rounded-full mb-1", dotColor)} title={`R$ ${tripRph.toFixed(0)}/h`} />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-1 w-full flex-wrap sm:flex-nowrap">
                                                       {tripHour && <span className="text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums w-10 shrink-0">{tripHour}</span>}
                                                       <span className="font-black text-gray-900 dark:text-white text-sm shrink-0 min-w-[60px]">R$ {trip.value.toFixed(2)}</span>
                                                       <div className="hidden sm:flex h-3 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                                                       <span className="text-xs text-gray-500 dark:text-gray-400 font-bold shrink-0 tabular-nums">
                                                         {mins > 0 ? `${mins}m ` : ''}{secs}s
                                                       </span>
                                                       <div className="hidden sm:flex h-3 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                                                       <span className="text-xs text-indigo-500 dark:text-indigo-400 font-bold shrink-0 tabular-nums">
                                                         {trip.distanceKm ? `${trip.distanceKm.toFixed(1)} km` : '--'}
                                                       </span>
                                                    </div>
                                                  </div>
                                                  <div className="flex gap-1 opacity-0 group-hover/trip:opacity-100 transition-opacity ml-2 shrink-0">
                                                    <button 
                                                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingTrip({ shiftId: shift.id, trip });
                                                        setShowEditTripModal(true);
                                                      }}
                                                    >
                                                      <Edit2 size={14} />
                                                    </button>
                                                    <button 
                                                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setTripToDelete({ shiftId: shift.id, tripId: trip.id });
                                                      }}
                                                    >
                                                      <X size={14} />
                                                    </button>
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

              {/* AI Analysis Floating Button at the end of history */}
              <div className="pt-6 pb-20">
                <Button 
                  onClick={() => setShowAiAnalysisModal(true)}
                  className="w-full py-6 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-200 dark:shadow-none transition-all group overflow-hidden relative"
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
                      <p className="text-xs font-black uppercase tracking-widest opacity-80">Inteligência Artificial</p>
                      <p className="text-lg font-bold">Análise de IA</p>
                    </div>
                  </div>
                </Button>
                <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 mt-4 font-medium uppercase tracking-tighter">
                  Analise seu desempenho diário, semanal ou mensal com IA
                </p>
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
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                  <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-4 -translate-y-4">
                    <Wallet size={120} />
                  </div>
                  <p className="text-sm font-medium text-blue-100 mb-1">Saldo Plataforma (Uber)</p>
                  <h3 className="text-4xl font-black tracking-tight relative z-10">R$ {settings?.platformBalance?.toFixed(2) || '0.00'}</h3>
                </div>

                {planningMetrics && (
                  <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-gray-900 border-indigo-100 dark:border-indigo-800 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Target size={120} />
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Resumo do Mês</h3>
                          <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100 italic">
                            Faltam {planningMetrics.daysRemaining} dias úteis
                          </p>
                        </div>
                        <button 
                          onClick={() => setShowMonthlyGoalModal(true)}
                          className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl hover:scale-110 transition-transform"
                          title="Editar Meta de Lucro"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>

                      <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/30 mb-6">
                        <p className="text-[10px] text-white/70 font-bold uppercase mb-1">Faturamento Bruto Necessário</p>
                        <div className="flex items-baseline gap-2">
                           <p className="text-3xl font-black leading-tight">R$ {planningMetrics.revenueNeededTotal.toFixed(0)}</p>
                        </div>
                        <p className="text-xs mt-2 text-indigo-100">Falta faturar <span className="font-bold text-white">R$ {planningMetrics.revenueRemaining.toFixed(2)}</span> p/ fechar.</p>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-6 space-y-2">
                        <div className="flex justify-between text-[11px] font-black text-indigo-900/60 dark:text-indigo-100/60 uppercase tracking-tighter">
                          <span>R$ {planningMetrics.revenueSoFar.toFixed(0)} feitos</span>
                          <span>{planningMetrics.progressPerc.toFixed(1)}%</span>
                        </div>
                        <div className="h-4 bg-indigo-200/40 dark:bg-indigo-950/50 rounded-full overflow-hidden border border-indigo-200/30 p-0.5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${planningMetrics.progressPerc}%` }}
                            className="h-full bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-indigo-50 dark:border-indigo-900/30 flex flex-col justify-center">
                          <p className="text-[10px] text-indigo-600/60 dark:text-indigo-400/60 font-bold uppercase tracking-tight">Meta Diária Inteligente</p>
                          <p className="text-lg font-black text-indigo-900 dark:text-indigo-100">R$ {planningMetrics.dailyNeeded.toFixed(0)}</p>
                        </div>
                        <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-indigo-50 dark:border-indigo-900/30 flex flex-col justify-center">
                          <p className="text-[10px] text-indigo-600/60 dark:text-indigo-400/60 font-bold uppercase tracking-tight">Total Horas Restantes</p>
                          <p className="text-lg font-black text-indigo-900 dark:text-indigo-100">~{planningMetrics.totalHoursRemaining.toFixed(0)}h</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-indigo-100 dark:border-indigo-800/50 space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                           <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-2 rounded-lg">
                             <p className="text-[9px] uppercase font-bold opacity-70">Meta de Lucro Líquido</p>
                             <p className="font-black text-sm">R$ {planningMetrics.monthlyNetGoal}</p>
                           </div>
                           <div 
                             onClick={() => setShowExpensesDetailsModal(true)}
                             className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-2 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                           >
                             <p className="text-[9px] uppercase font-bold opacity-70 flex items-center justify-between">
                               Est. Despesas/Comb. <ChevronRight size={10} />
                             </p>
                             <p className="font-black text-sm">R$ {(planningMetrics.estimatedFuelCostRemaining + planningMetrics.totalFixed + planningMetrics.totalExtraExpenses).toFixed(0)}</p>
                           </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1 text-[10px] text-indigo-500/70 font-bold uppercase bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-lg text-center flex items-center justify-center">
                            Sua Média: R$ {planningMetrics.avgRph.toFixed(0)}/h
                          </div>
                          <Button 
                            onClick={generateAIPlanning} 
                            variant="primary" 
                            className="py-3 px-4 text-xs font-black bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
                            icon={Sparkles}
                            disabled={isGeneratingAi}
                          >
                            {isGeneratingAi ? 'Pensando...' : 'Plano de Eficiência IA'}
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
                    className="text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline"
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
                        <Card key={fe.id} className={cn("flex flex-col sm:flex-row justify-between items-start sm:items-center group relative overflow-hidden gap-4", isPaid && "opacity-50 grayscale")}>
                          {daysUntilDue <= 3 && daysUntilDue >= 0 && !isPaid && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                          )}
                          <div className="flex items-center gap-4">
                            <div className={cn("p-3 rounded-2xl transition-colors", daysUntilDue <= 3 && daysUntilDue >= 0 && !isPaid ? "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400")}>
                               <CalendarIcon size={20} />
                            </div>
                            <div>
                               <p className="font-bold text-gray-900 dark:text-white leading-tight">{fe.name}</p>
                               <p className={cn("text-xs font-medium", daysUntilDue <= 3 && daysUntilDue >= 0 && !isPaid ? "text-red-500" : "text-gray-500")}>
                                 {isPaid ? 'Pago este mês' : `Vence dia ${fe.dueDay} (em ${daysUntilDue} dias)`}
                               </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                            <p className="font-bold text-lg dark:text-white">R$ {fe.amount.toFixed(2)}</p>
                            <div className="flex items-center gap-2">
                              {!isPaid && (
                                <button
                                  onClick={() => payFixedExpense(fe)}
                                  className="px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-xs font-bold transition-all hover:bg-green-200 dark:hover:bg-green-900/50"
                                >
                                  Pagar
                                </button>
                              )}
                              <button 
                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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
                      <Card key={w.id} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <div className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 p-2 rounded-xl">
                              <ArrowUpRight size={18} />
                           </div>
                           <div>
                             <p className="font-bold text-gray-900 dark:text-white leading-tight">Transferência</p>
                             <p className="text-xs text-gray-500">{format(w.date.toDate(), 'dd/MM/yyyy HH:mm')}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-bold text-gray-900 dark:text-white">R$ {w.amount.toFixed(2)}</p>
                           {w.fee > 0 && <p className="text-[10px] text-red-500">Taxa: R$ {w.fee.toFixed(2)}</p>}
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
                              {kmDriven > 0 && (
                                <p className="text-[10px] text-green-600 dark:text-green-400 font-bold">{kmDriven} km rodados</p>
                              )}
                            </div>
                            <ChevronRight size={16} className="text-gray-300 dark:text-gray-700 group-hover:text-blue-500 transition-colors" />
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
                          <span className="text-gray-400 text-sm">Combustível (Trabalho)</span>
                          <span className="font-bold">R$ {metrics.estimatedFuelCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                          <span className="text-gray-400 text-sm">Combustível (Pessoal)</span>
                          <span className="font-bold text-orange-400">R$ {metrics.personalFuelCost.toFixed(2)} <span className="text-xs text-gray-500">({metrics.personalFuelLiters.toFixed(1)}L)</span></span>
                        </div>
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                          <span className="text-gray-400 text-sm">Manutenção ({metrics.maintenancePercentage}%)</span>
                          <span className="font-bold underline decoration-gray-500/50 underline-offset-4">R$ {metrics.maintenanceCost.toFixed(2)}</span>
                        </div>
                        <div className="space-y-4 pt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-300">Lucro (Sem Reserva Manut.)</span>
                            <span className="text-xl font-bold text-blue-400">R$ {(metrics.totalRevenue - metrics.estimatedFuelCost).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold">Lucro Líquido Final</span>
                            <span className="text-2xl font-bold text-green-400">R$ {metrics.estimatedProfit.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Custos Reais */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Custos Reais (Últimos 30 Dias)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card className="p-4 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <FuelIcon size={16} className="text-red-600 dark:text-red-400" />
                          </div>
                          <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">Abastecimentos</p>
                        </div>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">R$ {costsMetrics.totalFuelValue30Days.toFixed(2)}</p>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">{costsMetrics.totalLiters30Days.toFixed(1)} Litros abastecidos</p>
                      </Card>
                      <Card className="p-4 bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/20">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <SettingsIcon size={16} className="text-orange-600 dark:text-orange-400" />
                          </div>
                          <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase">Outras Despesas</p>
                        </div>
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">R$ {costsMetrics.totalExpenses30Days.toFixed(2)}</p>
                      </Card>
                    </div>
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

                  {/* Projeção de Metas */}
                  {goalsProjection && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Projeção de Meta Semanal</h3>
                      <Card className="bg-blue-600 text-white p-6 relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 opacity-10">
                          <Target size={120} />
                        </div>
                        <div className="relative z-10 space-y-4">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-blue-100 text-xs font-bold uppercase tracking-tight mb-1">Acumulado na Semana</p>
                              <p className="text-3xl font-black">R$ {goalsProjection.weeklyRevenue.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                              <div className="flex flex-col items-end">
                                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-tight">Meta</p>
                                <p className="text-lg font-bold">R$ {goalsProjection.weeklyGoal.toFixed(0)}</p>
                                {planningMetrics && (
                                  <span className="text-[8px] bg-white/20 px-1 rounded uppercase font-black tracking-tighter mt-0.5">Sincronizada</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="w-full bg-blue-700/50 h-3 rounded-full overflow-hidden border border-blue-500/30">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (goalsProjection.weeklyRevenue / goalsProjection.weeklyGoal) * 100)}%` }}
                              className="bg-white h-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                            />
                          </div>

                          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="bg-white/20 p-2 rounded-xl">
                                <Sparkles size={18} className="text-white" />
                              </div>
                              <div>
                                <p className="text-[10px] text-blue-100 font-bold uppercase">Estimativa para bater a meta</p>
                                <p className="text-sm font-bold">
                                  Precisa de <span className="text-yellow-300">R$ {goalsProjection.requiredDaily.toFixed(2)} / dia</span> nos próximos {goalsProjection.daysRemaining} dias.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Mapa de Calor de Ganhos */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Mapa de Ganhos (Dia vs Hora)</h3>
                    <Card className="p-4 overflow-x-auto">
                      <div className="min-w-[600px]">
                        <div className="flex mb-2">
                          <div className="w-10 shrink-0" />
                          {Array.from({ length: heatmapData.maxH - heatmapData.minH + 1 }).map((_, i) => (
                            <div key={i} className="flex-1 text-[8px] font-bold text-gray-400 text-center">{heatmapData.minH + i}h</div>
                          ))}
                        </div>
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName, d) => (
                          <div key={d} className="flex items-center gap-1 mb-1">
                            <div className="w-10 shrink-0 text-[10px] font-bold text-gray-400 uppercase">{dayName}</div>
                            {Array.from({ length: heatmapData.maxH - heatmapData.minH + 1 }).map((_, i) => {
                              const h = heatmapData.minH + i;
                              const cell = heatmapData.data.find(cd => cd.day === d && cd.hour === h);
                              const val = cell?.avgPerHour || 0;
                              
                              // Color logic
                              let bg = 'bg-gray-50 dark:bg-gray-800/50';
                              if (val > 45) bg = 'bg-green-600 dark:bg-green-500';
                              else if (val > 35) bg = 'bg-green-500 dark:bg-green-600/80';
                              else if (val > 25) bg = 'bg-blue-500 dark:bg-blue-600/80';
                              else if (val > 15) bg = 'bg-blue-300 dark:bg-blue-800/40';
                              else if (val > 0) bg = 'bg-blue-100 dark:bg-blue-900/20';
                              
                              return (
                                <div 
                                  key={h} 
                                  title={`${dayName} ${h}h: R$ ${val.toFixed(2)}/h`}
                                  className={cn("flex-1 h-6 rounded-sm transition-all hover:scale-110 cursor-help", bg)}
                                />
                              );
                            })}
                          </div>
                        ))}
                        <div className="mt-4 flex items-center justify-center gap-4 text-[10px] font-bold text-gray-400 uppercase">
                          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" /> Sem dados</div>
                          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-100 dark:bg-blue-900/40" /> Baixo</div>
                          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-500" /> Bom</div>
                          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-600" /> Excelente</div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Tendência de Consumo & Perfil */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Tendência de Consumo</h3>
                      <Card className={cn(
                        "p-5 border-l-4",
                        fuelTrends?.status === 'bad' ? "border-l-red-500" : fuelTrends?.status === 'good' ? "border-l-green-500" : "border-l-blue-500"
                      )}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-xl">
                            <Activity size={18} className="text-gray-600 dark:text-gray-400" />
                          </div>
                          <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                            fuelTrends?.status === 'bad' ? "bg-red-100 text-red-700" : fuelTrends?.status === 'good' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {fuelTrends?.status === 'bad' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                            {Math.abs(fuelTrends?.diff || 0).toFixed(1)}% {fuelTrends?.status === 'bad' ? 'Pior' : 'Melhor'}
                          </div>
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Eficácia Recente</p>
                        <p className="text-2xl font-black dark:text-white">{fuelTrends?.avgRecent.toFixed(1)} <span className="text-xs font-bold text-gray-400">KM/L</span></p>
                        
                        {fuelTrends?.status === 'bad' && (
                          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/40">
                            <p className="text-[10px] text-red-700 dark:text-red-400 font-bold leading-tight uppercase">
                              ⚠️ Alerta: Consumo subiu! Verifique manutenção ou pneus.
                            </p>
                          </div>
                        )}
                      </Card>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Perfil de Corridas</h3>
                      <Card className="p-5">
                        <div className="flex justify-between items-center mb-6">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Baseado no seu Histórico</p>
                          <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-xl">
                            <MapPin size={18} className="text-gray-600 dark:text-gray-400" />
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {[
                            { label: 'Curtas (< 5km)', val: tripProfile.shortPerc, avg: tripProfile.shortAvgVal, color: 'bg-blue-400' },
                            { label: 'Médias (5-12km)', val: tripProfile.mediumPerc, avg: tripProfile.mediumAvgVal, color: 'bg-blue-600' },
                            { label: 'Longas (> 12km)', val: tripProfile.longPerc, avg: tripProfile.longAvgVal, color: 'bg-blue-800' }
                          ].map(p => (
                            <div key={p.label} className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 items-end">
                                <div className="space-y-0.5">
                                  <span className="block">{p.label}</span>
                                  <span className="text-gray-400 dark:text-gray-500 text-[9px]">
                                    Média: R$ {p.avg.toFixed(2)}
                                  </span>
                                </div>
                                <span className="text-sm dark:text-gray-300">{p.val.toFixed(0)}%</span>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${p.val}%` }}
                                  className={cn("h-full", p.color)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Top Turnos - Ranking */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">🏆 Hall da Fama (Mês Atual)</h3>
                    <Card className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
                        {/* Melhor Faturamento */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1 text-center md:text-left">Top Faturamento</p>
                          <div className="space-y-2">
                            {topShifts.revenue.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-4">Sem dados no mês</p>
                            ) : topShifts.revenue.map((s, i) => (
                              <div key={s.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 flex items-center justify-between border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                  <span className={cn(
                                    "w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black",
                                    i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : "bg-orange-100 text-orange-700"
                                  )}>{i+1}º</span>
                                  <span className="text-[10px] font-bold text-gray-500 uppercase">{format(ensureDate(s.startTime), 'dd/MM')}</span>
                                </div>
                                <p className="font-black text-blue-600 dark:text-blue-400">R$ {s.totalRevenue.toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Melhor R$/Hora */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest ml-1 text-center md:text-left">Top R$ / Hora</p>
                          <div className="space-y-2">
                            {topShifts.rph.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-4">Sem dados no mês</p>
                            ) : topShifts.rph.map((s, i) => (
                              <div key={s.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 flex items-center justify-between border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                  <span className={cn(
                                    "w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black",
                                    i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : "bg-orange-100 text-orange-700"
                                  )}>{i+1}º</span>
                                  <span className="text-[10px] font-bold text-gray-500 uppercase">{format(ensureDate(s.startTime), 'dd/MM')}</span>
                                </div>
                                <p className="font-black text-green-600 dark:text-green-400">R$ {(s.totalRevenue / (s.activeTimeSeconds / 3600)).toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Melhor R$/KM */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1 text-center md:text-left">Top R$ / KM</p>
                          <div className="space-y-2">
                            {topShifts.rpkm.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-4">Sem dados no mês</p>
                            ) : topShifts.rpkm.map((s, i) => {
                              const km = s.totalWorkKm || (s.endKm - s.startKm);
                              return (
                                <div key={s.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 flex items-center justify-between border border-gray-100 dark:border-gray-800">
                                  <div className="flex items-center gap-3">
                                    <span className={cn(
                                      "w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black",
                                      i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-200 text-gray-600" : "bg-orange-100 text-orange-700"
                                    )}>{i+1}º</span>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">{format(ensureDate(s.startTime), 'dd/MM')}</span>
                                  </div>
                                  <p className="font-black text-purple-600 dark:text-purple-400">R$ {(km > 0 ? s.totalRevenue / km : 0).toFixed(2)}</p>
                                </div>
                              );
                            })}
                          </div>
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
                       <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg text-blue-600 dark:text-blue-400"><Calendar size={16} /></div>
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
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex items-center gap-3 border border-blue-100 dark:border-blue-800/50">
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl text-blue-600 dark:text-blue-400">
              <Sparkles size={18} />
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
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
                        analysisFilter === f ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
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
                className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-2xl p-4 text-sm dark:text-white h-24 focus:ring-2 focus:ring-blue-500 transition-all resize-none"
              />
            </div>

            <Button 
              onClick={handleHistoryAIAnalysis}
              disabled={isAnalyzing || !analysisQuery.trim()}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2"
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
                  className="bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[10px] font-bold py-1 px-3 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showAiResultModal} onClose={() => setShowAiResultModal(false)} title="Insights da IA">
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex items-center gap-3 border border-blue-100 dark:border-blue-800/50">
            <div className="bg-white dark:bg-gray-800 p-2 rounded-xl text-blue-600 dark:text-blue-400">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-blue-600 dark:text-blue-400">Análise Concluída</p>
              <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
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
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-200">
            <p className="font-bold mb-2">Como importar seus dados:</p>
            <p className="mb-2">Cole na caixa abaixo os dados dos seus turnos anteriores. A inteligência artificial do app vai ler o texto e cadastrar tudo automaticamente.</p>
            <p><strong>Dica:</strong> Se você exportou os dados deste app anteriormente, basta abrir o arquivo CSV, copiar todo o conteúdo e colar aqui. O formato será reconhecido perfeitamente!</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dados para Importação</label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white h-48 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
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

      <Modal isOpen={showTripModal} onClose={() => setShowTripModal(false)} title="Detalhar Corridas">
        {selectedShiftId && (
          <TripBatchForm 
            shift={shifts.find(s => s.id === selectedShiftId)!}
            existingTrips={shiftTrips[selectedShiftId] || []}
            onSubmit={async (trips) => {
              for (const trip of trips) {
                if (trip.id) {
                  await updateDoc(doc(db, 'shifts', selectedShiftId, 'trips', trip.id), {
                    value: trip.value,
                    durationSeconds: trip.durationSeconds,
                    distanceKm: trip.distanceKm,
                    startTime: trip.startTime ? Timestamp.fromDate(trip.startTime) : null
                  });
                } else {
                  await addDoc(collection(db, 'shifts', selectedShiftId, 'trips'), {
                    userId: user?.uid,
                    shiftId: selectedShiftId,
                    value: trip.value,
                    durationSeconds: trip.durationSeconds,
                    distanceKm: trip.distanceKm,
                    timestamp: serverTimestamp(),
                    startTime: trip.startTime ? Timestamp.fromDate(trip.startTime) : null
                  });
                }
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
            onSubmit={(data) => {
              const tripUpdate: Partial<Trip> = {
                value: data.value,
                durationSeconds: data.durationSeconds,
                distanceKm: data.distanceKm,
              };
              if (data.startTime) {
                tripUpdate.startTime = Timestamp.fromDate(data.startTime);
              } else {
                tripUpdate.startTime = null as any; // Using any as Firestore accept nulls for delete FieldValue.delete() but it's simpler
              }
              return updateTrip(editingTrip.shiftId, editingTrip.trip.id, tripUpdate);
            }}
          />
        )}
      </Modal>

      <Modal isOpen={showRealtimeAiModal} onClose={() => setShowRealtimeAiModal(false)} title="Análise Rápida de Turno (IA)">
        <div className="space-y-6">
          {isGeneratingRealtimeAi ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 font-medium">A IA está analisando seu turno e o histórico das próximas horas...</p>
            </div>
          ) : (
            <div className="prose dark:prose-invert max-w-none text-sm space-y-2">
              <Markdown>{realtimeAiReport || ''}</Markdown>
            </div>
          )}
          <Button onClick={() => setShowRealtimeAiModal(false)} className="w-full" variant="outline">
            Fechar
          </Button>
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

function StartShiftForm({ onSubmit, initialKm }: { onSubmit: (km: number, autonomy: number) => void, initialKm: number }) {
  const [km, setKm] = useState(initialKm ? initialKm.toString() : '');
  const [autonomy, setAutonomy] = useState('');
  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <Input label="KM Total do Painel" type="number" inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} placeholder="Ex: 45000" />
      <Input label="Autonomia Restante (KM)" type="number" inputMode="numeric" value={autonomy} onChange={e => setAutonomy(e.target.value)} placeholder="Ex: 185" />
      <Button onClick={() => onSubmit(Number(km), Number(autonomy))} className="w-full py-4">Iniciar Agora</Button>
    </div>
  );
}

function PauseShiftForm({ onSubmit, currentRevenue, initialKm }: { onSubmit: (revenue: number, km: number, autonomy: number) => void, currentRevenue: number, initialKm: number }) {
  const [revenue, setRevenue] = useState(currentRevenue.toString());
  const [km, setKm] = useState(initialKm ? initialKm.toString() : '');
  const [autonomy, setAutonomy] = useState('');
  return (
    <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
      <CurrencyInput label="Faturamento Parcial (R$)" value={revenue} onValueChange={setRevenue} />
      <Input label="KM Atual" type="number" inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} />
      <Input label="Autonomia Restante (KM)" type="number" inputMode="numeric" value={autonomy} onChange={e => setAutonomy(e.target.value)} />
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
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-4">
        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Ganhos atuais registrados</p>
        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">R$ {currentRevenue.toFixed(2)}</p>
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
  const [revenue, setRevenue] = useState(currentRevenue.toString());
  const [totalDayTrips, setTotalDayTrips] = useState((todayTripsSoFar + currentShiftTrips).toString());
  
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

      <Button onClick={() => onSubmit(Number(km), Number(autonomy), Number(avgCons), Number(revenue), calculatedShiftTrips)} variant="danger" className="w-full py-4">Finalizar Turno</Button>
    </div>
  );
}

function ExpenseForm({ onSubmit, initialData, onDelete }: { 
  onSubmit: (date: Date, category: Expense['category'], value: number, km: number, paymentMethod: 'Pix' | 'Crédito', installments: number) => void,
  initialData?: Expense,
  onDelete?: () => void
}) {
  const [date, setDate] = useState(initialData ? format((initialData.date?.toDate() || new Date()), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [category, setCategory] = useState<Expense['category']>(initialData ? initialData.category : 'Manutenção');
  const [value, setValue] = useState(initialData ? initialData.value.toString() : '');
  const [km, setKm] = useState(initialData ? initialData.kmAtExpense.toString() : '');
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
  const [date, setDate] = useState(initialData ? format((initialData.date?.toDate() || new Date()), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
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
  const [start, setStart] = useState(initialData ? format((initialData.startTime?.toDate() || new Date()), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [end, setEnd] = useState(initialData && initialData.endTime ? format((initialData.endTime?.toDate() || new Date()), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
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
        <Input label="KM Inicial" type="number" inputMode="numeric" value={startKm} onChange={e => setStartKm(e.target.value)} />
        <Input label="KM Final" type="number" inputMode="numeric" value={endKm} onChange={e => setEndKm(e.target.value)} />
      </div>
      <Input label="Média de Consumo (KM/L)" type="number" inputMode="decimal" step="0.1" value={avgCons} onChange={e => setAvgCons(e.target.value)} />
      <CurrencyInput label="Faturamento Total (R$)" value={revenue} onValueChange={setRevenue} />
      <Input label="Qtd Corridas" type="number" inputMode="numeric" value={trips} onChange={e => setTrips(e.target.value)} />
      
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
  onSubmit: (data: { value: number, durationSeconds: number, distanceKm: number, startTime?: Date }) => Promise<void> | void 
}) {
  const [startTime, setStartTime] = useState(initialData.startTime ? format(initialData.startTime.toDate(), "yyyy-MM-dd'T'HH:mm") : '');
  const [value, setValue] = useState(initialData.value.toString());
  const [durationMin, setDurationMin] = useState(Math.floor(initialData.durationSeconds / 60).toString());
  const [durationSec, setDurationSec] = useState((initialData.durationSeconds % 60).toString());
  const [distance, setDistance] = useState(initialData.distanceKm.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
      <div className="grid grid-cols-1 gap-4">
        <Input 
          label="Hora de Início" 
          type="datetime-local" 
          value={startTime} 
          onChange={e => setStartTime(e.target.value)} 
        />
        <CurrencyInput 
          label="Valor (R$)" 
          value={value} 
          onValueChange={setValue} 
          placeholder="Ex: 9.80"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="Tempo (Min)" 
            type="number" 
            inputMode="numeric"
            value={durationMin} 
            onChange={e => setDurationMin(e.target.value)} 
            placeholder="0"
          />
          <Input 
            label="Tempo (Seg)" 
            type="number" 
            inputMode="numeric"
            value={durationSec} 
            onChange={e => setDurationSec(e.target.value)} 
            placeholder="0"
          />
        </div>
        <DistanceInput 
          label="Distância (KM)" 
          value={distance} 
          onValueChange={setDistance} 
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
              distanceKm: Number(distance),
              startTime: startTime ? new Date(startTime) : undefined
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

function TripBatchForm({ shift, existingTrips, onSubmit }: { 
  shift: Shift, 
  existingTrips: Trip[],
  onSubmit: (trips: { id?: string, value: number, durationSeconds: number, distanceKm: number, startTime?: Date }[]) => Promise<void> | void 
}) {
  const pendingTrips = existingTrips.filter(t => t.value === 0 && t.distanceKm === 0);
  const detailedTripsCount = existingTrips.length - pendingTrips.length;
  const missingCount = Math.max(0, shift.totalTrips - existingTrips.length);
  
  const [tripsData, setTripsData] = useState(() => {
    const data = [];
    // 1. Add pending trips
    for (const t of pendingTrips) {
      data.push({
        id: t.id,
        value: '',
        durationMin: '',
        durationSec: '',
        distance: '',
        startTime: t.startTime ? format(t.startTime.toDate(), "yyyy-MM-dd'T'HH:mm") : ''
      });
    }
    // 2. Add missing empty slots
    for (let i = 0; i < missingCount; i++) {
        data.push({
            id: undefined,
            value: '',
            durationMin: '',
            durationSec: '',
            distance: '',
            startTime: ''
        });
    }
    return data;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateTrip = (index: number, field: string, val: string) => {
    const newTrips = [...tripsData];
    newTrips[index] = { ...newTrips[index], [field]: val };
    setTripsData(newTrips);
  };

  if (tripsData.length === 0) {
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
        Você tem {tripsData.length} corrida(s) para detalhar.
      </p>
      
      {tripsData.map((trip, i) => (
        <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl space-y-4 border border-gray-100 dark:border-gray-700 transition-colors">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Corrida #{detailedTripsCount + i + 1}</p>
          <div className="grid grid-cols-1 gap-4">
            <Input 
              label="Hora de Início" 
              type="datetime-local" 
              value={trip.startTime} 
              onChange={e => updateTrip(i, 'startTime', e.target.value)} 
            />
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
            await onSubmit(tripsData.map(t => ({ 
              id: t.id,
              value: Number(t.value), 
              durationSeconds: (Number(t.durationMin || 0) * 60) + Number(t.durationSec || 0),
              distanceKm: Number(t.distance),
              startTime: t.startTime ? new Date(t.startTime) : undefined
            })));
          } finally {
            setIsSubmitting(false);
          }
        }} 
        className="w-full py-4 sticky bottom-0 shadow-lg"
      >
        {isSubmitting ? 'Salvando...' : `Salvar Corridas`}
      </Button>
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
                  ? "bg-blue-600 text-white shadow-md" 
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
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-4">
        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Saldo Disponível na Plataforma</p>
        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">R$ {platformBalance.toFixed(2)}</p>
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
      
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 transition-colors">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>Dica:</strong> O custo de manutenção agora é calculado como uma porcentagem do seu faturamento. 
          Um valor comum é separar 10% de tudo que você ganha para manutenção (pneus, óleo, suspensão).
        </p>
      </div>
    </div>
  );
}

