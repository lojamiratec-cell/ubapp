import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';

interface MonthAIInsightProps {
  metrics: any;
  costsMetrics: any;
  historyComparisonData: any;
  planningMetrics: any;
}

export function MonthAIInsight({ metrics, costsMetrics, historyComparisonData, planningMetrics }: MonthAIInsightProps) {
  const insight = useMemo(() => {
    const fuelCostPct = metrics.totalRevenue > 0 ? (costsMetrics?.totalFuelValuePeriod || metrics.estimatedFuelCost) / metrics.totalRevenue * 100 : 0;
    
    let comparisonStr = "";
    if (historyComparisonData?.current?.revenue > 0 && historyComparisonData?.previous?.revenue > 0) {
      const revDiff = ((historyComparisonData.current.revenue - historyComparisonData.previous.revenue) / historyComparisonData.previous.revenue) * 100;
      const timeDiff = historyComparisonData.previous.time > 0 ? ((historyComparisonData.current.time - historyComparisonData.previous.time) / historyComparisonData.previous.time) * 100 : 0;
      const progress = historyComparisonData.progressPct?.toFixed(0) || 100;
      
      const timeContext = timeDiff < 0 ? `trabalhando ${Math.abs(timeDiff).toFixed(0)}% a menos` : `trabalhando ${timeDiff.toFixed(0)}% a mais`;
      const revContext = revDiff > 0 ? `faturou ${revDiff.toFixed(0)}% a mais` : `faturou ${Math.abs(revDiff).toFixed(0)}% a menos`;

      if (progress < 100) {
        if (revDiff > 0 && timeDiff < 0) {
           comparisonStr = `Excelente! Você ${revContext} ${timeContext} neste mês. Sua eficiência disparou. `;
        } else {
           comparisonStr = `Com ${progress}% do mês passado, você ${revContext} e está ${timeContext}. `;
        }
      } else {
        if (revDiff > 0 && timeDiff <= 0) {
           comparisonStr = `Excelente! Você ${revContext} ${timeContext} comparado ao mês passado. `;
        } else {
           comparisonStr = `Você ${revContext} e trabalhou ${timeDiff > 0 ? '+' : ''}${timeDiff.toFixed(0)}% vs mês passado. `;
        }
      }
    }

    const projectedProfitStr = metrics.estimatedProfit > 0 
      ? `projeta um lucro de R$ ${(metrics.estimatedProfit / (historyComparisonData?.progressPct > 0 ? historyComparisonData.progressPct / 100 : 1)).toFixed(0)} ao fim do mês.` 
      : `precisa de atenção para ser lucrativo.`;

    if (fuelCostPct > 35) {
       return `${comparisonStr}Alerta: O combustível consome ${fuelCostPct.toFixed(1)}% do ganho (alto). O ritmo atual ${projectedProfitStr}`;
    }

    return `${comparisonStr}Ótimo controle de gastos! Combustível representa só ${fuelCostPct.toFixed(1)}% do faturamento. O ritmo atual ${projectedProfitStr}`;
  }, [metrics, costsMetrics, historyComparisonData]);

  return (
    <div className="mt-4 mb-4 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
      <div className="flex items-start gap-3 relative z-10">
        <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl shrink-0">
          <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" /> 
        </div>
        <div>
           <p className="text-xs font-black text-emerald-400 dark:text-emerald-500 uppercase tracking-widest mb-1">Análise de Inteligência</p>
           <p className="text-[14px] text-emerald-900 dark:text-emerald-100 font-medium leading-relaxed">
             {insight}
           </p>
        </div>
      </div>
    </div>
  );
}
