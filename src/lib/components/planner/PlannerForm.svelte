<script lang="ts">
	import { mdiAlphaECircleOutline, mdiBike, mdiBusDoubleDecker, mdiSubway, mdiTrain, mdiWalk } from '@mdi/js';
	import { DAY_PALETTE_OPTIONS, getDayPalette, paletteForDayIndex } from '$lib/services/planner/day-colors';
	import { addDaysToIsoDate, todayIsoDate } from '$lib/services/planner/day-settings';
	import type { LocationSuggestion } from '$lib/services/geocode';
	import {
		TRANSIT_PREFERENCES,
		type RouteDataSource,
		type TripDayPalette,
		type TransitPreference,
		type TransportMode,
		type TransportPreference,
		type TripDayFullness,
		type TripPlanningDay
	} from '$lib/types/planner';
	import AppIcon from './AppIcon.svelte';
	import InfoPopover from './InfoPopover.svelte';
	import LocationAutocomplete from './LocationAutocomplete.svelte';

	const PREFERENCE_ORDER: TransportPreference[] = ['walking', 'cycling', ...TRANSIT_PREFERENCES];
	const TRANSIT_PREFERENCE_SET = new Set<TransitPreference>(TRANSIT_PREFERENCES);
	const activeTravelOptions: Array<{
		preference: 'walking' | 'cycling';
		label: string;
		description: string;
		icon: string;
		disabled?: boolean;
	}> = [
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
	const transitOptions: Array<{
		preference: TransitPreference;
		label: string;
		description: string;
		icon: string;
	}> = [
		{ preference: 'tube', label: 'Tube', description: 'Underground, Overground and DLR.', icon: mdiSubway },
		{ preference: 'bus', label: 'Bus', description: 'TfL bus routing with walking connectors.', icon: mdiBusDoubleDecker },
		{ preference: 'train', label: 'Train', description: 'National Rail and tram services.', icon: mdiTrain },
		{ preference: 'elizabeth', label: 'Elizabeth', description: 'Use Elizabeth line journeys where available.', icon: mdiAlphaECircleOutline }
	];
	const dataSourceOptions: Array<{ value: RouteDataSource; label: string; description: string }> = [
		{ value: 'auto', label: 'Recommended', description: 'Use the best live provider for each trip, then fall back when needed.' },
		{ value: 'tfl', label: 'TfL', description: 'Prefer TfL journey data for public transport routing across London.' },
		{ value: 'openstreet', label: 'OpenStreet', description: 'Prefer OpenStreet routing for walking and cycling segments.' },
		{ value: 'heuristic', label: 'Heuristic', description: 'Use built-in estimates only, without live routing requests.' }
	];
	const fullnessOptions: Array<{ value: TripDayFullness; label: string; description: string }> = [
		{ value: 'light', label: 'Light', description: 'Keep extra breathing room and move overflow to later days.' },
		{ value: 'balanced', label: 'Balanced', description: 'Aim for a comfortable but productive day.' },
		{ value: 'full', label: 'Full', description: 'Pack the day well while still leaving some flex.' },
		{ value: 'packed', label: 'Packed', description: 'Cramp in as much as possible before spilling over.' }
	];

	interface PlannerFormValue {
		hotelName: string;
		hotelLat: number;
		hotelLng: number;
		dayStart: string;
		dayEnd: string;
		mode: TransportMode;
		preferences: TransportPreference[];
		dataSource: RouteDataSource;
		startDate?: string;
		endDate?: string;
		planningDays: TripPlanningDay[];
	}

	interface PlaceDraftValue {
		name: string;
		lat: number;
		lng: number;
		minimumDwellMinutes: number;
		openingTime: string;
		closingTime: string;
		fixedArrival: string;
		preferredDayId: string;
		priority: number;
	}

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
		return diffMs < 0 ? 1 : Math.floor(diffMs / 86_400_000) + 1;
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
			return 'OpenStreet routing does not include London public transport, so mixed trips may fall back to heuristic segments.';
		}

		if (dataSource === 'tfl' && mode !== 'mixed') {
			return 'TfL routing is strongest for public transport journeys. Walking or cycling-only trips may still fall back if needed.';
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
	<div class="rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
		<h2 id="planner-config-title" class="text-xl font-semibold text-slate-900">Trip settings</h2>
		<p class="mt-1 text-sm text-slate-700">These settings define the base for optimisation: your hotel, travel style, route source, and one or more trip days.</p>

		<div class="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
			<div class="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
				<h3 class="text-base font-semibold text-slate-900">Start point and trip details</h3>
				<div class="mt-3 space-y-3">
					<LocationAutocomplete label="Hotel search (London)" value={hotelSearchQuery} placeholder="Search for your hotel" onSelect={setHotelFromSuggestion} />
					<label class="flex flex-col gap-1">
						<span class="text-sm font-medium text-slate-700">Hotel display name</span>
						<input bind:value={hotelName} class="field" type="text" placeholder="The Savoy" />
					</label>
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="flex flex-col gap-1">
							<span class="text-sm font-medium text-slate-700">Hotel latitude</span>
							<input bind:value={hotelLat} class="field" inputmode="decimal" type="text" />
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-sm font-medium text-slate-700">Hotel longitude</span>
							<input bind:value={hotelLng} class="field" inputmode="decimal" type="text" />
						</label>
					</div>
				</div>
			</div>

			<div class="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
				<h3 class="text-base font-semibold text-slate-900">Transport and routing</h3>
				<p class="mt-1 text-sm text-slate-700">Set travel modes and route source.</p>
				<fieldset class="mt-3 space-y-2">
					<legend class="text-sm font-medium text-slate-700">Transport preferences</legend>
					<p class="text-sm text-slate-600">Walking stays enabled. Add cycling or any TfL services you want available.</p>
					<div class="space-y-2.5">
						<div>
							<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Active travel</p>
							<div class="grid gap-2 sm:grid-cols-2">
								{#each activeTravelOptions as option}
									<label class={`transport-option transport-option-compact ${hasPreference(option.preference) ? 'transport-option-active' : ''} ${option.disabled ? 'transport-option-disabled' : ''}`} title={option.description}>
										<input class="sr-only" type="checkbox" checked={hasPreference(option.preference)} disabled={option.disabled} onchange={() => togglePreference(option.preference)} />
										<span class="transport-icon transport-icon-compact"><AppIcon path={option.icon} size={16} label={option.label} /></span>
										<span class="min-w-0"><span class="block font-medium leading-tight text-slate-900">{option.label}</span><span class="block text-[11px] leading-tight text-slate-600">{option.description}</span></span>
									</label>
								{/each}
							</div>
						</div>
						<div>
							<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">TfL services</p>
							<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
								{#each transitOptions as option}
									<label class={`transport-option transport-option-compact ${hasPreference(option.preference) ? 'transport-option-active' : ''}`} title={option.description}>
										<input class="sr-only" type="checkbox" checked={hasPreference(option.preference)} onchange={() => togglePreference(option.preference)} />
										<span class="transport-icon transport-icon-compact"><AppIcon path={option.icon} size={16} label={option.label} /></span>
										<span class="min-w-0"><span class="block font-medium leading-tight text-slate-900">{option.label}</span><span class="block text-[11px] leading-tight text-slate-600">{option.description}</span></span>
									</label>
								{/each}
							</div>
						</div>
					</div>
					<p class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{selectionSummary()}</p>
				</fieldset>
				<fieldset class="mt-3 space-y-2">
					<legend class="text-sm font-medium text-slate-700">Route data source</legend>
					<p class="text-sm text-slate-600">Choose the routing source.</p>
					<div class="grid gap-2 sm:grid-cols-2">
						{#each dataSourceOptions as option}
							<label class={`transport-option transport-option-compact transport-option-text-only ${dataSource === option.value ? 'transport-option-active' : ''}`} title={option.description}>
								<input class="sr-only" type="radio" name="route-data-source" value={option.value} checked={dataSource === option.value} onchange={() => (dataSource = option.value)} />
								<span class="min-w-0"><span class="block font-medium leading-tight text-slate-900">{option.label}</span><span class="block text-[11px] leading-tight text-slate-600">{option.description}</span></span>
							</label>
						{/each}
					</div>
					<p class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{dataSourceNotice()}</p>
				</fieldset>
			</div>
		</div>

		<div class="mt-6 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 class="text-base font-semibold text-slate-900">Trip days</h3>
					<p class="mt-1 text-sm text-slate-700">Start with one day, then add more if you want the planner to spread stops across the trip. Extra days get their own date, start time, end time, and fullness.</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<button type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100" onclick={addPlanningDay}>Add day</button>
					<button type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" onclick={removePlanningDay} disabled={planningDays.length <= 1}>Remove last day</button>
				</div>
			</div>
			<div class="mt-4 grid gap-3 md:grid-cols-2">
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium text-slate-700">Trip start date</span>
					<input bind:value={startDate} class="field" type="date" name="trip-start-date" autocomplete="off" data-1p-ignore="true" data-lpignore="true" onchange={(event) => updateStartDate((event.currentTarget as HTMLInputElement).value)} />
				</label>
				{#if isMultiDay()}
					<label class="flex flex-col gap-1">
						<span class="text-sm font-medium text-slate-700">Trip end date</span>
						<input bind:value={endDate} class="field" type="date" name="trip-end-date" autocomplete="off" data-1p-ignore="true" data-lpignore="true" min={startDate} onchange={(event) => updateEndDate((event.currentTarget as HTMLInputElement).value)} />
					</label>
				{/if}
			</div>
			<div class="mt-4 grid gap-3 lg:grid-cols-2">
				{#each planningDays as tripDay, index}
					<div class="rounded-xl border p-4 shadow-sm" style={dayCardStyle(tripDay)}>
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="text-sm font-semibold">{tripDay.label}</p>
								<p class="text-xs opacity-80">{tripDay.date ?? 'Date not set'}</p>
							</div>
							<span class="rounded-full px-3 py-1 text-xs font-semibold" style={dayChipStyle(tripDay)}>{fullnessOptions.find((option) => option.value === tripDay.fullness)?.label ?? 'Full'}</span>
						</div>
						<div class="mt-3 grid gap-3 sm:grid-cols-2">
							<label class="flex flex-col gap-1">
								<span class="text-sm font-medium text-slate-700">Day start</span>
								<input class="field" type="time" value={tripDay.dayStart} onchange={(event) => updatePlanningDay(index, { dayStart: (event.currentTarget as HTMLInputElement).value })} />
							</label>
							<label class="flex flex-col gap-1">
								<span class="text-sm font-medium text-slate-700">Day end</span>
								<input class="field" type="time" value={tripDay.dayEnd} onchange={(event) => updatePlanningDay(index, { dayEnd: (event.currentTarget as HTMLInputElement).value })} />
							</label>
						</div>
						<div class="mt-3 flex flex-col gap-1">
							<span class="text-sm font-medium">Day colour</span>
							<div class="flex flex-wrap gap-2" role="radiogroup" aria-label={`${tripDay.label} colour palette`}>
								{#each DAY_PALETTE_OPTIONS as option}
									<button
										type="button"
										class={`day-swatch ${tripDay.palette === option.value ? 'day-swatch-selected' : ''}`}
										style={`background:${option.surfaceStrong};border-color:${option.border};color:${option.text};`}
										title={option.label}
										aria-label={`${tripDay.label} colour ${option.label}`}
										aria-pressed={tripDay.palette === option.value}
										onclick={() => updatePlanningDayPalette(index, option.value)}
									></button>
								{/each}
							</div>
						</div>

						{#if isMultiDay()}
							<label class="mt-3 flex flex-col gap-1">
								<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">Fullness <InfoPopover label="Day fullness" content="Higher fullness tells the planner to fit more into this day before shifting stops to the next one." /></span>
								<select class="field" value={tripDay.fullness} onchange={(event) => updatePlanningDay(index, { fullness: (event.currentTarget as HTMLSelectElement).value as TripDayFullness })}>
									{#each fullnessOptions as option}
										<option value={option.value}>{option.label} - {option.description}</option>
									{/each}
								</select>
							</label>
						{/if}
					</div>
				{/each}
			</div>
			{#if hasPendingTripChanges()}
				<p class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status" aria-live="polite">You changed trip details. Save them before you optimise.</p>
			{/if}
			<button class="mt-4 inline-flex cursor-pointer rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700" type="button" onclick={saveSettings}>Save start point and trip details</button>
			{#if saveStatus}
				<p class="mt-2 text-sm text-emerald-800" role="status" aria-live="polite">{saveStatus} Optimisation and itinerary generation now use these values.</p>
			{/if}
		</div>
	</div>

	<div class="rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
		<h2 class="text-xl font-semibold text-slate-900">Add place</h2>
		<p class="mt-1 text-sm text-slate-700">Search a place first, then adjust its opening hours, booking time, and preferred day.</p>
		<div class="mt-3"><LocationAutocomplete label="Find place in London" value={placeSearchQuery} placeholder="Search museum, park, attraction..." onSelect={setPlaceFromSuggestion} /></div>
		<div class="mt-3 grid gap-3 md:grid-cols-2">
			<label class="flex flex-col gap-1 md:col-span-2"><span class="text-sm font-medium text-slate-700">Place name</span><input bind:value={placeName} class="field" type="text" placeholder="British Museum" /></label>
			<label class="flex flex-col gap-1"><span class="text-sm font-medium text-slate-700">Latitude</span><input bind:value={placeLat} class="field" inputmode="decimal" type="text" /></label>
			<label class="flex flex-col gap-1"><span class="text-sm font-medium text-slate-700">Longitude</span><input bind:value={placeLng} class="field" inputmode="decimal" type="text" /></label>
			<label class="flex flex-col gap-1"><span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">Minimum dwell time (minutes) <InfoPopover label="Minimum dwell time" content="The least time you want to spend at this place. The planner keeps at least this many minutes in the itinerary." /></span><input bind:value={minimumDwellMinutes} class="field" inputmode="numeric" min="10" step="5" type="number" /></label>
			<label class="flex flex-col gap-1"><span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">Priority (1-10) <InfoPopover label="Priority" content="Higher priority places are favoured when route timing is tight. Use 10 for must-see places." /></span><input bind:value={priority} class="field" inputmode="numeric" min="1" max="10" type="number" /></label>
			<label class="flex flex-col gap-1"><span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">Opening time (optional) <InfoPopover label="Opening time" content="The planner will not schedule this place before it opens." /></span><input bind:value={openingTime} class="field" type="time" /></label>
			<label class="flex flex-col gap-1"><span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">Closing time (optional) <InfoPopover label="Closing time" content="The planner aims to finish the visit before this time." /></span><input bind:value={closingTime} class="field" type="time" /></label>
			<label class="flex flex-col gap-1 md:col-span-2"><span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">Fixed arrival (optional, hard constraint) <InfoPopover label="Fixed arrival" content="Must arrive at exactly this time, such as booked tickets. This is treated as a strict constraint." /></span><input bind:value={fixedArrival} class="field" type="time" /></label>
			{#if isMultiDay()}
				<label class="flex flex-col gap-1 md:col-span-2"><span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">Preferred trip day <InfoPopover label="Preferred trip day" content="Optional. Keep the stop flexible or ask the planner to try a specific day first." /></span><select bind:value={preferredDayId} class="field"><option value="">Flexible across days</option>{#each planningDays as day}<option value={day.id}>{day.label}{#if day.date} - {day.date}{/if}</option>{/each}</select></label>
			{/if}
		</div>
		<button class="mt-4 inline-flex cursor-pointer rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-600" type="button" onclick={addPlace} disabled={!(placeName.trim() || placeSearchQuery.trim())}>Add place</button>
		{#if stopCount > 0}
			<a href="#stops-title" class="mt-2 inline-flex cursor-pointer rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-900 ring-1 ring-slate-300 hover:bg-slate-200">Jump to stops ({stopCount})</a>
		{/if}
	</div>
</section>

<style>
	.field {
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		padding: 0.6rem 0.75rem;
		background: #fff;
	}
	.field:focus {
		outline: 2px solid #0f766e;
		outline-offset: 1px;
	}
	.transport-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.9rem;
		padding: 0.8rem 0.9rem;
		background: #ffffff;
		cursor: pointer;
		transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
	}
	.transport-option-active {
		border-color: #0f766e;
		box-shadow: inset 0 0 0 1px rgb(15 118 110 / 0.25);
		background: rgb(240 253 250 / 1);
	}
	.transport-option-disabled {
		cursor: default;
	}
	.transport-option:hover {
		border-color: #94a3b8;
	}
	.transport-option-compact {
		gap: 0.6rem;
		padding: 0.6rem 0.7rem;
		border-radius: 0.8rem;
	}
	.transport-option-text-only {
		align-items: flex-start;
	}
	.transport-icon {
		display: inline-flex;
		height: 2.1rem;
		width: 2.1rem;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: rgb(241 245 249 / 1);
		color: #0f172a;
	}
	.transport-icon-compact {
		height: 1.8rem;
		width: 1.8rem;
	}
	.day-swatch {
		height: 1.8rem;
		width: 1.8rem;
		border: 2px solid transparent;
		border-radius: 9999px;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}
	.day-swatch:hover {
		transform: translateY(-1px);
	}
	.day-swatch-selected {
		box-shadow: 0 0 0 2px #0f172a;
	}
</style>
