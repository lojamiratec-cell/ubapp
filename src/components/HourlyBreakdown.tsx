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

  return (
    <div className="mt-6">
      <h3 className="text-xs uppercase font-black text-gray-500 tracking-widest mb-3 flex items-center gap-2">
        <Clock size={14} /> {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {hourlyData.map(data => {
          const startTimeStr = `${String(data.hour).padStart(2, '0')}:00`;
          const endTimeStr = `${String((data.hour + 1) % 24).padStart(2, '0')}:00`;
          
          return (
            <div key={data.hour} className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="bg-white dark:bg-gray-900 px-2.5 py-1 rounded-lg text-xs font-black text-gray-700 dark:text-gray-300 shadow-sm border border-gray-100 dark:border-gray-800">
                  {startTimeStr} - {endTimeStr}
                </div>
                <div className="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  {data.count} {data.count === 1 ? 'corrida' : 'corridas'}
                </div>
              </div>
              
              <div className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                R$ {data.revenue.toFixed(2)}
              </div>
              
              <div className="flex items-center gap-2 mt-auto">
                <div className={cn("flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase", getRphTier(data.rph).bg, getRphTier(data.rph).color)}>
                  <TrendingUp size={12} /> {data.rph.toFixed(0)}/h
                </div>
                <div className={cn("flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase", getRpkmTier(data.rpkm).bg, getRpkmTier(data.rpkm).color)}>
                  <MapPin size={12} /> {data.rpkm.toFixed(2)}/km
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
