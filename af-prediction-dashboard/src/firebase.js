// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your Firebase SDK config (from Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyBXqXyAy14XZr7qNwmxeYdX0tDb12iMJ34",
  authDomain: "atrial-fibrillation-aa3fc.firebaseapp.com",
  projectId: "atrial-fibrillation-aa3fc",
  storageBucket: "atrial-fibrillation-aa3fc.firebasestorage.app",
  messagingSenderId: "109870362553",
  appId: "1:109870362553:web:c189fe743e00f4866b9068",
  measurementId: "G-Y64HM014VB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services for use in your app
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
