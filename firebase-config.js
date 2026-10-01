/* =========================================================
   FINANÇA — Configuração do Firebase
   Inicializa o SDK e expõe Auth + Firestore globalmente
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAH9IoRx1g3byNjBr0BYBpLRXzmEQMiJdQ",
  authDomain: "cyber-finance-58dc1.firebaseapp.com",
  projectId: "cyber-finance-58dc1",
  storageBucket: "cyber-finance-58dc1.firebasestorage.app",
  messagingSenderId: "159965033336",
  appId: "1:159965033336:web:69b5a62dbb7766da218e8d",
  measurementId: "G-V5DL6GPE1B"
};


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* =========================================================
   LOGIN
========================================================= */

window.fbLogin = async function (email, senha) {

  if (!email || !senha) {
    throw new Error("E-mail e senha são obrigatórios.");
  }

  const resultado = await signInWithEmailAndPassword(
    auth,
    email,
    senha
  );

  return resultado.user;
};


/* =========================================================
   CADASTRO
========================================================= */

window.fbCadastrar = async function (
  email,
  senha,
  nome
) {

  if (!email || !senha) {
    throw new Error("E-mail e senha são obrigatórios.");
  }

  const resultado =
    await createUserWithEmailAndPassword(
      auth,
      email,
      senha
    );

  const user = resultado.user;


  /* =======================================================
     SALVA O NOME DO USUÁRIO NO PERFIL DO FIREBASE
  ======================================================= */

  if (nome) {

    await updateProfile(user, {
      displayName: nome
    });

  }


  return user;
};


/* =========================================================
   RECUPERAÇÃO DE SENHA
========================================================= */

window.fbRecuperarSenha = async function (email) {

  if (!email) {
    throw new Error("E-mail é obrigatório.");
  }

  await sendPasswordResetEmail(
    auth,
    email
  );

};


/* =========================================================
   EXPÕE FIREBASE GLOBALMENTE
========================================================= */

window.firebaseApp = app;

window.firebaseAuth = auth;

window.firebaseDB = db;


/* =========================================================
   MARCA FIREBASE COMO PRONTO
========================================================= */

window.firebaseReady = true;


/* =========================================================
   AVISA O SCRIPT PRINCIPAL
========================================================= */

window.dispatchEvent(
  new Event("firebase-ready")
);


/* =========================================================
   DEBUG
========================================================= */

console.log(
  "🔥 Firebase inicializado com sucesso"
);

console.log(
  "🔥 Firebase Auth:",
  window.firebaseAuth
);

console.log(
  "🔥 Firebase Firestore:",
  window.firebaseDB
);

console.log(
  "🔥 fbLogin:",
  typeof window.fbLogin
);

console.log(
  "🔥 fbCadastrar:",
  typeof window.fbCadastrar
);

console.log(
  "🔥 fbRecuperarSenha:",
  typeof window.fbRecuperarSenha
);
