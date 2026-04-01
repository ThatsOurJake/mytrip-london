<script lang="ts">
	import type { LocationSuggestion } from '$lib/services/geocode';
	import type { TripPlanningDay } from '$lib/types/planner';
	import { VISIT_TIME_FIELD_LABEL, VISIT_TIME_PLACE_INFO } from '$lib/services/planner/ui-text';
	import { PRIMARY_BUTTON_CLASS } from '../shared/button-classes';
	import FieldLabel from '../shared/FieldLabel.svelte';
	import LocationAutocomplete from './LocationAutocomplete.svelte';
	import './planner-form-shared.css';

	let {
		placeSearchQuery,
		placeName,
		placeLat,
		placeLng,
		minimumDwellMinutes,
		openingTime,
		closingTime,
		fixedArrival,
		preferredDayId,
		priority,
		planningDays,
		isMultiDay,
		stopCount,
		onPlaceSuggestionSelect,
		onPlaceNameChange,
		onPlaceLatChange,
		onPlaceLngChange,
		onMinimumDwellMinutesChange,
		onOpeningTimeChange,
		onClosingTimeChange,
		onFixedArrivalChange,
		onPreferredDayIdChange,
		onPriorityChange,
		onAddPlace
	}: {
		placeSearchQuery: string;
		placeName: string;
		placeLat: string;
		placeLng: string;
		minimumDwellMinutes: string;
		openingTime: string;
		closingTime: string;
		fixedArrival: string;
		preferredDayId: string;
		priority: string;
		planningDays: TripPlanningDay[];
		isMultiDay: boolean;
		stopCount: number;
		onPlaceSuggestionSelect: (location: LocationSuggestion) => void;
		onPlaceNameChange: (value: string) => void;
		onPlaceLatChange: (value: string) => void;
		onPlaceLngChange: (value: string) => void;
		onMinimumDwellMinutesChange: (value: string) => void;
		onOpeningTimeChange: (value: string) => void;
		onClosingTimeChange: (value: string) => void;
		onFixedArrivalChange: (value: string) => void;
		onPreferredDayIdChange: (value: string) => void;
		onPriorityChange: (value: string) => void;
		onAddPlace: () => void;
	} = $props();
</script>

<div class="rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
	<h2 class="text-xl font-semibold text-slate-900">Add place</h2>
	<p class="mt-1 text-sm text-slate-700">Search a place first, then adjust its opening hours, booking time, and preferred day.</p>
	<div class="mt-3"><LocationAutocomplete label="Find place in London" value={placeSearchQuery} placeholder="Search museum, park, attraction..." onSelect={onPlaceSuggestionSelect} /></div>
	<div class="mt-3 grid gap-3 md:grid-cols-2">
		<label class="flex flex-col gap-1 md:col-span-2"><span class="text-sm font-medium text-slate-700">Place name</span><input class="field" type="text" placeholder="British Museum" value={placeName} oninput={(event) => onPlaceNameChange((event.currentTarget as HTMLInputElement).value)} /></label>
		<label class="flex flex-col gap-1"><span class="text-sm font-medium text-slate-700">Latitude</span><input class="field" inputmode="decimal" type="text" value={placeLat} oninput={(event) => onPlaceLatChange((event.currentTarget as HTMLInputElement).value)} /></label>
		<label class="flex flex-col gap-1"><span class="text-sm font-medium text-slate-700">Longitude</span><input class="field" inputmode="decimal" type="text" value={placeLng} oninput={(event) => onPlaceLngChange((event.currentTarget as HTMLInputElement).value)} /></label>
		<label class="flex flex-col gap-1"><FieldLabel text={VISIT_TIME_FIELD_LABEL} infoLabel={VISIT_TIME_FIELD_LABEL} infoContent={VISIT_TIME_PLACE_INFO} /><input class="field" inputmode="numeric" min="10" step="5" type="number" value={minimumDwellMinutes} oninput={(event) => onMinimumDwellMinutesChange((event.currentTarget as HTMLInputElement).value)} /></label>
		<label class="flex flex-col gap-1"><FieldLabel text="Priority (1-10)" infoLabel="Priority" infoContent="Higher priority places are favoured when route timing is tight. Use 10 for must-see places." /><input class="field" inputmode="numeric" min="1" max="10" type="number" value={priority} oninput={(event) => onPriorityChange((event.currentTarget as HTMLInputElement).value)} /></label>
		<label class="flex flex-col gap-1"><FieldLabel text="Opening time (optional)" infoLabel="Opening time" infoContent="The planner will not schedule this place before it opens." /><input class="field" type="time" value={openingTime} oninput={(event) => onOpeningTimeChange((event.currentTarget as HTMLInputElement).value)} /></label>
		<label class="flex flex-col gap-1"><FieldLabel text="Closing time (optional)" infoLabel="Closing time" infoContent="The planner aims to finish the visit before this time." /><input class="field" type="time" value={closingTime} oninput={(event) => onClosingTimeChange((event.currentTarget as HTMLInputElement).value)} /></label>
		<label class="flex flex-col gap-1 md:col-span-2"><FieldLabel text="Fixed arrival (optional, hard constraint)" infoLabel="Fixed arrival" infoContent="Must arrive at exactly this time, such as booked tickets. This is treated as a strict constraint." /><input class="field" type="time" value={fixedArrival} oninput={(event) => onFixedArrivalChange((event.currentTarget as HTMLInputElement).value)} /></label>
		{#if isMultiDay}
			<label class="flex flex-col gap-1 md:col-span-2"><FieldLabel text="Preferred trip day" infoLabel="Preferred trip day" infoContent="Optional. Keep the stop flexible or ask the planner to try a specific day first." /><select class="field" value={preferredDayId} onchange={(event) => onPreferredDayIdChange((event.currentTarget as HTMLSelectElement).value)}><option value="">Flexible across days</option>{#each planningDays as day}<option value={day.id}>{day.label}{#if day.date} - {day.date}{/if}</option>{/each}</select></label>
		{/if}
	</div>
	<button class={`mt-4 ${PRIMARY_BUTTON_CLASS} bg-emerald-700 hover:bg-emerald-600`} type="button" onclick={onAddPlace} disabled={!(placeName.trim() || placeSearchQuery.trim())}>Add place</button>
	{#if stopCount > 0}
		<a href="#stops-title" class="mt-2 inline-flex cursor-pointer rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-900 ring-1 ring-slate-300 hover:bg-slate-200">Jump to stops ({stopCount})</a>
	{/if}
</div>
