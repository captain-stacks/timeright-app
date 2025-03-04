// Haversine formula to calculate distance between two points on Earth (in kilometers)
export const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
};

// Haversine formula to calculate distance between two points on Earth (in miles)
export const getDistanceFromLatLonInMiles = (lat1, lon1, lat2, lon2) => {
  // Calculate in kilometers and convert to miles (1 km = 0.621371 miles)
  return getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) * 0.621371;
};

// Convert degrees to radians
const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

// Map of locations to their coordinates
export const locationCoordinates = {
  "Phoenix, AZ": { lat: 33.4484367, lng: -112.074141 },
  "Scottsdale, AZ": { lat: 33.4942, lng: -111.9261 },
  "Tempe, AZ": { lat: 33.4255, lng: -111.9400 },
  "Mesa, AZ": { lat: 33.4152, lng: -111.8315 },
  "Chandler, AZ": { lat: 33.3062, lng: -111.8413 },
  "Gilbert, AZ": { lat: 33.3528, lng: -111.7890 },
  "Glendale, AZ": { lat: 33.5387, lng: -112.1860 },
  "Peoria, AZ": { lat: 33.5806, lng: -112.2374 },
  "Surprise, AZ": { lat: 33.6292, lng: -112.3680 },
  "Goodyear, AZ": { lat: 33.4353, lng: -112.3576 },
  "Avondale, AZ": { lat: 33.4356, lng: -112.3497 },
  "Paradise Valley, AZ": { lat: 33.5312, lng: -111.9426 },
  "Cave Creek, AZ": { lat: 33.8336, lng: -111.9506 },
  "Carefree, AZ": { lat: 33.8233, lng: -111.9189 },
  "Fountain Hills, AZ": { lat: 33.6043, lng: -111.7224 },
  "Apache Junction, AZ": { lat: 33.4150485, lng: -111.549577 },
  "Queen Creek, AZ": { lat: 33.2483858, lng: -111.634158 }
}; 

// Get coordinates for a location
export const getCoordinates = (location) => {
  if (!location) return { lat: 0, lng: 0 };
  
  // Try to find exact match
  if (locationCoordinates[location]) {
    return locationCoordinates[location];
  }
  
  // Extract city
  const parts = location.split(',');
  const city = parts[0].trim() + (parts[1] ? ', ' + parts[1].trim() : '');
  
  // Try finding the city
  if (locationCoordinates[city]) {
    return locationCoordinates[city];
  }
  
  // Return Phoenix as default if no match
  console.warn(`No coordinates found for ${location}, using Phoenix as default`);
  return locationCoordinates["Phoenix, AZ"];
}; 