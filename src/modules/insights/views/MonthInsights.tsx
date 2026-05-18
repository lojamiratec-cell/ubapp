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
      
      {/* Pacing Progressivo */}
      {historyComparisonData && historyComparisonData.progressPct && historyComparisonData.progressPct < 100 && (
        <div className="bg-gradient-to-r from-gray-900 to-indigo-900 dark:from-gray-800 dark:to-indigo-950 rounded-3xl p-5 shadow-lg relative overflow-hidden text-white">
           <div className="absolute top-0 right-0 p-4 opacity-10">
              <History size={64} />
           </div>
           <div className="relative z-10">
             <div className="flex items-center justify-between mb-4">
                <span className="bg-white/20 text-white text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-md">
                   <Clock size={12} /> Progresso do Mês
                </span>
                <span className="text-xs font-bold text-indigo-300">
                   Já se foram {Math.floor(historyComparisonData.progressPct)}%
                </span>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col gap-1">
                   <span className="text-xs text-indigo-200 uppercase tracking-widest font-bold">Faturamento Parcial</span>
                   <div className="flex items-end gap-2 text-white">
                      <span className="text-xl font-black leading-none">R$ {historyComparisonData.current.revenue.toFixed(0)}</span>
                   </div>
                   {historyComparisonData.previous.revenue > 0 && (
                      <div className="text-xs font-bold mt-1 flex items-center gap-1">
                         {(() => {
                            const diff = ((historyComparisonData.current.revenue - historyComparisonData.previous.revenue) / historyComparisonData.previous.revenue) * 100;
                            return (
                               <span className={diff >= 0 ? "text-green-400" : "text-red-400"}>
                                  {diff >= 0 ? '📈' : '📉'} {diff >= 0 ? '+' : ''}{diff.toFixed(1)}% vs mesmo período
                               </span>
                            );
                         })()}
                      </div>
                   )}
                </div>
                
                <div className="flex flex-col gap-1">
                   <span className="text-xs text-indigo-200 uppercase tracking-widest font-bold">Horas Trabalhadas</span>
                   <div className="flex items-end gap-2 text-white">
                      <span className="text-xl font-black leading-none">{(historyComparisonData.current.time / 3600).toFixed(1)}h</span>
                   </div>
                   {historyComparisonData.previous.time > 0 && (
                      <div className="text-xs font-bold mt-1 text-indigo-100 flex items-center gap-1">
                         {(() => {
                            const prevH = (historyComparisonData.previous.time / 3600).toFixed(1);
                            const diff = ((historyComparisonData.current.time - historyComparisonData.previous.time) / historyComparisonData.previous.time) * 100;
                            const isLess = diff <= 0;
                            return (
                               <span className={isLess ? "text-green-400" : "text-red-400"}>
                                  vs {prevH}h ({isLess ? '📉' : '📈'} {diff >= 0 ? '+' : ''}{diff.toFixed(0)}%)
                               </span>
                            );
                         })()}
                      </div>
                   )}
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Resumo Financeiro Bento Box */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
         {/* Faturamento e Progresso */}
         <div className="sm:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-5 rounded-3xl border border-blue-100 dark:border-blue-800/20 shadow-sm relative overflow-hidden flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
            <div className="flex-1 w-full text-center sm:text-left">
              <div className="flex justify-center sm:justify-start items-center mb-2 relative z-10">
                  <p className="text-xs font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest flex items-center gap-1.5"><DollarSign size={12}/> Faturamento Total (Mês)</p>
              </div>
              <div className="mb-1 relative z-10">
                  <p className="text-4xl font-black text-blue-600 dark:text-blue-400">R$ {metrics.totalRevenue.toFixed(2)}</p>
                  <p className="text-xs font-bold text-blue-700/60 dark:text-blue-400/60 mt-1">Objetivo: R$ {planningMetrics?.revenueNeededTotal.toFixed(0) || '0'}</p>
              </div>
            </div>
            
            {planningMetrics && (
              <div className="h-[90px] w-[180px] shrink-0 relative mt-4 sm:mt-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { value: Math.min(metrics.totalRevenue, Math.max(1, planningMetrics.revenueNeededTotal)) },
                        { value: Math.max(0, planningMetrics.revenueNeededTotal - metrics.totalRevenue) }
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
                      <Cell fill="#3B82F6" />
                      <Cell fill="rgba(59, 130, 246, 0.2)" className="dark:fill-blue-900/30" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-2">
                   <span className="text-xs font-black text-blue-600 dark:text-blue-400 tracking-wider">
                     {Math.min(100, (metrics.totalRevenue / Math.max(1, planningMetrics.revenueNeededTotal)) * 100).toFixed(1)}%
                   </span>
                </div>
              </div>
            )}
         </div>

         {/* Gastos / Custos */}
         <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-4 relative overflow-hidden flex flex-col justify-between">
            <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FuelIcon size={12} /> Combustível (Mês)</h3>
            <p className="text-xl font-black text-gray-900 dark:text-white">R$ {costsMetrics?.totalFuelValuePeriod.toFixed(2) || '0.00'}</p>
         </div>
         <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm p-4 relative overflow-hidden flex flex-col justify-between">
            <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Activity size={12} /> Despesas (Mês)</h3>
            <p className="text-xl font-black text-gray-900 dark:text-white">R$ {costsMetrics?.totalExpensesPeriod.toFixed(2) || '0.00'}</p>
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
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Média R$ / Hora</p>
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
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Média R$ / KM</p>
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

      {/* Comparação dos Dias do Mês (Gráfico de Área) */}
      {chartsData?.revenueData && chartsData.revenueData.length > 0 && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-[#1F2937] shadow-sm relative overflow-hidden flex flex-col pt-5 pb-5 px-5 mb-4 mt-4">
          <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-white/5 pb-2">
            <TrendingUp size={12} className="text-emerald-500" /> Comparação de Faturamento (Atual vs Mês Escudo)
          </h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData.revenueData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValueMonth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPrevMonth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9CA3AF" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#9CA3AF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-[#1F2937]" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} 
                  dy={10} 
                  minTickGap={20}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} 
                  tickFormatter={(val) => `R$${val}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#6B7280', marginBottom: '8px' }}
                  formatter={(val: number, name: string) => [`R$ ${val.toFixed(2)}`, name === 'value' ? 'Atual' : 'Mês Escudo']}
                />
                <Area 
                  type="monotone" 
                  dataKey="prevValue" 
                  stroke="#9CA3AF" 
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1} 
                  fill="url(#colorPrevMonth)" 
                  name="Mês Escudo"
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValueMonth)" 
                  name="Atual" 
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#10B981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Comp. com Mês Anterior */}
      {historyComparisonData && historyComparisonData.current && (
        <div className="grid grid-cols-1 gap-3 mt-6">
          <ComparisonCard 
            title="Total Faturado (Comparação)"
            icon={<DollarSign size={16} />}
            current={historyComparisonData.current.revenue}
            prev={historyComparisonData.previous.revenue}
            avg={historyComparisonData.average.revenue}
            format={(v: number) => `R$ ${v.toFixed(2)}`}
            labelPrev={historyComparisonData.labelPrev}
            labelAvg={historyComparisonData.labelAvg}
            higherIsBetter={true}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ComparisonCard 
              title="Rhythm Comercial (R$/h)"
              icon={<TrendingUpIcon size={16} />}
              current={historyComparisonData.current.rph}
              prev={historyComparisonData.previous.rph}
              avg={historyComparisonData.average.rph}
              format={(v: number) => `R$ ${v.toFixed(1)}/h`}
              labelPrev="Mês Passado"
              labelAvg="Média (3M)"
              higherIsBetter={true}
            />
            <ComparisonCard 
              title="Tempo Trabalhado"
              icon={<Clock size={16} />}
              current={historyComparisonData.current.time / 3600}
              prev={historyComparisonData.previous.time / 3600}
              avg={historyComparisonData.average.time / 3600}
              format={(v: number) => `${v.toFixed(1)}h`}
              labelPrev="Mês Passado"
              labelAvg="Média (3M)"
              higherIsBetter={false}
            />
          </div>
        </div>
      )}

      {/* Histórico vs Todos os Meses (Opcional, se allTimeMetrics estiver disponivel) */}
      {allTimeMetrics && (
        <div className="bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 p-5 rounded-3xl">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <History size={12} /> Geral da Conta (Todos os Tempos)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">R$/Hora Médio</p>
              <p className="text-lg font-black text-gray-900 dark:text-white">R$ {allTimeMetrics.revenuePerHour.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ticket Médio Corridas</p>
              <p className="text-lg font-black text-gray-900 dark:text-white">R$ {allTimeMetrics.ticketMedio.toFixed(2)}</p>
            </div>
            <div className="col-span-2 mt-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Faturamento Lifetime</p>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">R$ {allTimeMetrics.totalRevenue.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
