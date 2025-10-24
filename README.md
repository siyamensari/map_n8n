# MapRAG - Interactive Location-Based Map System

A modern web frontend application built with **Leaflet.js** and **Vanilla JavaScript** for visualizing and querying location data from an n8n backend API.

## 🚀 Features

- **Interactive Map**: Full-screen Leaflet.js map with OpenStreetMap tiles
- **Radius-Based Search**: Search locations within a specified radius of any address
- **Geocoding**: Automatic address-to-coordinates conversion using OpenStreetMap Nominatim API
- **Real-time Filtering**: Dynamic marker updates based on search criteria
- **Rich Popups**: Detailed location information with contact details
- **Search Radius Visualization**: Blue circle showing search area
- **Responsive Design**: Works on desktop and mobile devices

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Maps**: Leaflet.js with OpenStreetMap tiles
- **HTTP Client**: Axios
- **Geocoding**: OpenStreetMap Nominatim API
- **Backend**: n8n webhooks

## 📁 Project Structure

```
MapRAG/
├── index.html          # Main HTML structure
├── style.css           # Styling and responsive design
├── main.js            # Application logic and API integration
├── README.md          # Project documentation
└── .gitignore         # Git ignore rules
```

## 🔧 API Integration

### Backend Endpoints

The application integrates with two n8n webhook endpoints:

1. **GET** `/webhook/map/data`
   - Returns all location records
   - Called on page load to display all markers

2. **POST** `/webhook/map/query`
   - Accepts: `{ latitude, longitude, radius }`
   - Returns filtered locations within the specified radius

### Data Format

Both endpoints return JSON arrays with location objects:

```json
[
  {
    "Name": "Office Name",
    "Business Name": "Business Name",
    "Type": "Office Type", 
    "Address": "123 Main St, City, State",
    "latitude": 33.5207,
    "longitude": -86.8025,
    "Email": "contact@office.com",
    "Contact": "(205) 123-4567",
    "Rates": "$200/hour"
  }
]
```

## 🚀 Getting Started

### Prerequisites

- Modern web browser
- n8n backend with configured webhooks
- Python 3.x (for local development server)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd MapRAG
   ```

2. **Start a local server**:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Or using Node.js
   npx serve .
   
   # Or using any other static file server
   ```

3. **Configure your n8n backend**:
   - Set up webhook endpoints at `http://localhost:5678/webhook/map/`
   - Ensure CORS headers are configured for cross-origin requests

4. **Open the application**:
   - Navigate to `http://localhost:8000`
   - The map should load with all locations from your n8n backend

## 🎯 Usage

### Basic Usage

1. **View All Locations**: The map automatically loads all locations on page load
2. **Search by Radius**: 
   - Enter an address (e.g., "Birmingham, AL")
   - Enter a radius in kilometers (e.g., 150)
   - Click "Search" or press Enter
3. **View Results**: The map updates with filtered markers and shows a blue search radius circle

### Advanced Features

- **Geocoding**: Supports various address formats (city, state, full addresses)
- **Auto-zoom**: Map automatically fits to show all search results
- **Rich Popups**: Click any marker to see detailed location information
- **Error Handling**: User-friendly error messages for invalid inputs or API failures

## 🔧 Configuration

### API Endpoints

To change the backend API URL, update the `API_BASE_URL` constant in `main.js`:

```javascript
const API_BASE_URL = 'http://localhost:5678/webhook/map';
```

### Map Settings

Default map center and zoom can be modified in `main.js`:

```javascript
const DEFAULT_MAP_CENTER = [33.5, -86.8]; // Alabama center
const DEFAULT_ZOOM = 6;
```

## 🛠️ Development

### Local Development

1. **Start the development server**:
   ```bash
   python -m http.server 8000
   ```

2. **Open browser developer tools** to monitor API calls and debug

3. **Test with your n8n backend**:
   - Ensure n8n is running on port 5678
   - Configure CORS headers in your webhook responses
   - Test both GET and POST endpoints

### CORS Configuration

If you encounter CORS errors, add these headers to your n8n webhook responses:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## 📱 Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

For issues and questions:
- Check the browser console for error messages
- Verify your n8n backend is running and accessible
- Ensure CORS headers are properly configured
- Test API endpoints directly with tools like Postman or curl

## 🔄 Changelog

### v1.0.0
- Initial release with Leaflet.js integration
- Radius-based search functionality
- Geocoding support with OpenStreetMap Nominatim
- Responsive design for desktop and mobile
- Rich popup information display
- Search radius visualization
