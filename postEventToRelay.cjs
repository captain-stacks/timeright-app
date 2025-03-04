/**
 * postEventToRelay.js
 * 
 * A simple Node.js script to post an event to a Nostr relay using nostr-tools.
 * Run with: node postEventToRelay.js
 */

// Import nostr-tools instead of https
const { SimplePool, getEventHash, finalizeEvent } = require('nostr-tools');

// Configuration - using the same values as in App.jsx
const relayUrl = 'wss://nos.lol'; // Same relay as in App.jsx
const privateKey = 'f4aaf944ae00428a6f9781be52736b42717542d3898f9c92cb1c0a160eda161a'; // Same private key as in App.jsx

// Event data to post - using proper Nostr event structure
const eventData = {
  kind: 30078, // Parameterized replaceable event
  tags: [
    ['d', 'weekly-dinner-rsvps'], // Same d-tag as in App.jsx
    ['t', 'rsvp_data']
  ],
  content: JSON.stringify([
      { "name": "Emily Johnson", "age": "29", "location": "Scottsdale, AZ" },
      { "name": "David Wilson", "age": "43", "location": "Phoenix, AZ" },
      { "name": "Sophia Martinez", "age": "25", "location": "Tempe, AZ" },
      { "name": "Michael Rodriguez", "age": "31", "location": "Mesa, AZ" },
      { "name": "Olivia Chen", "age": "37", "location": "Chandler, AZ" },
      { "name": "William Thompson", "age": "52", "location": "Gilbert, AZ" },
      { "name": "Ava Williams", "age": "23", "location": "Phoenix, AZ" },
      { "name": "Ethan Brown", "age": "33", "location": "Scottsdale, AZ" },
      { "name": "Isabella Garcia", "age": "45", "location": "Tempe, AZ" },
      { "name": "Noah Davis", "age": "27", "location": "Mesa, AZ" },
      { "name": "Mia Jackson", "age": "39", "location": "Phoenix, AZ" },
      { "name": "James Miller", "age": "34", "location": "Chandler, AZ" },
      { "name": "Charlotte Wilson", "age": "22", "location": "Gilbert, AZ" },
      { "name": "Benjamin Moore", "age": "48", "location": "Scottsdale, AZ" },
      { "name": "Amelia Taylor", "age": "30", "location": "Phoenix, AZ" },
    ])
};

// Function to post the event using nostr-tools
async function postEventToRelay() {
  // Create a pool for relay connection
  const pool = new SimplePool();
  
  try {
    console.log('Connecting to relay...');
    
    // Create an unsigned event
    const event = {
      ...eventData,
      pubkey: '', // Will be derived from private key
      created_at: Math.floor(Date.now() / 1000)
    };
    
    // Finalize and sign the event
    const signedEvent = finalizeEvent(event, privateKey);
    
    console.log('Posting event to relay...', relayUrl);
    console.log('Event:', signedEvent);
    
    // Publish the event to the relay
    const pub = pool.publish([relayUrl], signedEvent);
    
    // Wait for the publication to complete
    const result = await Promise.all(pub);
    
    console.log('Event posted successfully!');
    console.log('Response:', result);
    
    return result;
  } catch (error) {
    console.error('Error posting event:', error.message);
    throw error;
  } finally {
    // Clean up resources
    pool.close([relayUrl]);
  }
}

// Run the post event function
postEventToRelay()
  .then(response => {
    console.log('Post event operation completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Post event operation failed:', error);
    process.exit(1);
  }); 