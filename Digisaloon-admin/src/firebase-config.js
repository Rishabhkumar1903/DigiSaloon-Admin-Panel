import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyDo6Eij8Z22BE2ZptKwsiw9CNfGSBN9nSw",
  authDomain: "digitalsaloon-bad62.firebaseapp.com",
  projectId: "digitalsaloon-bad62",
  storageBucket: "digitalsaloon-bad62.firebasestorage.app",
  messagingSenderId: "162424572480",
  appId: "1:162424572480:web:4a68bd31ba395db910eda5",
  measurementId: "G-V5RDK4WPKT"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);