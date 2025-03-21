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
    const placeTypeSelect = document.getElementById("placeTypeSelect");
    const distanceSelect = document.getElementById("distanceSelect");

    // When selecting lines
    lineSelect.addEventListener('change', async (e) => {
        const selectedOptions = Array.from(e.target.selectedOptions);
        const selectedLines = selectedOptions.map(opt => opt.value);

        // Clear everything when unselecting all lines
        if (selectedLines.length === 0) {
            showLoading('Clearing map...');
            clearLayers(['markers', 'isochrones', 'places']);
            cachedIsochrones = null;
            lastSelectedLines = [];
            placeTypeSelect.disabled = true;
            hideLoading();
            return;
        }

        showLoading('Loading stations...');
        displayStations(selectedLines, stationsGeoJSON, parisBoundaryGeoJSON, map);
        lastSelectedLines = selectedLines;
        hideLoading();
    });

    // When generating isochrones
    document.getElementById("generateIsochrones").addEventListener("click", async () => {
        if (lastSelectedLines.length < 2) {
            alert('Please select at least two lines.');
            return;
        }

        showLoading('Generating isochrones...');
        clearLayers(['isochrones', 'places']);
        const allIsochrones = [];

        for (const line of lastSelectedLines) {
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

            const walkTime = parseInt(distanceSelect.value);
            const isochrone = await getIsochrones(lineStations, walkTime, parisBoundaryGeoJSON);
            if (isochrone) {
                allIsochrones.push(isochrone);
            }
        }

        if (allIsochrones.length < 2) {
            alert('No intersection found. Try other lines.');
            hideLoading();
            return;
        }

        cachedIsochrones = calculateIntersections(allIsochrones);
        document.getElementById('placeTypeContainer').style.display = 'block';
        placeTypeSelect.disabled = false;
        

        hideLoading();
    });

    // When changing place type
    placeTypeSelect.addEventListener("change", async () => {
        if (!cachedIsochrones) {
            return;
        }

        showLoading('Loading places...');
        clearLayers(['places']);
        const placeType = placeTypeSelect.value;
        const places = await getPlaces(cachedIsochrones, placeType);
        displayPlaces(places, currentStations, lastSelectedLines);
        hideLoading();
    });

    // When restting
    document.getElementById("resetApp").addEventListener("click", () => {
        showLoading('Resetting...');
    
        // Clear map layers
        clearLayers(['markers', 'isochrones', 'places']);
    
        // Reset form controls
        const lineSelect = document.getElementById('lineSelect');
        const placeTypeSelect = document.getElementById('placeTypeSelect');
        const distanceSelect = document.getElementById('distanceSelect');
    
        if (lineSelect._choices) {
            // Clear all selected items
            lineSelect._choices.clearStore(); 
            lineSelect._choices.removeActiveItems();
        } else {
            // Fallback for native select
            lineSelect.selectedIndex = -1;
        }
    
        placeTypeSelect.selectedIndex = 0;
        placeTypeSelect.disabled = true;
    
        distanceSelect.selectedIndex = 0;
    
        // Hide step 3 dropdown (places dropdown)
        document.getElementById('placeTypeContainer').style.display = 'none';
    
        // Reset cached variables
        cachedIsochrones = null;
        lastSelectedLines = [];
    
        hideLoading();
    });
    
}

// loading message
function showLoading(message) {
    let loader = document.getElementById('loadingMessage');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loadingMessage';
        loader.style.position = 'fixed';
        loader.style.top = '20px';
        loader.style.left = '50%';
        loader.style.transform = 'translateX(-50%)';
        loader.style.background = 'rgba(0,0,0,0.8)';
        loader.style.color = '#fff';
        loader.style.padding = '10px 20px';
        loader.style.borderRadius = '5px';
        loader.style.zIndex = 10000;
        document.body.appendChild(loader);
    }
    loader.innerText = message;
    loader.style.display = 'block';
}

function hideLoading() {
    const loader = document.getElementById('loadingMessage');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEventListeners();
});