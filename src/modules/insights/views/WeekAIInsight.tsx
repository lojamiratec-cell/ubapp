import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';

export function WeekAIInsight({ metrics, chartsData, historyComparisonData }: { metrics: any, chartsData: any, historyComparisonData: any }) {
  const insight = useMemo(() => {
    if (!chartsData || !chartsData.revenueData || chartsData.revenueData.length < 2) return "Continue trabalhando na semana para gerar análises comparativas.";
    
    let comparisonStr = "";
    if (historyComparisonData?.current?.revenue > 0 && historyComparisonData?.previous?.revenue > 0) {
      const revDiff = ((historyComparisonData.current.revenue - historyComparisonData.previous.revenue) / historyComparisonData.previous.revenue) * 100;
      const timeDiff = historyComparisonData.previous.time > 0 ? ((historyComparisonData.current.time - historyComparisonData.previous.time) / historyComparisonData.previous.time) * 100 : 0;
      const progress = historyComparisonData.progressPct?.toFixed(0) || 100;
      
      const timeContext = timeDiff < 0 ? `trabalhando ${Math.abs(timeDiff).toFixed(0)}% a menos` : `trabalhando ${timeDiff.toFixed(0)}% a mais`;
      const revContext = revDiff > 0 ? `faturou ${revDiff.toFixed(0)}% a mais` : `faturou ${Math.abs(revDiff).toFixed(0)}% a menos`;

      if (progress < 100) {
        if (revDiff > 0 && timeDiff < 0) {
           comparisonStr = `Excelente! Você ${revContext} ${timeContext} nesta semana. Eficiência altíssima. `;
        } else {
           comparisonStr = `Com ${progress}% da semana, você ${revContext} e está ${timeContext}. `;
        }
      } else {
        if (revDiff > 0 && timeDiff <= 0) {
           comparisonStr = `Excelente! Você ${revContext} ${timeContext} comparado a semana passada. `;
        } else {
           comparisonStr = `Você ${revContext} e trabalhou ${timeDiff > 0 ? '+' : ''}${timeDiff.toFixed(0)}% vs semana passada. `;
        }
      }
    }

    const sortedDays = [...chartsData.revenueData].sort((a,b) => a.value - b.value);
    const worstDay1 = sortedDays[0];
    const worstDay2 = sortedDays.length > 1 ? sortedDays[1] : null;

    let worstDaysStr = worstDay1.name.split(' ')[0];
    if (worstDay2 && worstDay2.value < worstDay1.value * 1.5) { // If the second worst is also relatively bad
       worstDaysStr += ` e ${worstDay2.name.split(' ')[0]}`;
    }

    const bestHourStr = metrics.bestHourInfo?.hour !== -1 
      ? `das ${String(metrics.bestHourInfo.hour).padStart(2, '0')}h às ${String(metrics.bestHourInfo.hour + 1).padStart(2, '0')}h` 
      : 'em horários de pico';

    return `${comparisonStr}${worstDaysStr} foram seus piores dias nesta semana. Em compensação, seu lucro foca ${bestHourStr}. Foque onde o dinheiro está!`;
  }, [chartsData, metrics, historyComparisonData]);

  return (
    <div className="mt-4 mb-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
      <div className="flex items-start gap-3 relative z-10">
        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-xl shrink-0">
          <Sparkles size={18} className="text-blue-600 dark:text-blue-400" /> 
        </div>
        <div>
           <p className="text-xs font-black text-blue-400 dark:text-blue-500 uppercase tracking-widest mb-1">Análise de Inteligência</p>
           <p className="text-[14px] text-blue-900 dark:text-blue-100 font-medium leading-relaxed">
             {insight}
           </p>
        </div>
      </div>
    </div>
  );
}
