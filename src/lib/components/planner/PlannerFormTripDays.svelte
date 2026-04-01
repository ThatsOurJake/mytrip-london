<script lang="ts">
	import { DAY_PALETTE_OPTIONS } from '$lib/services/planner/day-colors';
	import type { TripDayFullness, TripDayPalette, TripPlanningDay } from '$lib/types/planner';
	import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, SECONDARY_BUTTON_DISABLED_CLASS } from './button-classes';
	import FieldLabel from './FieldLabel.svelte';
	import type { FullnessOption } from './planner-form-types';
	import './planner-form-shared.css';

	let {
		planningDays,
		startDate,
		endDate,
		isMultiDay,
		fullnessOptions,
		dayCardStyle,
		dayChipStyle,
		addPlanningDay,
		removePlanningDay,
		updateStartDate,
		updateEndDate,
		updatePlanningDay,
		updatePlanningDayPalette,
		hasPendingTripChanges,
		saveSettings,
		saveStatus
	}: {
		planningDays: TripPlanningDay[];
		startDate: string;
		endDate: string;
		isMultiDay: boolean;
		fullnessOptions: FullnessOption[];
		dayCardStyle: (tripDay: TripPlanningDay) => string;
		dayChipStyle: (tripDay: TripPlanningDay) => string;
		addPlanningDay: () => void;
		removePlanningDay: () => void;
		updateStartDate: (value: string) => void;
		updateEndDate: (value: string) => void;
		updatePlanningDay: (index: number, patch: Partial<TripPlanningDay>) => void;
		updatePlanningDayPalette: (index: number, palette: TripDayPalette) => void;
		hasPendingTripChanges: () => boolean;
		saveSettings: () => void;
		saveStatus: string;
	} = $props();
</script>

<div class="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<h3 class="text-base font-semibold text-slate-900">Trip days</h3>
			<p class="mt-1 text-sm text-slate-700">Start with one day, then add more if you want the planner to spread stops across the trip. Extra days get their own date, start time, end time, and fullness.</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<button type="button" class={SECONDARY_BUTTON_CLASS} onclick={addPlanningDay}>Add day</button>
			<button type="button" class={SECONDARY_BUTTON_DISABLED_CLASS} onclick={removePlanningDay} disabled={planningDays.length <= 1}>Remove last day</button>
		</div>
	</div>
	<div class="mt-4 grid gap-3 md:grid-cols-2">
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium text-slate-700">Trip start date</span>
			<input class="field" type="date" name="trip-start-date" autocomplete="off" data-1p-ignore="true" data-lpignore="true" value={startDate} onchange={(event) => updateStartDate((event.currentTarget as HTMLInputElement).value)} />
		</label>
		{#if isMultiDay}
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium text-slate-700">Trip end date</span>
				<input class="field" type="date" name="trip-end-date" autocomplete="off" data-1p-ignore="true" data-lpignore="true" min={startDate} value={endDate} onchange={(event) => updateEndDate((event.currentTarget as HTMLInputElement).value)} />
			</label>
		{/if}
	</div>
	<div class="mt-4 grid gap-3 lg:grid-cols-2">
		{#each planningDays as tripDay, index}
			<div class="min-w-0 rounded-xl border p-4 shadow-sm" style={dayCardStyle(tripDay)}>
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="text-sm font-semibold">{tripDay.label}</p>
						<p class="text-xs opacity-80">{tripDay.date ?? 'Date not set'}</p>
					</div>
					<span class="shrink-0 rounded-full px-3 py-1 text-xs font-semibold" style={dayChipStyle(tripDay)}>{fullnessOptions.find((option) => option.value === tripDay.fullness)?.label ?? 'Full'}</span>
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
							<button type="button" class={`day-swatch ${tripDay.palette === option.value ? 'day-swatch-selected' : ''}`} style={`background:${option.surfaceStrong};border-color:${option.border};color:${option.text};`} title={option.label} aria-label={`${tripDay.label} colour ${option.label}`} aria-pressed={tripDay.palette === option.value} onclick={() => updatePlanningDayPalette(index, option.value)}></button>
						{/each}
					</div>
				</div>

				{#if isMultiDay}
					<label class="mt-3 flex flex-col gap-1">
						<FieldLabel text="Fullness" infoLabel="Day fullness" infoContent="Higher fullness tells the planner to fit more into this day before shifting stops to the next one." />
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
	<button class={`mt-4 ${PRIMARY_BUTTON_CLASS}`} type="button" onclick={saveSettings}>Save start point and trip details</button>
	{#if saveStatus}
		<p class="mt-2 text-sm text-emerald-800" role="status" aria-live="polite">{saveStatus} Optimisation and itinerary generation now use these values.</p>
	{/if}
</div>
