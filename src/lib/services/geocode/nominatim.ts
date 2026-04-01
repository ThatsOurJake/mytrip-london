export interface LocationSuggestion {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export async function searchLondonLocations(query: string, limit = 6): Promise<LocationSuggestion[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    q: `${trimmedQuery}, London`,
    countrycodes: 'gb',
    addressdetails: '0',
    limit: String(limit)
  });

  const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    headers: {
      'Accept-Language': 'en-GB'
    }
  });

  if (!response.ok) {
    return [];
  }

  const payload: NominatimResult[] = await response.json();
  return payload.map((item) => ({
    id: String(item.place_id),
    label: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon)
  }));
}
