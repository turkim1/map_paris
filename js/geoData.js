// Load stations and Paris boundary
export async function loadGeoJSONData() {
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