import { placesLayer } from './map.js';
import { getIconForPlace } from './utils.js';

export async function getPlaces(polygon, placeType) {
    const bbox = turf.bbox(polygon);
    const query = `
        [out:json][timeout:25];
        (
            node["amenity"="${placeType}"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
        );
        out body;
    `;

    const url = 'https://overpass-api.de/api/interpreter';

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: query,
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        });

        const data = await response.json();

        if (!data || !data.elements || data.elements.length === 0) {
            console.warn('No places found from Overpass API for type:', placeType);
            return [];
        }

        return data.elements.filter(el => 
            turf.booleanPointInPolygon(
                turf.point([el.lon, el.lat]),
                polygon
            )
        ).map(el => ({
            name: el.tags?.name || "Unknown",
            type: el.tags?.amenity || placeType,
            lat: el.lat,
            lon: el.lon,
            address: `${el.tags?.['addr:housenumber'] || ''} ${el.tags?.['addr:street'] || ''}`.trim() || "No address",
            opening_hours: el.tags?.opening_hours || null
        }));
    } catch (error) {
        console.error('Error fetching places:', error);
        return [];
    }
}

export function displayPlaces(places, currentStations, selectedLines = []) {
    placesLayer.clearLayers();

    places.forEach(place => {
        const placePoint = turf.point([place.lon, place.lat]);
        
        let nearestStationsText = '';

        selectedLines.forEach(line => {
            const stations = currentStations[line] || [];
            if (stations.length === 0) return;

            const stationFeatures = stations.map(st =>
                turf.point([st.lon, st.lat], { name: st.name, line: st.line })
            );
            const stationCollection = turf.featureCollection(stationFeatures);

            const nearest = turf.nearestPoint(placePoint, stationCollection);
            if (nearest && nearest.properties) {
                nearestStationsText += `Nearest station to ${line}: ${nearest.properties.name}<br>`;
            }
        });

        const icon = L.divIcon({
            className: 'place-marker',
            html: getIconForPlace(place.type),
            iconSize: [20, 20]
        });

        L.marker([place.lat, place.lon], { icon })
            .bindPopup(`
                <b>${place.name}</b><br>
                Type: ${place.type}<br>
                ${nearestStationsText || "No stations nearby"}
            `)
            .addTo(placesLayer);
    });
}
