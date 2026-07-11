
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
 const firebaseConfig = {
    apiKey: "AIzaSyAi1P7aNFujQkwMAV7gtLKcQ_Rk4rR5Sqs",
    authDomain: "ai-mock-test-1bc80.firebaseapp.com",
    databaseURL: "https://ai-mock-test-1bc80-default-rtdb.firebaseio.com",
    projectId: "ai-mock-test-1bc80",
    storageBucket: "ai-mock-test-1bc80.firebasestorage.app",
    messagingSenderId: "741109659244",
    appId: "1:741109659244:web:6366b124def5e1114eca49",
    measurementId: "G-H2B8P4DPJM"
  };


// Initialize Firebase
const app = initializeApp(firebaseConfig); 
export const db = getDatabase(app);
