import React from 'react';
import { Target, Activity, MapPin, Fuel as FuelIcon, TrendingUp as TrendingUpIcon, Clock, Sparkles, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { HourlyBreakdown } from '../../../components/HourlyBreakdown';
import { ComparisonCard } from '../components/ComparisonCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WeekAIInsight } from './WeekAIInsight';

interface WeekInsightsProps {
  metrics: any;
  planningMetrics: any;
  shiftTrips: any;
  chartsData: any;
  periodFilter: 'day' | 'week' | 'month';
  historyComparisonData: any;
}

export function WeekInsights({ metrics, planningMetrics, shiftTrips, chartsData, periodFilter, historyComparisonData }: WeekInsightsProps) {
  if (!metrics || periodFilter !== 'week') return null;

  return (
    <div className="space-y-4">
      {/* Resumo da Semana - Bento Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Progresso da Meta Semanal */}
        {planningMetrics && (
          <div className="col-span-2 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10 p-4 rounded-3xl border border-indigo-100 dark:border-indigo-800/20 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-2 relative z-10">
              <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <Target size={12}/> Semana vs Meta Mensal
              </p>
              <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                {Math.min(100, (metrics.totalRevenue / Math.max(1, planningMetrics.revenueNeededTotal / 4)) * 100).toFixed(1)}% Alcançado
              </p>
            </div>
            <div className="flex items-end gap-2 mb-3 relative z-10">
              <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">R$ {metrics.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="w-full bg-indigo-200/50 dark:bg-indigo-900/40 h-2.5 rounded-full overflow-hidden shadow-inner relative z-10">
              <div 
                className="h-full bg-indigo-500 transition-all duration-1000 relative"
                style={{ width: `${Math.min(100, (metrics.totalRevenue / Math.max(1, planningMetrics.revenueNeededTotal / 4)) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 mt-2 text-right relative z-10 uppercase">
              Meta Semanal Est. R$ {(planningMetrics.revenueNeededTotal / 4).toFixed(2)}
            </p>
          </div>
        )}

        {/* Small Boxes */}
        <div className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Clock size={12}/> Tempo</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{metrics.totalHours.toFixed(1)}h</p>
            <p className="text-[10px] text-gray-400 font-medium">Na semana</p>
        </div>
        <div className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><MapPin size={12}/> Trabalhado</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{metrics.totalKmWork.toFixed(1)} <span className="text-xs text-gray-400">km</span></p>
            <p className="text-[10px] text-gray-400 font-medium">Na semana</p>
        </div>
      </div>

      {/* Inteligência Estratégica AI */}
      <WeekAIInsight metrics={metrics} chartsData={chartsData} />

      {/* R$/H e R$/KM */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm overflow-hidden flex items-center gap-3 p-5">
         <div className="flex-[1] flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", metrics.revenuePerHour >= 35 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
              <Activity size={20} className={metrics.revenuePerHour >= 35 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Média R$ / Hora</p>
              <p className="font-black text-sm text-gray-900 dark:text-white">R$ {metrics.revenuePerHour.toFixed(2)}</p>
            </div>
         </div>
         <div className="w-px h-10 bg-gray-100 dark:bg-gray-800" />
         <div className="flex-[1] flex items-center gap-3 pl-2">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", metrics.revenuePerKm >= 2.5 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
              <MapPin size={20} className={metrics.revenuePerKm >= 2.5 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Média R$ / KM</p>
              <p className="font-black text-sm text-gray-900 dark:text-white">R$ {metrics.revenuePerKm.toFixed(2)}</p>
            </div>
         </div>
      </div>

      {/* Comparação vs Semana Passada (Cards) */}
      {historyComparisonData && historyComparisonData.current && (
        <div className="grid grid-cols-1 gap-3">
          <ComparisonCard 
            title="Total Faturado (vs Semana Anterior)"
            icon={<DollarSign size={16} />}
            current={historyComparisonData.current.revenue}
            prev={historyComparisonData.previous.revenue}
            avg={historyComparisonData.average.revenue}
            format={(v: number) => `R$ ${v.toFixed(2)}`}
            labelPrev={historyComparisonData.labelPrev}
            labelAvg={historyComparisonData.labelAvg}
            higherIsBetter={true}
          />
        </div>
      )}

      {/* Tendência da Semana (Bento Bars) */}
      {chartsData?.revenueData && chartsData.revenueData.length > 0 && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-5 pb-3 px-5">
          <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-white/5 pb-2">
            <TrendingUp size={12} className="text-emerald-500" /> Comparação dos Dias
          </h3>
          <div className="flex items-end gap-2 h-32 w-full pt-4">
            {chartsData.revenueData.map((data: any, idx: number) => {
              const maxVal = Math.max(...chartsData.revenueData.map((d: any) => d.value));
              const heightPct = Math.max(10, (data.value / (maxVal || 1)) * 100);
              
              const avgVal = (chartsData.revenueData.reduce((acc: number, cur: any) => acc + cur.value, 0) / chartsData.revenueData.length) || 1;
              const ratio = data.value / avgVal;
              
              let colorClass = "bg-gray-200 dark:bg-gray-800"; // Frio
              if (ratio >= 1.3) colorClass = "bg-emerald-500"; // Muito Quente
              else if (ratio >= 1.0) colorClass = "bg-green-400"; // Quente
              else if (ratio >= 0.7) colorClass = "bg-yellow-500"; // Morno

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] p-2 rounded-xl pointer-events-none z-10 whitespace-nowrap shadow-xl">
                    <p className="font-black mb-1">{data.name}</p>
                    <p className="font-bold flex justify-between gap-4"><span>Faturado:</span> <span>R$ {data.value.toFixed(2)}</span></p>
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-white rotate-45" />
                  </div>
                  <div 
                    className={cn("w-full max-w-[32px] rounded-t-sm transition-all duration-500 hover:opacity-80", colorClass)} 
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[9px] font-black text-gray-400">{data.name.substring(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Melhores Horários / Dias */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-4 flex flex-col justify-center">
            <p className="text-[10px] font-bold text-purple-500 uppercase mb-2 tracking-widest flex items-center gap-1.5"><Clock size={12} /> Melhor Horário</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">
            {metrics.bestHourInfo.hour !== -1 ? `${metrics.bestHourInfo.hour.toString().padStart(2, '0')}:00` : '--:--'}
            </p>
        </div>
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-4 flex flex-col justify-center">
            <p className="text-[10px] font-bold text-indigo-500 uppercase mb-2 tracking-widest flex items-center gap-1.5"><Calendar size={12} /> Melhor Dia</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">
            {metrics.bestDayInfo.day !== -1 ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][metrics.bestDayInfo.day] : '---'}
            </p>
        </div>
      </div>

    </div>
  );
}
