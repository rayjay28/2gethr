// Geofence Simulation Test Script
// Tests the geofencing logic to verify arrivals and departures are detected correctly

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c // Distance in meters
}

// Check if a point is inside a geofence
function isInsideGeofence(userLat, userLon, geofenceLat, geofenceLon, radiusMeters) {
  const distance = calculateDistance(userLat, userLon, geofenceLat, geofenceLon)
  return {
    isInside: distance <= radiusMeters,
    distance: Math.round(distance),
    radius: radiusMeters
  }
}

// Simulate geofence event detection
function detectGeofenceEvent(previousLocation, currentLocation, geofence) {
  const wasInside = previousLocation 
    ? isInsideGeofence(previousLocation.lat, previousLocation.lon, geofence.lat, geofence.lon, geofence.radius).isInside
    : false
  
  const isNowInside = isInsideGeofence(currentLocation.lat, currentLocation.lon, geofence.lat, geofence.lon, geofence.radius)
  
  let event = null
  if (!wasInside && isNowInside.isInside) {
    event = 'ARRIVAL'
  } else if (wasInside && !isNowInside.isInside) {
    event = 'DEPARTURE'
  }
  
  return {
    event,
    wasInside,
    isNowInside: isNowInside.isInside,
    distance: isNowInside.distance,
    radius: geofence.radius
  }
}

// Test scenarios
console.log('========================================')
console.log('   TOGETHR GEOFENCE SIMULATION TEST')
console.log('========================================\n')

// Define test geofences (places)
const geofences = [
  { id: 'home', name: 'Home', lat: 40.7128, lon: -74.0060, radius: 100 },
  { id: 'school', name: 'Lincoln Elementary School', lat: 40.7200, lon: -74.0100, radius: 150 },
  { id: 'grandma', name: "Grandma's House", lat: 40.7300, lon: -74.0200, radius: 80 },
]

// Simulate a child's movement throughout the day
const childMovement = [
  { time: '7:00 AM', lat: 40.7128, lon: -74.0060, description: 'At home (inside geofence)' },
  { time: '7:30 AM', lat: 40.7135, lon: -74.0065, description: 'Leaving home (still inside)' },
  { time: '7:35 AM', lat: 40.7150, lon: -74.0080, description: 'Walking to school (outside home geofence)' },
  { time: '7:50 AM', lat: 40.7195, lon: -74.0095, description: 'Approaching school' },
  { time: '8:00 AM', lat: 40.7200, lon: -74.0100, description: 'Arrived at school (inside geofence)' },
  { time: '3:00 PM', lat: 40.7200, lon: -74.0100, description: 'Still at school' },
  { time: '3:15 PM', lat: 40.7220, lon: -74.0120, description: 'Left school' },
  { time: '3:45 PM', lat: 40.7295, lon: -74.0195, description: 'Approaching grandmas house' },
  { time: '4:00 PM', lat: 40.7300, lon: -74.0200, description: 'Arrived at grandmas (inside geofence)' },
  { time: '5:30 PM', lat: 40.7310, lon: -74.0210, description: 'Left grandmas' },
  { time: '6:00 PM', lat: 40.7128, lon: -74.0060, description: 'Back home' },
]

console.log('TEST GEOFENCES:')
console.log('---------------')
geofences.forEach(g => {
  console.log(`  - ${g.name}: (${g.lat}, ${g.lon}) radius: ${g.radius}m`)
})
console.log('')

console.log('SIMULATING CHILD MOVEMENT:')
console.log('--------------------------\n')

let previousLocation = null
const alerts = []

childMovement.forEach((location, index) => {
  console.log(`[${location.time}] ${location.description}`)
  console.log(`   Position: (${location.lat}, ${location.lon})`)
  
  // Check each geofence
  geofences.forEach(geofence => {
    const result = detectGeofenceEvent(
      previousLocation,
      { lat: location.lat, lon: location.lon },
      geofence
    )
    
    if (result.event) {
      const alertType = result.event === 'ARRIVAL' ? 'ARRIVED AT' : 'LEFT'
      const alert = {
        time: location.time,
        event: result.event,
        place: geofence.name,
        distance: result.distance
      }
      alerts.push(alert)
      
      console.log(`   >>> ALERT: ${alertType} ${geofence.name}! (distance: ${result.distance}m)`)
    }
  })
  
  console.log('')
  previousLocation = { lat: location.lat, lon: location.lon }
})

console.log('========================================')
console.log('   GEOFENCE ALERTS SUMMARY')
console.log('========================================\n')

if (alerts.length === 0) {
  console.log('No geofence alerts triggered.')
} else {
  console.log(`Total alerts triggered: ${alerts.length}\n`)
  alerts.forEach((alert, i) => {
    const icon = alert.event === 'ARRIVAL' ? '[ENTER]' : '[EXIT]'
    console.log(`${i + 1}. ${icon} ${alert.time} - ${alert.event} at ${alert.place}`)
  })
}

console.log('\n========================================')
console.log('   TEST RESULTS')
console.log('========================================\n')

// Verify expected alerts
const expectedAlerts = [
  { event: 'DEPARTURE', place: 'Home' },
  { event: 'ARRIVAL', place: 'Lincoln Elementary School' },
  { event: 'DEPARTURE', place: 'Lincoln Elementary School' },
  { event: 'ARRIVAL', place: "Grandma's House" },
  { event: 'DEPARTURE', place: "Grandma's House" },
  { event: 'ARRIVAL', place: 'Home' },
]

let passed = 0
let failed = 0

expectedAlerts.forEach((expected, i) => {
  const actual = alerts[i]
  if (actual && actual.event === expected.event && actual.place === expected.place) {
    console.log(`[PASS] Expected ${expected.event} at ${expected.place}`)
    passed++
  } else {
    console.log(`[FAIL] Expected ${expected.event} at ${expected.place}, got ${actual ? `${actual.event} at ${actual.place}` : 'nothing'}`)
    failed++
  }
})

console.log('\n----------------------------------------')
console.log(`TOTAL: ${passed} passed, ${failed} failed`)
console.log('----------------------------------------')

if (failed === 0) {
  console.log('\nGEOFENCING SYSTEM: WORKING CORRECTLY!')
} else {
  console.log('\nGEOFENCING SYSTEM: NEEDS ATTENTION')
}
