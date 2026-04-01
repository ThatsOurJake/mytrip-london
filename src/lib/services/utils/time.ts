export function parseTimeToMinutes(value: string): number {
  const [hoursString, minutesString] = value.split(':');
  const hours = Number(hoursString);
  const minutes = Number(minutesString);

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time value: ${value}`);
  }

  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (normalized % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDuration(totalMinutes: number): string {
  const normalized = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr${hours === 1 ? '' : 's'}`;
  }

  return `${hours} hr${hours === 1 ? '' : 's'} ${minutes} min`;
}

export function clampMinutes(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function safeWindowStart(earliestArrival: string | undefined, dayStartMinutes: number): number {
  if (!earliestArrival) {
    return dayStartMinutes;
  }
  return Math.max(dayStartMinutes, parseTimeToMinutes(earliestArrival));
}

export function safeWindowEnd(latestArrival: string | undefined, dayEndMinutes: number): number {
  if (!latestArrival) {
    return dayEndMinutes;
  }
  return Math.min(dayEndMinutes, parseTimeToMinutes(latestArrival));
}
