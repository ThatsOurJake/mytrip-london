import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { normalizePlannerSettings, todayIsoDate } from '$lib/services/planner/day-settings';
import { paletteForDayIndex } from '../services/planner/day-colors';
import { normalizePlannerInputPlaces } from '../services/planner/place-constraints';
import { createId } from '$lib/services/utils';
import { clearPlannerRouteCache, runPlanner } from '$lib/services/planner/run-planner';
import { exportItineraryPdf } from '$lib/services/export/pdf';
import {
  PLANNER_STORAGE_VERSION,
  type RouteDataSource,
  TRANSIT_PREFERENCES,
  type Place,
  type PlannerInput,
  type PlannerResult,
  type SavedPlannerState,
  type TransitPreference,
  type TransportPreference,
  type TransportMode
} from '$lib/types/planner';

const STORAGE_KEY = 'london-day-planner-state';
const PREFERENCE_ORDER: TransportPreference[] = ['walking', 'cycling', ...TRANSIT_PREFERENCES];

function isTransitPreference(preference: TransportPreference): preference is TransitPreference {
  return TRANSIT_PREFERENCES.includes(preference as TransitPreference);
}

function hasTransitPreference(preferences: Iterable<TransportPreference>): boolean {
  for (const preference of preferences) {
    if (isTransitPreference(preference)) {
      return true;
    }
  }

  return false;
}

function orderPreferences(preferences: Iterable<TransportPreference>): TransportPreference[] {
  const set = new Set(preferences);
  return PREFERENCE_ORDER.filter((preference) => set.has(preference));
}

function preferencesFromMode(mode: TransportMode): TransportPreference[] {
  if (mode === 'cycling') {
    return ['walking', 'cycling'];
  }

  if (mode === 'mixed') {
    return ['walking', ...TRANSIT_PREFERENCES];
  }

  return ['walking'];
}

function normalizePreferences(preferences: TransportPreference[] | undefined, mode: TransportMode): TransportPreference[] {
  const base = new Set<TransportPreference>();

  for (const preference of preferences ?? preferencesFromMode(mode)) {
    base.add(preference);
  }

  base.add('walking');

  if (hasTransitPreference(base)) {
    base.delete('cycling');
  } else if (mode === 'cycling') {
    base.add('cycling');
  }

  if (mode === 'mixed' && !hasTransitPreference(base)) {
    for (const transitPreference of TRANSIT_PREFERENCES) {
      base.add(transitPreference);
    }
  }

  return orderPreferences(base);
}

export interface PlannerStoreState {
  input: PlannerInput;
  result: PlannerResult | null;
  isRunning: boolean;
  error: string | null;
}

const defaultState: PlannerStoreState = {
  input: {
    hotel: {
      name: '',
      location: { lat: 51.5072, lng: -0.1276 }
    },
    settings: {
      dayStart: '08:30',
      dayEnd: '21:00',
      mode: 'walking',
      preferences: ['walking'],
      dataSource: 'auto',
      startDate: todayIsoDate(),
      endDate: todayIsoDate(),
      planningDays: [
        {
          id: 'day-1',
          label: 'Day 1',
          date: todayIsoDate(),
          dayStart: '08:30',
          dayEnd: '21:00',
          fullness: 'full',
          palette: paletteForDayIndex(0)
        }
      ]
    },
    places: []
  },
  result: null,
  isRunning: false,
  error: null
};

function readPersistedState(): PlannerInput | null {
  if (!browser) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed: SavedPlannerState = JSON.parse(raw);
    if (parsed.version !== PLANNER_STORAGE_VERSION) {
      return null;
    }

    return normalizePlannerInputPlaces({
      ...parsed.input,
      settings: normalizePlannerSettings({
        ...parsed.input.settings,
        preferences: normalizePreferences(parsed.input.settings.preferences, parsed.input.settings.mode),
        dataSource: parsed.input.settings.dataSource ?? 'auto'
      })
    });
  } catch {
    return null;
  }
}

function persistState(input: PlannerInput): void {
  if (!browser) {
    return;
  }

  const payload: SavedPlannerState = {
    version: PLANNER_STORAGE_VERSION,
    input,
    updatedAt: new Date().toISOString()
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function mergeState(base: PlannerStoreState, partial: Partial<PlannerStoreState>): PlannerStoreState {
  return {
    ...base,
    ...partial
  };
}

function validatePlannerInput(input: PlannerInput): string | null {
  const hotelName = input.hotel.name.trim();
  const { lat, lng } = input.hotel.location;

  if (!hotelName) {
    return 'Please set and save a hotel/start point name before optimising.';
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'Please provide a valid hotel/start point location before optimising.';
  }

  if (input.places.length === 0) {
    return 'Add at least one place before optimising.';
  }

  return null;
}

function createPlannerStore() {
  const initialInput = readPersistedState() ?? defaultState.input;
  const { subscribe, update } = writable<PlannerStoreState>({
    ...defaultState,
    input: initialInput
  });

  function updateInput(mutator: (input: PlannerInput) => PlannerInput): void {
    update((state) => {
      const input = mutator(state.input);
      persistState(input);
      clearPlannerRouteCache();
      return mergeState(state, { input, result: null, error: null });
    });
  }

  return {
    subscribe,
    setHotel(name: string, lat: number, lng: number): void {
      updateInput((input) => ({
        ...input,
        hotel: {
          name,
          location: { lat, lng }
        }
      }));
    },
    setSettings(settings: {
      dayStart: string;
      dayEnd: string;
      mode: TransportMode;
      preferences?: TransportPreference[];
      dataSource?: RouteDataSource;
      startDate?: string;
      endDate?: string;
      planningDays?: PlannerInput['settings']['planningDays'];
    }): void {
      updateInput((input) => ({
        ...input,
        settings: normalizePlannerSettings({
          dayStart: settings.dayStart,
          dayEnd: settings.dayEnd,
          mode: settings.mode,
          preferences: normalizePreferences(settings.preferences, settings.mode),
          dataSource: settings.dataSource ?? 'auto',
          startDate: settings.startDate,
          endDate: settings.endDate,
          planningDays: settings.planningDays
        })
      }));
    },
    addPlace(placeDraft: Omit<Place, 'id'>): void {
      updateInput((input) => ({
        ...input,
        places: [
          ...input.places,
          {
            ...placeDraft,
            id: createId('place')
          }
        ]
      }));
    },
    updatePlace(updatedPlace: Place): void {
      updateInput((input) => ({
        ...input,
        places: input.places.map((place) => (place.id === updatedPlace.id ? updatedPlace : place))
      }));
    },
    removePlace(id: string): void {
      updateInput((input) => ({
        ...input,
        places: input.places.filter((place) => place.id !== id)
      }));
    },
    reset(): void {
      update(() => {
        persistState(defaultState.input);
        clearPlannerRouteCache();
        return {
          ...defaultState,
          input: defaultState.input
        };
      });
    },
    async optimize(): Promise<void> {
      update((state) => mergeState(state, { isRunning: true, error: null }));
      let snapshot: PlannerInput | null = null;
      update((state) => {
        snapshot = state.input;
        return state;
      });

      if (!snapshot) {
        update((state) => mergeState(state, { isRunning: false, error: 'Planner state is unavailable.' }));
        return;
      }

      const validationError = validatePlannerInput(snapshot);
      if (validationError) {
        update((state) => mergeState(state, { isRunning: false, error: validationError }));
        return;
      }

      try {
        const result = await runPlanner(snapshot);
        update((state) => mergeState(state, { result, isRunning: false }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to optimise itinerary.';
        update((state) => mergeState(state, { error: message, isRunning: false }));
      }
    },
    exportPdf(): void {
      update((state) => {
        if (!state.result) {
          return mergeState(state, { error: 'Run optimisation before exporting a PDF.' });
        }

        exportItineraryPdf(state.input, state.result);
        return state;
      });
    },
    importSharedPlan(input: PlannerInput, result: PlannerResult): void {
      const normalizedInput: PlannerInput = normalizePlannerInputPlaces({
        ...input,
        settings: normalizePlannerSettings({
          ...input.settings,
          preferences: normalizePreferences(input.settings.preferences, input.settings.mode),
          dataSource: input.settings.dataSource ?? 'auto'
        })
      });

      persistState(normalizedInput);
      clearPlannerRouteCache();

      update(() => ({
        input: normalizedInput,
        result,
        isRunning: false,
        error: null
      }));
    }
  };
}

export const plannerStore = createPlannerStore();
