/**
 * geocode.js - Get geographical coordinates for a city using OpenStreetMap Nominatim API
 * 
 * Usage: node geocode.js "City, State/Country"
 * Example: node geocode.js "Phoenix, AZ"
 */

const https = require('https');

// App name for User-Agent header (required by Nominatim's usage policy)
const APP_NAME = 'WeeklyDinnerRSVP/1.0';

/**
 * Gets coordinates for a location using OpenStreetMap's Nominatim API
 * @param {string} location - Location string (e.g., "Phoenix, AZ")
 * @returns {Promise<{lat: number, lng: number} | null>} Coordinates or null if not found
 */
function getCoordinates(location) {
  return new Promise((resolve, reject) => {
    // Encode the location for URL
    const encodedLocation = encodeURIComponent(location);
    
    // Nominatim API URL
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}`;
    
    // Request options
    const options = {
      headers: {
        'User-Agent': APP_NAME // Required by Nominatim usage policy
      }
    };
    
    // Make the API request
    const req = https.get(url, options, (res) => {
      let data = '';
      
      // Collect data chunks
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      // Process complete response
      res.on('end', () => {
        try {
          // Check for error status code
          if (res.statusCode !== 200) {
            reject(new Error(`API returned status code ${res.statusCode}: ${data}`));
            return;
          }
          
          // Parse the JSON response
          const results = JSON.parse(data);
          
          // Check if we got any results
          if (results && results.length > 0) {
            const coordinates = {
              lat: parseFloat(results[0].lat),
              lng: parseFloat(results[0].lon)
            };
            resolve(coordinates);
          } else {
            console.log(`No results found for "${location}"`);
            resolve(null);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    // Handle request errors
    req.on('error', (error) => {
      reject(error);
    });
    
    // End the request
    req.end();
  });
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    // Get location from command line arguments
    const location = process.argv[2];
    
    // Check if a location was provided
    if (!location) {
      console.error('Please provide a location, e.g., "Phoenix, AZ"');
      console.error('Usage: node geocode.js "City, State/Country"');
      process.exit(1);
    }
    
    console.log(`Looking up coordinates for: ${location}`);
    
    // Get the coordinates
    const coords = await getCoordinates(location);
    
    // Display results
    if (coords) {
      console.log(`\n${location}:`);
      console.log(`Latitude: ${coords.lat}`);
      console.log(`Longitude: ${coords.lng}`);
      console.log(`\nFor use in locationCoordinates object:`);
      console.log(`"${location}": { lat: ${coords.lat}, lng: ${coords.lng} },`);
    } else {
      console.error(`Could not find coordinates for "${location}"`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main(); 