import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, BarChart3, ChevronRight, ChevronLeft, Car, Clock, MapPin, 
  Sparkles, Activity, History, TrendingUp, TrendingDown, AlertCircle,
  Calendar, Target, Users, Wallet, TrendingUp as TrendingUpIcon, Fuel as FuelIcon,
  Settings as SettingsIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isSameDay, isSameWeek, isSameMonth, differenceInSeconds, addDays, differenceInDays, subDays, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { 
  collection, query, where, getDocs
} from 'firebase/firestore';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { db } from '../../firebase';
import { cn, ensureDate } from '../../lib/utils';
import { Shift, Trip, UserSettings, Expense, Fuel, MonthlyStat, FixedExpense } from '../../types';

interface InsightsProps {
  user: any;
  settings: UserSettings | null;
  shifts: Shift[];
  shiftTrips: Record<string, Trip[]>;
  setShiftTrips: React.Dispatch<React.SetStateAction<Record<string, Trip[]>>>;
  periodFilter: 'day' | 'week' | 'month';
  setPeriodFilter: (filter: 'day' | 'week' | 'month') => void;
  referenceDate: Date;
  setReferenceDate: React.Dispatch<React.SetStateAction<Date>>;
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  fuelRecords: Fuel[];
  monthlyStatsDoc: MonthlyStat | null;
  prevPeriodRange: () => void;
  nextPeriodRange: () => void;
  periodRangeLabel: { type: string, label: string };
  elapsedTime: number;
  isLoadingMonthlyStats: boolean;
  Modal: any;
  Button: any;
  Card: any;
}

export function ComparisonCard({ title, icon, current, prev, avg, format, labelPrev, labelAvg, higherIsBetter }: any) {
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

export function InsightsModule({ 
  user, 
  settings, 
  shifts, 
  shiftTrips, 
  setShiftTrips,
  periodFilter, 
  setPeriodFilter,
  referenceDate,
  setReferenceDate,
  expenses,
  fixedExpenses,
  fuelRecords,
  monthlyStatsDoc,
  prevPeriodRange,
  nextPeriodRange,
  periodRangeLabel,
  elapsedTime,
  isLoadingMonthlyStats,
  Modal,
  Button,
  Card
}: InsightsProps) {
  const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);
  const [showAiResultModal, setShowAiResultModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [analysisFilter, setAnalysisFilter] = useState<'day' | 'week' | 'month'>('week');
  const [selectedAnalysisDate, setSelectedAnalysisDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [analysisQuery, setAnalysisQuery] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  const activeShift = useMemo(() => shifts.find(s => s.status === 'active' || s.status === 'paused'), [shifts]);

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

    const missingShifts = scopeShifts.filter(s => (s.totalTrips > 0 || s.totalRevenue > 0) && !shiftTrips[s.id]);
    
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
  }, [periodFilter, referenceDate, shifts, user, setShiftTrips, shiftTrips]);





  const allTimeMetrics = useMemo(() => {
    const finished = shifts.filter(s => s.status === 'finished');
    if (finished.length === 0) return null;

    const totalRevenue = finished.reduce((acc, s) => acc + s.totalRevenue, 0);
    const totalKm = finished.reduce((acc, s) => acc + (s.totalWorkKm || ((s.endKm || 0) - s.startKm)), 0);
    const totalSeconds = finished.reduce((acc, s) => acc + s.activeTimeSeconds, 0);
    const totalTrips = finished.reduce((acc, s) => acc + Math.max(s.totalTrips || 0, (shiftTrips[s.id] || []).filter(t => !t.isCancelled).length), 0);

    return {
      revenuePerHour: totalSeconds > 0 ? totalRevenue / (totalSeconds / 3600) : 0,
      revenuePerKm: totalKm > 0 ? totalRevenue / totalKm : 0,
      ticketMedio: totalTrips > 0 ? totalRevenue / totalTrips : 0,
      totalHours: totalSeconds / 3600,
      totalKm,
      totalTrips,
      totalRevenue
    };
  }, [shifts, shiftTrips]);

  const planningMetrics = useMemo(() => {
    if (!settings) return null;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();
    const daysRemaining = Math.max(1, daysInMonth - daysPassed + 1);

    const monthlyNetGoal = settings.monthlyNetGoal || 5000;
    const totalFixed = fixedExpenses.reduce((acc, e) => acc + e.amount, 0);
    
    const currentMonthShifts = shifts.filter(s => s.status === 'finished' && isSameMonth(ensureDate(s.startTime), now));
    const revenueSoFar = currentMonthShifts.reduce((acc, s) => acc + s.totalRevenue, 0);
    const kmSoFar = currentMonthShifts.reduce((acc, s) => acc + (s.totalWorkKm || (s.endKm! - s.startKm)), 0);
    const secondsSoFar = currentMonthShifts.reduce((acc, s) => acc + s.activeTimeSeconds, 0);

    const avgRph = (allTimeMetrics?.revenuePerHour || 35);
    const avgRpkm = (allTimeMetrics?.revenuePerKm || 2.0);
    const avgCons = settings.avgConsumption || 12;
    const fuelPrice = settings.defaultFuelPrice || 5.5;
    const maintPerc = (settings.maintenancePercentage || 10) / 100;

    const revenueNeededTotal = (monthlyNetGoal + totalFixed) / (1 - (fuelPrice / (avgCons * avgRpkm)) - maintPerc);
    const revenueRemaining = Math.max(0, revenueNeededTotal - revenueSoFar);
    const dailyGoalRemaining = revenueRemaining / daysRemaining;

    const totalHoursRemaining = avgRph > 0 ? revenueRemaining / avgRph : 0;

    return {
      monthlyNetGoal,
      totalFixed,
      revenueSoFar,
      revenueNeededTotal,
      revenueRemaining,
      dailyGoalRemaining,
      daysRemaining,
      avgRph,
      avgRpkm,
      totalHoursRemaining
    };
  }, [settings, shifts]);

  const metrics = useMemo(() => {
    const targetDate = referenceDate;
    let filteredShiftsForMetrics = shifts.filter(s => s.status === 'finished');
    let filteredExpenses = expenses;
    let filteredFuel = fuelRecords;

    if (periodFilter === 'day') {
      filteredShiftsForMetrics = filteredShiftsForMetrics.filter(s => isSameDay(ensureDate(s.startTime), targetDate));
      filteredExpenses = expenses.filter(e => isSameDay(ensureDate(e.date), targetDate));
      filteredFuel = fuelRecords.filter(f => isSameDay(ensureDate(f.date), targetDate));
    } else if (periodFilter === 'week') {
      filteredShiftsForMetrics = filteredShiftsForMetrics.filter(s => isSameWeek(ensureDate(s.startTime), targetDate, { weekStartsOn: 1 }));
      filteredExpenses = expenses.filter(e => isSameWeek(ensureDate(e.date), targetDate, { weekStartsOn: 1 }));
      filteredFuel = fuelRecords.filter(f => isSameWeek(ensureDate(f.date), targetDate, { weekStartsOn: 1 }));
    } else if (periodFilter === 'month') {
      filteredShiftsForMetrics = filteredShiftsForMetrics.filter(s => isSameMonth(ensureDate(s.startTime), targetDate));
      filteredExpenses = expenses.filter(e => isSameMonth(ensureDate(e.date), targetDate));
      filteredFuel = fuelRecords.filter(f => isSameMonth(ensureDate(f.date), targetDate));
    }

    if (filteredShiftsForMetrics.length === 0) return null;

    const totalRevenue = filteredShiftsForMetrics.reduce((acc, s) => acc + s.totalRevenue, 0);
    const totalKmWork = filteredShiftsForMetrics.reduce((acc, s) => acc + (s.totalWorkKm || ((s.endKm || 0) - s.startKm)), 0);
    const totalSeconds = filteredShiftsForMetrics.reduce((acc, s) => acc + s.activeTimeSeconds, 0);
    const totalTrips = filteredShiftsForMetrics.reduce((acc, s) => acc + Math.max(s.totalTrips || 0, (shiftTrips[s.id] || []).filter(t => !t.isCancelled).length), 0);
    
    const allFinishedShifts = shifts.filter(s => s.status === 'finished').sort((a, b) => (ensureDate(a.startTime).getTime()) - (ensureDate(b.startTime).getTime()));
    let totalKmPersonal = 0;
    
    filteredShiftsForMetrics.forEach(filteredShift => {
      const index = allFinishedShifts.findIndex(s => s.id === filteredShift.id);
      let personalKmForThisShift = filteredShift.totalPersonalKm || 0;

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

    const currentAvgCons = settings?.avgConsumption || 12.0;
    const currentFuelPrice = settings?.defaultFuelPrice || 5.50;
    const currentMaintPercentage = settings?.maintenancePercentage ?? 10;

    const estimatedFuelCost = totalKmWork > 0 ? (totalKmWork / currentAvgCons) * currentFuelPrice : 0;
    const maintenanceCost = totalRevenue * (currentMaintPercentage / 100);
    
    const personalFuelCost = totalKmPersonal > 0 ? (totalKmPersonal / currentAvgCons) * currentFuelPrice : 0;

    let totalDynamicValue = 0;
    let totalCancelledTrips = 0;
    let totalCancelledValue = 0;
    let allTripsInPeriod: Trip[] = [];

    filteredShiftsForMetrics.forEach(shift => {
      const trips = shiftTrips[shift.id] || [];
      if (trips.length === 0 && shift.totalRevenue > 0) {
        if (shift.totalDynamicValue) totalDynamicValue += shift.totalDynamicValue;
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

    const validTrips = allTripsInPeriod.filter(t => !t.isCancelled && t.durationSeconds > 0 && t.value > 0);
    
    const hourStats: Record<number, { count: number, totalVal: number, totalSecs: number }> = {};
    validTrips.forEach(t => {
      const hour = ensureDate(t.startTime || t.timestamp).getHours();
      if (!hourStats[hour]) hourStats[hour] = { count: 0, totalVal: 0, totalSecs: 0 };
      hourStats[hour].count += 1;
      hourStats[hour].totalVal += t.value;
      hourStats[hour].totalSecs += t.durationSeconds;
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

    const dayStats: Record<number, { count: number, totalVal: number, totalSecs: number }> = {};
    validTrips.forEach(t => {
      const day = ensureDate(t.startTime || t.timestamp).getDay();
      if (!dayStats[day]) dayStats[day] = { count: 0, totalVal: 0, totalSecs: 0 };
      dayStats[day].count += 1;
      dayStats[day].totalVal += t.value;
      dayStats[day].totalSecs += t.durationSeconds;
    });

    let bestDayInfo = { day: -1, rph: 0 };
    Object.keys(dayStats).forEach(dStr => {
      const d = parseInt(dStr);
      const stat = dayStats[d];
      const rph = stat.totalSecs > 0 ? stat.totalVal / (stat.totalSecs / 3600) : 0;
      if (rph > bestDayInfo.rph && stat.count >= 5) {
        bestDayInfo = { day: d, rph };
      }
    });

    return {
      totalRevenue,
      totalKmWork,
      totalKmPersonal,
      totalHours: totalSeconds / 3600,
      totalTrips,
      totalExpenses,
      totalFuelValue,
      estimatedFuelCost,
      maintenanceCost,
      personalFuelCost,
      totalDynamicValue,
      totalCancelledTrips,
      totalCancelledValue,
      revenuePerHour: totalSeconds > 0 ? totalRevenue / (totalSeconds / 3600) : 0,
      revenuePerKm: totalKmWork > 0 ? totalRevenue / totalKmWork : 0,
      ticketMedio: totalTrips > 0 ? totalRevenue / totalTrips : 0,
      bestHourInfo,
      bestDayInfo,
      estimatedProfit: totalRevenue - estimatedFuelCost - maintenanceCost,
      pieData: [
        { name: 'Combustível', value: estimatedFuelCost, color: '#EF4444' },
        { name: 'Manutenção', value: maintenanceCost, color: '#F97316' },
        { name: 'Lucro Líquido', value: Math.max(0, totalRevenue - estimatedFuelCost - maintenanceCost), color: '#22C55E' }
      ].filter(d => d.value > 0)
    };
  }, [periodFilter, referenceDate, shifts, expenses, fuelRecords, settings, shiftTrips]);

  const chartsData = useMemo(() => {
    if (!shifts || shifts.length === 0) return { barData: [] };
    
    let barData: any[] = [];
    const now = referenceDate;
    
    if (periodFilter === 'day') {
       // Single day bar chart (hourly maybe?)
    } else if (periodFilter === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      barData = Array.from({ length: 7 }).map((_, i) => {
        const dayDate = addDays(start, i);
        const dayShifts = shifts.filter(s => isSameDay(ensureDate(s.startTime), dayDate) && s.status === 'finished');
        return {
          name: format(dayDate, 'EEE', { locale: ptBR }),
          value: dayShifts.reduce((acc, s) => acc + s.totalRevenue, 0)
        };
      });
    } else if (periodFilter === 'month') {
      const start = startOfMonth(now);
      const daysCount = differenceInDays(endOfMonth(now), start) + 1;
      barData = Array.from({ length: daysCount }).map((_, i) => {
        const dayDate = addDays(start, i);
        const dayShifts = shifts.filter(s => isSameDay(ensureDate(s.startTime), dayDate) && s.status === 'finished');
        return {
          name: format(dayDate, 'dd'),
          value: dayShifts.reduce((acc, s) => acc + s.totalRevenue, 0)
        };
      });
    }

    return { barData };
  }, [shifts, periodFilter, referenceDate]);

  const goalsProjection = useMemo(() => {
    if (!planningMetrics || !settings) return null;
    
    const now = new Date();
    const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const weeklyRevenue = shifts.filter(s => s.status === 'finished' && isSameWeek(ensureDate(s.startTime), now, { weekStartsOn: 1 }))
                               .reduce((acc, s) => acc + s.totalRevenue, 0);
    
    const weeklyGoal = (planningMetrics.revenueNeededTotal / 4);
    const remaining = Math.max(0, weeklyGoal - weeklyRevenue);
    const endOfWk = endOfWeek(now, { weekStartsOn: 1 });
    const daysRemaining = differenceInDays(endOfWk, now) + 1;
    const requiredDaily = remaining / Math.max(1, daysRemaining);

    return {
      weeklyRevenue,
      weeklyGoal,
      remaining,
      daysRemaining,
      requiredDaily
    };
  }, [planningMetrics, settings, shifts]);

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

    const dataWithColors = data.map(d => ({
       ...d,
       color: d.val === 0 ? '#e5e7eb' : (d.val > generalAvg * 1.05 ? '#22c55e' : (d.val >= generalAvg * 0.9 ? '#eab308' : '#ef4444'))
    }));

    let insightMsg = "Estude seus horários para encontrar o melhor padrão.";
    if (count > 0 && best.val > 0 && generalAvg > 0) {
       const diffPerc = ((best.val - generalAvg) / generalAvg * 100).toFixed(0);
       insightMsg = `Seu pico às ${best.h}h rende ${diffPerc}% a mais que sua média.`;
    }

    return {
       data: dataWithColors,
       best,
       worst: worst.h !== -1 ? worst : null,
       generalAvg,
       insightMsg
    };
  }, [shifts, periodFilter, referenceDate]);

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

      const relevantShifts = shifts.filter(s => {
        const d = ensureDate(s.startTime);
        return d >= startDate && d <= endDate;
      });

      if (relevantShifts.length === 0) {
        setAnalysisResult("Não encontrei dados de turnos para este período para analisar.");
        setIsAnalyzing(false);
        return;
      }

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

      const apiKeyToUse = settings?.geminiApiKey || process.env.GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
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

  const generateAIPlanning = async () => {
    if (!user || !planningMetrics) return;
    setIsGeneratingAi(true);
    try {
      const apiKeyToUse = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKeyToUse) {
        setAnalysisResult("Configuração Necessária: Para usar a IA, adicione sua chave Gemini nas configurações.");
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
        - Melhor Dia p/ trabalho: ${metrics.bestDayInfo.day !== -1 ? `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][metrics.bestDayInfo.day]} com R$ ${metrics.bestHourInfo.rph.toFixed(2)}/h` : 'Indisponível'}
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

  return (
    <div className="space-y-6">
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
            <button 
              onClick={() => setShowComparisonModal(true)}
              className="px-2 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition-all active:scale-95 flex items-center gap-1"
            >
              <History size={14} />
              HISTÓRICO
            </button>
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
        {(isLoadingInsights || isLoadingMonthlyStats) && (
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

      {!metrics || isLoadingInsights || isLoadingMonthlyStats ? (
        <div className="text-center py-20 space-y-4">
          <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            {(isLoadingInsights || isLoadingMonthlyStats) ? (
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
            {(isLoadingInsights || isLoadingMonthlyStats) ? "Carregando dados das corridas..." : "Nenhum dado para este período."}
          </p>
        </div>
      ) : (
        <>
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
            </Card>
          )}

          {/* Efficiency and Quality */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6">
            <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Eficiência e Qualidade</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", metrics.revenuePerHour >= 35 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
                    <Activity size={20} className={metrics.revenuePerHour >= 35 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">R$ / Hora</p>
                    <p className="font-bold text-base text-gray-900 dark:text-white">R$ {metrics.revenuePerHour.toFixed(2)}/h</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", metrics.revenuePerKm >= 2.5 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
                    <MapPin size={20} className={metrics.revenuePerKm >= 2.5 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">R$ / KM</p>
                    <p className="font-bold text-base text-gray-900 dark:text-white">R$ {metrics.revenuePerKm.toFixed(2)}/km</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Strategic Intelligence */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6">
            <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Inteligência Estratégica</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 rounded-2xl flex flex-col justify-center">
                <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-2 tracking-widest flex items-center gap-1.5"><Clock size={12} /> Melhor Horário</p>
                <p className="text-2xl font-black text-purple-700 dark:text-purple-300">
                  {metrics.bestHourInfo.hour !== -1 ? `${metrics.bestHourInfo.hour.toString().padStart(2, '0')}:00` : '--:--'}
                </p>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl flex flex-col justify-center">
                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-2 tracking-widest flex items-center gap-1.5"><Calendar size={12} /> Melhor Dia</p>
                <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                  {metrics.bestDayInfo.day !== -1 ? ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][metrics.bestDayInfo.day] : '---'}
                </p>
              </div>
            </div>
          </div>

          {/* Extra Revenue */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6">
            <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Receita Extra</h3>
            <div className="grid grid-cols-2 gap-3">
               <div className="p-4 bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/20 rounded-2xl">
                  <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase mb-1 tracking-widest">Dinâmicos</p>
                  <p className="text-2xl font-black text-teal-700 dark:text-teal-300">R$ {metrics.totalDynamicValue.toFixed(2)}</p>
               </div>
               <div className="p-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-widest">Taxas Canc.</p>
                  <p className="text-2xl font-black dark:text-gray-200">R$ {metrics.totalCancelledValue.toFixed(2)}</p>
               </div>
            </div>
          </div>

          {/* Costs & Profit */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6">
            <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Custos & Lucro (Estimado)</h3>
            
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
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1F2937', borderRadius: '12px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Líquido</span>
                  <span className="text-sm font-bold dark:text-white">R$ {metrics.estimatedProfit.toFixed(0)}</span>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-sm p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase tracking-wide">Combustível</span>
                <span className="font-bold text-white">R$ {metrics.estimatedFuelCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase tracking-wide">Manutenção ({(settings?.maintenancePercentage || 10)}%)</span>
                <span className="font-bold text-orange-400">R$ {metrics.maintenanceCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Real Costs 30 Days */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6">
            <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Custos Reais (30 dias)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl">
                <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase mb-1">Combustível</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-300">R$ {costsMetrics.totalFuelValue30Days.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 rounded-2xl">
                <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase mb-1">Despesas</p>
                <p className="text-xl font-bold text-orange-700 dark:text-orange-300">R$ {costsMetrics.totalExpenses30Days.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Hourly Analysis */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-6 pb-4 px-6">
            <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Ganhos por Hora</h3>
            <div className="h-[200px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="hrString" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', color: '#fff', borderRadius: '12px', border: 'none' }}
                    labelStyle={{ color: '#9CA3AF', fontSize: '10px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                    {hourlyData.data.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
            <Button 
                onClick={() => setShowAiAnalysisModal(true)}
                className="w-full py-6 rounded-2xl bg-gradient-to-r from-green-600 to-indigo-600 hover:from-green-700 hover:to-indigo-700 text-white shadow-xl transition-all group overflow-hidden relative border-none"
            >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <Sparkles size={20} className="relative z-10" />
                <span className="font-black uppercase tracking-wider relative z-10">Perguntar para IA</span>
            </Button>
            
            <Button 
                onClick={generateAIPlanning}
                disabled={isGeneratingAi}
                variant="outline"
                className="w-full py-6 rounded-2xl border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                icon={BarChart3}
            >
                {isGeneratingAi ? "Gerando..." : "Gerar Plano Estratégico (IA)"}
            </Button>
          </div>
        </>
      )}

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
        </div>
      </Modal>
    </div>
  );
}
