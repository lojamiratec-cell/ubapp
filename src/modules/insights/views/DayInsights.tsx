import React from 'react';
import { Target, Activity, MapPin, Fuel as FuelIcon, TrendingUp as TrendingUpIcon, Clock, Sparkles, DollarSign } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { HourlyBreakdown } from '../../../components/HourlyBreakdown';
import { ComparisonCard } from '../components/ComparisonCard';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { DayAIInsight } from './DayAIInsight';

interface DayInsightsProps {
  metrics: any;
  planningMetrics: any;
  shiftTrips: any;
  periodFilter: 'day' | 'week' | 'month';
  historyComparisonData?: any;
  hourlyData?: any[];
  settings?: any;
}

export function DayInsights({ metrics, planningMetrics, shiftTrips, periodFilter, historyComparisonData, hourlyData, settings }: DayInsightsProps) {
  if (!metrics || periodFilter !== 'day') return null;

  return (
    <div className="space-y-4">
      
      {/* Resumo do Dia - Bento Box Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Meta Box (Large) */}
        <div className="sm:col-span-2 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 p-5 rounded-3xl border border-green-100 dark:border-green-800/20 shadow-sm relative overflow-hidden flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
            <div className="flex-1 w-full text-center sm:text-left">
              <div className="flex justify-center sm:justify-start items-center mb-2 relative z-10">
                  <p className="text-xs font-black text-green-600 dark:text-green-500 uppercase tracking-widest flex items-center gap-1.5"><Target size={12}/> Foco do Dia</p>
              </div>
              <div className="mb-1 relative z-10">
                  <p className="text-4xl font-black text-green-600 dark:text-green-400">R$ {metrics.totalRevenue.toFixed(2)}</p>
                  <p className="text-xs font-bold text-green-700/60 dark:text-green-400/60 mt-1">
                    Meta Diária: R$ {(planningMetrics?.dailyGoalRemaining || 250).toFixed(0)}
                  </p>
              </div>
            </div>

            <div className="h-[90px] w-[180px] shrink-0 relative mt-4 sm:mt-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { value: Math.min(metrics.totalRevenue, Math.max(1, planningMetrics?.dailyGoalRemaining || 250)) },
                      { value: Math.max(0, (planningMetrics?.dailyGoalRemaining || 250) - metrics.totalRevenue) }
                    ]}
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={65}
                    outerRadius={80}
                    stroke="none"
                    dataKey="value"
                  >
                    <Cell fill="#10B981" />
                    <Cell fill="rgba(16, 185, 129, 0.2)" className="dark:fill-green-900/30" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-2">
                 <span className="text-xs font-black text-green-600 dark:text-green-400 tracking-wider">
                   {Math.min(100, (metrics.totalRevenue / Math.max(1, planningMetrics?.dailyGoalRemaining || 250)) * 100).toFixed(1)}%
                 </span>
              </div>
            </div>
        </div>

        {/* Small Boxes */}
        <div className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm flex flex-col justify-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Clock size={12}/> Tempo</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{metrics.totalHours.toFixed(1)}h</p>
        </div>
        <div className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm flex flex-col justify-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><MapPin size={12}/> Trabalhado</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{metrics.totalKmWork.toFixed(1)} <span className="text-xs text-gray-400 font-medium">km</span></p>
        </div>

        {/* Corridas */}
        <div className="sm:col-span-2 bg-white dark:bg-[#111827] p-4 rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Corridas Executadas</p>
                <div className="flex items-end gap-2">
                    <p className="text-2xl font-black text-gray-900 dark:text-white font-mono tracking-tighter">{metrics.totalTrips}</p>
                </div>
            </div>
            {metrics.totalTrips > 0 && (
                <div className="text-left sm:text-right">
                    <div className={cn("inline-block px-2 py-0.5 mb-1 rounded-full text-[11px] font-black uppercase tracking-widest border border-current/10", metrics.precisionColor)}>
                        Precisão {metrics.precisionLevel}
                    </div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        {metrics.corridasCompletas} ok <span className="mx-1">•</span> {metrics.corridasIncompletas} inc.
                    </p>
                </div>
            )}
        </div>
      </div>

      {/* Inteligência Estratégica AI */}
      <DayAIInsight metrics={metrics} hourlyData={hourlyData || []} />

      {/* Lucro Estimado Pie Chart */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-5 pb-5 px-5">
        <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Estimativa de Lucro</h3>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="h-[140px] w-[140px] shrink-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {metrics.pieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Líquido</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white leading-none">R${metrics.estimatedProfit.toFixed(0)}</span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
               <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor: '#EF4444'}}></div> Combustível</span> 
               <span className="font-bold text-gray-900 dark:text-white">R$ {metrics.estimatedFuelCost.toFixed(2)}</span>
            </div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
               <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor: '#F97316'}}></div> <span className="flex flex-col">Manutenção <span className="text-xs opacity-70 leading-tight">({(settings?.maintenancePercentage || 10)}% de Reserva)</span></span></span> 
               <span className="font-bold text-gray-900 dark:text-white">R$ {metrics.maintenanceCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* R$/H e R$/KM */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm overflow-hidden flex flex-col sm:flex-row items-center gap-3 p-5">
         <div className="flex-1 w-full flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", metrics.revenuePerHour >= 35 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
                <Activity size={20} className={metrics.revenuePerHour >= 35 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
              </div>
              <div className="flex flex-col">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-tight">R$ / Hora</p>
                <div className="flex items-center gap-2">
                  <p className="font-black text-sm text-gray-900 dark:text-white">R$ {metrics.revenuePerHour.toFixed(2)}</p>
                </div>
              </div>
            </div>
            {metrics.revenuePerHour >= 35 ? (
               <span className="text-xs sm:ml-2 font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Alta</span>
            ) : metrics.revenuePerHour >= 25 ? (
               <span className="text-xs sm:ml-2 font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">Média</span>
            ) : (
               <span className="text-xs sm:ml-2 font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Baixa</span>
            )}
         </div>
         <div className="w-full sm:w-px h-px sm:h-10 bg-gray-100 dark:bg-gray-800 my-2 sm:my-0" />
         <div className="flex-1 w-full flex items-center justify-between sm:justify-start gap-3 sm:pl-2">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", metrics.revenuePerKm >= 2.5 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
                <MapPin size={20} className={metrics.revenuePerKm >= 2.5 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
              </div>
              <div className="flex flex-col">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-tight">R$ / KM</p>
                <div className="flex items-center gap-2">
                  <p className="font-black text-sm text-gray-900 dark:text-white">R$ {metrics.revenuePerKm.toFixed(2)}</p>
                </div>
              </div>
            </div>
            {metrics.revenuePerKm >= 2.5 ? (
               <span className="text-xs sm:ml-2 font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Alta</span>
            ) : metrics.revenuePerKm >= 1.5 ? (
               <span className="text-xs sm:ml-2 font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">Média</span>
            ) : (
               <span className="text-xs sm:ml-2 font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Baixa</span>
            )}
         </div>
      </div>

      {/* Custos e Dinâmicos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-4 flex flex-col justify-between">
          <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FuelIcon size={12} /> Combustível</h3>
          <p className="text-xl font-black text-gray-900 dark:text-white">R$ {metrics.estimatedFuelCost.toFixed(2)}</p>
          <p className="text-[11px] font-medium text-gray-400 mt-1 uppercase">Estimado Diário</p>
        </div>
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-4 flex flex-col justify-between">
          <h3 className="text-xs font-black text-teal-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><TrendingUpIcon size={12} /> Extras</h3>
          <p className="text-xl font-black text-gray-900 dark:text-white">R$ {metrics.totalDynamicValue.toFixed(2)}</p>
          <p className="text-[11px] font-medium text-gray-400 mt-1 uppercase">+ R$ {metrics.totalCancelledValue.toFixed(2)} Taxas Canc.</p>
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
