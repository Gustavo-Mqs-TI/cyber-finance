/* =========================================================
   FINANÇA — Configuração do Firebase
   Inicializa o SDK e expõe auth + db globalmente
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAH9IoRx1g3byNjBr0BYBpLRXzmEQMiJdQ",
  authDomain: "cyber-finance-58dc1.firebaseapp.com",
  projectId: "cyber-finance-58dc1",
  storageBucket: "cyber-finance-58dc1.firebasestorage.app",
  messagingSenderId: "159965033336",
  appId: "1:159965033336:web:69b5a62dbb7766da218e8d",
  measurementId: "G-V5DL6GPE1B",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Expõe globalmente pra ser usado por script.js e demais módulos
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDB = db;
window.firebaseReady = true;

// Avisa quem estiver esperando
window.dispatchEvent(new Event("firebase-ready"));

console.log("🔥 Firebase inicializado com sucesso");
