import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

async function testGeofencing() {
  console.log('=== GEOFENCE SIMULATION TEST ===\n')

  // Step 1: Get a test user and family
  const users = await sql`
    SELECT u.id, u.email, u.first_name, fm.family_id, f.name as family_name
    FROM users u
    JOIN family_members fm ON u.id = fm.user_id
    JOIN families f ON fm.family_id = f.id
    WHERE u.is_active = true AND fm.is_active = true
    LIMIT 1
  `

  if (users.length === 0) {
    console.log('No users found. Please create a user first.')
    return
  }

  const testUser = users[0]
  console.log(`Test User: ${testUser.first_name} (${testUser.email})`)
  console.log(`Family: ${testUser.family_name}\n`)

  // Step 2: Check existing saved places with geofencing enabled
  let places = await sql`
    SELECT * FROM saved_places 
    WHERE family_id = ${testUser.family_id} AND geofence_enabled = true
  `

  // If no geofence-enabled places, create a test place
  if (places.length === 0) {
    console.log('No geofence-enabled places found. Creating test place...\n')
    
    const placeId = `place_test_${Date.now()}`
    await sql`
      INSERT INTO saved_places (
        id, family_id, name, address, latitude, longitude, radius,
        geofence_enabled, alert_on_arrival, alert_on_departure,
        icon, color, created_at, updated_at
      ) VALUES (
        ${placeId},
        ${testUser.family_id},
        'Test Location - Home',
        '123 Test Street, Test City',
        37.7749,
        -122.4194,
        100,
        true,
        true,
        true,
        'home',
        '#3B82F6',
        NOW(), NOW()
      )
    `
    
    places = await sql`SELECT * FROM saved_places WHERE id = ${placeId}`
    console.log(`Created test place: ${places[0].name}`)
  }

  const testPlace = places[0]
  console.log(`\nTest Place: ${testPlace.name}`)
  console.log(`  Location: ${testPlace.latitude}, ${testPlace.longitude}`)
  console.log(`  Radius: ${testPlace.radius} meters`)
  console.log(`  Alert on arrival: ${testPlace.alert_on_arrival}`)
  console.log(`  Alert on departure: ${testPlace.alert_on_departure}\n`)

  // Step 3: Simulate ARRIVAL (location within radius)
  console.log('--- SIMULATING ARRIVAL ---')
  const arrivalLat = testPlace.latitude + 0.0001 // Very close to center
  const arrivalLon = testPlace.longitude + 0.0001
  const arrivalDistance = calculateDistance(
    arrivalLat, arrivalLon,
    testPlace.latitude, testPlace.longitude
  )
  
  console.log(`Simulated position: ${arrivalLat}, ${arrivalLon}`)
  console.log(`Distance from center: ${arrivalDistance.toFixed(2)} meters`)
  console.log(`Inside geofence: ${arrivalDistance <= testPlace.radius ? 'YES' : 'NO'}`)

  // Record arrival ping
  const arrivalPingId = `ping_arrival_${Date.now()}`
  await sql`
    INSERT INTO location_pings (id, user_id, latitude, longitude, accuracy, timestamp)
    VALUES (${arrivalPingId}, ${testUser.id}, ${arrivalLat}, ${arrivalLon}, 10, NOW())
  `

  // Check last geofence event
  const lastEvents = await sql`
    SELECT event_type FROM geofence_events
    WHERE user_id = ${testUser.id} AND saved_place_id = ${testPlace.id}
    ORDER BY timestamp DESC
    LIMIT 1
  `
  const wasInside = lastEvents.length > 0 && lastEvents[0].event_type === 'ARRIVAL'
  console.log(`Previous state: ${wasInside ? 'INSIDE' : 'OUTSIDE'}`)

  // Record arrival if wasn't inside before
  if (arrivalDistance <= testPlace.radius && !wasInside && testPlace.alert_on_arrival) {
    const arrivalEventId = `gfe_arrival_${Date.now()}`
    await sql`
      INSERT INTO geofence_events (id, user_id, saved_place_id, event_type, latitude, longitude, timestamp)
      VALUES (${arrivalEventId}, ${testUser.id}, ${testPlace.id}, 'ARRIVAL', ${arrivalLat}, ${arrivalLon}, NOW())
    `
    console.log('ARRIVAL EVENT RECORDED!')

    // Create notification
    const notifId = `notif_arrival_${Date.now()}`
    await sql`
      INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
      VALUES (
        ${notifId},
        ${testUser.id},
        'LOCATION_ALERT',
        ${testUser.first_name + ' arrived'},
        ${testUser.first_name + ' has arrived at ' + testPlace.name},
        ${JSON.stringify({ userId: testUser.id, placeName: testPlace.name, eventType: 'ARRIVAL' })}::jsonb,
        NOW()
      )
    `
    console.log('ARRIVAL NOTIFICATION CREATED!')
  }

  // Step 4: Simulate DEPARTURE (location outside radius)
  console.log('\n--- SIMULATING DEPARTURE ---')
  const departureLat = testPlace.latitude + 0.01 // Far from center
  const departureLon = testPlace.longitude + 0.01
  const departureDistance = calculateDistance(
    departureLat, departureLon,
    testPlace.latitude, testPlace.longitude
  )
  
  console.log(`Simulated position: ${departureLat}, ${departureLon}`)
  console.log(`Distance from center: ${departureDistance.toFixed(2)} meters`)
  console.log(`Inside geofence: ${departureDistance <= testPlace.radius ? 'YES' : 'NO'}`)

  // Record departure ping
  const departurePingId = `ping_departure_${Date.now()}`
  await sql`
    INSERT INTO location_pings (id, user_id, latitude, longitude, accuracy, timestamp)
    VALUES (${departurePingId}, ${testUser.id}, ${departureLat}, ${departureLon}, 10, NOW())
  `

  // Check last geofence event after arrival
  const lastEventsAfterArrival = await sql`
    SELECT event_type FROM geofence_events
    WHERE user_id = ${testUser.id} AND saved_place_id = ${testPlace.id}
    ORDER BY timestamp DESC
    LIMIT 1
  `
  const nowInside = lastEventsAfterArrival.length > 0 && lastEventsAfterArrival[0].event_type === 'ARRIVAL'
  console.log(`Previous state: ${nowInside ? 'INSIDE' : 'OUTSIDE'}`)

  // Record departure if was inside before
  if (departureDistance > testPlace.radius && nowInside && testPlace.alert_on_departure) {
    const departureEventId = `gfe_departure_${Date.now()}`
    await sql`
      INSERT INTO geofence_events (id, user_id, saved_place_id, event_type, latitude, longitude, timestamp)
      VALUES (${departureEventId}, ${testUser.id}, ${testPlace.id}, 'DEPARTURE', ${departureLat}, ${departureLon}, NOW())
    `
    console.log('DEPARTURE EVENT RECORDED!')

    // Create notification
    const notifId = `notif_departure_${Date.now()}`
    await sql`
      INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
      VALUES (
        ${notifId},
        ${testUser.id},
        'LOCATION_ALERT',
        ${testUser.first_name + ' left'},
        ${testUser.first_name + ' has left ' + testPlace.name},
        ${JSON.stringify({ userId: testUser.id, placeName: testPlace.name, eventType: 'DEPARTURE' })}::jsonb,
        NOW()
      )
    `
    console.log('DEPARTURE NOTIFICATION CREATED!')
  }

  // Step 5: Summary - Show all geofence events
  console.log('\n--- GEOFENCE EVENTS SUMMARY ---')
  const allEvents = await sql`
    SELECT ge.*, sp.name as place_name
    FROM geofence_events ge
    JOIN saved_places sp ON ge.saved_place_id = sp.id
    WHERE ge.user_id = ${testUser.id}
    ORDER BY ge.timestamp DESC
    LIMIT 10
  `
  
  if (allEvents.length === 0) {
    console.log('No geofence events recorded.')
  } else {
    console.log(`Found ${allEvents.length} geofence events:`)
    for (const event of allEvents) {
      console.log(`  - ${event.event_type} at ${event.place_name} (${new Date(event.timestamp).toLocaleString()})`)
    }
  }

  // Step 6: Show notifications
  console.log('\n--- LOCATION NOTIFICATIONS ---')
  const notifications = await sql`
    SELECT * FROM notifications
    WHERE user_id = ${testUser.id} AND type = 'LOCATION_ALERT'
    ORDER BY created_at DESC
    LIMIT 5
  `
  
  if (notifications.length === 0) {
    console.log('No location notifications found.')
  } else {
    console.log(`Found ${notifications.length} location notifications:`)
    for (const notif of notifications) {
      console.log(`  - ${notif.title}: ${notif.body}`)
    }
  }

  console.log('\n=== GEOFENCE TEST COMPLETE ===')
}

testGeofencing().catch(console.error)
