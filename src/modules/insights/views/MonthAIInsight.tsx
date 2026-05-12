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
    const fuelCostPct = metrics.totalRevenue > 0 ? (costsMetrics?.totalFuelValue30Days || metrics.estimatedFuelCost) / metrics.totalRevenue * 100 : 0;
    
    let comparisonStr = "";
    if (historyComparisonData?.current?.revenue > 0 && historyComparisonData?.previous?.revenue > 0) {
      const diff = ((historyComparisonData.current.revenue - historyComparisonData.previous.revenue) / historyComparisonData.previous.revenue) * 100;
      if (diff > 0) comparisonStr = `Seu faturamento está crescendo ${diff.toFixed(0)}% vs mês passado. `;
      else comparisonStr = `Seu faturamento reduziu ${Math.abs(diff).toFixed(0)}% vs mês passado. `;
    }

    const projectedProfitStr = metrics.estimatedProfit > 0 
      ? `projeta um lucro líquido de R$ ${(metrics.estimatedProfit * 1.1).toFixed(0)} até o fechamento. ` // Rough heuristic
      : `precisa de atenção para ser lucrativo.`;

    if (fuelCostPct > 35) {
       return `${comparisonStr}Alerta: Seu custo de combustível está consumindo ${fuelCostPct.toFixed(1)}% do faturamento, um valor muito alto. Porém, o ritmo atual ${projectedProfitStr}`;
    }

    return `${comparisonStr}Ótimo controle de gastos! Seu combustível representa apenas ${fuelCostPct.toFixed(1)}% do faturamento. O ritmo atual ${projectedProfitStr}`;
  }, [metrics, costsMetrics, historyComparisonData]);

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold italic leading-relaxed flex items-start gap-2 relative z-10">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-emerald-500" /> 
        {insight}
      </p>
    </div>
  );
}
