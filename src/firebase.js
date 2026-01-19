import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyD2a7zQXEx0iwZV4c_1y55zUafILgVAvL8",
  authDomain: "wrong-sms.firebaseapp.com",
  databaseURL: "https://wrong-sms-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "wrong-sms",
  storageBucket: "wrong-sms.firebasestorage.app",
  messagingSenderId: "701613407620",
  appId: "1:701613407620:web:f0c97e50a1e29954bd31d1",
  measurementId: "G-50QQ7Z6PK6"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
