import React from 'react';
import { Target, Activity, MapPin, Fuel as FuelIcon, TrendingUp as TrendingUpIcon, Clock, Sparkles, DollarSign } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { HourlyBreakdown } from '../../../components/HourlyBreakdown';
import { ComparisonCard } from '../components/ComparisonCard';
import { DayAIInsight } from './DayAIInsight';

interface DayInsightsProps {
  metrics: any;
  planningMetrics: any;
  shiftTrips: any;
  periodFilter: 'day' | 'week' | 'month';
  historyComparisonData?: any;
  hourlyData?: any[];
}

export function DayInsights({ metrics, planningMetrics, shiftTrips, periodFilter, historyComparisonData, hourlyData }: DayInsightsProps) {
  if (!metrics || periodFilter !== 'day') return null;

  return (
    <div className="space-y-4">
      
      {/* Resumo do Dia - Bento Box Layout */}
      <div className="grid grid-cols-2 gap-3">
        {/* Meta Box (Large) */}
        <div className="col-span-2 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 p-4 rounded-3xl border border-green-100 dark:border-green-800/20 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-2 relative z-10">
                <p className="text-[10px] font-black text-green-600 dark:text-green-500 uppercase tracking-widest flex items-center gap-1.5"><Target size={12}/> Foco do Dia</p>
                <p className="text-[10px] font-bold text-green-700 dark:text-green-400">Meta Diária: R$ {(planningMetrics?.dailyGoalRemaining || 250).toFixed(2)}</p>
            </div>
            <div className="flex items-end gap-2 mb-3 relative z-10">
                <p className="text-4xl font-black text-green-600 dark:text-green-400">R$ {metrics.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="w-full bg-green-200/50 dark:bg-green-900/40 h-2.5 rounded-full overflow-hidden shadow-inner relative z-10">
                <div 
                    className="h-full bg-green-500 transition-all duration-1000 relative"
                    style={{ width: `${Math.min(100, (metrics.totalRevenue / Math.max(1, planningMetrics?.dailyGoalRemaining || 250)) * 100)}%` }}
                />
            </div>
             <p className="text-[9px] font-bold text-green-500 dark:text-green-400 mt-2 text-right relative z-10 uppercase">
              {Math.min(100, (metrics.totalRevenue / Math.max(1, planningMetrics?.dailyGoalRemaining || 250)) * 100).toFixed(1)}% Alcançado
            </p>
        </div>

        {/* Small Boxes */}
        <div className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Clock size={12}/> Tempo</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{metrics.totalHours.toFixed(1)}h</p>
        </div>
        <div className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><MapPin size={12}/> Trabalhado</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{metrics.totalKmWork.toFixed(1)} <span className="text-xs text-gray-400 font-medium">km</span></p>
        </div>

        {/* Corridas */}
        <div className="col-span-2 bg-white dark:bg-[#111827] p-4 rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Corridas Executadas</p>
                <div className="flex items-end gap-2">
                    <p className="text-2xl font-black text-gray-900 dark:text-white font-mono tracking-tighter">{metrics.totalTrips}</p>
                </div>
            </div>
            {metrics.totalTrips > 0 && (
                <div className="text-left sm:text-right">
                    <div className={cn("inline-block px-2 py-0.5 mb-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-current/10", metrics.precisionColor)}>
                        Precisão {metrics.precisionLevel}
                    </div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        {metrics.corridasCompletas} ok <span className="mx-1">•</span> {metrics.corridasIncompletas} inc.
                    </p>
                </div>
            )}
        </div>
      </div>

      {/* Inteligência Estratégica AI */}
      <DayAIInsight metrics={metrics} hourlyData={hourlyData || []} />

      {/* R$/H e R$/KM */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm overflow-hidden flex items-center gap-3 p-5">
         <div className="flex-[1] flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", metrics.revenuePerHour >= 35 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
              <Activity size={20} className={metrics.revenuePerHour >= 35 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-tight">R$ / Hora</p>
              <p className="font-black text-sm text-gray-900 dark:text-white">R$ {metrics.revenuePerHour.toFixed(2)}</p>
            </div>
         </div>
         <div className="w-px h-10 bg-gray-100 dark:bg-gray-800" />
         <div className="flex-[1] flex items-center gap-3 pl-2">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", metrics.revenuePerKm >= 2.5 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
              <MapPin size={20} className={metrics.revenuePerKm >= 2.5 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-tight">R$ / KM</p>
              <p className="font-black text-sm text-gray-900 dark:text-white">R$ {metrics.revenuePerKm.toFixed(2)}</p>
            </div>
         </div>
      </div>

      {/* Custos e Dinâmicos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-4 flex flex-col justify-between">
          <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FuelIcon size={12} /> Combustível</h3>
          <p className="text-xl font-black text-gray-900 dark:text-white">R$ {metrics.estimatedFuelCost.toFixed(2)}</p>
          <p className="text-[9px] font-medium text-gray-400 mt-1 uppercase">Estimado Diário</p>
        </div>
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-4 flex flex-col justify-between">
          <h3 className="text-[10px] font-black text-teal-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><TrendingUpIcon size={12} /> Extras</h3>
          <p className="text-xl font-black text-gray-900 dark:text-white">R$ {metrics.totalDynamicValue.toFixed(2)}</p>
          <p className="text-[9px] font-medium text-gray-400 mt-1 uppercase">+ R$ {metrics.totalCancelledValue.toFixed(2)} Taxas Canc.</p>
        </div>
      </div>

      {/* Comparação Histórica (Cards) */}
      {historyComparisonData && historyComparisonData.current && (
        <div className="grid grid-cols-1 gap-3">
          <ComparisonCard 
            title="Sua performance vs ontem"
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

      {/* Mapa Térmico do Dia (Substitui o Gráfico Feio) */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-4 pb-4 px-5">
         <HourlyBreakdown shifts={metrics.shiftsForMetrics} shiftTrips={shiftTrips} title="Mapa Térmico (Ganhos)" />
      </div>

    </div>
  );
}
