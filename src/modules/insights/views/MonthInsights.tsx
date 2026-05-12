import React from 'react';
import { Target, Activity, MapPin, Fuel as FuelIcon, TrendingUp as TrendingUpIcon, Clock, Sparkles, DollarSign, Calendar, TrendingUp, History } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { HourlyBreakdown } from '../../../components/HourlyBreakdown';
import { ComparisonCard } from '../components/ComparisonCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MonthAIInsight } from './MonthAIInsight';

interface MonthInsightsProps {
  metrics: any;
  planningMetrics: any;
  costsMetrics: any;
  chartsData: any;
  periodFilter: 'day' | 'week' | 'month';
  historyComparisonData: any;
  allTimeMetrics: any;
  settings: any;
}

export function MonthInsights({ metrics, planningMetrics, costsMetrics, chartsData, periodFilter, historyComparisonData, allTimeMetrics, settings }: MonthInsightsProps) {
  if (!metrics || periodFilter !== 'month') return null;

  return (
    <div className="space-y-4">
      
      {/* Resumo Financeiro Bento Box */}
      <div className="grid grid-cols-2 gap-3">
         {/* Faturamento e Progresso */}
         <div className="col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-5 rounded-3xl border border-blue-100 dark:border-blue-800/20 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-2 relative z-10">
                <p className="text-[10px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest flex items-center gap-1.5"><DollarSign size={12}/> Faturamento Total (Mês)</p>
                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400">Objetivo: R$ {planningMetrics?.revenueNeededTotal.toFixed(2)}</p>
            </div>
            <div className="flex items-end gap-2 mb-3 relative z-10">
                <p className="text-4xl font-black text-blue-600 dark:text-blue-400">R$ {metrics.totalRevenue.toFixed(2)}</p>
            </div>
            
            {planningMetrics && (
              <>
                <div className="w-full bg-blue-200/50 dark:bg-blue-900/40 h-2.5 rounded-full overflow-hidden shadow-inner relative z-10">
                    <div 
                        className="h-full bg-blue-500 transition-all duration-1000 relative"
                        style={{ width: `${Math.min(100, (metrics.totalRevenue / Math.max(1, planningMetrics.revenueNeededTotal)) * 100)}%` }}
                    />
                </div>
                <p className="text-[9px] font-bold text-blue-500 dark:text-blue-400 mt-2 text-right relative z-10 uppercase">
                  {Math.min(100, (metrics.totalRevenue / Math.max(1, planningMetrics.revenueNeededTotal)) * 100).toFixed(1)}% Alcançado
                </p>
              </>
            )}
         </div>

         {/* Gastos / Custos */}
         <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-4 relative overflow-hidden flex flex-col justify-between">
            <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FuelIcon size={12} /> Combustível (Mês)</h3>
            <p className="text-xl font-black text-gray-900 dark:text-white">R$ {costsMetrics?.totalFuelValue30Days.toFixed(2) || '0.00'}</p>
         </div>
         <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-4 relative overflow-hidden flex flex-col justify-between">
            <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Activity size={12} /> Despesas (Mês)</h3>
            <p className="text-xl font-black text-gray-900 dark:text-white">R$ {costsMetrics?.totalExpenses30Days.toFixed(2) || '0.00'}</p>
         </div>
      </div>

      {/* Inteligência Estratégica AI */}
      <MonthAIInsight 
        metrics={metrics} 
        costsMetrics={costsMetrics} 
        historyComparisonData={historyComparisonData} 
        planningMetrics={planningMetrics} 
      />

      {/* Lucro Estimado Pie Chart */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-5 pb-5 px-6">
        <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Estimativa de Lucro</h3>
        <div className="flex items-center gap-4">
          <div className="h-[120px] w-[120px] shrink-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
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
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Líquido</span>
                <span className="text-xs font-bold dark:text-white">R${metrics.estimatedProfit.toFixed(0)}</span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl">
               <span>Combustível</span> <span className="font-bold text-gray-900 dark:text-white">R$ {metrics.estimatedFuelCost.toFixed(2)}</span>
            </div>
            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl">
               <span className="flex flex-col">Manutenção <span className="text-[8px] opacity-70">({(settings?.maintenancePercentage || 10)}% guardados)</span></span> 
               <span className="font-bold text-orange-500">R$ {metrics.maintenanceCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

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

      {/* Comparação dos Dias do Mês (Bento Bars) */}
      {chartsData?.revenueData && chartsData.revenueData.length > 0 && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-5 pb-3 px-5 mb-4 mt-4">
          <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-white/5 pb-2">
            <TrendingUp size={12} className="text-emerald-500" /> Tendência do Mês
          </h3>
          <div className="flex items-end gap-[2px] h-32 w-full pt-4 overflow-x-auto no-scrollbar pb-2">
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
                <div key={idx} className="flex-1 min-w-[12px] max-w-[24px] flex flex-col items-center gap-2 group relative">
                  {/* Tooltip on hover/touch */}
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] p-2 rounded-xl pointer-events-none z-10 whitespace-nowrap shadow-xl">
                    <p className="font-black mb-1">{data.name}</p>
                    <p className="font-bold flex justify-between gap-4"><span>Faturado:</span> <span>R$ {data.value.toFixed(2)}</span></p>
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-white rotate-45" />
                  </div>

                  <div 
                    className={cn("w-full rounded-t-sm transition-all duration-500 hover:opacity-80", colorClass)} 
                    style={{ height: `${heightPct}%` }}
                  />
                  {idx % 3 === 0 && (
                    <span className="text-[8px] font-black text-gray-400 absolute top-full mt-1.5">{data.name.split(' ')[0]}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comp. com Mês Anterior */}
      {historyComparisonData && historyComparisonData.current && (
        <div className="grid grid-cols-1 gap-3">
          <ComparisonCard 
            title="Total Faturado (Mês a Mês)"
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

      {/* Histórico vs Todos os Meses (Opcional, se allTimeMetrics estiver disponivel) */}
      {allTimeMetrics && (
        <div className="bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 p-5 rounded-3xl">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <History size={12} /> Geral da Conta (Todos os Tempos)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">R$/Hora Médio</p>
              <p className="text-lg font-black text-gray-900 dark:text-white">R$ {allTimeMetrics.revenuePerHour.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Ticket Médio Corridas</p>
              <p className="text-lg font-black text-gray-900 dark:text-white">R$ {allTimeMetrics.ticketMedio.toFixed(2)}</p>
            </div>
            <div className="col-span-2 mt-2">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Faturamento Lifetime</p>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">R$ {allTimeMetrics.totalRevenue.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
