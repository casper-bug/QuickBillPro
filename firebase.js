// Firebase imports (using module syntax for direct browser use)
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    sendEmailVerification,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    collection
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Parse Firebase configuration
const firebaseConfig = JSON.parse(typeof window.__firebase_config !== 'undefined' ? window.__firebase_config : '{}');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global Firebase state
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseUserId = null;
window.isFirebaseReady = false;
window.firebaseUser = null;

// Global authentication functions
window.firebaseSignInWithEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            return { success: false, error: 'email-not-verified' };
        }
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

window.firebaseSignUpWithEmail = async (email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        await signOut(auth);
        return { success: true, emailVerificationSent: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

window.firebaseSignInWithGoogle = async () => {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return { success: true, user: result.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

window.firebaseSignOut = async () => {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

window.firebaseResetPassword = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

window.firebaseResendVerificationEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (userCredential.user.emailVerified) {
            return { success: true, alreadyVerified: true };
        }
        await sendEmailVerification(userCredential.user);
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// Sync functions for Firestore
window.syncDataToFirestore = async (firebaseUid) => {
    if (!firebaseUid || !db) return { success: false, error: 'No user or database' };

    try {
        // Always read from the stable local storage key so data isn't lost in
        // the Firebase-timeout fallback case.
        const localId = window.quickbillLocalUserId || firebaseUid;
        const userDoc = doc(db, 'users', firebaseUid);
        const lastSync = new Date().toISOString();
        // Record the timestamp before writing so the onSnapshot listener can
        // recognise this as our own write and skip applying it as a remote change.
        _ownSyncTimestamp = lastSync;
        const data = {
            orders: localStorage.getItem(`quickbill-${localId}-orders`) || '[]',
            stock: localStorage.getItem(`quickbill-${localId}-stock`) || '[]',
            notes: localStorage.getItem(`quickbill-${localId}-notes`) || '[]',
            companyDetails: localStorage.getItem(`quickbill-${localId}-companyDetails`) || '{}',
            lastSync: lastSync
        };

        await setDoc(userDoc, data);
        return { success: true };
    } catch (error) {
        console.error('Sync error:', error);
        return { success: false, error: error.message };
    }
};

window.loadDataFromFirestore = async (userId) => {
    if (!userId || !db) return { success: false, error: 'No user or database' };

    try {
        const userDoc = doc(db, 'users', userId);
        const docSnap = await getDoc(userDoc);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return { success: true, data };
        } else {
            return { success: false, error: 'No data found' };
        }
    } catch (error) {
        console.error('Load error:', error);
        return { success: false, error: error.message };
    }
};

// Track the lastSync timestamp we most recently wrote so onSnapshot can
// distinguish our own writes from changes made on another device.
let _ownSyncTimestamp = null;

// Holds the unsubscribe function for the real-time Firestore listener.
let _realtimeSyncUnsubscribe = null;

// Debounced auto-sync: triggered after every local data change
let autoSyncTimer = null;
window.scheduleAutoSync = () => {
    if (!window.firebaseUser || window.firebaseUser.isAnonymous) return;
    const uid = window.firebaseUserId;
    if (!uid) return;
    clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(async () => {
        const result = await window.syncDataToFirestore(uid);
        if (result.success) {
            console.log('Auto-sync completed');
            const lastSyncEl = document.getElementById('auth-last-sync');
            if (lastSyncEl) {
                lastSyncEl.textContent = 'Last synced: Just now';
            }
        } else {
            console.warn('Auto-sync failed:', result.error);
            if (typeof window.showToast === 'function') {
                window.showToast('⚠️ Cloud sync failed. Changes saved locally.');
            }
        }
    }, 3000);
};

// Sets up a real-time Firestore listener so changes pushed by another device
// are automatically applied on this device without any manual button press.
function setupRealtimeSync(firebaseUid) {
    // Cancel any existing listener first.
    if (_realtimeSyncUnsubscribe) {
        _realtimeSyncUnsubscribe();
        _realtimeSyncUnsubscribe = null;
    }

    const userDoc = doc(db, 'users', firebaseUid);
    let isFirstSnapshot = true;

    _realtimeSyncUnsubscribe = onSnapshot(userDoc, (docSnap) => {
        if (isFirstSnapshot) {
            // The first snapshot is always the current state on load — use it to
            // initialise our baseline so we do not treat it as a remote change.
            isFirstSnapshot = false;
            if (docSnap.exists()) {
                _ownSyncTimestamp = docSnap.data().lastSync || null;
            }
            return;
        }

        if (!docSnap.exists()) return;
        const data = docSnap.data();

        // If this update was written by this device, ignore it.
        if (!data.lastSync || data.lastSync === _ownSyncTimestamp) return;

        // A different device wrote newer data — apply it locally and refresh.
        console.log('Real-time sync: remote change detected, applying...');
        const localId = window.quickbillLocalUserId || firebaseUid;
        if (data.orders) localStorage.setItem(`quickbill-${localId}-orders`, data.orders);
        if (data.stock) localStorage.setItem(`quickbill-${localId}-stock`, data.stock);
        if (data.notes) localStorage.setItem(`quickbill-${localId}-notes`, data.notes);
        if (data.companyDetails) localStorage.setItem(`quickbill-${localId}-companyDetails`, data.companyDetails);

        // Update our baseline so a rapid second snapshot does not re-trigger.
        _ownSyncTimestamp = data.lastSync;

        const lastSyncEl = document.getElementById('auth-last-sync');
        if (lastSyncEl) lastSyncEl.textContent = 'Last synced: Just now';

        if (typeof window.showToast === 'function') {
            window.showToast('🔄 Data synced from another device!');
        }
        // Delay matches the toast display duration so the user can read the message
        // before the page refreshes to render the updated data.
        setTimeout(() => location.reload(), 1500);
    }, (error) => {
        console.warn('Real-time sync listener error:', error);
    });
}

// Firebase Authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.firebaseUserId = user.uid;
        window.firebaseUser = user;
        window.isFirebaseReady = true;
        console.log('Firebase user authenticated:', user.uid);
        console.log('Is anonymous:', user.isAnonymous);

        // Update UI
        if (typeof window.updateAuthUI === 'function') {
            window.updateAuthUI(user);
        }

        // Auto-load cloud data whenever a verified, non-anonymous user signs in
        if (!user.isAnonymous && user.emailVerified && typeof window.loadDataFromFirestore === 'function') {
            // Remember that this browser has had a verified named account (used for welcome-back)
            localStorage.setItem('quickbill-had-named-account', '1');
            try {
                const result = await window.loadDataFromFirestore(user.uid);
                if (result.success && result.data) {
                    // Write to the stable local key so initializeApp picks it up correctly
                    const localId = window.quickbillLocalUserId || user.uid;
                    if (result.data.orders) localStorage.setItem(`quickbill-${localId}-orders`, result.data.orders);
                    if (result.data.stock) localStorage.setItem(`quickbill-${localId}-stock`, result.data.stock);
                    if (result.data.notes) localStorage.setItem(`quickbill-${localId}-notes`, result.data.notes);
                    if (result.data.companyDetails) localStorage.setItem(`quickbill-${localId}-companyDetails`, result.data.companyDetails);
                    console.log('Cloud data written to local key:', localId);
                }
            } catch (e) {
                console.error('Auto-load from Firestore failed:', e);
            }
            // Start listening for changes pushed by other devices.
            setupRealtimeSync(user.uid);
        }

        // Trigger app initialization if load event already fired
        if (document.readyState === 'complete') {
            const event = new Event('firebase-ready');
            window.dispatchEvent(event);
        }
    } else {
        // Stop listening for remote changes when the user signs out.
        if (_realtimeSyncUnsubscribe) {
            _realtimeSyncUnsubscribe();
            _realtimeSyncUnsubscribe = null;
        }
        // Sign in anonymously (demo mode)
        signInAnonymously(auth)
            .then(() => {
                console.log('Firebase anonymous sign-in successful');
            })
            .catch((error) => {
                console.error('Firebase authentication error:', error);
                // Fall back to demo mode
                window.isFirebaseReady = false;
            });
    }
});
