const fs = require('fs');
const path = require('path');

/**
 * Generates HTML for a Leaflet map from Obsidian plugin data
 * @param {string} relativePath - Relative path for the output file
 * @param {function} resolveObsidianLink - Function to resolve Obsidian links
 * @returns {string} Leaflet map HTML content
 */
function generateLeafletMapHtml(relativePath, resolveObsidianLink) {
    // Read the Obsidian leaflet plugin data
    const dataPath = path.join(__dirname, '../../CurseOfStrahdNotes/_data/LeafletMaps/plugins/obsidian-leaflet-plugin/data.json');

    if (!fs.existsSync(dataPath)) {
        return '<p>Map data not found.</p>';
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const mapData = data.mapMarkers.find(map => map.id === 'leaflet-map');

    if (!mapData) {
        return '<p>Leaflet map data not found.</p>';
    }

    // Calculate depth for image path
    const currentDir = path.dirname(relativePath);
    const depth = currentDir === '.' ? 0 : currentDir.split('/').length;
    const imageBasePath = depth === 0 ? 'images/' : '../'.repeat(depth) + 'images/';

    // Define image dimensions for coordinate transformation
    const imageWidth = 5025;
    const imageHeight = 3225;

    // Transform markers to pixel coordinates and resolve links
    const markers = mapData.markers.map(marker => {
        // Use percent values if available, otherwise calculate from coordinates
        let pixelX, pixelY;
        console.log('Marker:', marker);

        // Check if marker has valid percent coordinates
        if (!marker.percent || !Array.isArray(marker.percent)) {
            console.error(`Marker "${marker.id}" "${marker.link}" "${marker.description}" is missing valid percent coordinates. Skipping.`);
            console.log("You can solve this by moving the marker a bit on the map in Obsidian. This adds the percent coordinates to the marker.");
            return null;
        }

        pixelX = marker.percent[0] * imageWidth;
        pixelY = (1 - marker.percent[1]) * imageHeight; // Flip Y by subtracting from 1

        // Resolve the link path if it exists
        let resolvedLinkPath = null;
        if (marker.link) {
            const resolvedPath = resolveObsidianLink(marker.link);

            // Calculate relative path from map page to target
            const currentDir = path.dirname(relativePath);
            let linkPath = resolvedPath;

            if (currentDir !== '.') {
                const depth = currentDir.split('/').length;
                const upLevels = '../'.repeat(depth);
                linkPath = upLevels + resolvedPath;
            }

            // URL encode only the filename part for spaces
            const pathParts = linkPath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            pathParts[pathParts.length - 1] = encodeURIComponent(fileName);
            resolvedLinkPath = pathParts.join('/');
        }

        return {
            id: marker.id,
            type: marker.type,
            loc: [pixelY, pixelX], // Leaflet uses [y, x] format
            link: marker.link,
            resolvedLinkPath: resolvedLinkPath,
            description: marker.description,
            tooltip: marker.tooltip
        };
    });

    // Generate marker icon definitions
    const markerIcons = data.markerIcons.reduce((acc, icon) => {
        acc[icon.type] = {
            iconName: icon.iconName,
            color: icon.color,
            size: icon.transform.size
        };
        return acc;
    }, {});

    // Add default marker icon
    markerIcons['default'] = {
        iconName: data.defaultMarker.iconName,
        color: data.defaultMarker.color,
        size: data.defaultMarker.transform.size
    };

    return `
        <style>
            body {
                margin: 0;
                padding: 0;
            }
            main {
                margin: 0;
                padding: 0;
            }
            article {
                margin: 0;
                padding: 0;
            }
            h1 {
                display: none;
            }
            .note-properties {
                display: none;
            }
            #map {
                width: 100vw;
                height: calc(100vh - 50px);
                border: none;
                border-radius: 0;
                position: fixed;
                top: 50px;
                left: 0;
                z-index: 1;
            }
        </style>
        
        
    <div id="map"></div>

    <!-- Leaflet JS -->
     <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
     integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
     crossorigin=""/>
     <!-- Make sure you put this AFTER Leaflet's CSS -->
 <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
     integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
     crossorigin=""></script>
    
    <script>
        // Image dimensions
        const imageWidth = 5025;
        const imageHeight = 3225;
        
        // Create the map with CRS.Simple for pixel coordinates
        const map = L.map('map', {
            crs: L.CRS.Simple,
            minZoom: -2,  // Allow zooming out further
            maxZoom: 3    // Allow zooming in for detail
        });
        
        // Define the image bounds in pixel coordinates
        // [0, 0] is top-left, [imageHeight, imageWidth] is bottom-right
        const bounds = [[0, 0], [imageHeight, imageWidth]];
        
        // Add the image overlay
        L.imageOverlay('${imageBasePath}Barovia.jpg', bounds).addTo(map);
        
        // Marker icons configuration
        const markerIcons = ${JSON.stringify(markerIcons, null, 12)};
        
        // Add custom CSS for marker icons first
        const style = document.createElement('style');
        style.textContent = \`
            .custom-div-icon {
                background: none !important;
                border: none !important;
            }
            .custom-div-icon i {
                color: #dddddd;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
                font-size: 18px;
            }
            \` + Object.entries(markerIcons).map(([type, config]) => \`
            .marker-\${type} i {
                color: \${config.color} !important;
            }
            \`).join('');
        document.head.appendChild(style);
        
        // Function to create custom icons
        function createCustomIcon(type) {
            const iconConfig = markerIcons[type] || markerIcons['default'];
            return L.divIcon({
                html: '<i class="fas fa-' + iconConfig.iconName + '"></i>',
                iconSize: [iconConfig.size, iconConfig.size],
                className: 'custom-div-icon marker-' + type,
                // Try centering the anchor point
                iconAnchor: [iconConfig.size, -iconConfig.size]
            });
        }
        
        // Add markers with transformed coordinates
        const markers = ${JSON.stringify(markers, null, 12)};
        
        markers.forEach(markerData => {
            const [lat, lng] = markerData.loc;
            const marker = L.marker([lat, lng], {
                icon: createCustomIcon(markerData.type)
            }).addTo(map);
            
            // Add click handler for navigation if link is available
            if (markerData.link) {
                marker.on('click', function() {
                    window.location.href = markerData.resolvedLinkPath;
                });
                
                // Add popup with link info
                const popupContent = markerData.description 
                    ? '<strong>' + markerData.link + '</strong><br>' + markerData.description + '<br><em>Click marker to visit page</em>'
                    : '<strong>' + markerData.link + '</strong><br><em>Click marker to visit page</em>';
                marker.bindPopup(popupContent);
            }
            
            // Handle tooltip display
            if (markerData.tooltip === 'always' && markerData.link) {
                marker.bindTooltip(markerData.link, { permanent: true });
            } else if (markerData.tooltip === 'hover' && (markerData.link || markerData.description)) {
                marker.bindTooltip(markerData.link || markerData.description);
            }
        });
        
        // Wait for the map container to be fully rendered, then fit bounds
        setTimeout(() => {
            map.fitBounds(bounds);
        }, 100);
    </script>
        
        <!-- Font Awesome for icons -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    `;
}

module.exports = {
    generateLeafletMapHtml
};