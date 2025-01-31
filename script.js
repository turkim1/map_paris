    // Load both GeoJSON files
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

    // Initialize the map and data
    let stationsGeoJSON = null;
    let parisBoundaryGeoJSON = null;
    let markersLayer = L.featureGroup();
    let isochronesLayer = L.layerGroup();
    let placesLayer = L.layerGroup();
    let parisBoundaryLayer = L.layerGroup();
    let currentStations = [];

    const map = L.map('map', {
        center: [48.8566, 2.3522],
        zoom: 12,
        layers: [markersLayer, isochronesLayer, placesLayer, parisBoundaryLayer]
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Function to check if a point is within Paris boundary
    function isPointInParis(lat, lon) {
        const point = turf.point([lon, lat]);
        return turf.booleanPointInPolygon(point, parisBoundaryGeoJSON);
    }

    // Populate line select dropdown with unique res_com values
    async function populateLineSelect() {
        const lineSelect = document.getElementById('lineSelect');
        if (!stationsGeoJSON) return;

        // Get unique res_com values for stations within Paris
        const uniqueLines = [...new Set(stationsGeoJSON.features
            .filter(feature => 
                isPointInParis(
                    feature.geometry.coordinates[1],
                    feature.geometry.coordinates[0]
                )
            )
            .map(feature => feature.properties.res_com)
            .filter(Boolean))]
            .sort();

        // Clear existing options except the first one
        lineSelect.innerHTML = '<option value="">Select Line</option>';

        // Add new options
        uniqueLines.forEach(line => {
            const option = document.createElement('option');
            option.value = line;
            option.textContent = line;
            lineSelect.appendChild(option);
        });
    }

    // Clear specific layers
    function clearLayers(layers = ['markers', 'isochrones', 'places']) {
        if (layers.includes('markers')) markersLayer.clearLayers();
        if (layers.includes('isochrones')) isochronesLayer.clearLayers();
        if (layers.includes('places')) placesLayer.clearLayers();
    }

    // Display stations for selected line (only within Paris)
    function displayStations(selectedLine) {
        clearLayers(['markers']);
        
        currentStations = stationsGeoJSON.features
            .filter(feature => 
                feature.properties.res_com === selectedLine &&
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

        currentStations.forEach(station => {
            L.marker([station.lat, station.lon])
                .bindPopup(station.name)
                .addTo(markersLayer);
        });

        if (currentStations.length > 0) {
            const bounds = markersLayer.getBounds();
            map.fitBounds(bounds);
        }
    }

    // Generate isochrones only for stations within Paris
    async function getIsochrones(stations, walkTime) {
        const apiKey = "5b3ce3597851110001cf6248c77cc4882b4d4ff096993189c163cf62";
        let isochrones = [];

        try {
            for (const station of stations) {
                const url = `https://api.openrouteservice.org/v2/isochrones/foot-walking`;
                const body = {
                    locations: [[station.lon, station.lat]],
                    range: [walkTime * 60],
                    range_type: 'time'
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) throw new Error('Failed to fetch isochrone');
                
                const data = await response.json();
                
                // Clip isochrone to Paris boundary
                const intersection = turf.intersect(
                    data.features[0],
                    parisBoundaryGeoJSON
                );

                if (intersection) {
                    const polygon = L.geoJSON(intersection, {
                        style: {
                            color: '#3388ff',
                            weight: 2,
                            opacity: 0.5,
                            fillOpacity: 0.2
                        }
                    }).addTo(isochronesLayer);
                    
                    isochrones.push(intersection);
                }
            }
            return isochrones;
        } catch (error) {
            console.error('Error generating isochrones:', error);
            return [];
        }
    }

    // Get places within Paris and within isochrone
    async function getPlaces(isochrone) {
        try {
            const bounds = L.geoJSON(isochrone).getBounds();
            const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
            
            const query = `
                [out:json][timeout:25];
                area["boundary"="administrative"]["admin_level"="8"]["name"="Paris"]->.paris;
                (
                    node["amenity"="restaurant"](area.paris)(${bbox});
                    node["amenity"="bar"](area.paris)(${bbox});
                );
                out body;
            `;
            
            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch places');
            
            const data = await response.json();
            return data.elements.map(el => ({
                name: el.tags.name || "Unknown",
                type: el.tags.amenity,
                lat: el.lat,
                lon: el.lon
            }));
        } catch (error) {
            console.error('Error fetching places:', error);
            return [];
        }
    }

    // Event listener for line select
    document.getElementById("lineSelect").addEventListener("change", (event) => {
        const selectedLine = event.target.value;
        if (selectedLine) {
            displayStations(selectedLine);
        } else {
            clearLayers(['markers']);
        }
    });

    // Event listener for find places button
    document.getElementById("findPlaces").addEventListener("click", async () => {
        const selectedLine = document.getElementById("lineSelect").value;
        const walkTime = parseInt(document.getElementById("distanceSelect").value);
        
        if (!selectedLine) {
            alert('Please select a transport line');
            return;
        }

        if (currentStations.length === 0) {
            alert('No stations found for selected line within Paris');
            return;
        }

        // Clear previous isochrones and places
        clearLayers(['isochrones', 'places']);

        // Generate isochrones and find places
        const isochrones = await getIsochrones(currentStations, walkTime);
        for (const isochrone of isochrones) {
            const places = await getPlaces(isochrone);
            places.forEach(place => {
                const icon = L.divIcon({
                    className: 'place-marker',
                    html: place.type === 'restaurant' ? '🍽️' : '🍺',
                    iconSize: [20, 20]
                });

                L.marker([place.lat, place.lon], {icon})
                    .bindPopup(`<b>${place.name}</b><br>${place.type}`)
                    .addTo(placesLayer);
            });
        }

        // Fit map to show all markers and places
        const bounds = L.featureGroup([markersLayer, placesLayer]).getBounds();
        map.fitBounds(bounds);
    });

    // Initialize the application
    async function init() {
        const data = await loadGeoJSONData();
        if (data) {
            stationsGeoJSON = data.stations;
            parisBoundaryGeoJSON = data.parisBoundary;
            
            // Display Paris boundary on map
            L.geoJSON(parisBoundaryGeoJSON, {
                style: {
                    color: '#ff0000',
                    weight: 2,
                    opacity: 0.5,
                    fillOpacity: 0.1
                }
            }).addTo(parisBoundaryLayer);
            
            await populateLineSelect();
            
            // Fit map to Paris boundary
            const parisBounds = L.geoJSON(parisBoundaryGeoJSON).getBounds();
            map.fitBounds(parisBounds);
        } else {
            alert('Failed to load data. Please refresh the page.');
        }
    }

    // Start the application
    init();