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
const API_BASE_URL = 'https://n8n.srv1108756.hstgr.cloud/webhook/map';
const API_UPDATE_URL = 'https://n8n.srv1108756.hstgr.cloud/webhook/map/update';
const API_REVIEW_URL = 'https://n8n.srv1108756.hstgr.cloud/webhook/map/review';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_MAP_CENTER = [33.5, -86.8]; // Alabama center
const DEFAULT_ZOOM = 6;

// Global variables
let map;
let markers = [];
let searchCircle = null;
let searchLocationMarker = null;
let isLoading = false;
let lastSearchLocation = null;

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    loadAllPins();
    
    // Initialize sidebar and adjust map width
    adjustMapWidth();
    
    // Verify sidebar is visible
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        console.log('Sidebar element found:', sidebar);
        console.log('Sidebar visible:', window.getComputedStyle(sidebar).display);
        console.log('Window width:', window.innerWidth);
    } else {
        console.error('Sidebar element not found!');
    }
    
    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            adjustMapWidth();
            if (map) {
                map.invalidateSize();
            }
        }, 150);
    });
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
    const updateMapBtn = document.getElementById('updateMapBtn');
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    
    // Search button click
    searchBtn.addEventListener('click', handleSearch);
    
    // Update Map button click
    if (updateMapBtn) {
        updateMapBtn.addEventListener('click', handleUpdateMap);
    }
    
    // Toggle sidebar button click
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', toggleSidebar);
    }
    
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
 * Handle update map button click - triggers the update webhook
 */
async function handleUpdateMap() {
    const updateMapBtn = document.getElementById('updateMapBtn');
    
    if (isLoading) {
        return;
    }
    
    try {
        showLoading(true);
        if (updateMapBtn) {
            updateMapBtn.disabled = true;
            updateMapBtn.textContent = 'Updating...';
        }
        
        console.log('Triggering update webhook...');
        
        // Trigger the update webhook (POST request)
        const response = await axios.post(API_UPDATE_URL);
        
        console.log('Update webhook triggered successfully:', response.data);
        
        // Show success message
        showSuccess('Map update triggered successfully!');
        
        // Reload all pins after a short delay to show updated data
        setTimeout(() => {
            loadAllPins();
        }, 1000);
        
    } catch (error) {
        console.error('Error triggering update webhook:', error);
        showError('Failed to trigger map update. Please try again.');
    } finally {
        showLoading(false);
        if (updateMapBtn) {
            updateMapBtn.disabled = false;
            updateMapBtn.textContent = 'Update Map';
        }
    }
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
        // Convert miles to kilometers for API (backend expects km)
        const radiusKm = radius * 1.60934;
        
        console.log('Searching for:', address, 'within', radius, 'miles');
        
        // Step 1: Geocode the address
        const geocodeResult = await geocodeAddress(address);
        if (!geocodeResult) {
            showError('Could not find the specified address. Please try a different address.');
            return;
        }
        
        console.log('Geocoded address:', geocodeResult);
        
        // Store the search location for later distance calculations
        lastSearchLocation = {
            lat: geocodeResult.lat,
            lon: geocodeResult.lon
        };
        
        // Step 2: Search for locations within radius (send km to API)
        const response = await axios.post(`${API_BASE_URL}/query`, {
            latitude: geocodeResult.lat,
            longitude: geocodeResult.lon,
            radius: radiusKm
        });
        
        const data = response.data;
        console.log(`Search returned ${data.length} results`);
        
        // Step 3: Update map with results
        clearMarkers();
        plotMarkers(data);
        
        // Step 4: Update sidebar with results (display in miles)
        updateSidebar(data, radius);
        
        // Step 5: Draw search radius circle (in miles)
        drawSearchCircle(geocodeResult.lat, geocodeResult.lon, radius);
        highlightSearchLocation(geocodeResult.lat, geocodeResult.lon, geocodeResult.display_name || address);
        
        // Step 6: Center map on search location
        map.setView([geocodeResult.lat, geocodeResult.lon], Math.max(8, map.getZoom()));
        
        // Show message if no results
        if (data.length === 0) {
            showError('No locations found within that radius.');
        }
        
        // Adjust map width to accommodate sidebar
        adjustMapWidth();
        
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
 * @param {number} radiusMiles - Radius in miles
 */
function drawSearchCircle(lat, lon, radiusMiles) {
    // Remove existing search circle
    if (searchCircle) {
        map.removeLayer(searchCircle);
    }
    
    // Create new search circle (convert miles to meters: 1 mile = 1609.34 meters)
    searchCircle = L.circle([lat, lon], {
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        radius: radiusMiles * 1609.34 // Convert miles to meters
    }).addTo(map);
}

/**
 * Highlight the user's search location with a distinct marker
 * @param {number} lat - Latitude of search location
 * @param {number} lon - Longitude of search location
 * @param {string} label - Optional label to show in popup
 */
function highlightSearchLocation(lat, lon, label = '') {
    if (!map) {
        return;
    }

    // Remove existing search marker
    if (searchLocationMarker) {
        map.removeLayer(searchLocationMarker);
    }

    searchLocationMarker = L.circleMarker([lat, lon], {
        radius: 9,
        color: '#ff4757',
        fillColor: '#ff4757',
        fillOpacity: 0.95,
        weight: 2
    }).addTo(map);

    if (label) {
        searchLocationMarker.bindPopup(`<strong>Search location</strong><br>${label}`);
    }
}

/**
 * Show or hide loading indicator
 * @param {boolean} show - Whether to show loading indicator
 */
function showLoading(show) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const searchBtn = document.getElementById('searchBtn');
    const updateMapBtn = document.getElementById('updateMapBtn');
    
    if (show) {
        loadingIndicator.classList.remove('hidden');
        searchBtn.disabled = true;
        if (updateMapBtn) {
            updateMapBtn.disabled = true;
        }
        isLoading = true;
    } else {
        loadingIndicator.classList.add('hidden');
        searchBtn.disabled = false;
        if (updateMapBtn) {
            updateMapBtn.disabled = false;
        }
        isLoading = false;
    }
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
    // Remove existing error and success messages
    const existingError = document.querySelector('.error-message');
    const existingSuccess = document.querySelector('.success-message');
    if (existingError) {
        existingError.remove();
    }
    if (existingSuccess) {
        existingSuccess.remove();
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
 * Show success message to user
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
    // Remove existing error and success messages
    const existingError = document.querySelector('.error-message');
    const existingSuccess = document.querySelector('.success-message');
    if (existingError) {
        existingError.remove();
    }
    if (existingSuccess) {
        existingSuccess.remove();
    }
    
    // Create new success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
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
 * @returns {number} Distance in miles
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Update star rating visual display
 * @param {HTMLElement} starsContainer - Container element with star elements
 * @param {number} rating - Selected rating (1-5, or 0 to reset)
 */
function updateStars(starsContainer, rating) {
    const stars = starsContainer.querySelectorAll('.star');
    stars.forEach((star, index) => {
        const starRating = parseInt(star.getAttribute('data-rating'));
        if (starRating <= rating) {
            star.classList.add('star-selected');
            star.style.filter = 'grayscale(0%) brightness(1.2)';
        } else {
            star.classList.remove('star-selected');
            star.style.filter = 'grayscale(100%) opacity(0.5)';
        }
    });
}

/**
 * Update the sidebar with search results
 * @param {Array} results - Array of location results
 * @param {number} radius - Search radius in miles
 */
function updateSidebar(results, radius) {
    const sidebarContent = document.getElementById('sidebarContent');
    const sidebarTitle = document.getElementById('sidebarTitle');
    const sidebar = document.getElementById('sidebar');
    
    // Show sidebar when updating with results (ensure it's expanded, not minimized)
    if (sidebar) {
        sidebar.classList.remove('hidden');
        sidebar.classList.remove('minimized');
        const toggleBtn = document.getElementById('toggleSidebarBtn');
        if (toggleBtn) {
            toggleBtn.textContent = '−';
            toggleBtn.title = 'Minimize sidebar';
        }
    }
    
    // Update title with total results count
    const resultCount = results && results.length ? results.length : 0;
    if (results && results.length > 0) {
        sidebarTitle.innerHTML = `Results within ${radius} miles<br><span style="font-size: 14px; font-weight: 400; opacity: 0.9;">Total results: ${resultCount}</span>`;
    } else {
        sidebarTitle.innerHTML = 'Search Results<br><span style="font-size: 14px; font-weight: 400; opacity: 0.9;">Total results: 0</span>';
    }
    
    // Clear existing content
    sidebarContent.innerHTML = '';
    
    // Handle empty results
    if (!results || results.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'result-empty';
        emptyDiv.innerHTML = '<p>No locations found in this radius.</p>';
        sidebarContent.appendChild(emptyDiv);
        
        // Show sidebar on mobile
        if (window.innerWidth <= 768) {
            sidebar.classList.add('open');
        }
        // Adjust map width after showing sidebar
        adjustMapWidth();
        return;
    }
    
    // Process results and sort if distance is available
    const processedResults = results.map((raw, index) => {
        const rec = raw.json || raw;
        
        let distanceMiles = null;
        const locLat = parseFloat(rec.latitude ?? rec.lat ?? rec.Latitude ?? rec.Lat);
        const locLon = parseFloat(rec.longitude ?? rec.lon ?? rec.Longitude ?? rec.Lon);
        if (lastSearchLocation && !Number.isNaN(locLat) && !Number.isNaN(locLon)) {
            distanceMiles = Number(calculateDistance(
                lastSearchLocation.lat,
                lastSearchLocation.lon,
                locLat,
                locLon
            ).toFixed(1));
        }

        return {
            index: index + 1,
            serial: rec.serial || rec.Serial || rec['Serial No.'] || rec['Serial No'] || rec.serial_no || index + 1,
            name: rec.name || rec.Name || 'Unnamed',
            businessName: rec.business_name || rec['Business Name'] || '',
            address: rec.address || rec.Address || '',
            type: rec.type || rec.Type || '',
            state: rec.state || rec.State || '',
            contact: rec.contact || rec.Contact || '',
            email: rec.email || rec.Email || '',
            website: rec.website || rec.Website || '',
            distance: distanceMiles,
            rating: rec.rating || rec.Rating || null,
            feedback: rec.feedback || rec.Feedback || null
        };
    });
    
    // Sort by distance if available
    if (processedResults.length > 0 && processedResults.some(r => r.distance !== null)) {
        processedResults.sort((a, b) => {
            const distA = a.distance !== null ? a.distance : Infinity;
            const distB = b.distance !== null ? b.distance : Infinity;
            return distA - distB;
        });
        // Re-number after sorting
        processedResults.forEach((result, index) => {
            result.index = index + 1;
        });
    }
    
    // Create result cards
    processedResults.forEach(result => {
        const card = document.createElement('div');
        card.className = 'result-card';
        
        // Card header with number and name
        const header = document.createElement('div');
        header.className = 'result-card-header';
        header.innerHTML = `
            <span class="result-number">${result.index}</span>
            <div class="result-name-distance">
                <h3 class="result-name">${result.name}</h3>
                ${result.distance !== null ? `<span class="result-distance">${result.distance} miles</span>` : ''}
            </div>
        `;
        card.appendChild(header);
        
        // Card content
        const content = document.createElement('div');
        
        // Business Name
        if (result.businessName) {
            const businessField = document.createElement('div');
            businessField.className = 'result-field';
            businessField.innerHTML = `
                <span class="result-field-label">Business:</span>
                <span class="result-field-value">${result.businessName}</span>
            `;
            content.appendChild(businessField);
        }
        
        // Address
        if (result.address) {
            const addressField = document.createElement('div');
            addressField.className = 'result-field';
            addressField.innerHTML = `
                <span class="result-field-label">Address:</span>
                <span class="result-field-value">${result.address}</span>
            `;
            content.appendChild(addressField);
        }
        
        // Type
        if (result.type) {
            const typeField = document.createElement('div');
            typeField.className = 'result-field';
            typeField.innerHTML = `
                <span class="result-field-label">Type:</span>
                <span class="result-field-value">${result.type}</span>
            `;
            content.appendChild(typeField);
        }
        
        // State
        if (result.state) {
            const stateField = document.createElement('div');
            stateField.className = 'result-field';
            stateField.innerHTML = `
                <span class="result-field-label">State:</span>
                <span class="result-field-value">${result.state}</span>
            `;
            content.appendChild(stateField);
        }
        
        // Contact
        if (result.contact) {
            const contactField = document.createElement('div');
            contactField.className = 'result-field';
            contactField.innerHTML = `
                <span class="result-field-label">Contact:</span>
                <span class="result-field-value">${result.contact}</span>
            `;
            content.appendChild(contactField);
        }
        
        // Email
        if (result.email) {
            const emailField = document.createElement('div');
            emailField.className = 'result-field';
            emailField.innerHTML = `
                <span class="result-field-label">Email:</span>
                <span class="result-field-value">
                    <a href="mailto:${result.email}">${result.email}</a>
                </span>
            `;
            content.appendChild(emailField);
        }
        
        // Website
        if (result.website) {
            const websiteField = document.createElement('div');
            websiteField.className = 'result-field';
            let websiteUrl = result.website;
            if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
                websiteUrl = 'https://' + websiteUrl;
            }
            websiteField.innerHTML = `
                <span class="result-field-label">Website:</span>
                <span class="result-field-value">
                    <a href="${websiteUrl}" target="_blank" rel="noopener noreferrer">${result.website}</a>
                </span>
            `;
            content.appendChild(websiteField);
        }
        
        card.appendChild(content);
        
        // Feedback Section - Show current rating and feedback
        const feedbackSection = document.createElement('div');
        feedbackSection.className = 'feedback-section';
        feedbackSection.innerHTML = `
            <div class="feedback-display">
                <div class="feedback-field">
                    <span class="result-field-label">Current Rating:</span>
                    <span class="result-field-value">${result.rating ? result.rating + ' ⭐' : 'Not rated yet'}</span>
                </div>
                <div class="feedback-field">
                    <span class="result-field-label">Feedback:</span>
                    <span class="result-field-value">${result.feedback || 'No feedback yet'}</span>
                </div>
            </div>
        `;
        card.appendChild(feedbackSection);
        
        // Write Feedback Button
        const writeFeedbackBtn = document.createElement('button');
        writeFeedbackBtn.className = 'write-feedback-btn';
        writeFeedbackBtn.innerHTML = '✍️ Write Feedback';
        writeFeedbackBtn.setAttribute('data-serial', result.serial);
        card.appendChild(writeFeedbackBtn);
        
        // Feedback Form (initially hidden)
        const feedbackForm = document.createElement('div');
        feedbackForm.className = 'feedback-form';
        feedbackForm.style.display = 'none';
        feedbackForm.setAttribute('data-serial', result.serial);
        
        // Star Rating
        const starsContainer = document.createElement('div');
        starsContainer.className = 'stars-container';
        starsContainer.innerHTML = '<span class="stars-label">Rating:</span>';
        const starsDiv = document.createElement('div');
        starsDiv.className = 'stars';
        let selectedRating = 0;
        
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = 'star';
            star.textContent = '⭐';
            star.setAttribute('data-rating', i);
            star.addEventListener('click', function() {
                selectedRating = i;
                updateStars(starsDiv, i);
            });
            starsDiv.appendChild(star);
        }
        
        starsContainer.appendChild(starsDiv);
        feedbackForm.appendChild(starsContainer);
        
        // Textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'feedback-textarea';
        textarea.placeholder = 'Write your feedback...';
        textarea.rows = 4;
        feedbackForm.appendChild(textarea);
        
        // Submit Button
        const submitBtn = document.createElement('button');
        submitBtn.className = 'submit-feedback-btn';
        submitBtn.textContent = '💾 Submit';
        submitBtn.addEventListener('click', async function() {
            if (selectedRating === 0) {
                alert('Please select a star rating before submitting.');
                return;
            }
            
            const feedbackText = textarea.value.trim();
            
            // Disable button and show loading state
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Submitting...';
            submitBtn.classList.add('submitting');
            
            // Disable textarea and stars during submission
            textarea.disabled = true;
            const stars = starsDiv.querySelectorAll('.star');
            stars.forEach(star => star.style.pointerEvents = 'none');
            
            try {
                // Ensure serial is sent as a string, review as number, feedback as string
                const requestBody = {
                    serial: String(result.serial),
                    review: Number(selectedRating),
                    feedback: String(feedbackText)
                };
                
                console.log('Submitting feedback with body:', requestBody);
                
                const response = await axios.post(API_REVIEW_URL, requestBody, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                // Success state
                submitBtn.textContent = '✅ Submitted!';
                submitBtn.style.background = '#2ed573';
                
                // Small delay to show success state
                await new Promise(resolve => setTimeout(resolve, 500));
                
                alert('Feedback submitted!');
                
                // Close form
                feedbackForm.style.display = 'none';
                writeFeedbackBtn.style.display = 'block';
                
                // Update displayed feedback
                const ratingDisplay = feedbackSection.querySelector('.feedback-field:first-child .result-field-value');
                const feedbackDisplay = feedbackSection.querySelector('.feedback-field:last-child .result-field-value');
                ratingDisplay.textContent = selectedRating + ' ⭐';
                feedbackDisplay.textContent = feedbackText || 'No feedback yet';
                
                // Reset form
                selectedRating = 0;
                updateStars(starsDiv, 0);
                textarea.value = '';
                
                // Re-enable form elements
                submitBtn.disabled = false;
                submitBtn.textContent = '💾 Submit';
                submitBtn.classList.remove('submitting');
                submitBtn.style.background = '';
                textarea.disabled = false;
                stars.forEach(star => star.style.pointerEvents = 'auto');
                
            } catch (error) {
                console.error('Error submitting feedback:', error);
                
                // Re-enable form elements on error
                submitBtn.disabled = false;
                submitBtn.textContent = '💾 Submit';
                submitBtn.classList.remove('submitting');
                submitBtn.style.background = '';
                textarea.disabled = false;
                stars.forEach(star => star.style.pointerEvents = 'auto');
                
                alert('Failed to submit feedback. Please try again.');
            }
        });
        feedbackForm.appendChild(submitBtn);
        
        // Initialize stars to unselected state
        updateStars(starsDiv, 0);
        
        // Toggle form visibility
        writeFeedbackBtn.addEventListener('click', function() {
            const isVisible = feedbackForm.style.display !== 'none';
            feedbackForm.style.display = isVisible ? 'none' : 'block';
            writeFeedbackBtn.style.display = isVisible ? 'block' : 'none';
            
            if (!isVisible) {
                // Reset form when opening
                selectedRating = 0;
                updateStars(starsDiv, 0);
                textarea.value = '';
            }
        });
        
        card.appendChild(feedbackForm);
        sidebarContent.appendChild(card);
    });
    
    // Scroll to top
    sidebarContent.scrollTop = 0;
    
    // Show sidebar on mobile
    if (window.innerWidth <= 768) {
        sidebar.classList.add('open');
    }
    
    // Adjust map width after showing sidebar
    adjustMapWidth();
}

/**
 * Toggle sidebar between minimized and expanded states
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    const mapElement = document.getElementById('map');
    
    if (!sidebar || !toggleBtn) return;
    
    const isMinimized = sidebar.classList.contains('minimized');
    
    if (isMinimized) {
        // Expand sidebar
        sidebar.classList.remove('minimized');
        toggleBtn.textContent = '−';
        toggleBtn.title = 'Minimize sidebar';
        
        if (window.innerWidth > 768) {
            mapElement.style.width = 'calc(100vw - 32%)';
        }
    } else {
        // Minimize sidebar
        sidebar.classList.add('minimized');
        toggleBtn.textContent = '+';
        toggleBtn.title = 'Expand sidebar';
        mapElement.style.width = '100vw';
    }
    
    // Trigger map resize
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 300); // Match CSS transition duration
}

/**
 * Adjust map width to accommodate sidebar
 */
function adjustMapWidth() {
    const sidebar = document.getElementById('sidebar');
    const mapElement = document.getElementById('map');
    
    if (!sidebar || !mapElement) {
        console.error('Sidebar or map element not found');
        return;
    }
    
    if (window.innerWidth > 768) {
        // Desktop: sidebar visible unless hidden or minimized, adjust map width
        if (sidebar && !sidebar.classList.contains('hidden') && !sidebar.classList.contains('minimized')) {
            const sidebarWidth = window.getComputedStyle(sidebar).width;
            console.log('Desktop mode - Sidebar width:', sidebarWidth);
            mapElement.style.width = 'calc(100vw - 32%)';
            sidebar.classList.remove('open'); // Remove mobile class if present
            // Ensure sidebar is visible on desktop
            sidebar.style.transform = 'translateX(0)';
        } else {
            mapElement.style.width = '100vw';
        }
    } else {
        // Mobile: full width, sidebar hidden by default (controlled by CSS)
        console.log('Mobile mode - Full width map');
        mapElement.style.width = '100vw';
    }
    
    // Trigger map resize
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 100);
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
    calculateDistance,
    updateSidebar,
    adjustMapWidth
};