import { initMap, clearLayers, displayParisBoundary, placesLayer } from './map.js';
import { loadGeoJSONData } from './geoData.js';
import { populateLineSelect, displayStations, currentStations } from './stations.js';
import { getIsochrones, calculateIntersections } from './isochrones.js';
import { getPlaces, displayPlaces } from './places.js';
import { isPointInParis} from './utils.js';

// State variables
let stationsGeoJSON = null;
let parisBoundaryGeoJSON = null;
let map = null;

let cachedIsochrones = null;
let lastSelectedLines = [];


// Initialize app
async function init() {
    map = initMap();
    
    const data = await loadGeoJSONData();
    if (data) {
        stationsGeoJSON = data.stations;
        parisBoundaryGeoJSON = data.parisBoundary;
        
        // Display Paris boundary
        await displayParisBoundary(map);
        
        // Populate line select dropdown
        await populateLineSelect(stationsGeoJSON, parisBoundaryGeoJSON);
    } else {
        alert('Failed to load data.');
    }
}

// Event handlers
function setupEventListeners() {
    const lineSelect = document.getElementById('lineSelect');
    const generateIsochrones = document.getElementById('generateIsochrones');
    const findPlacesBtn = document.getElementById('findPlaces');

    // Handle multi-select (line selection)
    lineSelect.addEventListener('change', (e) => {
        const selectedOptions = Array.from(e.target.selectedOptions);
        const selectedLines = selectedOptions.map(opt => opt.value);

        // Reset iso cache when lines change
        if (JSON.stringify(selectedLines) !== JSON.stringify(lastSelectedLines)) {
            cachedIsochrones = null;
            lastSelectedLines = [...selectedLines];
        }

        if (selectedLines.length > 0) {
            displayStations(selectedLines, stationsGeoJSON, parisBoundaryGeoJSON, map);
        } else {
            clearLayers(['markers']);
        }
    });

    // GENERATE ISOCHRONES BUTTON
    generateIsochrones.addEventListener("click", async () => {
        const selectedOptions = Array.from(lineSelect.selectedOptions);
        const selectedLines = selectedOptions.map(opt => opt.value);
        const walkTime = parseInt(document.getElementById("distanceSelect").value);

        if (selectedLines.length < 2) {
            alert('Please select at least two transport lines');
            return;
        }

        clearLayers(['isochrones']);

        const allIsochrones = [];

        for (const line of selectedLines) {
            const lineStations = stationsGeoJSON.features
                .filter(feature =>
                    feature.properties.res_com === line &&
                    isPointInParis(
                        feature.geometry.coordinates[1],
                        feature.geometry.coordinates[0],
                        parisBoundaryGeoJSON
                    )
                )
                .map(feature => ({
                    name: feature.properties.nom_gares,
                    lat: feature.geometry.coordinates[1],
                    lon: feature.geometry.coordinates[0]
                }));

            if (lineStations.length === 0) continue;

            const isochrone = await getIsochrones(lineStations, walkTime, parisBoundaryGeoJSON);
            if (isochrone) {
                allIsochrones.push(isochrone);
            }
        }

        if (allIsochrones.length < 2) {
            alert('Please select at least two lines with stations in Paris.');
            return;
        }

        cachedIsochrones = calculateIntersections(allIsochrones);

        if (!cachedIsochrones) {
            alert('No overlapping area found between lines.');
            return;
        }

        // Optionally display isochrones layer here
        console.log('Isochrones generated and cached');
    });

    // FIND PLACES BUTTON
    document.getElementById("placeTypeSelect").addEventListener("change", async () => {
        if (!cachedIsochrones) {
            alert('Please generate isochrones first.');
            return;
        }
    
        const selectedLines = lastSelectedLines;
        const placeType = document.getElementById("placeTypeSelect").value;
    
        clearLayers(['places']);
    
        const places = await getPlaces(cachedIsochrones, placeType);
        displayPlaces(places, currentStations, selectedLines);
    
        // Fit bounds to places
        const layersToFit = [];
        placesLayer.eachLayer(layer => layersToFit.push(layer));
        const bounds = L.featureGroup(layersToFit).getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds);
        }
    });
}
// Start the application
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEventListeners();
});