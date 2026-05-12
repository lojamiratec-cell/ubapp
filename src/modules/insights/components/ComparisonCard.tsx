import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface ComparisonCardProps {
  title: string;
  icon: React.ReactNode;
  current: number;
  prev: number;
  avg: number;
  format: (v: number) => string;
  labelPrev: string;
  labelAvg: string;
  higherIsBetter: boolean;
}

export function ComparisonCard({ title, icon, current, prev, avg, format, labelPrev, labelAvg, higherIsBetter }: ComparisonCardProps) {
  const getDiff = (a: number, b: number) => {
    if (b === 0) return { pct: 0, str: '0%', good: true };
    const diff = ((a - b) / b) * 100;
    const isGood = higherIsBetter ? diff >= 0 : diff <= 0;
    return { pct: diff, str: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`, good: isGood };
  };

  const diffPrev = getDiff(current, prev);
  const diffAvg = getDiff(current, avg);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-gray-400 dark:text-gray-500">{icon}</div>
        <p className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{title}</p>
      </div>
      
      <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-4">{format(current)}</p>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg text-[11px] font-bold">
           <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vs. {labelPrev}</span>
           <div className="flex items-center gap-2">
             <span className="text-gray-400 font-medium tabular-nums">{format(prev)}</span>
             {prev > 0 ? (
               <span className={cn("px-1.5 py-0.5 rounded flex items-center gap-0.5", diffPrev.good ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                 {diffPrev.good ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                 {diffPrev.str}
               </span>
             ) : <span className="text-gray-400 font-medium tracking-wide">Sem dados</span>}
           </div>
        </div>
        
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg text-[11px] font-bold">
           <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vs. {labelAvg}</span>
           <div className="flex items-center gap-2">
             <span className="text-gray-400 font-medium tabular-nums">{format(avg)}</span>
             {avg > 0 ? (
               <span className={cn("px-1.5 py-0.5 rounded flex items-center gap-0.5", diffAvg.good ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                 {diffAvg.good ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                 {diffAvg.str}
               </span>
             ) : <span className="text-gray-400 font-medium tracking-wide">Sem dados</span>}
           </div>
        </div>
      </div>
    </div>
  );
}
