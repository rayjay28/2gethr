# Safe Link - Deployment & Publishing Guide

## Table of Contents
1. [Admin Portal Access](#admin-portal-access)
2. [Web App Deployment (Vercel)](#web-app-deployment)
3. [Google Play Store Publishing](#google-play-store-publishing)
4. [Pre-Launch Checklist](#pre-launch-checklist)

---

## Admin Portal Access

### First-Time Setup (Create Super Admin)

1. **Navigate to Setup Page**
   ```
   https://your-domain.com/admin/setup
   ```

2. **Create Super Admin Account**
   - Enter your email address
   - Enter your full name
   - Create a strong password (min 8 chars, uppercase, lowercase, number)
   - Click "Create Super Admin Account"

3. **Important**: This setup page only works ONCE. After the first admin is created, it will redirect to login.

### Regular Admin Login

1. **Navigate to Admin Login**
   ```
   https://your-domain.com/admin/login
   ```

2. **Enter Credentials**
   - Email: Your admin email
   - Password: Your admin password

3. **Admin Dashboard**
   After login, you'll see:
   - `/admin` - Main dashboard with stats
   - `/admin/users` - User management
   - `/admin/tickets` - Support tickets
   - `/admin/subscriptions` - Subscription management

### Admin Roles

| Role | Permissions |
|------|-------------|
| SUPER_ADMIN | Full access to all features |
| SUPPORT_ADMIN | User lookup, ticket management |
| BILLING_ADMIN | Subscription management, refunds |
| TRUST_SAFETY | Location controls, risk flags, account actions |
| ANALYST | Read-only dashboard and reports |

---

## Web App Deployment

### Deploy to Vercel (Recommended)

1. **Click "Publish" in v0**
   - Top right corner of the v0 interface
   - Select "Deploy to Vercel"

2. **Configure Environment Variables**
   Already configured via integrations:
   - `DATABASE_URL` - Neon PostgreSQL connection
   - `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage

   Add these manually in Vercel Dashboard > Settings > Environment Variables:
   ```
   JWT_SECRET=<generate-a-64-char-random-string>
   ADMIN_JWT_SECRET=<generate-a-different-64-char-random-string>
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

3. **Generate Secure Secrets**
   ```bash
   # Run in terminal to generate secrets
   openssl rand -base64 48
   ```

4. **Custom Domain (Optional)**
   - Vercel Dashboard > Settings > Domains
   - Add your custom domain
   - Update DNS records as instructed

---

## Google Play Store Publishing

Since Safe Link is built as a Next.js web app, you have **three options** for Google Play Store:

### Option 1: Progressive Web App (PWA) with TWA (Recommended)

**Trusted Web Activity (TWA)** wraps your web app in an Android shell.

1. **Make the web app PWA-ready**
   
   Create `/public/manifest.json`:
   ```json
   {
     "name": "Safe Link",
     "short_name": "SafeLink",
     "description": "Family coordination and safety app",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#0d9488",
     "theme_color": "#0d9488",
     "icons": [
       {
         "src": "/icons/icon-192.png",
         "sizes": "192x192",
         "type": "image/png"
       },
       {
         "src": "/icons/icon-512.png",
         "sizes": "512x512",
         "type": "image/png"
       }
     ]
   }
   ```

2. **Use Bubblewrap CLI**
   ```bash
   npm install -g @aspect-dev/aspect-cli
   npx @nicolo-ribaudo/aspect-cli init --manifest https://your-domain.com/manifest.json
   ```

3. **Generate APK/AAB**
   ```bash
   npx @nicolo-ribaudo/aspect-cli build
   ```

4. **Submit to Play Store**
   - Create Google Play Developer account ($25 one-time fee)
   - Upload AAB file
   - Complete store listing

**Pros**: Fastest path, automatic updates, small app size
**Cons**: Requires internet connection

### Option 2: Capacitor Wrapper

Convert the web app to a native Android app:

1. **Install Capacitor**
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "Safe Link" com.safelink.app
   ```

2. **Build and Sync**
   ```bash
   npm run build
   npx cap add android
   npx cap sync
   ```

3. **Open in Android Studio**
   ```bash
   npx cap open android
   ```

4. **Build Release APK**
   - Android Studio > Build > Generate Signed Bundle/APK

**Pros**: Access to native features (push notifications, camera)
**Cons**: Requires maintaining Android project

### Option 3: React Native Rebuild (Most Work)

For a fully native experience, rebuild the mobile UI in React Native:

1. **Create React Native Project**
   ```bash
   npx create-expo-app SafeLinkMobile
   ```

2. **Reuse Backend**
   - All `/api/*` routes work as-is
   - Reuse `lib/` services and utilities
   - Only rebuild UI components

3. **Build for Android**
   ```bash
   eas build --platform android
   ```

**Pros**: Best performance, full native experience
**Cons**: Significant development time

### Recommended Approach

| Timeline | Approach |
|----------|----------|
| Launch ASAP | TWA (Option 1) - 1-2 days |
| 2-4 weeks | Capacitor (Option 2) |
| 2-3 months | React Native (Option 3) |

---

## Pre-Launch Checklist

### Database
- [ ] Run cleanup script: `005-cleanup-test-data.sql`
- [ ] Verify production database connection
- [ ] Enable connection pooling in Neon

### Security
- [ ] Generate production JWT secrets
- [ ] Set `NODE_ENV=production`
- [ ] Review CORS settings
- [ ] Enable rate limiting (add middleware)

### Admin
- [ ] Create production super admin account
- [ ] Remove `/admin/setup` route after first admin created (optional)
- [ ] Set up admin team accounts

### Monitoring
- [ ] Enable Vercel Analytics
- [ ] Set up error tracking (Sentry recommended)
- [ ] Configure uptime monitoring

### Legal
- [ ] Terms of Service page
- [ ] Privacy Policy page
- [ ] COPPA compliance (for children's data)
- [ ] GDPR compliance (if serving EU users)

### App Store
- [ ] Create app icons (192px, 512px)
- [ ] Prepare screenshots (phone + tablet)
- [ ] Write store description
- [ ] Set up Google Play Developer account

---

## Quick Commands

```bash
# Clean test data before launch
# Execute 005-cleanup-test-data.sql via v0

# Generate JWT secrets
openssl rand -base64 48

# Check deployment status
vercel --prod

# View production logs
vercel logs --prod
```

---

## Support

For issues or questions:
- Check the user manuals in `/docs/`
- Review API documentation
- Contact support via admin ticket system
