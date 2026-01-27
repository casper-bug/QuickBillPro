# Firebase Configuration Guide for QuickBillPro

This guide will help you set up Firebase Authentication and Firestore to enable cloud sync features in QuickBillPro.

## Prerequisites

- A Google account
- Access to the [Firebase Console](https://console.firebase.google.com/)

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter your project name (e.g., "QuickBillPro")
4. (Optional) Enable Google Analytics for your project
5. Click **"Create project"**
6. Wait for the project to be created, then click **"Continue"**

## Step 2: Register Your Web App

1. In your Firebase project dashboard, click the **Web icon** (`</>`) to add a web app
2. Register your app with a nickname (e.g., "QuickBillPro Web")
3. Check **"Also set up Firebase Hosting"** if you plan to host on Firebase (optional)
4. Click **"Register app"**
5. You'll see your Firebase configuration object - **keep this page open**, you'll need these values

Your config will look like this:
```javascript
{
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:..."
}
```

## Step 3: Enable Authentication Methods

### Enable Email/Password Authentication

1. In the Firebase Console, click **"Authentication"** from the left sidebar
2. Click **"Get started"** if this is your first time
3. Go to the **"Sign-in method"** tab
4. Click on **"Email/Password"**
5. Toggle **"Enable"** to ON
6. Click **"Save"**

### Enable Google Sign-In

1. In the **"Sign-in method"** tab, click on **"Google"**
2. Toggle **"Enable"** to ON
3. Select a **"Project support email"** from the dropdown
4. Click **"Save"**

### Enable Phone Authentication

1. In the **"Sign-in method"** tab, click on **"Phone"**
2. Toggle **"Enable"** to ON
3. Click **"Save"**

**Important for Phone Auth:**
- You need to add your domain to the authorized domains list
- For localhost testing: Firebase automatically allows `localhost`
- For production: Add your production domain in **Authentication > Settings > Authorized domains**

## Step 4: Set Up Cloud Firestore

1. In the Firebase Console, click **"Firestore Database"** from the left sidebar
2. Click **"Create database"**
3. Choose a starting mode:
   - **Production mode**: Secure by default (recommended)
   - **Test mode**: Open for testing (less secure)
4. Select a Cloud Firestore location (choose one closest to your users)
5. Click **"Enable"**

### Configure Firestore Security Rules

For production, you should set up proper security rules. Here's a recommended configuration:

1. Go to **Firestore Database > Rules** tab
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Click **"Publish"**

**Note:** These rules ensure users can only access their own data. Anonymous users won't be able to sync data (by design).

## Step 5: Update Your QuickBillPro Configuration

1. Open `index.html` in your text editor
2. Find the Firebase Configuration section (around line 1536):

```javascript
window.__firebase_config = JSON.stringify({
    apiKey: "AIzaSyAyX3Y9TJaTW5HDz0Hb1Z_o6YmpucB9fqc",
    authDomain: "quickbill-33bf7.firebaseapp.com",
    projectId: "quickbill-33bf7",
    storageBucket: "quickbill-33bf7.firebasestorage.app",
    messagingSenderId: "749941620593",
    appId: "1:749941620593:web:4ae8ba14e6b5291dfd00d0"
});
```

3. Replace the values with your own Firebase configuration from Step 2:

```javascript
window.__firebase_config = JSON.stringify({
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
});
```

4. Save the file

## Step 6: Test the Setup

1. Open `index.html` in a web browser (or deploy to a web server)
2. Navigate to **Settings**
3. You should see the **"Cloud Sync (Optional)"** section
4. Test the authentication methods:

### Test Email/Password:
- Enter an email and password
- Click **"Sign Up"** to create an account
- You should see a success message

### Test Google Sign-In:
- Click **"Sign in with Google"**
- Select your Google account
- Authorize the app

### Test Phone Authentication:
- Click the **"Phone"** tab
- Enter your phone number with country code (e.g., +1234567890)
- Click **"Send Code"**
- Enter the 6-digit verification code received via SMS
- Click **"Verify"**

### Test Data Sync:
- Once signed in, click **"Sync Data to Cloud"**
- Check Firestore Database in Firebase Console - you should see a new document under `users/{userId}`
- Try loading data from another device or browser

## Troubleshooting

### Common Issues:

**"Firebase authentication error: network-request-failed"**
- Check your internet connection
- Verify your Firebase configuration is correct
- Make sure your domain is in the authorized domains list

**"reCAPTCHA init error" when using phone auth**
- Make sure you're not blocking third-party cookies
- Ensure your domain is authorized in Firebase Console
- Try using a different browser

**"Permission denied" when syncing data**
- Check your Firestore security rules
- Make sure you're signed in (not using anonymous/demo mode)
- Verify the user is authenticated

**Phone verification code not received**
- Check that Phone authentication is enabled in Firebase
- Verify the phone number format includes country code
- Some countries/carriers may have restrictions
- Check Firebase Console > Authentication > Usage for any errors

### Testing Locally

When testing on `localhost`, Firebase automatically allows it as an authorized domain. For production:

1. Go to **Authentication > Settings > Authorized domains**
2. Add your production domain (e.g., `yourapp.com`)
3. Click **"Add domain"**

## Data Structure in Firestore

When a user syncs data, it's stored in Firestore with this structure:

```
users/
  └── {userId}/
       ├── orders: "[JSON array string]"
       ├── stock: "[JSON array string]"
       ├── notes: "[JSON array string]"
       ├── companyDetails: "{JSON object string}"
       └── lastSync: "2024-01-27T16:00:00.000Z"
```

## Security Best Practices

1. **Never commit Firebase config with sensitive data** - Use environment variables for production
2. **Keep Firebase SDK up to date** - Check for updates regularly
3. **Use strong security rules** - Only allow users to access their own data
4. **Enable App Check** (optional) - Add an extra layer of security to prevent abuse
5. **Monitor usage** - Check Firebase Console for unusual activity
6. **Set up budget alerts** - Avoid unexpected charges

## Cost Considerations

Firebase has a free tier (Spark Plan) that includes:
- **Authentication**: Unlimited users
- **Firestore**: 1 GB storage, 50K reads/day, 20K writes/day
- **Hosting**: 10 GB storage, 360 MB/day transfer

For most small to medium businesses, the free tier should be sufficient. Monitor your usage in Firebase Console.

## Support

If you encounter issues:
1. Check the [Firebase Documentation](https://firebase.google.com/docs)
2. Visit [Stack Overflow - Firebase](https://stackoverflow.com/questions/tagged/firebase)
3. Review the [Firebase Status Dashboard](https://status.firebase.google.com/)

## Additional Resources

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Cloud Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Firebase Phone Authentication](https://firebase.google.com/docs/auth/web/phone-auth)
