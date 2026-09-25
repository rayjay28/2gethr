import admin from 'firebase-admin'

// Initialize Firebase Admin SDK
const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  console.log('❌ Firebase credentials missing:')
  console.log('  FIREBASE_PROJECT_ID:', projectId ? '✓ Set' : '✗ Missing')
  console.log('  FIREBASE_CLIENT_EMAIL:', clientEmail ? '✓ Set' : '✗ Missing')
  console.log('  FIREBASE_PRIVATE_KEY:', privateKey ? '✓ Set' : '✗ Missing')
  process.exit(1)
}

// Initialize the app if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })
}

console.log('✓ Firebase Admin SDK initialized')
console.log('  Project ID:', projectId)
console.log('  Client Email:', clientEmail)

async function testFirebasePush() {
  console.log('\n📱 Testing Firebase Cloud Messaging...\n')

  // Test 1: Verify credentials work by getting the messaging instance
  try {
    const messaging = admin.messaging()
    console.log('✓ Firebase Messaging instance created')
  } catch (error) {
    console.log('❌ Failed to create messaging instance:', error)
    return
  }

  // Test 2: Send a test message to a topic (this will succeed even without subscribers)
  try {
    const topicMessage = {
      topic: 'test-topic',
      notification: {
        title: 'Test Notification',
        body: 'This is a test notification from Togethr',
      },
      data: {
        type: 'TEST',
        timestamp: new Date().toISOString(),
      },
    }

    const topicResponse = await admin.messaging().send(topicMessage)
    console.log('✓ Topic message sent successfully')
    console.log('  Message ID:', topicResponse)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.log('⚠ Topic message test:', err.message)
  }

  // Test 3: Try to send to a dummy token (will fail but confirms API is working)
  try {
    const testMessage = {
      token: 'test-device-token-that-does-not-exist',
      notification: {
        title: 'Test Push',
        body: 'Testing Firebase push notifications',
      },
    }

    await admin.messaging().send(testMessage)
    console.log('✓ Token message sent (unexpected)')
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err.code === 'messaging/invalid-registration-token' || 
        err.code === 'messaging/registration-token-not-registered') {
      console.log('✓ Firebase API is working (expected token error)')
      console.log('  Error code:', err.code)
    } else {
      console.log('❌ Unexpected error:', err.message)
    }
  }

  // Test 4: Validate a batch of messages (dry run)
  try {
    const messages = [
      {
        notification: { title: 'Task Reminder', body: 'You have a task due today' },
        topic: 'task-reminders',
      },
      {
        notification: { title: 'Event Alert', body: 'Soccer practice in 30 minutes' },
        topic: 'event-alerts',
      },
      {
        notification: { title: 'Location Alert', body: 'Emma arrived at school' },
        topic: 'location-alerts',
      },
    ]

    const dryRunResponse = await admin.messaging().sendEach(messages, true) // dry run = true
    console.log('✓ Dry run batch test completed')
    console.log('  Success count:', dryRunResponse.successCount)
    console.log('  Failure count:', dryRunResponse.failureCount)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.log('⚠ Dry run batch test:', err.message)
  }

  console.log('\n✅ Firebase Push Notification Tests Complete!')
  console.log('\nTo receive actual notifications:')
  console.log('1. Go to Settings > Notifications in the app')
  console.log('2. Enable push notifications')
  console.log('3. Grant browser permission')
  console.log('4. Your device token will be saved')
  console.log('5. Create a task or event to trigger a real notification')
}

testFirebasePush().catch(console.error)
