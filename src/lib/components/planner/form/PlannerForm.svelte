<script lang="ts">
	import { mdiAlphaECircleOutline, mdiBike, mdiBusDoubleDecker, mdiSubway, mdiTrain, mdiWalk } from '@mdi/js';
	import { getDayPalette, paletteForDayIndex } from '$lib/services/planner/day-colors';
	import { addDaysToIsoDate, todayIsoDate } from '$lib/services/planner/day-settings';
	import { routeDataSourceLabel } from '$lib/services/planner/ui-text';
	import type { LocationSuggestion } from '$lib/services/geocode';
	import {
		TRANSIT_PREFERENCES,
		type RouteDataSource,
		type TripDayPalette,
		type TransitPreference,
		type TransportMode,
		type TransportPreference,
		type TripPlanningDay
	} from '$lib/types/planner';
	import PlannerFormAddPlace from './PlannerFormAddPlace.svelte';
	import PlannerFormTripDays from './PlannerFormTripDays.svelte';
	import PlannerFormTripSettings from './PlannerFormTripSettings.svelte';
	import type {
		ActiveTravelOption,
		DataSourceOption,
		FullnessOption,
		PlaceDraftValue,
		PlannerFormValue,
		TransitOption
	} from './planner-form-types';

	const PREFERENCE_ORDER: TransportPreference[] = ['walking', 'cycling', ...TRANSIT_PREFERENCES];
	const TRANSIT_PREFERENCE_SET = new Set<TransitPreference>(TRANSIT_PREFERENCES);
	const MILLISECONDS_PER_DAY = 86_400_000;

	const activeTravelOptions: ActiveTravelOption[] = [
		{
			preference: 'walking',
			label: 'Walking',
			description: 'Always on for short links and station access.',
			icon: mdiWalk,
			disabled: true
		},
		{
			preference: 'cycling',
			label: 'Cycling',
			description: 'Prefer bike routing instead of TfL services.',
			icon: mdiBike
		}
	];

	const transitOptions: TransitOption[] = [
		{ preference: 'tube', label: 'Tube', description: 'Underground, Overground and DLR.', icon: mdiSubway },
		{ preference: 'bus', label: 'Bus', description: 'TfL bus routing with walking connectors.', icon: mdiBusDoubleDecker },
		{ preference: 'train', label: 'Train', description: 'National Rail and tram services.', icon: mdiTrain },
		{ preference: 'elizabeth', label: 'Elizabeth', description: 'Use Elizabeth line journeys where available.', icon: mdiAlphaECircleOutline }
	];

	const dataSourceOptions: DataSourceOption[] = [
		{ value: 'auto', label: 'Recommended', description: 'Use the best live provider for each trip, then fall back when needed.' },
		{ value: 'tfl', label: 'TfL', description: 'Prefer TfL journey data for public transport routing across London.' },
		{ value: 'openstreet', label: 'OpenStreet', description: 'Prefer OpenStreet routing for walking and cycling segments.' },
		{ value: 'heuristic', label: 'Heuristic', description: 'Use built-in estimates only, without live routing requests.' }
	];

	const fullnessOptions: FullnessOption[] = [
		{ value: 'light', label: 'Light', description: 'Keep extra breathing room and move overflow to later days.' },
		{ value: 'balanced', label: 'Balanced', description: 'Aim for a comfortable but productive day.' },
		{ value: 'full', label: 'Full', description: 'Pack the day well while still leaving some flex.' },
		{ value: 'packed', label: 'Packed', description: 'Cramp in as much as possible before spilling over.' }
	];

	let {
		value,
		stopCount,
		onSaveSettings,
		onAddPlace,
		onSettingsSaved = () => undefined
	}: {
		value: PlannerFormValue;
		stopCount: number;
		onSaveSettings: (next: PlannerFormValue) => void;
		onAddPlace: (next: PlaceDraftValue) => void;
		onSettingsSaved?: () => void;
	} = $props();

	let hotelName = $state('');
	let tripName = $state('');
	let hotelLat = $state('');
	let hotelLng = $state('');
	let dayStart = $state('08:30');
	let dayEnd = $state('21:00');
	let mode = $state<TransportMode>('walking');
	let preferences = $state<TransportPreference[]>(['walking']);
	let dataSource = $state<RouteDataSource>('auto');
	let startDate = $state(todayIsoDate());
	let endDate = $state(todayIsoDate());
	let planningDays = $state<TripPlanningDay[]>([]);

	$effect(() => {
		tripName = value.tripName;
		hotelName = value.hotelName;
		hotelLat = value.hotelLat.toString();
		hotelLng = value.hotelLng.toString();
		dayStart = value.dayStart;
		dayEnd = value.dayEnd;
		mode = value.mode;
		preferences = [...value.preferences];
		dataSource = value.dataSource;
		startDate = value.startDate ?? value.planningDays[0]?.date ?? todayIsoDate();
		endDate = value.endDate ?? value.planningDays[value.planningDays.length - 1]?.date ?? startDate;
		planningDays = value.planningDays.map((tripDay) => ({ ...tripDay }));
	});

	let placeName = $state('');
	let placeLat = $state('51.509865');
	let placeLng = $state('-0.118092');
	let minimumDwellMinutes = $state('90');
	let openingTime = $state('');
	let closingTime = $state('');
	let fixedArrival = $state('');
	let preferredDayId = $state('');
	let priority = $state('5');
	let hotelSearchQuery = $state('');
	let placeSearchQuery = $state('');
	let saveStatus = $state('');

	function orderPreferences(nextPreferences: Iterable<TransportPreference>): TransportPreference[] {
		const nextSet = new Set(nextPreferences);
		return PREFERENCE_ORDER.filter((preference) => nextSet.has(preference));
	}

	function hasTransitPreference(nextPreferences: Iterable<TransportPreference>): boolean {
		for (const preference of nextPreferences) {
			if (TRANSIT_PREFERENCE_SET.has(preference as TransitPreference)) {
				return true;
			}
		}

		return false;
	}

	function modeFromPreferences(nextPreferences: TransportPreference[]): TransportMode {
		if (hasTransitPreference(nextPreferences)) {
			return 'mixed';
		}

		if (nextPreferences.includes('cycling')) {
			return 'cycling';
		}

		return 'walking';
	}

	function togglePreference(preference: TransportPreference): void {
		if (preference === 'walking') {
			return;
		}

		const next = new Set(preferences);
		if (next.has(preference)) {
			next.delete(preference);
		} else {
			next.add(preference);
			if (preference === 'cycling') {
				for (const transitPreference of TRANSIT_PREFERENCES) {
					next.delete(transitPreference);
				}
			} else if (TRANSIT_PREFERENCE_SET.has(preference as TransitPreference)) {
				next.delete('cycling');
			}
		}

		next.add('walking');
		preferences = orderPreferences(next);
		mode = modeFromPreferences(preferences);
	}

	function hasPreference(preference: TransportPreference): boolean {
		return preferences.includes(preference);
	}

	function isMultiDay(): boolean {
		return planningDays.length > 1;
	}

	function inclusiveDayCount(rangeStart: string, rangeEnd: string): number {
		const start = new Date(`${rangeStart}T00:00:00`);
		const end = new Date(`${rangeEnd}T00:00:00`);
		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
			return 1;
		}

		const diffMs = end.getTime() - start.getTime();
		return diffMs < 0 ? 1 : Math.floor(diffMs / MILLISECONDS_PER_DAY) + 1;
	}

	function syncPlanningDays(nextStartDate: string, nextEndDate: string): void {
		const targetCount = inclusiveDayCount(nextStartDate, nextEndDate);
		planningDays = Array.from({ length: targetCount }, (_, index) => {
			const existingDay = planningDays[index];
			return {
				id: existingDay?.id ?? `day-${index + 1}`,
				label: `Day ${index + 1}`,
				date: addDaysToIsoDate(nextStartDate, index),
				dayStart: existingDay?.dayStart ?? dayStart,
				dayEnd: existingDay?.dayEnd ?? dayEnd,
				fullness: existingDay?.fullness ?? 'full',
				palette: existingDay?.palette ?? paletteForDayIndex(index)
			};
		});
		dayStart = planningDays[0]?.dayStart ?? dayStart;
		dayEnd = planningDays[0]?.dayEnd ?? dayEnd;
	}

	function updateStartDate(nextStartDate: string): void {
		startDate = nextStartDate;
		if (!isMultiDay() || endDate < nextStartDate) {
			endDate = nextStartDate;
		}
		syncPlanningDays(nextStartDate, endDate);
	}

	function updateEndDate(nextEndDate: string): void {
		endDate = nextEndDate < startDate ? startDate : nextEndDate;
		syncPlanningDays(startDate, endDate);
	}

	function addPlanningDay(): void {
		const nextEndDate = addDaysToIsoDate(endDate, 1);
		endDate = nextEndDate;
		syncPlanningDays(startDate, nextEndDate);
	}

	function removePlanningDay(): void {
		if (planningDays.length <= 1) {
			return;
		}

		const nextEndDate = addDaysToIsoDate(startDate, planningDays.length - 2);
		endDate = nextEndDate;
		syncPlanningDays(startDate, nextEndDate);
	}

	function updatePlanningDay(index: number, patch: Partial<TripPlanningDay>): void {
		planningDays = planningDays.map((tripDay, tripDayIndex) => {
			if (tripDayIndex !== index) {
				return tripDay;
			}

			const nextDay = {
				...tripDay,
				...patch,
				label: `Day ${tripDayIndex + 1}`,
				date: addDaysToIsoDate(startDate, tripDayIndex)
			};

			if (tripDayIndex === 0) {
				dayStart = nextDay.dayStart;
				dayEnd = nextDay.dayEnd;
			}

			return nextDay;
		});
	}

	function updatePlanningDayPalette(index: number, palette: TripDayPalette): void {
		updatePlanningDay(index, { palette });
	}

	function dayCardStyle(tripDay: TripPlanningDay): string {
		const palette = getDayPalette(tripDay.palette);
		return `background:${palette.surface};border-color:${palette.border};color:${palette.text};`;
	}

	function dayChipStyle(tripDay: TripPlanningDay): string {
		const palette = getDayPalette(tripDay.palette);
		return `background:${palette.surfaceStrong};color:${palette.text};`;
	}

	function hasPendingTripChanges(): boolean {
		return (
			tripName !== value.tripName ||
			hotelName !== value.hotelName ||
			hotelLat !== value.hotelLat.toString() ||
			hotelLng !== value.hotelLng.toString() ||
			dayStart !== value.dayStart ||
			dayEnd !== value.dayEnd ||
			mode !== value.mode ||
			preferences.join('|') !== value.preferences.join('|') ||
			dataSource !== value.dataSource ||
			startDate !== (value.startDate ?? '') ||
			endDate !== (value.endDate ?? '') ||
			JSON.stringify(planningDays) !== JSON.stringify(value.planningDays)
		);
	}

	function saveSettings(): void {
		onSaveSettings({
			tripName,
			hotelName,
			hotelLat: Number(hotelLat),
			hotelLng: Number(hotelLng),
			dayStart: planningDays[0]?.dayStart ?? dayStart,
			dayEnd: planningDays[0]?.dayEnd ?? dayEnd,
			mode,
			preferences,
			dataSource,
			startDate,
			endDate,
			planningDays
		});
		saveStatus = 'Trip details saved.';
		onSettingsSaved();
	}

	function selectionSummary(): string {
		if (hasTransitPreference(preferences)) {
			return `Walking plus ${preferences
				.filter((preference) => TRANSIT_PREFERENCE_SET.has(preference as TransitPreference))
				.map((preference) => transitOptions.find((option) => option.preference === preference)?.label.toLowerCase() ?? preference)
				.join(', ')}.`;
		}

		if (preferences.includes('cycling')) {
			return 'Walking plus cycling.';
		}

		return 'Walking only.';
	}

	function dataSourceNotice(): string {
		if (dataSource === 'openstreet' && mode === 'mixed') {
			return `${routeDataSourceLabel(dataSource)} routing does not include London public transport, so mixed trips may fall back to heuristic segments.`;
		}

		if (dataSource === 'tfl' && mode !== 'mixed') {
			return `${routeDataSourceLabel(dataSource)} routing is strongest for public transport journeys. Walking or cycling-only trips may still fall back if needed.`;
		}

		return dataSourceOptions.find((option) => option.value === dataSource)?.description ?? '';
	}

	function setHotelFromSuggestion(location: LocationSuggestion): void {
		hotelSearchQuery = location.label;
		hotelName = location.label.split(',')[0]?.trim() || location.label;
		hotelLat = location.lat.toFixed(6);
		hotelLng = location.lng.toFixed(6);
	}

	function setPlaceFromSuggestion(location: LocationSuggestion): void {
		const selectedName = location.label.split(',').map((part) => part.trim()).find(Boolean) || location.label.trim();
		placeSearchQuery = location.label;
		placeName = selectedName;
		placeLat = location.lat.toFixed(6);
		placeLng = location.lng.toFixed(6);
	}

	function addPlace(): void {
		const resolvedPlaceName = placeName.trim() || placeSearchQuery.split(',').map((part) => part.trim()).find(Boolean) || 'Selected place';
		onAddPlace({
			name: resolvedPlaceName,
			lat: Number(placeLat),
			lng: Number(placeLng),
			minimumDwellMinutes: Number(minimumDwellMinutes),
			openingTime,
			closingTime,
			fixedArrival,
			preferredDayId,
			priority: Number(priority)
		});

		placeName = '';
		placeSearchQuery = '';
		openingTime = '';
		closingTime = '';
		fixedArrival = '';
		preferredDayId = '';
	}
</script>

<section aria-labelledby="planner-config-title" class="space-y-6">
	<PlannerFormTripSettings
		{tripName}
		{hotelSearchQuery}
		{hotelName}
		{hotelLat}
		{hotelLng}
		{activeTravelOptions}
		{transitOptions}
		{dataSourceOptions}
		{hasPreference}
		{togglePreference}
		{selectionSummary}
		{dataSource}
		{dataSourceNotice}
		onTripNameChange={(value) => (tripName = value)}
		onHotelNameChange={(value) => (hotelName = value)}
		onHotelLatChange={(value) => (hotelLat = value)}
		onHotelLngChange={(value) => (hotelLng = value)}
		onHotelSuggestionSelect={setHotelFromSuggestion}
		onDataSourceChange={(value) => (dataSource = value)}
	/>

	<PlannerFormTripDays
		{planningDays}
		{startDate}
		{endDate}
		isMultiDay={isMultiDay()}
		{fullnessOptions}
		{dayCardStyle}
		{dayChipStyle}
		{addPlanningDay}
		{removePlanningDay}
		{updateStartDate}
		{updateEndDate}
		{updatePlanningDay}
		{updatePlanningDayPalette}
		{hasPendingTripChanges}
		{saveSettings}
		{saveStatus}
	/>

	<PlannerFormAddPlace
		{placeSearchQuery}
		{placeName}
		{placeLat}
		{placeLng}
		{minimumDwellMinutes}
		{openingTime}
		{closingTime}
		{fixedArrival}
		{preferredDayId}
		{priority}
		{planningDays}
		isMultiDay={isMultiDay()}
		{stopCount}
		onPlaceSuggestionSelect={setPlaceFromSuggestion}
		onPlaceNameChange={(value) => (placeName = value)}
		onPlaceLatChange={(value) => (placeLat = value)}
		onPlaceLngChange={(value) => (placeLng = value)}
		onMinimumDwellMinutesChange={(value) => (minimumDwellMinutes = value)}
		onOpeningTimeChange={(value) => (openingTime = value)}
		onClosingTimeChange={(value) => (closingTime = value)}
		onFixedArrivalChange={(value) => (fixedArrival = value)}
		onPreferredDayIdChange={(value) => (preferredDayId = value)}
		onPriorityChange={(value) => (priority = value)}
		onAddPlace={addPlace}
	/>
</section>
