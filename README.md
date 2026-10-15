# Signed & Sealed — Ask the Law, Anonymously

An anonymous legal questions wall built with Vite, React, TypeScript, plain CSS, and Three.js.

## Features
- **3D Atmospheric Background**: Interactive Three.js scene with 90 floating parchment slips, brass torus rings, a 3D brass question mark, and scroll-reactive camera flight.
- **Masonry Question Wall**: Rotated lined-paper cards with red wax seals, live answer counters, 3D pointer tilt, category filtering, search, and answer status tabs.
- **Dossier Drawer**: Slide-in thread view with quote-reply support, anonymous slip styling, and keyboard navigation (`Enter` to send, `Shift+Enter` for newline, `Esc` to close).
- **Strict Anonymity**: Random aliases (e.g., *Quiet Heron 42*) generated and persisted in `sessionStorage` with anonymous IDs. No PII collected.
- **Theming & Accessibility**: Responsive layout, light/dark mode support with high-contrast palette tokens, and `prefers-reduced-motion` compliance.

---

## Connecting Firebase Firestore

The application includes dual-mode data persistence:
1. **Local Storage Fallback (Active by default)**: When Firebase is not configured, the app uses a resilient `localStorage` store (`unsigned:msgs3`) with cross-tab sync via the `storage` event.
2. **Firebase Firestore (Real-time Cloud Sync)**: Enables global real-time synchronization, anonymous authentication, and active peer presence.

### Connecting to Firebase in AI Studio / Google Cloud:
1. **Configuration File**:
   Create a `firebase-applet-config.json` file in the root directory (or set environment variables starting with `VITE_FIREBASE_` in `.env`):
   ```json
   {
     "apiKey": "YOUR_API_KEY",
     "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
     "projectId": "YOUR_PROJECT_ID",
     "storageBucket": "YOUR_PROJECT_ID.appspot.com",
     "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
     "appId": "YOUR_APP_ID"
   }
   ```

2. **Security Rules**:
   The included `firestore.rules` file enforces zero-trust rules for anonymous users:
   - Anyone authenticated (including anonymous sign-ins) can read messages and presence.
   - Questions are limited to 1–600 characters; answers are limited to 1–800 characters.
   - Updates and deletes are disallowed to preserve historical integrity.
   - Deploy rules via Firebase CLI or AI Studio integration:
     ```bash
     firebase deploy --only firestore:rules
     ```

3. **Anonymous Authentication**:
   In the [Firebase Console](https://console.firebase.google.com/) under **Authentication > Sign-in method**, enable **Anonymous** sign-in.
