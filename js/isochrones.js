import { isochronesLayer } from './map.js';

export async function getIsochrones(stations, walkTime, parisBoundaryGeoJSON) {
    const chunkSize = 5;
    const chunks = [];

    // Split stations array into chunks of 5
    for (let i = 0; i < stations.length; i += chunkSize) {
        chunks.push(stations.slice(i, i + chunkSize));
    }

    let mergedIsochrone = null;

    // Loop through chunks and make separate API calls
    for (const chunk of chunks) {
        const locations = chunk.map(station => [station.lon, station.lat]);

        const body = {
            locations,
            range: [walkTime * 60],
            range_type: 'time',
            attributes: ['area']
        };

        try {
            const response = await fetch('/api/isochrones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to fetch isochrone: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();

            const chunkUnion = data.features.reduce((acc, feature) => {
                return acc ? turf.union(acc, feature) : feature;
            }, null);

            if (chunkUnion) {
                mergedIsochrone = mergedIsochrone
                    ? turf.union(mergedIsochrone, chunkUnion)
                    : chunkUnion;
            }

        } catch (error) {
            console.error('Error generating chunked isochrone:', error);
            return null;
        }
    }

    if (mergedIsochrone) {
        // Clip to Paris boundary
        const clipped = turf.intersect(mergedIsochrone, parisBoundaryGeoJSON);
        if (clipped) {
            L.geoJSON(clipped, {
                style: {
                    color: '#3388ff',
                    weight: 2,
                    opacity: 0.5,
                    fillOpacity: 0.2
                }
            }).addTo(isochronesLayer);

            return clipped;
        }
    }

    return null;
}

export function calculateIntersections(allIsochrones) {
    if (allIsochrones.length < 2) {
        return null;
    }
    
    let intersections = [];
    
    // Calculate pairwise intersections
    for (let i = 0; i < allIsochrones.length; i++) {
        for (let j = i + 1; j < allIsochrones.length; j++) {
            const pairIntersection = turf.intersect(allIsochrones[i], allIsochrones[j]);
            if (pairIntersection) {
                intersections.push(pairIntersection);
    
                // Display pair intersection on map
                L.geoJSON(pairIntersection, {
                    style: {
                        color: '#ffa500',
                        weight: 2,
                        fillOpacity: 0.2
                    }
                }).addTo(isochronesLayer);
            }
        }
    }
    
    // Optional: highlight triple overlap
    if (allIsochrones.length === 3) {
        let tripleIntersection = turf.intersect(intersections[0], allIsochrones[2]);
        if (tripleIntersection) {
            L.geoJSON(tripleIntersection, {
                style: {
                    color: '#ff0000',
                    weight: 3,
                    fillOpacity: 0.4
                }
            }).addTo(isochronesLayer);
        }
    }
    
    // Merge all pairwise intersections for querying places
    const unionedIntersections = intersections.length > 1
        ? intersections.reduce((acc, poly) => acc ? turf.union(acc, poly) : poly, null)
        : intersections[0];
    
    return unionedIntersections;
}