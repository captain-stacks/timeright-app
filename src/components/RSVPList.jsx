import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getDistanceFromLatLonInMiles, getCoordinates } from '../utils/geo';

const RSVPList = ({ rsvps, onReassignTables, getTableDescription, onRefresh }) => {
  const [isReassigning, setIsReassigning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('table'); // Default sort by table
  const [expandedTable, setExpandedTable] = useState(null);

  const handleReassignTables = () => {
    setIsReassigning(true);
    onReassignTables();
    
    // Show reassigning status for 1 second
    setTimeout(() => {
      setIsReassigning(false);
    }, 1000);
  };
  
  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh().finally(() => {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    });
  };

  const filteredRsvps = rsvps.filter(rsvp => 
    rsvp.name?.toLowerCase().includes(filter.toLowerCase()) || 
    rsvp.location?.toLowerCase().includes(filter.toLowerCase())
  );

  // Sort the filtered RSVPs
  const sortedRsvps = [...filteredRsvps].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'age') return parseInt(a.age) - parseInt(b.age);
    if (sortBy === 'location') return a.location.localeCompare(b.location);
    return a.table?.localeCompare(b.table || ''); // Default sort by table
  });

  // Group RSVPs by table
  const tableGroups = {};
  rsvps.forEach(rsvp => {
    if (!rsvp.table) return;
    
    if (!tableGroups[rsvp.table]) {
      tableGroups[rsvp.table] = [];
    }
    tableGroups[rsvp.table].push(rsvp);
  });
  
  // Calculate statistics for each table
  const tableStats = {};
  Object.keys(tableGroups).forEach(tableId => {
    const guests = tableGroups[tableId];
    
    // Age statistics
    const ages = guests.map(g => parseInt(g.age));
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    const ageRange = maxAge - minAge;
    const avgAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
    
    // Geographic statistics
    let maxDistance = 0;
    let totalDistance = 0;
    let pairCount = 0;
    
    // Calculate distance between each pair of guests
    for (let i = 0; i < guests.length; i++) {
      const guest1 = guests[i];
      const coords1 = getCoordinates(guest1.location);
      
      for (let j = i + 1; j < guests.length; j++) {
        const guest2 = guests[j];
        const coords2 = getCoordinates(guest2.location);
        
        const distance = getDistanceFromLatLonInMiles(
          coords1.lat, coords1.lng, 
          coords2.lat, coords2.lng
        );
        
        totalDistance += distance;
        pairCount++;
        maxDistance = Math.max(maxDistance, distance);
      }
    }
    
    // Calculate average distance between guests
    const avgDistance = pairCount > 0 ? totalDistance / pairCount : 0;
    
    tableStats[tableId] = {
      count: guests.length,
      minAge,
      maxAge,
      ageRange,
      avgAge,
      maxDistance,
      avgDistance
    };
  });
  
  // Sort tables by ID for consistent display
  const sortedTables = Object.keys(tableGroups).sort();

  // Calculate table counts and statistics
  const tableCounts = {};
  const tableAges = {};
  
  rsvps.forEach(rsvp => {
    if (!rsvp.table) return;
    
    // Count each guest
    tableCounts[rsvp.table] = (tableCounts[rsvp.table] || 0) + 1;
    
    // Track ages for each table
    if (!tableAges[rsvp.table]) {
      tableAges[rsvp.table] = [];
    }
    tableAges[rsvp.table].push(parseInt(rsvp.age));
  });
  
  // Calculate age stats for each table
  const tableStatsForAges = {};
  Object.entries(tableAges).forEach(([table, ages]) => {
    const avgAge = Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    const ageRange = maxAge - minAge;
    
    tableStatsForAges[table] = {
      avgAge,
      minAge,
      maxAge,
      ageRange
    };
  });

  // Count tables with valid/invalid sizes
  const validTables = Object.entries(tableCounts).filter(([_, count]) => count >= 4 && count <= 6).length;
  const smallTables = Object.entries(tableCounts).filter(([_, count]) => count < 4).length;
  const largeTables = Object.entries(tableCounts).filter(([_, count]) => count > 6).length;
  const totalTables = Object.keys(tableCounts).length;

  const allTablesValid = smallTables === 0 && largeTables === 0;
  
  // Check if we have enough guests for valid tables
  const notEnoughGuests = rsvps.length > 0 && rsvps.length < 4;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">All Dinner RSVPs</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh from Relays
              </>
            )}
          </button>
          <Link 
            to="/"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
          >
            Back to RSVP Form
          </Link>
        </div>
      </div>

      {/* Table summary */}
      <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
        <h3 className="text-lg font-semibold text-indigo-800 mb-2">Tables Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white p-3 rounded shadow">
            <span className="font-medium">Total Tables:</span> {totalTables}
          </div>
          <div className="bg-white p-3 rounded shadow">
            <span className="font-medium">Valid Tables (4-6 guests):</span> {validTables}
          </div>
          <div className={`bg-white p-3 rounded shadow ${!allTablesValid ? 'text-red-600 font-bold' : ''}`}>
            <span className="font-medium">Invalid Tables:</span> {smallTables + largeTables}
          </div>
        </div>
        
        {notEnoughGuests ? (
          <div className="mt-3 p-3 bg-yellow-100 text-yellow-800 rounded">
            <svg className="inline w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Not enough guests to create valid tables. Minimum 4 guests required.
          </div>
        ) : !allTablesValid ? (
          <div className="mt-3 p-3 bg-red-100 text-red-800 rounded">
            <svg className="inline w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Some tables don't have 4-6 guests. Click "Recalculate Tables" to fix.
          </div>
        ) : null}
      </div>

      <div className="flex justify-between mb-6">
        <button
          onClick={handleReassignTables}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isReassigning || rsvps.length < 4}
        >
          {isReassigning ? 'Recalculating...' : 'Recalculate Tables'}
        </button>
        
        <div className="relative">
          <input
            type="text"
            placeholder="Search names or locations..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
          />
          <svg
            className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* RSVPs list */}
      {sortedRsvps.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No RSVPs found.
          {filter && ' Try adjusting your search.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => setSortBy('name')}
                >
                  Name {sortBy === 'name' && '↓'}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => setSortBy('age')}
                >
                  Age {sortBy === 'age' && '↓'}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => setSortBy('location')}
                >
                  Location {sortBy === 'location' && '↓'}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => setSortBy('table')}
                >
                  Table {sortBy === 'table' && '↓'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table Info</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRsvps.map((rsvp, index) => {
                const count = tableCounts[rsvp.table] || 0;
                let sizeClass;
                if (count < 4) sizeClass = 'text-red-600';
                else if (count > 6) sizeClass = 'text-red-600';
                else sizeClass = 'text-green-600';
                
                // Age cohort info
                const stats = tableStatsForAges[rsvp.table];
                const ageInfo = stats 
                  ? `Ages ${stats.minAge}-${stats.maxAge}`
                  : '';
                  
                return (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rsvp.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rsvp.age}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rsvp.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                        {rsvp.table || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={sizeClass}>
                        {count} guests
                      </span>
                      <span className="text-xs text-gray-500 ml-1">
                        ({ageInfo})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-500">
        <p>Total RSVPs: {rsvps.length}</p>
        {filter && <p>Filtered Results: {sortedRsvps.length}</p>}
        <p className="text-indigo-500 mt-2">Synchronized with Nostr Relay Network</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-5 mb-8">
        <h2 className="text-xl font-semibold mb-4">Table Statistics Overview</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guests</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age Range</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Age</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Distance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Distance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTables.map(tableId => (
                <tr key={`stats-${tableId}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{tableId}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{tableStats[tableId].count}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {tableStats[tableId].minAge} - {tableStats[tableId].maxAge} 
                    <span className="ml-1 text-gray-500">({tableStats[tableId].ageRange} yrs)</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{tableStats[tableId].avgAge.toFixed(1)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {tableStats[tableId].maxDistance.toFixed(1)} mi
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {tableStats[tableId].avgDistance.toFixed(1)} mi
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {sortedTables.map(tableId => (
        <div key={tableId} className="bg-white rounded-lg shadow-md p-5 mb-6">
          <div 
            className="flex justify-between items-center cursor-pointer"
            onClick={() => setExpandedTable(expandedTable === tableId ? null : tableId)}
          >
            <h2 className="text-lg font-semibold">{tableId} ({tableGroups[tableId].length} guests)</h2>
            <div className="text-sm text-gray-600 flex items-center">
              <span className="mr-4">
                Ages: {tableStats[tableId].minAge}-{tableStats[tableId].maxAge} 
                <span className="ml-1 text-gray-500">({tableStats[tableId].ageRange} yrs)</span>
              </span>
              <span className="mr-4">
                Avg Distance: {tableStats[tableId].avgDistance.toFixed(1)} mi
              </span>
              <svg className={`w-5 h-5 transition-transform ${expandedTable === tableId ? 'transform rotate-180' : ''}`} 
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {expandedTable === tableId && (
            <div className="mt-4">
              <div className="mb-4 p-3 bg-blue-50 rounded-md">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Table Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Age Range: <span className="font-medium">{tableStats[tableId].minAge}-{tableStats[tableId].maxAge} years</span></p>
                    <p className="text-sm text-gray-600">Average Age: <span className="font-medium">{tableStats[tableId].avgAge.toFixed(1)} years</span></p>
                    <p className="text-sm text-gray-600">Age Spread: <span className="font-medium">{tableStats[tableId].ageRange} years</span></p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Max Distance: <span className="font-medium">{tableStats[tableId].maxDistance.toFixed(1)} miles</span></p>
                    <p className="text-sm text-gray-600">Avg Distance: <span className="font-medium">{tableStats[tableId].avgDistance.toFixed(1)} miles</span></p>
                    <p className="text-sm text-gray-600">Guest Count: <span className="font-medium">{tableStats[tableId].count}</span></p>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tableGroups[tableId].map((rsvp, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">{rsvp.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{rsvp.age}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{rsvp.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default RSVPList; 