import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { initializeCloudData } from "./firebase-data.js?v=1";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
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
const crmApp = document.getElementById("crmApp");
const appLoading = document.getElementById("appLoading");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const logoutButton = document.getElementById("logoutButton");

let crmLoaded = false;
let submitting = false;

function showLogin(message = "") {
  authScreen.hidden = false;
  crmApp.hidden = true;
  appLoading.hidden = true;
  loginMessage.textContent = message;
  loginButton.disabled = false;
  loginButton.textContent = "Entrar";
  submitting = false;
}

async function showCRM() {
  authScreen.hidden = true;
  appLoading.hidden = false;
  crmApp.hidden = true;

  try {
    if (!crmLoaded) {
      await initializeCloudData(auth.currentUser.uid);
      await import("./script.js?v=20261015-5");
      crmLoaded = true;
    }
    appLoading.hidden = true;
    crmApp.hidden = false;
  } catch (error) {
    console.error("Falha ao carregar o CRM:", error);
    await signOut(auth).catch(() => {});
    showLogin("Não foi possível conectar os dados à nuvem. Confira as regras do Firestore e tente novamente.");
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
    await signInWithEmailAndPassword(
      auth,
      loginEmail.value.trim(),
      loginPassword.value
    );
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
    await showCRM();
  } else {
    showLogin();
  }
});
