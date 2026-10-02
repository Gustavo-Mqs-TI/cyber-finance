/* =========================================================
   FINANÇA — Firebase Unificado
   Init + Auth + Firestore (CRUD)
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  writeBatch,
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
  measurementId: "G-V5DL6GPE1B",
};

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================================================
   AUTENTICAÇÃO
========================================================= */

async function fbCadastrar(email, senha, nome) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);

  if (nome) {
    await updateProfile(cred.user, { displayName: nome });
  }

  try {
    await setDoc(
      doc(db, "users", cred.user.uid, "perfil", "geral"),
      {
        nome: nome || "",
        email: email,
        criadoEm: new Date().toISOString(),
      }
    );
  } catch (e) {
    console.warn("Erro ao criar perfil no Firestore:", e);
  }

  return cred.user;
}

async function fbLogin(email, senha) {
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  return cred.user;
}

async function fbLogout() {
  await signOut(auth);
}

async function fbRecuperarSenha(email) {
  await sendPasswordResetEmail(auth, email);
}

function fbAoMudarUsuario(callback) {
  onAuthStateChanged(auth, callback);
}

/* =========================================================
   HELPERS DE REFERÊNCIA
========================================================= */

function fbUserRef(uid, ...path) {
  return doc(db, "users", uid, ...path);
}

function fbUserCol(uid, colecao) {
  return collection(db, "users", uid, colecao);
}

/* =========================================================
   DOCUMENTO ÚNICO (config, cores, perfil)
========================================================= */

async function fbCarregarDoc(uid, ...path) {
  if (!uid) return null;
  try {
    const snap = await getDoc(fbUserRef(uid, ...path));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("fbCarregarDoc erro:", e);
    return null;
  }
}

async function fbSalvarDoc(uid, dados, ...path) {
  if (!uid) return false;
  try {
    await setDoc(fbUserRef(uid, ...path), dados, { merge: true });
    return true;
  } catch (e) {
    console.warn("fbSalvarDoc erro:", e);
    return false;
  }
}

/* =========================================================
   COLEÇÃO (transacoes, criptos, parcelas, etc.)
========================================================= */

async function fbCarregarColecao(uid, colecao) {
  if (!uid) return [];
  try {
    const snap = await getDocs(fbUserCol(uid, colecao));
    const arr = [];
    snap.forEach((d) => {
      arr.push({ ...d.data(), _fbId: d.id });
    });
    return arr;
  } catch (e) {
    console.warn("fbCarregarColecao erro:", e);
    return [];
  }
}

async function fbAdicionarItem(uid, colecao, dados) {
  if (!uid) return null;
  try {
    const ref = await addDoc(fbUserCol(uid, colecao), dados);
    return ref.id;
  } catch (e) {
    console.warn("fbAdicionarItem erro:", e);
    return null;
  }
}

async function fbAtualizarItem(uid, colecao, docId, dados) {
  if (!uid || !docId) return false;
  try {
    await updateDoc(
      doc(db, "users", uid, colecao, docId),
      dados
    );
    return true;
  } catch (e) {
    console.warn("fbAtualizarItem erro:", e);
    return false;
  }
}

async function fbExcluirItem(uid, colecao, docId) {
  if (!uid || !docId) return false;
  try {
    await deleteDoc(doc(db, "users", uid, colecao, docId));
    return true;
  } catch (e) {
    console.warn("fbExcluirItem erro:", e);
    return false;
  }
}

async function fbSubstituirColecao(uid, colecao, itens) {
  if (!uid) return false;
  try {
    const snap = await getDocs(fbUserCol(uid, colecao));
    const batch = writeBatch(db);

    snap.forEach((d) => {
      batch.delete(d.ref);
    });

    itens.forEach((item) => {
      const ref = doc(fbUserCol(uid, colecao));
      const dados = { ...item };
      delete dados._fbId;
      batch.set(ref, dados);
    });

    await batch.commit();
    return true;
  } catch (e) {
    console.warn("fbSubstituirColecao erro:", e);
    return false;
  }
}

/* =========================================================
   EXPORTA GLOBALMENTE
========================================================= */

window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDB = db;

window.fbCadastrar = fbCadastrar;
window.fbLogin = fbLogin;
window.fbLogout = fbLogout;
window.fbRecuperarSenha = fbRecuperarSenha;
window.fbAoMudarUsuario = fbAoMudarUsuario;

window.fbCarregarDoc = fbCarregarDoc;
window.fbSalvarDoc = fbSalvarDoc;
window.fbCarregarColecao = fbCarregarColecao;
window.fbAdicionarItem = fbAdicionarItem;
window.fbAtualizarItem = fbAtualizarItem;
window.fbExcluirItem = fbExcluirItem;
window.fbSubstituirColecao = fbSubstituirColecao;

/* =========================================================
   MARCA FIREBASE COMO PRONTO
========================================================= */

window.firebaseReady = true;
window.dispatchEvent(new Event("firebase-ready"));

/* =========================================================
   DEBUG
========================================================= */

console.log("🔥 Firebase unificado pronto");
console.log("   Auth:", typeof window.firebaseAuth);
console.log("   DB:", typeof window.firebaseDB);
console.log("   fbLogin:", typeof window.fbLogin);
console.log("   fbCadastrar:", typeof window.fbCadastrar);
console.log("   fbCarregarColecao:", typeof window.fbCarregarColecao);