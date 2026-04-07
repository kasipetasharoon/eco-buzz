// js/firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyBix73it6aCuVUkXIam0leJT18uh0x6CIE",
    authDomain: "eco-buzz-b2f33.firebaseapp.com",
    databaseURL: "https://eco-buzz-b2f33-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "eco-buzz-b2f33",
    storageBucket: "eco-buzz-b2f33.firebasestorage.app",
    messagingSenderId: "515658514359",
    appId: "1:515658514359:web:97610624ccb3f826913232",
    measurementId: "G-VWVVC6WE5J"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Make 'db' global so other files can use it
window.db = firebase.database();
console.log("Firebase Connected");
