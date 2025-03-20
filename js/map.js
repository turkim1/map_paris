import { loadGeoJSONData } from './geoData.js';

// Map setup
export const markersLayer = L.featureGroup();
export const isochronesLayer = L.layerGroup();
export const intersectionLayer = L.layerGroup();
export const placesLayer = L.layerGroup();
export const parisBoundaryLayer = L.layerGroup();

export function initMap() {
    const map = L.map('map', {
        center: [48.8566, 2.3522],
        zoom: 12,
        layers: [markersLayer, isochronesLayer, intersectionLayer, placesLayer, parisBoundaryLayer]
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    return map;
}

export function clearLayers(layers = ['markers', 'isochrones', 'intersection', 'places']) {
    if (layers.includes('markers')) markersLayer.clearLayers();
    if (layers.includes('isochrones')) isochronesLayer.clearLayers();
    if (layers.includes('intersection')) intersectionLayer.clearLayers();
    if (layers.includes('places')) placesLayer.clearLayers();
}

export async function displayParisBoundary(map) {
    const data = await loadGeoJSONData();
    if (data && data.parisBoundary) {
        L.geoJSON(data.parisBoundary, {
            style: { color: '#ff0000', weight: 2, opacity: 0.5, fillOpacity: 0.1 }
        }).addTo(parisBoundaryLayer);
        
        map.fitBounds(L.geoJSON(data.parisBoundary).getBounds());
        return data.parisBoundary;
    }
    return null;
}