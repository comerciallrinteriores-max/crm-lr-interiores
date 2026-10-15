import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getEncryptionState, initializeCloudData, lockCloudData } from "./firebase-data.js?v=2";
import {
  getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA722B8KStlkMsherNQN5aDXPxLxqsnpmA",
  authDomain: "crm-lr-interiores.firebaseapp.com",
  projectId: "crm-lr-interiores",
  storageBucket: "crm-lr-interiores.firebasestorage.app",
  messagingSenderId: "916787768354",
  appId: "1:916787768354:web:e55272a3b260e0d9ff2e7b"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const authScreen = document.getElementById("authScreen");
const encryptionScreen = document.getElementById("encryptionScreen");
const crmApp = document.getElementById("crmApp");
const appLoading = document.getElementById("appLoading");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const encryptionForm = document.getElementById("encryptionForm");
const encryptionTitle = document.getElementById("encryptionTitle");
const encryptionDescription = document.getElementById("encryptionDescription");
const encryptionPassword = document.getElementById("encryptionPassword");
const encryptionConfirmField = document.getElementById("encryptionConfirmField");
const encryptionConfirm = document.getElementById("encryptionConfirm");
const encryptionButton = document.getElementById("encryptionButton");
const encryptionMessage = document.getElementById("encryptionMessage");
const logoutButton = document.getElementById("logoutButton");

let crmLoaded = false;
let loadedUid = null;
let submitting = false;
let encryptionConfigured = false;
let currentUid = null;
let handlingUser = false;
let hadAuthenticatedSession = false;

function showLogin(message = "") {
  authScreen.hidden = false;
  encryptionScreen.hidden = true;
  crmApp.hidden = true;
  appLoading.hidden = true;
  loginMessage.textContent = message;
  loginButton.disabled = false;
  loginButton.textContent = "Entrar";
  submitting = false;
}

async function showEncryptionScreen(user) {
  if (handlingUser) return;
  handlingUser = true;
  currentUid = user.uid;
  hadAuthenticatedSession = true;
  authScreen.hidden = true;
  crmApp.hidden = true;
  appLoading.hidden = true;
  encryptionScreen.hidden = false;
  encryptionMessage.textContent = "";
  encryptionForm.hidden = true;
  encryptionButton.disabled = true;
  encryptionTitle.textContent = "Verificando proteção dos dados…";
  encryptionDescription.textContent = "Aguarde enquanto verificamos se este CRM já possui uma senha de criptografia.";
  try {
    const state = await getEncryptionState(user.uid);
    encryptionConfigured = state.configured;
    encryptionTitle.textContent = state.configured ? "Desbloqueie seus dados" : "Crie sua senha de criptografia";
    encryptionDescription.textContent = state.configured
      ? "Digite sua senha de criptografia para desbloquear os dados protegidos. Ela é diferente da senha de login."
      : "Esta senha protegerá os dados antes de serem enviados ao Firebase. Guarde-a em segurança: sem ela, não será possível descriptografar os dados.";
    encryptionConfirmField.hidden = state.configured;
    encryptionConfirm.required = !state.configured;
    encryptionPassword.value = "";
    encryptionConfirm.value = "";
    encryptionPassword.autocomplete = state.configured ? "current-password" : "new-password";
    encryptionButton.textContent = state.configured ? "Desbloquear CRM" : "Criar senha e proteger dados";
    encryptionForm.hidden = false;
    encryptionButton.disabled = false;
    encryptionPassword.focus();
  } catch (error) {
    console.error("Falha ao verificar criptografia:", error);
    encryptionTitle.textContent = "Não foi possível verificar a proteção";
    encryptionDescription.textContent = "Confira a conexão com o Firebase e tente novamente.";
    encryptionMessage.textContent = "Os dados não foram alterados.";
    encryptionForm.hidden = true;
  } finally {
    handlingUser = false;
  }
}

async function loadCRMWithEncryption(user, password, confirmation) {
  encryptionButton.disabled = true;
  encryptionButton.textContent = "Protegendo dados…";
  encryptionMessage.textContent = "";
  try {
    await initializeCloudData(user.uid, password, confirmation);
    encryptionPassword.value = "";
    encryptionConfirm.value = "";
    encryptionScreen.hidden = true;
    appLoading.hidden = false;
    if (!crmLoaded) {
      await import("./script.js?v=20261015-5");
      crmLoaded = true;
      loadedUid = user.uid;
    }
    appLoading.hidden = true;
    crmApp.hidden = false;
  } catch (error) {
    console.error("Falha ao desbloquear ou migrar os dados:", error.code || error.message);
    const messages = {
      "WEAK_ENCRYPTION_PASSWORD": "Use uma senha com pelo menos 10 caracteres.",
      "ENCRYPTION_PASSWORD_MISMATCH": "As senhas não coincidem. Confira e tente novamente.",
      "WRONG_ENCRYPTION_PASSWORD": "Senha de criptografia incorreta. Os dados continuam protegidos e não foram alterados.",
      "INVALID_LOCAL_DATA": error.message,
      "INVALID_CLOUD_RECORD": error.message,
      "permission-denied": "O Firebase recusou o acesso. Confira as regras do Firestore.",
      "unavailable": "Não foi possível conectar ao Firebase. Verifique a internet e tente novamente."
    };
    encryptionMessage.textContent = messages[error.code] || "Não foi possível proteger/desbloquear os dados. Nenhum dado local será apagado. Tente novamente ou confira o console.";
    encryptionScreen.hidden = false;
    appLoading.hidden = true;
    encryptionButton.disabled = false;
    encryptionButton.textContent = encryptionConfigured ? "Desbloquear CRM" : "Criar senha e proteger dados";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return;
  submitting = true;
  loginButton.disabled = true;
  loginButton.textContent = "Entrando…";
  loginMessage.style.color = "#a33131";
  loginMessage.textContent = "";
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
    loginPassword.value = "";
  } catch (error) {
    console.error("Falha no login Firebase:", error.code || error.message);
    const messages = {
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/invalid-email": "Digite um e-mail válido.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
      "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
      "auth/user-disabled": "Esta conta está desativada."
    };
    showLogin(messages[error.code] || "Não foi possível entrar. Confira o e-mail e a senha e tente novamente.");
  }
});

encryptionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUid || !auth.currentUser || auth.currentUser.uid !== currentUid) return;
  const password = encryptionPassword.value;
  const confirmation = encryptionConfirm.value;
  await loadCRMWithEncryption(auth.currentUser, password, confirmation);
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Falha ao sair:", error);
    alert("Não foi possível encerrar a sessão. Tente novamente.");
  } finally {
    logoutButton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (crmLoaded && loadedUid === user.uid) {
      encryptionScreen.hidden = true;
      appLoading.hidden = true;
      crmApp.hidden = false;
      return;
    }
    await showEncryptionScreen(user);
  } else {
    lockCloudData();
    currentUid = null;
    handlingUser = false;
    if (hadAuthenticatedSession) {
      window.location.reload();
      return;
    }
    showLogin();
  }
});
