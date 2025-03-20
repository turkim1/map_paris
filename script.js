// Load stations and Paris boundary
async function loadGeoJSONData() {
    try {
        const [stationsResponse, parisResponse] = await Promise.all([
            fetch('emplacement-des-gares-idf.geojson'),
            fetch('departement-75-paris.geojson')
        ]);

        if (!stationsResponse.ok || !parisResponse.ok) {
            throw new Error('Failed to load GeoJSON data');
        }

        return {
            stations: await stationsResponse.json(),
            parisBoundary: await parisResponse.json()
        };
    } catch (error) {
        console.error('Error loading GeoJSON:', error);
        return null;
    }
}

// Map setup
let stationsGeoJSON = null;
let parisBoundaryGeoJSON = null;
let markersLayer = L.featureGroup();
let isochronesLayer = L.layerGroup();
let intersectionLayer = L.layerGroup();
let placesLayer = L.layerGroup();
let parisBoundaryLayer = L.layerGroup();
let currentStations = {};

const map = L.map('map', {
    center: [48.8566, 2.3522],
    zoom: 12,
    layers: [markersLayer, isochronesLayer, intersectionLayer, placesLayer, parisBoundaryLayer]
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Utility functions
function isPointInParis(lat, lon) {
    const point = turf.point([lon, lat]);
    return turf.booleanPointInPolygon(point, parisBoundaryGeoJSON);
}

function getIconForPlace(type) {
    switch (type) {
        case 'restaurant': return '🍽️';
        case 'bar': return '🍺';
        case 'cafe': return '☕';
        case 'pub': return '🍻';
        case 'fast_food': return '🍔';
        default: return '📍';
    }
}

function clearLayers(layers = ['markers', 'isochrones', 'intersection', 'places']) {
    if (layers.includes('markers')) markersLayer.clearLayers();
    if (layers.includes('isochrones')) isochronesLayer.clearLayers();
    if (layers.includes('intersection')) intersectionLayer.clearLayers();
    if (layers.includes('places')) placesLayer.clearLayers();
}

// Populate line select dropdown
async function populateLineSelect() {
    const lineSelect = document.getElementById('lineSelect');
    if (!stationsGeoJSON) return;

    const uniqueLines = [...new Set(stationsGeoJSON.features
        .filter(feature =>
            isPointInParis(
                feature.geometry.coordinates[1],
                feature.geometry.coordinates[0]
            )
        )
        .map(feature => feature.properties.res_com)
        .filter(Boolean))].sort();

    // Clear & add options
    lineSelect.innerHTML = '';
    uniqueLines.forEach(line => {
        const option = document.createElement('option');
        option.value = line;
        option.textContent = line;
        lineSelect.appendChild(option);
    });

    // Activate Choices.js on the select
    if (!lineSelect.classList.contains('choices-initialized')) {
        new Choices(lineSelect, {
            removeItemButton: true,
            placeholderValue: 'Select lines',
            searchPlaceholderValue: 'Search lines...',
            shouldSort: false,
            maxItemCount:3,
        });
        lineSelect.classList.add('choices-initialized');
    }
}


// Display stations per line (multi-line mode)
function displayStations(selectedLines) {
    clearLayers(['markers']);
    currentStations = {};

    selectedLines.forEach(line => {
        const stations = stationsGeoJSON.features
            .filter(feature =>
                feature.properties.res_com === line &&
                isPointInParis(
                    feature.geometry.coordinates[1],
                    feature.geometry.coordinates[0]
                )
            )
            .map(feature => ({
                name: feature.properties.nom_gares,
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0]
            }));

        currentStations[line] = stations;

        stations.forEach(station => {
            L.marker([station.lat, station.lon], { icon: L.divIcon({ html: `<div style="color: ${getColorForLine(line)};">⬤</div>` }) })
                .bindPopup(`${station.name} (${line})`)
                .addTo(markersLayer);
        });
    });

    const bounds = markersLayer.getBounds();
    if (bounds.isValid()) {
        map.fitBounds(bounds);
    }
}

// Color by line (optional)
function getColorForLine(line) {
    const colors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628'];
    return colors[line.charCodeAt(0) % colors.length];
}

// Isochrone generation - batch stations by line - chunk by 5 for API limit
async function getIsochrones(stations, walkTime) {
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



// Get places inside intersection polygon
async function getPlaces(polygon, placeType) {
    const bbox = turf.bbox(polygon);
    const query = `
        [out:json][timeout:25];
        (
            node["amenity"="${placeType}"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
        );
        out body;
    `;

    const url = 'https://overpass-api.de/api/interpreter';

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
}


document.getElementById("findPlaces").addEventListener("click", async () => {
    const select = document.getElementById("lineSelect");
    const selectedOptions = Array.from(select.selectedOptions);
    const selectedLines = selectedOptions.map(opt => opt.value);

    const walkTime = parseInt(document.getElementById("distanceSelect").value);
    const placeType = document.getElementById("placeTypeSelect").value;

    if (selectedLines.length < 2) {
        alert('Please select at least two transport lines');
        return;
    }

    clearLayers(['isochrones', 'places']);

    const allIsochrones = [];

    // Batch each line
    for (const line of selectedLines) {
        const lineStations = stationsGeoJSON.features
            .filter(feature =>
                feature.properties.res_com === line &&
                isPointInParis(
                    feature.geometry.coordinates[1],
                    feature.geometry.coordinates[0]
                )
            )
            .map(feature => ({
                name: feature.properties.nom_gares,
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0]
            }));

        if (lineStations.length === 0) continue;

        const isochrone = await getIsochrones(lineStations, walkTime);
        if (isochrone) {
            allIsochrones.push(isochrone);
        }
    }

    if (allIsochrones.length < 2) {
        alert('Please select at least two lines.');
        return;
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
    
    if (!unionedIntersections) {
        alert('No overlapping area found between lines.');
        return;
    }

    // Fetch and show places inside intersection
    const places = await getPlaces(unionedIntersections , placeType);

    places.forEach(place => {
        const placePoint = turf.point([place.lon, place.lat]);
    
        // Flatten all stations into one collection for nearest search
        const allStations = Object.values(currentStations).flat();
        const stationFeatures = allStations.map(st => 
            turf.point([st.lon, st.lat], { name: st.name, line: st.line })
        );
        const stationCollection = turf.featureCollection(stationFeatures);
    
        const nearest = turf.nearestPoint(placePoint, stationCollection);
        const nearestStationName = nearest.properties.name || "Unknown station";
        const nearestLine = nearest.properties.line || "Unknown line";
    
        const icon = L.divIcon({
            className: 'place-marker',
            html: getIconForPlace(placeType),
            iconSize: [20, 20]
        });
    
        L.marker([place.lat, place.lon], { icon })
            .bindPopup(`
                <b>${place.name}</b><br>
                Type: ${place.type}<br>
                Nearest station: ${nearestStationName} (${nearestLine})
            `)
            .addTo(placesLayer);
    });
    

    // Fit bounds
    const layersToFit = [];

    placesLayer.eachLayer(layer => layersToFit.push(layer));
    
    const bounds = L.featureGroup(layersToFit).getBounds();
    if (bounds.isValid()) {
        map.fitBounds(bounds);
    }
});


// Init app
async function init() {
    const data = await loadGeoJSONData();
    if (data) {
        stationsGeoJSON = data.stations;
        parisBoundaryGeoJSON = data.parisBoundary;
        L.geoJSON(parisBoundaryGeoJSON, {
            style: { color: '#ff0000', weight: 2, opacity: 0.5, fillOpacity: 0.1 }
        }).addTo(parisBoundaryLayer);

        await populateLineSelect();
        map.fitBounds(L.geoJSON(parisBoundaryGeoJSON).getBounds());
    } else {
        alert('Failed to load data.');
    }
}
init();

// Handle multi-select (bootstrap-native or plain select multiple)
document.getElementById('lineSelect').addEventListener('change', (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions);
    const selectedLines = selectedOptions.map(opt => opt.value);
    if (selectedLines.length > 0) {
        displayStations(selectedLines);
    } else {
        clearLayers(['markers']);
    }
});
