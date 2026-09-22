// ============================================================
//  Flora — Firebase Configuration
//  Paste your Firebase SDK configuration here.
// ============================================================
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDQXJZKu7oDsUUlsHlRPWE6RfgCApZ3Lts",
  authDomain: "flora-91d3e.firebaseapp.com",
  projectId: "flora-91d3e",
  storageBucket: "flora-91d3e.firebasestorage.app",
  messagingSenderId: "780458657637",
  appId: "1:780458657637:web:6c80e387a9579ed835038c",
  measurementId: "G-CRP9QKPXGQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exporting config globally for other scripts
window.FLORA_FIREBASE_CONFIG = firebaseConfig;
