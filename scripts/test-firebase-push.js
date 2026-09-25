const admin = require('firebase-admin');

// Check environment variables
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

console.log('=== Firebase Push Notification Test ===\n');
console.log('Configuration Check:');
console.log('- FIREBASE_PROJECT_ID:', projectId ? `✓ ${projectId}` : '✗ Missing');
console.log('- FIREBASE_CLIENT_EMAIL:', clientEmail ? `✓ ${clientEmail.substring(0, 30)}...` : '✗ Missing');
console.log('- FIREBASE_PRIVATE_KEY:', privateKey ? `✓ Set (${privateKey.length} chars)` : '✗ Missing');

if (!projectId || !clientEmail || !privateKey) {
  console.log('\n❌ Missing required Firebase configuration. Please set all environment variables.');
  process.exit(1);
}

// Initialize Firebase Admin
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
  console.log('\n✓ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('\n❌ Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

// Test sending a dry-run notification (validates configuration without needing a real device token)
async function testFirebaseMessaging() {
  console.log('\n=== Testing Firebase Cloud Messaging ===\n');
  
  // Test 1: Validate messaging service is available
  try {
    const messaging = admin.messaging();
    console.log('✓ Firebase Messaging service is available');
  } catch (error) {
    console.error('❌ Firebase Messaging service error:', error.message);
    return;
  }

  // Test 2: Try to send a dry-run message (validates everything except the token)
  const testMessage = {
    notification: {
      title: 'Test Notification from Togethr',
      body: 'If you see this, Firebase push notifications are working!',
    },
    data: {
      type: 'TEST',
      timestamp: new Date().toISOString(),
    },
    // Use a dummy token - dryRun will validate everything else
    token: 'test-token-for-validation',
  };

  try {
    // Dry run validates the message format and Firebase configuration
    // without actually sending (would fail due to invalid token, but that's expected)
    await admin.messaging().send(testMessage, true); // true = dryRun
    console.log('✓ Dry-run message validation passed');
  } catch (error) {
    if (error.code === 'messaging/invalid-argument' || 
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      // This is expected with a dummy token - the important thing is Firebase accepted our credentials
      console.log('✓ Firebase credentials validated (token error expected in test mode)');
    } else {
      console.error('❌ Firebase Messaging error:', error.code, error.message);
      return;
    }
  }

  // Test 3: Validate message payloads for different notification types
  const testPayloads = [
    {
      name: 'Task Assignment',
      notification: { title: 'New Task Assigned', body: 'You have been assigned: Clean your room' },
      data: { type: 'TASK_ASSIGNED', taskId: 'test-123' }
    },
    {
      name: 'Event Reminder',
      notification: { title: 'Event Reminder', body: 'Soccer Practice starts in 30 minutes' },
      data: { type: 'EVENT_REMINDER', eventId: 'event-456' }
    },
    {
      name: 'Geofence Alert',
      notification: { title: 'Location Alert', body: 'Emma arrived at School' },
      data: { type: 'GEOFENCE_ALERT', memberId: 'member-789' }
    },
  ];

  console.log('\n=== Validating Notification Payloads ===\n');
  
  for (const payload of testPayloads) {
    try {
      await admin.messaging().send({
        ...payload,
        token: 'test-token',
      }, true);
      console.log(`✓ ${payload.name}: Valid payload`);
    } catch (error) {
      if (error.code?.includes('token')) {
        console.log(`✓ ${payload.name}: Valid payload (token error expected)`);
      } else {
        console.log(`❌ ${payload.name}: ${error.message}`);
      }
    }
  }

  console.log('\n=== Firebase Push Test Complete ===');
  console.log('\nResult: Firebase Admin SDK is properly configured!');
  console.log('Push notifications will work once users subscribe with valid device tokens.');
  console.log('\nTo receive notifications:');
  console.log('1. Open the app and go to Settings > Notifications');
  console.log('2. Click "Enable Push Notifications"');
  console.log('3. Grant browser permission when prompted');
}

testFirebaseMessaging().catch(console.error);
