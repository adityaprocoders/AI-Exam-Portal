
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2mCfaYxxShG6pDmBxm61hqpoEqCN63Zk",
  authDomain: "claim-3b5c0.firebaseapp.com",
  databaseURL: "https://claim-3b5c0-default-rtdb.firebaseio.com",
  projectId: "claim-3b5c0",
  storageBucket: "claim-3b5c0.firebasestorage.app",
  messagingSenderId: "12476778425",
  appId: "1:12476778425:web:dc9d094b489237ca5b5868"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the Firestore instance
export const db = getFirestore(app);