import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';

export function WeekAIInsight({ metrics, chartsData }: { metrics: any, chartsData: any }) {
  const insight = useMemo(() => {
    if (!chartsData || !chartsData.revenueData || chartsData.revenueData.length < 2) return "Continue trabalhando na semana para gerar análises comparativas.";
    
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

    return `${worstDaysStr} foram seus piores dias nesta semana. Em compensação, seu melhor R$/h tem sido ${bestHourStr}. Foque onde o dinheiro está!`;
  }, [chartsData, metrics]);

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
      <p className="text-[11px] text-blue-700 dark:text-blue-300 font-bold italic leading-relaxed flex items-start gap-2 relative z-10">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-blue-500" /> 
        {insight}
      </p>
    </div>
  );
}
