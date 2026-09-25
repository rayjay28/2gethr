const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function sendTestPushNotification() {
  console.log('=== Firebase Push Notification Test ===\n');
  
  // Check configuration
  console.log('Configuration Check:');
  console.log('- FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Missing');
  console.log('- FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✓ Set' : '✗ Missing');
  console.log('- FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✓ Set' : '✗ Missing');
  console.log('');

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.log('❌ Firebase is not fully configured. Please add all required environment variables.');
    return;
  }

  // For a real test, you'd need a device token from a registered device
  // This test verifies Firebase Admin SDK initialization works
  
  try {
    // Verify the SDK is properly initialized by checking the app
    const app = admin.app();
    console.log('✓ Firebase Admin SDK initialized successfully');
    console.log('  Project ID:', app.options.credential.projectId || process.env.FIREBASE_PROJECT_ID);
    console.log('');
    
    // Create a test message (dry run - won't actually send without a valid token)
    const testMessage = {
      notification: {
        title: 'Togethr Test Notification',
        body: 'This is a test push notification from Togethr!',
      },
      data: {
        type: 'TEST',
        timestamp: new Date().toISOString(),
      },
      // This is a placeholder token - real tokens come from device registration
      token: 'test_device_token_placeholder',
    };

    console.log('Test Message Payload:');
    console.log(JSON.stringify(testMessage, null, 2));
    console.log('');

    // Try to validate the message (this will fail with invalid token, but proves SDK works)
    try {
      await admin.messaging().send(testMessage, true); // dry_run = true
      console.log('✓ Message validation passed (dry run)');
    } catch (sendError) {
      if (sendError.code === 'messaging/invalid-argument' || 
          sendError.code === 'messaging/registration-token-not-registered') {
        console.log('✓ Firebase SDK is working correctly');
        console.log('  (Token validation failed as expected - no real device token provided)');
      } else {
        throw sendError;
      }
    }

    console.log('');
    console.log('=== Firebase Push Notification Setup: VERIFIED ===');
    console.log('');
    console.log('To send real notifications:');
    console.log('1. Users must enable push notifications in the app');
    console.log('2. Their device tokens are stored in the database');
    console.log('3. Notifications are sent when events trigger (geofence, reminders, etc.)');
    
  } catch (error) {
    console.error('❌ Firebase Error:', error.message);
    if (error.code) {
      console.error('   Error Code:', error.code);
    }
  }
}

sendTestPushNotification();
