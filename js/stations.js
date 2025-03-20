import { isPointInParis, getLogoForLine } from './utils.js';
import { markersLayer } from './map.js';

export let currentStations = {};

export async function populateLineSelect(stationsGeoJSON, parisBoundaryGeoJSON) {
    const lineSelect = document.getElementById('lineSelect');
    if (!stationsGeoJSON) return;

    const uniqueLines = [...new Set(stationsGeoJSON.features
        .filter(feature =>
            isPointInParis(
                feature.geometry.coordinates[1],
                feature.geometry.coordinates[0],
                parisBoundaryGeoJSON
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
            maxItemCount: 3,
        });
        lineSelect.classList.add('choices-initialized');
    }
}

export function displayStations(selectedLines, stationsGeoJSON, parisBoundaryGeoJSON, map) {
    markersLayer.clearLayers();
    currentStations = {};

    selectedLines.forEach(line => {
        const stations = stationsGeoJSON.features
            .filter(feature =>
                feature.properties.res_com === line
            )
            .map(feature => ({
                name: feature.properties.nom_gares,
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0],
                line: line
            }));

        currentStations[line] = stations;

        stations.forEach(station => {
            const icon = L.divIcon({
                className: 'station-icon',
                html: `<img src="${getLogoForLine(line)}" alt="Line ${line}" style="width: 24px; height: 24px;">`,
                iconSize: [24, 24]
            });

            L.marker([station.lat, station.lon], { icon })
                .bindPopup(`${station.name} (Line ${line})`)
                .addTo(markersLayer);
        });
    });

    const bounds = markersLayer.getBounds();
    if (bounds.isValid()) {
        map.fitBounds(bounds);
    }
}
