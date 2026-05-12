import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';

export function DayAIInsight({ metrics, hourlyData }: { metrics: any, hourlyData: any[] }) {
  const insight = useMemo(() => {
    if (!hourlyData || hourlyData.length === 0) return "Registre mais corridas para obter insights inteligentes do seu dia.";
    
    // Identificar horas com menos faturamento ou Pior R$/KM
    // A logica heuristicamente: se o rpkm for baixo
    const lowestRpkm = [...hourlyData].filter(d => d.rpkm > 0).sort((a,b) => a.rpkm - b.rpkm);
    if (lowestRpkm.length > 0 && lowestRpkm[0].rpkm < 1.5) {
      const h = lowestRpkm[0].hour;
      return `Você rodou muito vazio próximo as ${h}h-${h+1}h, afetando seu R$/km geral hoje. Considere desligar ou reposicionar durante esse horário.`;
    }

    if (metrics.revenuePerHour > 35) {
      return `Dia de excelência! Seu faturamento por hora (R$ ${metrics.revenuePerHour.toFixed(0)}/h) está com ótimo desempenho.`;
    } else {
      return `Dia desafiador. Tente direcionar-se para áreas de alta demanda no próximo turno para aumentar sua eficiência de ganhos.`;
    }
  }, [hourlyData, metrics]);

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
      <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold italic leading-relaxed flex items-start gap-2 relative z-10">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-purple-500" /> 
        {insight}
      </p>
    </div>
  );
}
