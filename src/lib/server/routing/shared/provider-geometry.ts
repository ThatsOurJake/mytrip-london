import type { RouteLookupInput } from '$lib/services/routing/provider';
import type { Coordinates } from '$lib/types/planner';

export function toCoordinatePair(first: number, second: number): Coordinates | null {
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }

  const looksLikeLatLng = Math.abs(first) <= 90 && Math.abs(second) <= 180 && Math.abs(first) > 20;
  const looksLikeLngLat = Math.abs(first) <= 180 && Math.abs(second) <= 90 && Math.abs(second) > 20;

  if (looksLikeLatLng) {
    return { lat: first, lng: second };
  }

  if (looksLikeLngLat) {
    return { lat: second, lng: first };
  }

  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    return { lat: first, lng: second };
  }

  return null;
}

export function normalizeGeometryPoints(value: unknown): Coordinates[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        return toCoordinatePair(Number(entry[0]), Number(entry[1]));
      }

      if (entry && typeof entry === 'object') {
        const candidate = entry as {
          lat?: number;
          lng?: number;
          lon?: number;
          latitude?: number;
          longitude?: number;
        };

        const lat = candidate.lat ?? candidate.latitude;
        const lng = candidate.lng ?? candidate.lon ?? candidate.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat: Number(lat), lng: Number(lng) };
        }
      }

      return null;
    })
    .filter((entry): entry is Coordinates => Boolean(entry));
}

export function decodePolyline(value: string, precision = 5): Coordinates[] {
  const points: Coordinates[] = [];
  const factor = 10 ** precision;
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < value.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = value.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < value.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = value.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < value.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
}

export function parseLineString(value: string | undefined): Coordinates[] {
  if (!value) {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      return normalizeGeometryPoints(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }

  const coordinates = trimmed
    .split(/\s+/)
    .map((point) => point.split(',').map((entry) => Number(entry.trim())))
    .map((parts) => (parts.length >= 2 ? toCoordinatePair(parts[0] as number, parts[1] as number) : null))
    .filter((entry): entry is Coordinates => Boolean(entry));

  return coordinates;
}

export function geometryForOrsRoute(
  route: { geometry?: string | { coordinates?: number[][] } },
  input: RouteLookupInput
): Coordinates[] {
  if (typeof route.geometry === 'string') {
    const decoded = decodePolyline(route.geometry);
    if (decoded.length > 1) {
      return decoded;
    }
  }

  const geometryObject = typeof route.geometry === 'object' && route.geometry ? route.geometry : undefined;
  const normalized = normalizeGeometryPoints(geometryObject?.coordinates);
  if (normalized.length > 1) {
    return normalized;
  }

  return [input.from, input.to];
}

export function geometryForTflJourney(
  legs: Array<{ path?: { lineString?: string } }>,
  input: RouteLookupInput
): Coordinates[] {
  const geometry: Coordinates[] = [];

  for (const leg of legs) {
    const legGeometry = parseLineString(leg.path?.lineString);
    if (legGeometry.length === 0) {
      continue;
    }

    if (geometry.length > 0) {
      const [firstPoint, ...remaining] = legGeometry;
      const previousPoint = geometry[geometry.length - 1];
      if (!firstPoint || previousPoint.lat !== firstPoint.lat || previousPoint.lng !== firstPoint.lng) {
        geometry.push(firstPoint);
      }
      geometry.push(...remaining);
      continue;
    }

    geometry.push(...legGeometry);
  }

  return geometry.length > 1 ? geometry : [input.from, input.to];
}
