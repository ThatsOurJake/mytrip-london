<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { getDayPalette } from '$lib/services/planner/day-colors';
	import type { PlannerInput, PlannerResult, RouteSegment } from '$lib/types/planner';
	import 'leaflet/dist/leaflet.css';

	type LeafletModule = typeof import('leaflet');

	interface MapStop {
		label: string;
		lat: number;
		lng: number;
		variant: 'hotel' | 'place';
		markerLabel: string;
		timeLabel?: string;
	}

	interface MapSegment {
		label: string;
		dayIndex: number;
		source: string;
		coordinates: Array<[number, number]>;
	}

	let {
		input,
		result
	}: {
		input: PlannerInput;
		result: PlannerResult;
	} = $props();

	let mapElement = $state<HTMLDivElement | null>(null);
	let mapInstance = $state<import('leaflet').Map | null>(null);
	let leaflet = $state<LeafletModule | null>(null);
	let announcedSummary = $state('');

	function buildStops(input: PlannerInput, result: PlannerResult): MapStop[] {
		const scheduledVisits = result.itinerary.filter((entry) => entry.visitType === 'place');
		const visitStops = scheduledVisits.flatMap((visit, index) => {
			const place = result.orderedPlaces.find((entry) => entry.id === visit.placeId) ?? input.places.find((entry) => entry.id === visit.placeId);
			if (!place) {
				return [];
			}

			return [{
				label: place.name,
				lat: place.location.lat,
				lng: place.location.lng,
				variant: 'place' as const,
				markerLabel: String(index + 1),
				timeLabel: `${visit.arrivalTime} to ${visit.departureTime}`
			}];
		});

		return [
			{
				label: `${input.hotel.name} (start and finish)`,
				lat: input.hotel.location.lat,
				lng: input.hotel.location.lng,
				variant: 'hotel',
				markerLabel: 'H'
			},
			...visitStops
		];
	}

	function routeCoordinates(input: PlannerInput, result: PlannerResult): Array<[number, number]> {
		const scheduledPlaces = result.itinerary
			.filter((visit) => visit.visitType === 'place')
			.map((visit) => result.orderedPlaces.find((place) => place.id === visit.placeId) ?? input.places.find((place) => place.id === visit.placeId))
			.filter((place): place is PlannerResult['orderedPlaces'][number] => Boolean(place));

		return [
			[input.hotel.location.lat, input.hotel.location.lng],
			...scheduledPlaces.map((place) => [place.location.lat, place.location.lng] as [number, number]),
			[input.hotel.location.lat, input.hotel.location.lng]
		];
	}

	function fallbackSegmentCoordinates(segment: RouteSegment): Array<[number, number]> {
		return [
			[segment.fromLocation.lat, segment.fromLocation.lng],
			[segment.toLocation.lat, segment.toLocation.lng]
		];
	}

	function buildSegments(result: PlannerResult): MapSegment[] {
		return result.itinerary
			.filter((visit) => visit.travelFromPrevious)
			.map((visit) => {
				const segment = visit.travelFromPrevious as RouteSegment;
				return {
					label: `${segment.fromName} to ${segment.toName}`,
					dayIndex: visit.dayIndex,
					source: segment.source,
					coordinates:
						segment.geometry && segment.geometry.length > 1
							? segment.geometry.map((point) => [point.lat, point.lng] as [number, number])
							: fallbackSegmentCoordinates(segment)
				};
			});
	}

	function segmentStyle(result: PlannerResult, dayIndex: number, source: string): {
		color: string;
		weight: number;
		opacity: number;
		dashArray?: string;
	} {
		const planningDay = result.planningDays[dayIndex] ?? result.planningDays[0];
		const palette = getDayPalette(planningDay?.palette);
		const baseStyle = {
			color: palette.accent,
			weight: 5,
			opacity: 0.9
		};

		if (source === 'tfl') {
			return baseStyle;
		}

		if (source === 'openrouteservice') {
			return baseStyle;
		}

		return { ...baseStyle, weight: 4, opacity: 0.82, dashArray: '6 6' };
	}

	function updateMap(): void {
		if (!browser || !leaflet || !mapInstance) {
			return;
		}

		const L = leaflet;
		const stops = buildStops(input, result);
		const segments = buildSegments(result);
		const fallbackCoordinates = routeCoordinates(input, result);

		announcedSummary = `Map overview of ${segments.length} journey legs, starting and ending at ${input.hotel.name}.`;

		mapInstance.eachLayer((layer: import('leaflet').Layer) => {
			mapInstance?.removeLayer(layer);
		});

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 18,
			attribution: '&copy; OpenStreetMap contributors'
		}).addTo(mapInstance);

		if (segments.length === 0) {
			L.polyline(fallbackCoordinates, {
				color: '#0f766e',
				weight: 4,
				opacity: 0.8,
				dashArray: '6 6'
			}).addTo(mapInstance);
		} else {
			for (const segment of segments) {
				L.polyline(segment.coordinates, segmentStyle(result, segment.dayIndex, segment.source))
					.addTo(mapInstance)
					.bindPopup(`<strong>${segment.label}</strong><div>Source: ${segment.source}</div>`);
			}
		}

		for (const stop of stops) {
			const marker = L.circleMarker([stop.lat, stop.lng], {
				radius: stop.variant === 'hotel' ? 9 : 8,
				color: stop.variant === 'hotel' ? '#113b92' : '#0f766e',
				fillColor: stop.variant === 'hotel' ? '#113b92' : '#14b8a6',
				fillOpacity: 0.92,
				weight: 2
			}).addTo(mapInstance);

			const popup = [`<strong>${stop.label}</strong>`];
			if (stop.timeLabel) {
				popup.push(`<div>${stop.timeLabel}</div>`);
			}

			marker.bindPopup(popup.join(''));
			marker.bindTooltip(stop.markerLabel, {
				permanent: true,
				direction: 'center',
				className: 'itinerary-map-tooltip'
			});
		}

		const bounds = L.latLngBounds([
			...stops.map((stop) => [stop.lat, stop.lng] as [number, number]),
			...segments.flatMap((segment) => segment.coordinates)
		]);
		mapInstance.fitBounds(bounds.pad(0.2));
		mapInstance.invalidateSize();
	}

	onMount(() => {
		if (!browser || !mapElement) {
			return;
		}

		void (async () => {
			leaflet = await import('leaflet');
			if (!mapElement) {
				return;
			}

			mapInstance = leaflet.map(mapElement, {
				scrollWheelZoom: true
			});

			updateMap();
		})();

		return () => {
			mapInstance?.remove();
			mapInstance = null;
		};
	});

	$effect(() => {
		input;
		result;
		updateMap();
	});
</script>

<section aria-labelledby="itinerary-map-title" aria-describedby="itinerary-map-description itinerary-map-summary" class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
	<div>
		<h3 id="itinerary-map-title" class="text-base font-semibold text-slate-900">Map overview</h3>
		<p id="itinerary-map-description" class="mt-1 text-sm text-slate-700">
			Use your mouse wheel or trackpad to zoom. When live geometry is available from TfL or OpenStreet routing, the map draws that route instead of a simple stop-order line.
		</p>
	</div>

	<p id="itinerary-map-summary" class="sr-only">{announcedSummary}</p>
	<div bind:this={mapElement} class="mt-4 h-72 w-full overflow-hidden rounded-xl border border-slate-200 sm:h-80 lg:h-96" aria-hidden="true"></div>
</section>

<style>
	:global(.itinerary-map-tooltip) {
		background: transparent;
		border: 0;
		box-shadow: none;
		color: #ffffff;
		font-weight: 700;
		font-size: 0.8rem;
	}

	:global(.itinerary-map-tooltip:before) {
		display: none;
	}
</style>
