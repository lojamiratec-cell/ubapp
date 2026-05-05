import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Trip, Shift, Fuel } from './types';

// Helps parsing date from possible timestamps
const ensureDate = (dateOrTimestamp: any): Date => {
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp;
  if (dateOrTimestamp && typeof dateOrTimestamp.toDate === 'function') return dateOrTimestamp.toDate();
  if (typeof dateOrTimestamp === 'string' || typeof dateOrTimestamp === 'number') return new Date(dateOrTimestamp);
  return new Date();
};

export const syncMonthlyStats = async (userId: string, shiftDate: Date, maintPercentage: number, maintCostPerKm: number) => {
  try {
    const year = shiftDate.getFullYear();
    const month = String(shiftDate.getMonth() + 1).padStart(2, '0');
    const docId = `${userId}_${year}_${month}`;

    const start = new Date(year, shiftDate.getMonth(), 1);
    const end = new Date(year, shiftDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // Retrieve all shifts and fuel for this user. We could restrict by dates, 
    // but without composite indices it's safer to fetch the user's data and filter locally,
    // assuming the number of shifts is manageable, or just query normally if we assume no index is needed?
    // Actually, Firestore REQUIRES a composite index if we do: where('userId', '==', userId), where('startTime', '>=', start).
    // So we fetch everything for the user and filter.
    const qShifts = query(collection(db, 'shifts'), where('userId', '==', userId));
    const shiftsSnap = await getDocs(qShifts);
    
    let totalRevenue = 0;
    let totalTrips = 0;
    let totalShifts = 0;
    let totalKm = 0;
    let totalHours = 0;
    let totalDynamic = 0;

    const dailyRev: Record<string, number> = {};
    const shiftsIds: string[] = [];

    shiftsSnap.docs.forEach(d => {
      const s = d.data() as Shift;
      const sDate = ensureDate(s.startTime);
      if (sDate >= start && sDate <= end && s.status === 'finished') {
        totalShifts += 1;
        totalRevenue += s.totalRevenueFromTrips || s.totalRevenue || 0;
        totalTrips += Math.max(s.totalTrips || 0, 0); // we will refine trips count with actual trips
        totalKm += s.totalWorkKm || ((s.endKm || 0) - s.startKm) || 0;
        totalHours += (s.activeTimeSeconds || 0) / 3600;
        totalDynamic += s.totalDynamicValue || 0;
        
        const dayStr = sDate.toISOString().split('T')[0];
        dailyRev[dayStr] = (dailyRev[dayStr] || 0) + (s.totalRevenueFromTrips || s.totalRevenue || 0);
        shiftsIds.push(d.id);
      }
    });

    let bestDay = null;
    let maxRev = -1;
    for (const [day, rev] of Object.entries(dailyRev)) {
      if (rev > maxRev) {
        maxRev = rev;
        bestDay = day;
      }
    }

    // Now get all trips to find total registered trips count, dynamic, and best hour
    let actualTripsCount = 0;
    const hourlyRev: Record<number, number> = {};
    
    // Process trips only for the filtered shifts
    for (const sId of shiftsIds) {
      const qTrips = query(collection(db, 'shifts', sId, 'trips'));
      const tSnap = await getDocs(qTrips);
      tSnap.docs.forEach(tDoc => {
        const t = tDoc.data() as Trip;
        if (!t.isCancelled) {
          actualTripsCount += 1;
          const tDate = ensureDate(t.startTime || t.timestamp);
          const h = tDate.getHours();
          hourlyRev[h] = (hourlyRev[h] || 0) + (t.value || 0);
        }
      });
    }

    if (actualTripsCount > 0) {
      // Prefer real trips count over aggregated totalTrips if it's larger
      totalTrips = Math.max(totalTrips, actualTripsCount);
    }

    let bestHour = null;
    let maxHRev = -1;
    for (const [h, rev] of Object.entries(hourlyRev)) {
      if (rev > maxHRev) {
        maxHRev = rev;
        bestHour = Number(h);
      }
    }

    // Get fuel cost
    const qFuel = query(collection(db, 'fuel'), where('userId', '==', userId));
    const fuelSnap = await getDocs(qFuel);
    let fuelCost = 0;
    fuelSnap.docs.forEach(d => {
      const f = d.data() as Fuel;
      const fDate = ensureDate(f.date);
      if (fDate >= start && fDate <= end) {
        fuelCost += f.totalValue || 0;
      }
    });

    const avgPerHour = totalHours > 0 ? totalRevenue / totalHours : 0;
    const avgPerKm = totalKm > 0 ? totalRevenue / totalKm : 0;
    
    // Based on Insights, maintenanceReserve = totalRevenue * (maintenancePercentage / 100)
    // or fallback to totalKm * maintCostPerKm
    const maintenanceReserve = totalRevenue * (maintPercentage / 100);

    const netProfit = totalRevenue - fuelCost - maintenanceReserve;

    const statsRef = doc(db, 'monthly_stats', docId);
    await setDoc(statsRef, {
      userId,
      yearMonth: `${year}_${month}`,
      totalRevenue,
      totalTrips,
      totalShifts,
      totalKm,
      totalHours,
      avgPerHour,
      avgPerKm,
      totalDynamic,
      fuelCost,
      maintenanceReserve,
      netProfit,
      bestDay,
      bestHour,
      updatedAt: serverTimestamp()
    }, { merge: true });

  } catch (err) {
    console.error('Error syncing monthly stats: ', err);
  }
};
