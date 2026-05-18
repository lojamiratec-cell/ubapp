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
    <div className="mt-4 p-5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-32 h-32 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
      <div className="flex items-start gap-3 relative z-10">
        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl shrink-0">
          <Sparkles size={18} className="text-purple-600 dark:text-purple-400" /> 
        </div>
        <div>
           <p className="text-xs font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-1">Análise de Inteligência</p>
           <p className="text-[14px] text-indigo-900 dark:text-indigo-100 font-medium leading-relaxed">
             {insight}
           </p>
        </div>
      </div>
    </div>
  );
}
