import type { TripDayPalette } from '$lib/types/planner';

export const DAY_PALETTE_OPTIONS: Array<{
  value: TripDayPalette;
  label: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  accent: string;
  text: string;
  muted: string;
}> = [
    { value: 'blush', label: 'Blush', surface: '#fdf2f8', surfaceStrong: '#fce7f3', border: '#f5c2d8', accent: '#c08497', text: '#9d5c79', muted: '#b76e8d' },
    { value: 'peach', label: 'Peach', surface: '#fff4ed', surfaceStrong: '#ffe8d6', border: '#fdba74', accent: '#ea580c', text: '#9a3412', muted: '#c2410c' },
    { value: 'butter', label: 'Butter', surface: '#fffbea', surfaceStrong: '#fef3c7', border: '#fcd34d', accent: '#d97706', text: '#92400e', muted: '#b45309' },
    { value: 'mint', label: 'Mint', surface: '#ecfdf5', surfaceStrong: '#d1fae5', border: '#6ee7b7', accent: '#059669', text: '#065f46', muted: '#047857' },
    { value: 'sky', label: 'Sky', surface: '#eff6ff', surfaceStrong: '#dbeafe', border: '#93c5fd', accent: '#2563eb', text: '#1d4ed8', muted: '#2563eb' },
    { value: 'lavender', label: 'Lavender', surface: '#f5f3ff', surfaceStrong: '#ede9fe', border: '#c4b5fd', accent: '#7c3aed', text: '#5b21b6', muted: '#6d28d9' },
    { value: 'mist', label: 'Mist', surface: '#f1f5f9', surfaceStrong: '#e2e8f0', border: '#cbd5e1', accent: '#475569', text: '#334155', muted: '#475569' }
  ];

export function paletteForDayIndex(index: number): TripDayPalette {
  return DAY_PALETTE_OPTIONS[index % DAY_PALETTE_OPTIONS.length]?.value ?? 'sky';
}

export function getDayPalette(value: TripDayPalette | undefined) {
  return DAY_PALETTE_OPTIONS.find((option) => option.value === value) ?? DAY_PALETTE_OPTIONS[0];
}
