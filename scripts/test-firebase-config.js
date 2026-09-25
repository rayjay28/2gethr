// Simple Firebase configuration verification test

console.log('=== Firebase Configuration Test ===\n');

console.log('Environment Variables Check:');
console.log('- FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? `✓ Set (${process.env.FIREBASE_PROJECT_ID})` : '✗ Missing');
console.log('- FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? `✓ Set (${process.env.FIREBASE_CLIENT_EMAIL})` : '✗ Missing');
console.log('- FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? `✓ Set (${process.env.FIREBASE_PRIVATE_KEY.substring(0, 50)}...)` : '✗ Missing');

console.log('');

const allSet = process.env.FIREBASE_PROJECT_ID && 
               process.env.FIREBASE_CLIENT_EMAIL && 
               process.env.FIREBASE_PRIVATE_KEY;

if (allSet) {
  console.log('=== Firebase Configuration: COMPLETE ===');
  console.log('');
  console.log('Firebase Admin SDK will initialize with:');
  console.log({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKeySet: true
  });
  console.log('');
  console.log('Push notifications are ready to be sent when:');
  console.log('1. Users enable notifications in the app');
  console.log('2. Their device tokens are registered');
  console.log('3. Events trigger notifications (geofence, reminders, etc.)');
} else {
  console.log('=== Firebase Configuration: INCOMPLETE ===');
  console.log('Please add the missing environment variables in Settings > Vars');
}
