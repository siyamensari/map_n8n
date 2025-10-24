/**
 * MapRAG - Location-Based Map System
 * 
 * This application provides an interactive map interface for querying location data
 * from an n8n backend API with geocoding and radius-based search functionality.
 * 
 * API Endpoints:
 * - GET /webhook/map/data - Returns all locations
 * - POST /webhook/map/query - Returns filtered locations based on lat/lng/radius
 * 
 * To change the API base URL for deployment, update the API_BASE_URL constant below.
 */

// Configuration
const API_BASE_URL = 'http://localhost:5678/webhook/map';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_MAP_CENTER = [33.5, -86.8]; // Alabama center
const DEFAULT_ZOOM = 6;

// Global variables
let map;
let markers = [];
let searchCircle = null;
let isLoading = false;

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    loadAllPins();
});

/**
 * Initialize the Leaflet map
 */
function initializeMap() {
    // Create map instance
    map = L.map('map').setView(DEFAULT_MAP_CENTER, DEFAULT_ZOOM);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);
    
    console.log('Map initialized successfully');
}

/**
 * Setup event listeners for user interactions
 */
function setupEventListeners() {
    const addressInput = document.getElementById('addressInput');
    const radiusInput = document.getElementById('radiusInput');
    const searchBtn = document.getElementById('searchBtn');
    
    // Search button click
    searchBtn.addEventListener('click', handleSearch);
    
    // Enter key press in inputs
    addressInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !isLoading) {
            handleSearch();
        }
    });
    
    radiusInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !isLoading) {
            handleSearch();
        }
    });
    
    // Input focus for better UX
    addressInput.addEventListener('focus', function() {
        this.select();
    });
    
    radiusInput.addEventListener('focus', function() {
        this.select();
    });
}

/**
 * Load all pins from the API and display on map
 */
async function loadAllPins() {
    try {
        showLoading(true);
        console.log('Loading all locations...');
        
        const response = await axios.get(`${API_BASE_URL}/data`);
        const data = response.data;
        
        console.log(`Loaded ${data.length} locations`);
        plotMarkers(data);
        
    } catch (error) {
        console.error('Error loading all pins:', error);
        showError('Failed to load locations. Please check your connection and try again.');
    } finally {
        showLoading(false);
    }
}

/**
 * Handle search functionality
 */
async function handleSearch() {
    const addressInput = document.getElementById('addressInput');
    const radiusInput = document.getElementById('radiusInput');
    const address = addressInput.value.trim();
    const radius = parseFloat(radiusInput.value);
    
    // Validate inputs
    if (!address) {
        showError('Please enter an address');
        return;
    }
    
    if (!radius || radius <= 0) {
        showError('Please enter a valid radius (greater than 0)');
        return;
    }
    
    if (isLoading) {
        return;
    }
    
    try {
        showLoading(true);
        console.log('Searching for:', address, 'within', radius, 'km');
        
        // Step 1: Geocode the address
        const geocodeResult = await geocodeAddress(address);
        if (!geocodeResult) {
            showError('Could not find the specified address. Please try a different address.');
            return;
        }
        
        console.log('Geocoded address:', geocodeResult);
        
        // Step 2: Search for locations within radius
        const response = await axios.post(`${API_BASE_URL}/query`, {
            latitude: geocodeResult.lat,
            longitude: geocodeResult.lon,
            radius: radius
        });
        
        const data = response.data;
        console.log(`Search returned ${data.length} results`);
        
        // Step 3: Update map with results
        clearMarkers();
        plotMarkers(data);
        
        // Step 4: Draw search radius circle
        drawSearchCircle(geocodeResult.lat, geocodeResult.lon, radius);
        
        // Step 5: Center map on search location
        map.setView([geocodeResult.lat, geocodeResult.lon], Math.max(8, map.getZoom()));
        
        // Show message if no results
        if (data.length === 0) {
            showError('No locations found within that radius.');
        }
        
    } catch (error) {
        console.error('Error in search:', error);
        showError('Search failed. Please try again.');
    } finally {
        showLoading(false);
    }
}

/**
 * Geocode an address using OpenStreetMap Nominatim API
 * @param {string} address - The address to geocode
 * @returns {Object|null} - Object with lat/lon or null if not found
 */
async function geocodeAddress(address) {
    try {
        const encodedAddress = encodeURIComponent(address);
        const url = `${NOMINATIM_API}?format=json&q=${encodedAddress}&limit=1`;
        
        console.log('Geocoding address:', address);
        const response = await axios.get(url);
        
        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            return {
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
                display_name: result.display_name
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error geocoding address:', error);
        return null;
    }
}

/**
 * Plot markers on the map
 * @param {Array} data - Array of location records to display
 */
function plotMarkers(data) {
   
    if (!data || data.length === 0) {
        console.log('No data to plot');
        return;
    }
    
    // Create markers for each location
    data.forEach(raw => {
        // handle both cases: raw.json or raw directly
        const rec = raw.json || raw;
      
        const lat = parseFloat(rec.latitude);
        const lon = parseFloat(rec.longitude);
      
        console.log("Placing marker at:", lat, lon);
      
        if (isNaN(lat) || isNaN(lon)) {
          console.warn("Invalid coordinates in record:", rec);
          return;
        }
      
        const marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup(`
            <b>${rec.name || rec.Name || "Unnamed"}</b><br>
            <i>${rec.business_name || rec["Business Name"] || ""}</i><br>
            <span style="font-weight:600;">${rec.type || rec.Type || ""}</span><br>
            ${rec.address || rec.Address || ""}<br>
          
            <a
              href="mailto:${rec.email || rec.Email}?"
              class="email-link"
            >
              ${rec.email || rec.Email}
            </a><br>
          
            ${rec.contact || rec.Contact || ""}<br>
            ${rec.rates || rec.Rates || ""}
          `);
          
          
        markers.push(marker);
      });
      
    
    // Fit map to show all markers if we have any
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
    
    console.log(`Plotted ${markers.length} markers`);
}

/**
 * Create a marker for a single location
 * @param {Object} location - The location data
 * @returns {L.Marker} Leaflet marker instance
 */
function createMarker(location) {
    const { latitude, longitude, Name, "Business Name": businessName, Type, Address, Email, Contact, Rates } = location;
    
    // Create marker
    const marker = L.marker([latitude, longitude]);
    
    // Create popup content
    const popupContent = `
        <div class="popup-content">
            <h3>${Name || 'Unknown'}</h3>
            ${businessName ? `<p><strong>Business:</strong> ${businessName}</p>` : ''}
            ${Type ? `<p><strong>Type:</strong> ${Type}</p>` : ''}
            <p><strong>Address:</strong> ${Address || 'N/A'}</p>
            <div class="contact-info">
                <p><strong>Email:</strong> ${Email || 'N/A'}</p>
                <p><strong>Contact:</strong> ${Contact || 'N/A'}</p>
                <p><strong>Rates:</strong> ${Rates || 'N/A'}</p>
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    
    return marker;
}

/**
 * Clear all markers from the map
 */
function clearMarkers() {
    markers.forEach(marker => {
        map.removeLayer(marker);
    });
    markers = [];
}

/**
 * Draw a search radius circle on the map
 * @param {number} lat - Latitude of center
 * @param {number} lon - Longitude of center
 * @param {number} radiusKm - Radius in kilometers
 */
function drawSearchCircle(lat, lon, radiusKm) {
    // Remove existing search circle
    if (searchCircle) {
        map.removeLayer(searchCircle);
    }
    
    // Create new search circle
    searchCircle = L.circle([lat, lon], {
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        radius: radiusKm * 1000 // Convert km to meters
    }).addTo(map);
}

/**
 * Show or hide loading indicator
 * @param {boolean} show - Whether to show loading indicator
 */
function showLoading(show) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const searchBtn = document.getElementById('searchBtn');
    
    if (show) {
        loadingIndicator.classList.remove('hidden');
        searchBtn.disabled = true;
        isLoading = true;
    } else {
        loadingIndicator.classList.add('hidden');
        searchBtn.disabled = false;
        isLoading = false;
    }
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
    // Remove existing error messages
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

/**
 * Utility function to format coordinates for display
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Formatted coordinates
 */
function formatCoordinates(lat, lng) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * Utility function to calculate distance between two points
 * @param {number} lat1 - First latitude
 * @param {number} lng1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lng2 - Second longitude
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Export functions for potential external use
window.MapRAG = {
    loadAllPins,
    handleSearch,
    clearMarkers,
    plotMarkers,
    geocodeAddress,
    showError,
    formatCoordinates,
    calculateDistance
};