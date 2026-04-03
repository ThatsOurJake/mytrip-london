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
    { value: 'blush', label: 'Rose', surface: '#fbf0f3', surfaceStrong: '#f4d9e3', border: '#dfa8bf', accent: '#a84b6e', text: '#7a2a4a', muted: '#96395f' },
    { value: 'peach', label: 'Coral', surface: '#fef0eb', surfaceStrong: '#fddacc', border: '#f4a478', accent: '#c05530', text: '#7d2e10', muted: '#a03a1e' },
    { value: 'butter', label: 'Gold', surface: '#fdf7e4', surfaceStrong: '#fae8a4', border: '#e8cb6a', accent: '#b8952a', text: '#7a5f0c', muted: '#826415' },
    { value: 'mint', label: 'Sage', surface: '#f0f4ee', surfaceStrong: '#d9e6d4', border: '#9bbb8f', accent: '#4a7a44', text: '#2a5226', muted: '#3d6a38' },
    { value: 'sky', label: 'Steel', surface: '#eef2f7', surfaceStrong: '#d5dfe9', border: '#90aabf', accent: '#3a6680', text: '#1e4260', muted: '#2e577a' },
    { value: 'lavender', label: 'Plum', surface: '#f5eef5', surfaceStrong: '#e5d3e5', border: '#bb96bc', accent: '#7a3a7a', text: '#4e1e4e', muted: '#652a65' },
    { value: 'mist', label: 'Slate', surface: '#f1f3f5', surfaceStrong: '#e4e7eb', border: '#afbac5', accent: '#4a5568', text: '#2d3748', muted: '#3e4a5c' }
  ];

export function paletteForDayIndex(index: number): TripDayPalette {
  return DAY_PALETTE_OPTIONS[index % DAY_PALETTE_OPTIONS.length]?.value ?? 'sky';
}

export function getDayPalette(value: TripDayPalette | undefined) {
  return DAY_PALETTE_OPTIONS.find((option) => option.value === value) ?? DAY_PALETTE_OPTIONS[0];
}
