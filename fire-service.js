/* =========================================================
   FINANÇA — Serviço de comunicação com o Firebase
   Fornece funções prontas para login, cadastro e CRUD
========================================================= */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* =========================================================
   AUTENTICAÇÃO
========================================================= */

async function fbCadastrar(email, senha, nome) {
  const cred = await createUserWithEmailAndPassword(window.firebaseAuth, email, senha);
  if (nome) {
    await updateProfile(cred.user, { displayName: nome });
  }
  // Cria documento de perfil no Firestore
  await setDoc(doc(window.firebaseDB, "users", cred.user.uid, "perfil", "geral"), {
    nome: nome || "",
    email: email,
    criadoEm: new Date().toISOString(),
  });
  return cred.user;
}

async function fbLogin(email, senha) {
  const cred = await signInWithEmailAndPassword(window.firebaseAuth, email, senha);
  return cred.user;
}

async function fbLogout() {
  await signOut(window.firebaseAuth);
}

async function fbRecuperarSenha(email) {
  await sendPasswordResetEmail(window.firebaseAuth, email);
}

function fbAoMudarUsuario(callback) {
  onAuthStateChanged(window.firebaseAuth, callback);
}

/* =========================================================
   HELPERS DE DOCUMENTO
========================================================= */

function fbUserRef(uid, ...path) {
  return doc(window.firebaseDB, "users", uid, ...path);
}

function fbUserCol(uid, colecao) {
  return collection(window.firebaseDB, "users", uid, colecao);
}

/* =========================================================
   DOCUMENTO ÚNICO (config, cores, perfil)
========================================================= */

async function fbCarregarDoc(uid, ...path) {
  try {
    const snap = await getDoc(fbUserRef(uid, ...path));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("fbCarregarDoc erro:", e);
    return null;
  }
}

async function fbSalvarDoc(uid, dados, ...path) {
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
  try {
    const ref = await addDoc(fbUserCol(uid, colecao), dados);
    return ref.id;
  } catch (e) {
    console.warn("fbAdicionarItem erro:", e);
    return null;
  }
}

async function fbAtualizarItem(uid, colecao, docId, dados) {
  try {
    await updateDoc(doc(window.firebaseDB, "users", uid, colecao, docId), dados);
    return true;
  } catch (e) {
    console.warn("fbAtualizarItem erro:", e);
    return false;
  }
}

async function fbExcluirItem(uid, colecao, docId) {
  try {
    await deleteDoc(doc(window.firebaseDB, "users", uid, colecao, docId));
    return true;
  } catch (e) {
    console.warn("fbExcluirItem erro:", e);
    return false;
  }
}

/* Substitui a coleção inteira (útil pra sincronizar em massa) */
async function fbSubstituirColecao(uid, colecao, itens) {
  try {
    // Busca todos os docs atuais
    const snap = await getDocs(fbUserCol(uid, colecao));
    const batch = writeBatch(window.firebaseDB);

    // Deleta os existentes
    snap.forEach((d) => {
      batch.delete(d.ref);
    });

    // Adiciona os novos (com id próprio se houver)
    itens.forEach((item) => {
      const ref = doc(fbUserCol(uid, colecao)); // gera id
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

console.log("🔥 Serviço Firebase pronto");
