import React, { useMemo } from 'react';
import { Trip, Shift } from '../types';
import { ensureDate, cn } from '../lib/utils';
import { getRphTier, getRpkmTier } from '../App';
import { Clock, TrendingUp, MapPin, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  shifts: Shift[];
  shiftTrips: Record<string, Trip[]>;
  title?: string;
}

export function HourlyBreakdown({ shifts, shiftTrips, title = "Ganhos por Hora" }: Props) {
  const hourlyData = useMemo(() => {
    const buckets: Record<number, { revenue: number, km: number, count: number }> = {};
    
    let hasAnyTripsWithTime = false;

    shifts.forEach(shift => {
      const trips = shiftTrips[shift.id] || [];
      trips.forEach(t => {
        if (t.isCancelled) return;
        const date = ensureDate(t.startTime || t.timestamp);
        if (!date) return;
        
        hasAnyTripsWithTime = true;
        
        const h = date.getHours();
        if (!buckets[h]) {
          buckets[h] = { revenue: 0, km: 0, count: 0 };
        }
        buckets[h].revenue += t.value || 0;
        buckets[h].km += t.distanceKm || 0;
        buckets[h].count += 1;
      });
    });

    if (!hasAnyTripsWithTime) return [];

    return Object.entries(buckets).map(([h, data]) => ({
      hour: Number(h),
      ...data,
      rph: data.revenue, // Since the bucket is exactly 1 hour, revenue in that hour IS revenue per hour for that active hour
      rpkm: data.km > 0 ? data.revenue / data.km : 0
    })).sort((a, b) => a.hour - b.hour);
  }, [shifts, shiftTrips]);

  if (hourlyData.length === 0) return null;

  const maxRevenue = Math.max(...hourlyData.map(d => d.revenue));

  return (
    <div className="mt-2">
      <h3 className="text-xs uppercase font-black text-gray-500 tracking-widest mb-3 flex items-center gap-2">
        <Clock size={12} /> {title}
      </h3>
      
      <div className="flex items-end gap-1 h-32 w-full pt-4">
        {hourlyData.map(data => {
          const heightPct = Math.max(10, (data.revenue / maxRevenue) * 100);
          
          let colorClass = "bg-gray-200 dark:bg-gray-800"; // Frio
          if (data.rph >= 45) {
            colorClass = "bg-red-500"; // Muito Quente
          } else if (data.rph >= 35) {
            colorClass = "bg-orange-500"; // Quente
          } else if (data.rph >= 25) {
            colorClass = "bg-yellow-500"; // Morno
          } else if (data.rph >= 15) {
            colorClass = "bg-blue-400"; // Frio
          }

          return (
            <div key={data.hour} className="flex-1 flex flex-col items-center gap-2 group relative">
              
              {/* Tooltip on hover/touch */}
              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs p-2 rounded-xl pointer-events-none z-10 whitespace-nowrap shadow-xl">
                <p className="font-black mb-1">{String(data.hour).padStart(2, '0')}:00 - {String((data.hour + 1) % 24).padStart(2, '0')}:00</p>
                <p className="font-bold flex justify-between gap-4"><span>Faturado:</span> <span>R$ {data.revenue.toFixed(2)}</span></p>
                <p className="flex justify-between gap-4"><span>Média:</span> <span>R$ {data.rph.toFixed(0)}/h</span></p>
                <p className="flex justify-between gap-4 text-gray-400 dark:text-gray-500"><span>Corridas:</span> <span>{data.count}</span></p>
                <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-white rotate-45" />
              </div>

              <div 
                className={cn("w-full rounded-t-sm transition-all duration-500 hover:opacity-80", colorClass)} 
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-xs font-black text-gray-400">{String(data.hour).padStart(2, '0')}h</span>
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-between items-center mt-4 border-t border-gray-100 dark:border-white/5 pt-3">
         <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            <span>Temperatura:</span>
            <span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-800" /> Frio
            <span className="w-2 h-2 rounded-full bg-yellow-500 ml-1" /> Morno
            <span className="w-2 h-2 rounded-full bg-red-500 ml-1" /> Quente
         </div>
      </div>
    </div>
  );
}
