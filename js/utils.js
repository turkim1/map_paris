
// Utility functions
export function isPointInParis(lat, lon, parisBoundaryGeoJSON) {
    const point = turf.point([lon, lat]);
    return turf.booleanPointInPolygon(point, parisBoundaryGeoJSON);
}

export function getIconForPlace(type) {
    switch (type) {
        case 'restaurant': return '🍽️';
        case 'bar': return '🍺';
        case 'cafe': return '☕';
        case 'pub': return '🍻';
        case 'fast_food': return '🍔';
        default: return '📍';
    }
}

export function getLogoForLine(line) {
    const baseUrl = 'https://www.ratp.fr/sites/default/files/lines-assets/picto-v2/';

    // Separate base paths by transport type
    const metroBase = `${baseUrl}metro/`;
    const rerBase = `${baseUrl}rer/`;
    const tramBase = `${baseUrl}tramway/`;

    const logos = {
        // Métro lines
        "METRO 1": `${metroBase}picto-ligne-LIGIDFMC01371.1742443537.svg`,
        "METRO 2": `${metroBase}picto-ligne-LIGIDFMC01372.1742443537.svg`,
        "METRO 3": `${metroBase}picto-ligne-LIGIDFMC01373.1742443537.svg`,
        "METRO 3bis": `${metroBase}picto-ligne-LIGIDFMC01386.1742443537.svg`,
        "METRO 4": `${metroBase}picto-ligne-LIGIDFMC01374.1742443537.svg`,
        "METRO 5": `${metroBase}picto-ligne-LIGIDFMC01375.1742443537.svg`,
        "METRO 6": `${metroBase}picto-ligne-LIGIDFMC01376.1742443537.svg`,
        "METRO 7": `${metroBase}picto-ligne-LIGIDFMC01377.1742443537.svg`,
        "METRO 7bis": `${metroBase}picto-ligne-LIGIDFMC01387.1742443537.svg`,
        "METRO 8": `${metroBase}picto-ligne-LIGIDFMC01378.1742443537.svg`,
        "METRO 9": `${metroBase}picto-ligne-LIGIDFMC01379.1742443537.svg`,
        "METRO 10": `${metroBase}picto-ligne-LIGIDFMC01380.1742443537.svg`,
        "METRO 11": `${metroBase}picto-ligne-LIGIDFMC01381.1742443537.svg`,
        "METRO 12": `${metroBase}picto-ligne-LIGIDFMC01382.1742443537.svg`,
        "METRO 13": `${metroBase}picto-ligne-LIGIDFMC01383.1742443537.svg`,
        "METRO 14": `${metroBase}picto-ligne-LIGIDFMC01384.1742443537.svg`,

        // Tram lines
        "TRAM 1": `${tramBase}picto-ligne-LIGIDFMC01389.1742443537.svg`,
        "TRAM 2": `${tramBase}picto-ligne-LIGIDFMC01390.1742443537.svg`,
        "TRAM 3a": `${tramBase}picto-ligne-LIGIDFMC01391.1742443537.svg`,
        "TRAM 3b": `${tramBase}picto-ligne-LIGIDFMC01392.1742443537.svg`,
        "TRAM 4": `${tramBase}picto-ligne-LIGIDFMC01393.1742443537.svg`,
        "TRAM 5": `${tramBase}picto-ligne-LIGIDFMC01394.1742443537.svg`,
        "TRAM 6": `${tramBase}picto-ligne-LIGIDFMC01395.1742443537.svg`,
        "TRAM 7": `${tramBase}picto-ligne-LIGIDFMC01396.1742443537.svg`,
        "TRAM 8": `${tramBase}picto-ligne-LIGIDFMC01397.1742443537.svg`,

                // RER lines
        "RER A": `https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Paris_transit_icons_-_RER_A.svg/1024px-Paris_transit_icons_-_RER_A.svg.png`,
        "RER B": `https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Paris_transit_icons_-_RER_B.svg/1024px-Paris_transit_icons_-_RER_B.svg.png`,
        "RER C": `https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Paris_transit_icons_-_RER_C.svg/1024px-Paris_transit_icons_-_RER_C.svg.png`,
        "RER D": `https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Paris_transit_icons_-_RER_D.svg/1024px-Paris_transit_icons_-_RER_D.svg.png`,
        "RER E": `https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Paris_transit_icons_-_RER_E.svg/1024px-Paris_transit_icons_-_RER_E.svg.png`,

    };

    return logos[line] || 'https://upload.wikimedia.org/wikipedia/commons/e/ec/RedDot.svg';
}

