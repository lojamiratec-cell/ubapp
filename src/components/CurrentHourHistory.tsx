import React, { useMemo } from 'react';
import { Shift, Trip } from '../types';
import { ensureDate } from '../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  shifts: Shift[];
  shiftTrips: Record<string, Trip[]>;
  currentRph: number;
}

export function CurrentHourHistory({ shifts, shiftTrips, currentRph }: Props) {
  const historyData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const oneWeekAgoStart = new Date();
    oneWeekAgoStart.setDate(oneWeekAgoStart.getDate() - 8);
    const oneWeekAgoEnd = new Date();
    oneWeekAgoEnd.setDate(oneWeekAgoEnd.getDate() - 6);

    let totalRevenue = 0;
    const uniqueDays = new Set<string>();
    
    let lastWeekRevenue = 0;
    const lastWeekDays = new Set<string>();

    shifts.forEach(shift => {
      const shiftStartTime = ensureDate(shift.startTime);
      if (shiftStartTime < fourWeeksAgo) return;

      const trips = shiftTrips[shift.id] || [];
      trips.forEach(trip => {
        if (trip.isCancelled) return;
        const tripTime = ensureDate(trip.startTime || trip.timestamp);
        if (!tripTime) return;

        if (tripTime.getDay() === currentDay && tripTime.getHours() === currentHour) {
          const val = trip.value || 0;
          const dayStr = format(tripTime, 'yyyy-MM-dd');
          
          totalRevenue += val;
          uniqueDays.add(dayStr);
          
          if (tripTime > oneWeekAgoStart && tripTime < oneWeekAgoEnd) {
             lastWeekRevenue += val;
             lastWeekDays.add(dayStr);
          }
        }
      });
    });

    if (lastWeekDays.size > 0) {
       return { avgRph: lastWeekRevenue / lastWeekDays.size, numDays: 1, currentDay, currentHour, label: 'semana passada' };
    }

    const numDays = uniqueDays.size;
    const avgRph = numDays > 0 ? totalRevenue / numDays : 0;
    
    return { avgRph, numDays, currentDay, currentHour, label: `Últimas ${numDays} semanas` };
  }, [shifts, shiftTrips]);

  if (!historyData || historyData.numDays === 0) return null;

  const diff = currentRph - historyData.avgRph;
  const diffPerc = historyData.avgRph > 0 ? (diff / historyData.avgRph) * 100 : 0;
  
  const dayName = format(new Date(), 'EEEE', { locale: ptBR }).split('-')[0];
  const startTimeStr = `${String(historyData.currentHour).padStart(2, '0')}h`;
  const endTimeStr = `${String((historyData.currentHour + 1) % 24).padStart(2, '0')}h`;

  return (
    <div className="bg-white/5 border border-white/10 p-3 rounded-2xl text-white relative z-10 flex items-center gap-3">
      <div className={`p-2 rounded-xl mt-0.5 ${diffPerc > 0 ? 'bg-green-500/20 text-green-400' : diffPerc < 0 ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
         {diffPerc > 0 ? <TrendingUp size={16} /> : diffPerc < 0 ? <TrendingDown size={16} /> : <Minus size={16} />}
      </div>
      <div>
        <p className="text-[11px] font-medium leading-relaxed opacity-90">
          Agora: <span className="font-bold">R${currentRph.toFixed(0)}/h.</span>{' '}
          {historyData.label} ({startTimeStr}-{endTimeStr}): <span className="font-bold">R${historyData.avgRph.toFixed(0)}/h.</span>{' '}
          {diffPerc !== 0 && (
             <span className={diffPerc > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
               Você está {diffPerc > 0 ? '+' : ''}{diffPerc.toFixed(0)}% {diffPerc > 0 ? 'acima' : 'abaixo'}.
             </span>
          )}
        </p>
      </div>
    </div>
  );
}
