import {
  type PlannerSettings,
  type TripDayPalette,
  type TripDayFullness,
  type TripPlanningDay
} from '$lib/types/planner';
import { paletteForDayIndex } from './day-colors';

const DEFAULT_DAY_START = '08:30';
const DEFAULT_DAY_END = '21:00';
const DEFAULT_DAY_FULLNESS: TripDayFullness = 'full';
const DEFAULT_DAY_PALETTE: TripDayPalette = 'sky';

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIsoDate(): string {
  return toLocalIsoDate(new Date());
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function addDaysToIsoDate(date: string | undefined, offset: number): string {
  const baseDate = parseIsoDate(date) ?? parseIsoDate(todayIsoDate());
  if (!baseDate) {
    return todayIsoDate();
  }

  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + offset);
  return toLocalIsoDate(nextDate);
}

function inclusiveDayCount(startDate: string | undefined, endDate: string | undefined): number {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) {
    return 1;
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    return 1;
  }

  return Math.floor(diffMs / 86_400_000) + 1;
}

export function normalizePlanningDays(settings: PlannerSettings): TripPlanningDay[] {
  const startDate = settings.startDate ?? todayIsoDate();
  const sourceDays = settings.planningDays ?? [];
  const explicitCount = sourceDays.length;
  const dateCount = inclusiveDayCount(startDate, settings.endDate);
  const totalDays = Math.max(1, explicitCount, dateCount);

  return Array.from({ length: totalDays }, (_, index) => {
    const existingDay = sourceDays[index];
    return {
      id: existingDay?.id ?? `day-${index + 1}`,
      label: existingDay?.label ?? `Day ${index + 1}`,
      date: addDaysToIsoDate(startDate, index),
      dayStart: existingDay?.dayStart ?? settings.dayStart ?? DEFAULT_DAY_START,
      dayEnd: existingDay?.dayEnd ?? settings.dayEnd ?? DEFAULT_DAY_END,
      fullness: existingDay?.fullness ?? DEFAULT_DAY_FULLNESS,
      palette: existingDay?.palette ?? paletteForDayIndex(index) ?? DEFAULT_DAY_PALETTE
    };
  });
}

export function normalizePlannerSettings(settings: PlannerSettings): PlannerSettings {
  const planningDays = normalizePlanningDays(settings);
  const firstDay = planningDays[0];
  const lastDay = planningDays[planningDays.length - 1];

  return {
    ...settings,
    dayStart: firstDay?.dayStart ?? settings.dayStart ?? DEFAULT_DAY_START,
    dayEnd: firstDay?.dayEnd ?? settings.dayEnd ?? DEFAULT_DAY_END,
    startDate: firstDay?.date ?? settings.startDate ?? todayIsoDate(),
    endDate: lastDay?.date ?? settings.endDate ?? firstDay?.date ?? todayIsoDate(),
    planningDays
  };
}

export function fullnessMultiplier(fullness: TripDayFullness): number {
  switch (fullness) {
    case 'light':
      return 0.65;
    case 'balanced':
      return 0.8;
    case 'packed':
      return 1.08;
    default:
      return 0.95;
  }
}
