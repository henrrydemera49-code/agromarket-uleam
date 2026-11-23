// ═══════════════════════════════════════════════════════
// firebase-config.js
// Reemplaza los 6 valores con los datos de tu proyecto.
// Firebase Console → ⚙️ → Tu app web → SDK de Firebase
// ═══════════════════════════════════════════════════════

const firebaseConfig = { 
  apiKey : "AIzaSyA3WEGcqdsy0Cch1x7vkeufPvJhToL0c1A" , 
  authDomain : "agromarket-uleam-50108.firebaseapp.com" , 
  projectId : "agromarket-uleam-50108" , 
  storageBucket : "agromarket-uleam-50108.firebasestorage.app" , 
  messagingSenderId : "52411975792" , 
  appId : "1:52411975792:web:27c8147104ce1752910cb5" 
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

const DOMINIO = "@uleam.edu.ec";
