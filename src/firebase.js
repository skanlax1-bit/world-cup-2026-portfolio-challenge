import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDergv1xbEZcifEokXJZeSsB-Ttd2GO4Vs",
  authDomain: "world-cup-portfolio-chal-40420.firebaseapp.com",
  databaseURL: "https://world-cup-portfolio-chal-40420-default-rtdb.firebaseio.com",
  projectId: "world-cup-portfolio-chal-40420",
  storageBucket: "world-cup-portfolio-chal-40420.firebasestorage.app",
  messagingSenderId: "799949850064",
  appId: "1:799949850064:web:3c1684c239a063e94ca5d5"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);