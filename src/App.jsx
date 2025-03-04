import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import RSVPForm from './components/RSVPForm';
import RSVPConfirmation from './components/RSVPConfirmation';
import RSVPList from './components/RSVPList';
// Import Nostr tools
import { 
  SimplePool, 
  getEventHash, 
  finalizeEvent, 
  getPublicKey 
} from 'nostr-tools';
import { locationCoordinates, getDistanceFromLatLonInKm, getCoordinates } from './utils/geo';

function App() {
  const [submitted, setSubmitted] = useState(false);
  const [userData, setUserData] = useState(null);
  const [allRsvps, setAllRsvps] = useState([]);
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const privateKey = 'f4aaf944ae00428a6f9781be52736b42717542d3898f9c92cb1c0a160eda161a';
  
  // Define constants for the Nostr event
  const EVENT_KIND = 30078; // Parameterized replaceable event
  const EVENT_D_TAG = 'weekly-dinner-rsvps'; // Unique identifier for this dataset
  
  // Track if we need to publish to relays
  const needsPublishRef = useRef(false);
  
  // Array of Nostr relay URLs to use
  const relayUrls = [
    'wss://nos.lol',
    // 'wss://relay.damus.io',
    // 'wss://relay.nostr.band',
    // 'wss://nostr.fmt.wiz.biz'
  ];
  
  // Create a pool instance for reuse
  const [pool] = useState(() => new SimplePool());
  const subRef = useRef(null);
  
  // Create a unique identifier for an RSVP
  const getRsvpKey = (rsvp) => {
    return `${rsvp.name}|${rsvp.age}|${rsvp.location}`;
  };
  
  // Process relay events and update state
  const processRelayEvents = (events) => {
    console.log('Processing', events.length, 'RSVPs from relays');
    
    if (events.length > 0) {
      // Create a map for quick lookup and deduplication
      const rsvpMap = new Map();
      
      // Add all relay events to the map
      events.forEach(rsvp => {
        const key = getRsvpKey(rsvp);
        rsvpMap.set(key, rsvp);
      });
      
      // Convert map back to array
      const uniqueRsvps = Array.from(rsvpMap.values());
      console.log('After deduplication:', uniqueRsvps.length, 'RSVPs');
      
      // Update state with the unique RSVPs from relays
      setAllRsvps(uniqueRsvps);
    }
  };
  
  // Set up a persistent subscription to keep state in sync with relays
  useEffect(() => {
    console.log('Setting up persistent relay subscription');
    const relayEvents = [];
    
    // Create a new subscription with the event handlers directly inline
    const sub = pool.subscribeMany(
      relayUrls, 
      [{
        kinds: [EVENT_KIND],
        '#d': [EVENT_D_TAG],
      }],
      {
        // Handle events as they come in
        onevent(event) {
          try {
            const rsvpData = JSON.parse(event.content);
            if (Array.isArray(rsvpData)) {
              // Before EOSE, collect events for initial sync
              if (!initialSyncComplete) {
                relayEvents.push(...rsvpData);
              } else {
                // After EOSE, process events in real-time
                console.log('Received real-time update with', rsvpData.length, 'RSVPs');
                processRelayEvents(rsvpData);
              }
            }
          } catch (error) {
            console.error('Failed to parse event content:', error);
          }
        },
        // Handle end of stored events
        oneose() {
          console.log('Initial sync complete with', relayEvents.length, 'events');
          processRelayEvents(relayEvents);
          setInitialSyncComplete(true);
          setIsLoading(false);
        }
      }
    );
    
    // Store the subscription for later cleanup
    subRef.current = sub;
    
    // Handle timeout if EOSE never arrives
    const timeoutId = setTimeout(() => {
      if (!initialSyncComplete) {
        console.log('EOSE timeout reached, processing available events anyway');
        processRelayEvents(relayEvents);
        setInitialSyncComplete(true);
        setIsLoading(false);
      }
    }, 10000);
    
    // Clean up pool on component unmount
    return () => {
      clearTimeout(timeoutId);
      if (subRef.current) {
        subRef.current.unsub();
      }
      pool.close(relayUrls);
    };
  }, []);
  
  // Publish an event to Nostr relays using the pool
  const publishToRelays = async (content) => {
    console.log('Publishing to relays:', content.length, 'RSVPs');
    const publicKey = getPublicKey(privateKey);
    
    // Create an event using kind 30078 with d-tag
    const event = {
      kind: EVENT_KIND,
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', EVENT_D_TAG],
        ['t', 'rsvp_data']
      ],
      content: JSON.stringify(content)
    };
    
    // Calculate the event hash
    event.id = getEventHash(event);
    
    // Sign the event
    const signedEvent = finalizeEvent(event, privateKey);
    
    try {
      await Promise.all(pool.publish(relayUrls, signedEvent))
        .catch(e => console.log('Error publishing event: ', e));
      
      console.log('Successfully published to relays');
      // Reset the flag since we've now published
      needsPublishRef.current = false;
    } catch (error) {
      console.error('Failed to publish to relays:', error);
      // Keep the flag set so we'll try again
      needsPublishRef.current = true;
    }
  };
  
  // Manual refresh function for when the user explicitly wants to refresh
  const manualRefresh = async () => {
    // If we have local changes that haven't been published yet, publish them first
    if (needsPublishRef.current && allRsvps.length > 0) {
      await publishToRelays(allRsvps);
    }
    
    // No need to refetch since we have a persistent subscription
    return Promise.resolve();
  };
  
  // Set up a listener to ensure all changes are published
  useEffect(() => {
    if (allRsvps.length > 0 && initialSyncComplete) {
      // Mark that we need to publish
      needsPublishRef.current = true;
      
      // Publish after a short delay to batch rapid changes
      const publishTimer = setTimeout(() => {
        if (needsPublishRef.current) {
          publishToRelays(allRsvps);
        }
      }, 1000);
      
      return () => clearTimeout(publishTimer);
    }
  }, [allRsvps, initialSyncComplete]);
  
  // Calculate average distance between a guest and everyone at a table
  const calculateAverageDistance = (guestLocation, tableGuests) => {
    if (!tableGuests.length) return 0;
    
    const guestCoords = getCoordinates(guestLocation);
    
    let totalDistance = 0;
    for (const tableGuest of tableGuests) {
      const tableGuestCoords = getCoordinates(tableGuest.location);
      const distance = getDistanceFromLatLonInKm(
        guestCoords.lat, guestCoords.lng,
        tableGuestCoords.lat, tableGuestCoords.lng
      );
      totalDistance += distance;
    }
    
    return totalDistance / tableGuests.length;
  };

  // Enhanced assignOptimalTable function with real geographical distances
  const assignOptimalTable = (newRsvp, currentRsvps) => {
    const newGuestAge = parseInt(newRsvp.age);
    const newGuestLocation = newRsvp.location;
    
    // First, gather all existing guests excluding the new one
    const existingGuests = currentRsvps.filter(rsvp => rsvp !== newRsvp);
    
    // If this is the first guest, simply assign Table-1
    if (existingGuests.length === 0) {
      newRsvp.table = 'Table-1';
      return;
    }
    
    // Get existing tables and counts
    const tables = {};
    existingGuests.forEach(guest => {
      if (!guest.table) return;
      
      if (!tables[guest.table]) {
        tables[guest.table] = {
          guests: [],
          ages: [],
          locations: []
        };
      }
      
      tables[guest.table].guests.push(guest);
      tables[guest.table].ages.push(parseInt(guest.age));
      tables[guest.table].locations.push(guest.location);
    });
    
    // Calculate table statistics
    const tableStats = {};
    let minCombinedScoreTable = null;
    let minCombinedScore = Infinity;
    
    // For each table, calculate key metrics
    Object.keys(tables).forEach(tableId => {
      const table = tables[tableId];
      const count = table.guests.length;
      
      // Skip tables that are already full
      if (count >= 6) return;
      
      // Calculate age statistics
      const ages = table.ages;
      const minAge = Math.min(...ages);
      const maxAge = Math.max(...ages);
      const ageRange = maxAge - minAge;
      const avgAge = ages.reduce((total, age) => total + age, 0) / count;
      
      // Calculate what the new age range would be if we add this guest
      const newMinAge = Math.min(minAge, newGuestAge);
      const newMaxAge = Math.max(maxAge, newGuestAge);
      const newAgeRange = newMaxAge - newMinAge;
      
      // Calculate how much this guest would increase the age range
      const ageRangeIncrease = newAgeRange - ageRange;
      
      // Calculate how far this guest is from the average age
      const ageDistanceFromAvg = Math.abs(newGuestAge - avgAge);
      
      // Calculate geographical proximity using Haversine distance
      const avgDistance = calculateAverageDistance(newGuestLocation, table.guests);
      
      // Normalize the distance to a 0-10 scale (assume max reasonable distance is 50km)
      // Lower distance is better, so higher score is worse
      const normalizedDistanceScore = Math.min(10, avgDistance / 5);
      
      // Create a composite score that prioritizes:
      // 1. Minimizing the increase in age range (weight: 3)
      // 2. Keeping the guest close to the average age (weight: 1)
      // 3. Minimizing geographical distance (weight: 4)
      // 4. Filling tables that already have more people (weight: 0.5)
      const combinedScore = 
        (ageRangeIncrease * 3) + 
        ageDistanceFromAvg - 
        (count * 0.5) + 
        (normalizedDistanceScore * 4);
      
      tableStats[tableId] = {
        count,
        ageRange,
        avgAge,
        newAgeRange,
        ageRangeIncrease,
        ageDistanceFromAvg,
        avgDistance,
        normalizedDistanceScore,
        combinedScore
      };
      
      // Track the table with minimum combined score
      if (combinedScore < minCombinedScore) {
        minCombinedScore = combinedScore;
        minCombinedScoreTable = tableId;
      }
    });
    
    // Handle special cases
    if (Object.keys(tables).length === 0) {
      // No tables exist yet, create the first one
      newRsvp.table = 'Table-1';
      return;
    }
    
    if (!minCombinedScoreTable) {
      // All existing tables are full, create a new one
      const maxTableNum = Math.max(...Object.keys(tables).map(id => {
        const num = parseInt(id.split('-')[1]);
        return isNaN(num) ? 0 : num;
      }));
      newRsvp.table = `Table-${maxTableNum + 1}`;
      return;
    }
    
    // Assign the table with minimum combined score
    newRsvp.table = minCombinedScoreTable;
    
    // Log the assignment for debugging
    console.log(`Assigned ${newRsvp.name} (age ${newRsvp.age}, ${newRsvp.location}) to ${minCombinedScoreTable}`);
    console.log(`Score: ${minCombinedScore.toFixed(2)}, Age distance: ${tableStats[minCombinedScoreTable].ageDistanceFromAvg.toFixed(2)}, Geo distance: ${tableStats[minCombinedScoreTable].avgDistance.toFixed(2)}km`);
  };
  
  // Handle form submission
  const handleSubmit = (formData) => {
    // Create a new RSVP with the form data
    const newRsvp = {
      ...formData,
      submittedAt: new Date().toISOString()
    };
    
    // Add the new RSVP to the existing ones
    const updatedRsvps = [...allRsvps, newRsvp];
    
    // Assign tables if this is the first RSVP
    if (updatedRsvps.length === 1) {
      newRsvp.table = 'Table-1';
    } else {
      // Use the table assignment algorithm for larger groups
      assignOptimalTable(newRsvp, updatedRsvps);
    }
    
    // Update the state with the new RSVP included
    setAllRsvps(updatedRsvps);
    
    // Set user data for the confirmation page
    setUserData(newRsvp);
    
    // Show confirmation
    setSubmitted(true);
  };
  
  // Reset the form for another submission
  const handleReset = () => {
    setSubmitted(false);
    setUserData(null);
  };
  
  // Get counts of people at each table
  const getTableCounts = (currentRsvps) => {
    const counts = {};
    currentRsvps.forEach(rsvp => {
      if (rsvp.table) {
        counts[rsvp.table] = (counts[rsvp.table] || 0) + 1;
      }
    });
    return counts;
  };
  
  // Update the handleReassignAllTables function to use real distances as well
  const handleReassignAllTables = () => {
    // Confirm with the user before proceeding
    if (!confirm('This will reassign all tables based on age and geographic proximity. Continue?')) {
      return;
    }
    
    // Make a copy of the current RSVP list
    const rsvps = [...allRsvps];
    if (rsvps.length < 8) {
      alert('Not enough RSVPs to optimize tables. Need at least 8 RSVPs.');
      return;
    }
    
    console.log('Reassigning all tables for', rsvps.length, 'RSVPs');
    
    // PHASE 1: INITIALIZATION - PREPARE DATA
    
    // Sort by age to start with some rough clustering
    rsvps.sort((a, b) => parseInt(a.age) - parseInt(b.age));
    
    // Helper function to get table counts
    const getTableCounts = (guests) => {
      const counts = {};
      guests.forEach(g => {
        if (!g.table) return;
        counts[g.table] = (counts[g.table] || 0) + 1;
      });
      return counts;
    };
    
    // Calculate ideal number of tables based on 4-6 people per table
    const idealNumTables = Math.ceil(rsvps.length / 5); // Aim for about 5 per table on average
    console.log('Creating', idealNumTables, 'tables');
    
    // PHASE 2: INITIAL ASSIGNMENT - DISTRIBUTE EVENLY
    
    // Create initial tables with even distribution
    for (let i = 0; i < rsvps.length; i++) {
      const tableIndex = i % idealNumTables;
      rsvps[i].table = `Table-${tableIndex + 1}`;
    }
    
    // PHASE 3: OPTIMIZATION - ITERATIVE IMPROVEMENT
    
    // Function to calculate table age ranges
    const calculateTableAgeRanges = (tables) => {
      const ranges = {};
      tables.forEach((table, index) => {
        const ages = table.guests.map(g => parseInt(g.age));
        ranges[`Table-${index + 1}`] = Math.max(...ages) - Math.min(...ages);
      });
      return ranges;
    };
    
    // Function to calculate average geographic distance within each table
    const calculateTableDistances = (tables) => {
      const distances = {};
      
      tables.forEach((table, index) => {
        let totalDistance = 0;
        let pairCount = 0;
        
        // Calculate distance between each pair of guests
        for (let i = 0; i < table.guests.length; i++) {
          const guest1 = table.guests[i];
          const coords1 = getCoordinates(guest1.location);
          
          for (let j = i + 1; j < table.guests.length; j++) {
            const guest2 = table.guests[j];
            const coords2 = getCoordinates(guest2.location);
            
            const distance = getDistanceFromLatLonInKm(
              coords1.lat, coords1.lng, 
              coords2.lat, coords2.lng
            );
            
            totalDistance += distance;
            pairCount++;
          }
        }
        
        // Average distance between all pairs of guests at the table
        distances[`Table-${index + 1}`] = pairCount > 0 ? totalDistance / pairCount : 0;
      });
      
      return distances;
    };
    
    // Group guests by table
    let tables = [];
    for (let i = 0; i < idealNumTables; i++) {
      tables.push({
        id: `Table-${i + 1}`,
        guests: rsvps.filter(r => r.table === `Table-${i + 1}`)
      });
    }
    
    // Iteratively improve the assignment
    const maxIterations = 100;
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let improved = false;
      
      // Calculate current metrics
      const ageRanges = calculateTableAgeRanges(tables);
      const geoDistances = calculateTableDistances(tables);
      
      // Calculate total weighted score (lower is better)
      const totalAgeRange = Object.values(ageRanges).reduce((sum, range) => sum + range, 0);
      const totalGeoDistance = Object.values(geoDistances).reduce((sum, dist) => sum + dist, 0);
      
      // Normalize geo distances (assuming max reasonable distance is 50km)
      const normalizedGeoDistance = Math.min(10, totalGeoDistance / tables.length / 5);
      
      const totalScore = (totalAgeRange * 3) + (normalizedGeoDistance * 40);
      
      // Try all possible swaps between tables
      for (let t1 = 0; t1 < tables.length; t1++) {
        for (let t2 = t1 + 1; t2 < tables.length; t2++) {
          for (let g1 = 0; g1 < tables[t1].guests.length; g1++) {
            for (let g2 = 0; g2 < tables[t2].guests.length; g2++) {
              // Try swapping guest g1 from table t1 with guest g2 from table t2
              const guest1 = tables[t1].guests[g1];
              const guest2 = tables[t2].guests[g2];
              
              // Perform the swap
              tables[t1].guests[g1] = guest2;
              tables[t2].guests[g2] = guest1;
              
              // Recalculate metrics after the swap
              const newAgeRanges = calculateTableAgeRanges(tables);
              const newGeoDistances = calculateTableDistances(tables);
              
              // Calculate new total weighted score
              const newTotalAgeRange = Object.values(newAgeRanges).reduce((sum, range) => sum + range, 0);
              const newTotalGeoDistance = Object.values(newGeoDistances).reduce((sum, dist) => sum + dist, 0);
              
              // Normalize geo distances
              const newNormalizedGeoDistance = Math.min(10, newTotalGeoDistance / tables.length / 5);
              
              const newTotalScore = (newTotalAgeRange * 3) + (newNormalizedGeoDistance * 40);
              
              // If the swap improved the situation, keep it
              if (newTotalScore < totalScore) {
                improved = true;
                console.log(`Iteration ${iteration}: Improved score from ${totalScore.toFixed(2)} to ${newTotalScore.toFixed(2)}`);
              } else {
                // Otherwise, revert the swap
                tables[t1].guests[g1] = guest1;
                tables[t2].guests[g2] = guest2;
              }
            }
          }
        }
      }
      
      // If no improvement was found in this iteration, stop
      if (!improved) {
        console.log(`Optimization complete after ${iteration + 1} iterations`);
        break;
      }
    }
    
    // PHASE 4: FINALIZE - ASSIGN TABLE NAMES BASED ON AGE CLUSTERS
    
    // Assign final table names based on median age of each table
    const reassigned = [];
    tables.forEach((table, index) => {
      // Calculate median age to use for table name
      const ages = table.guests.map(g => parseInt(g.age)).sort((a, b) => a - b);
      const medianAge = ages[Math.floor(ages.length / 2)];
      const tableId = `${medianAge}-${index + 1}`;
      
      // Assign this table ID to all guests
      table.guests.forEach(guest => {
        reassigned.push({
          ...guest,
          table: tableId
        });
      });
    });
    
    // Final validation
    const finalCounts = getTableCounts(reassigned);
    const allValid = Object.values(finalCounts).every(count => count >= 4 && count <= 6);
    
    if (!allValid) {
      console.error("Table constraints violated after reassignment!");
      return;
    }
    
    // Update state with the reassigned tables
    setAllRsvps(reassigned);
  };
  
  // Get the age range description for a table
  const getTableDescription = (table) => {
    // Find all guests at this table and get their ages
    const tableGuests = allRsvps.filter(rsvp => rsvp.table === table);
    if (tableGuests.length === 0) return 'Empty table';
    
    // Calculate min, max and average age
    const ages = tableGuests.map(g => parseInt(g.age));
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    
    if (minAge === maxAge) {
      return `Age ${minAge}`;
    }
    
    return `Ages ${minAge} to ${maxAge}`;
  };

  // Define HomeView component inside App
  const HomeView = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Weekly Dinner RSVP</h1>
          <p className="text-gray-600 mt-2">Join us for a delightful evening with great food and company</p>
          
          {/* Admin button at the top */}
          <div className="mt-4">
            <a 
              href="/admin"
              className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              Admin View
            </a>
          </div>
        </div>
        
        {!initialSyncComplete ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : !submitted ? (
          <RSVPForm onSubmit={handleSubmit} />
        ) : (
          <div className="space-y-6">
            <RSVPConfirmation 
              name={userData.name} 
              table={userData.table}
              tableDescription={getTableDescription(userData.table)} 
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={handleReset}
                className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg shadow-md transition duration-200"
              >
                Submit Another RSVP
              </button>
              <a 
                href="/admin"
                className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition duration-200 text-center"
              >
                View All RSVPs
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/admin" element={
          <div className="min-h-screen bg-gray-50 py-8 px-4">
            {!initialSyncComplete ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="ml-3 text-indigo-600">Loading data from Nostr relays...</p>
              </div>
            ) : (
              <RSVPList 
                rsvps={allRsvps} 
                onReassignTables={handleReassignAllTables}
                getTableDescription={getTableDescription}
                onRefresh={manualRefresh}
              />
            )}
          </div>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;