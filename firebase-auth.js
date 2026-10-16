import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getEncryptionState, initializeCloudData, lockCloudData, changeEncryptionPassword, createEncryptedBackup, restoreEncryptedBackup } from "./firebase-data.js?v=7";
import {
  getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword,
  sendPasswordResetEmail, onAuthStateChanged, signOut
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
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
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
const backupPassword = document.getElementById("backupPassword");
const backupPasswordConfirm = document.getElementById("backupPasswordConfirm");
const createBackupButton = document.getElementById("createBackupButton");
const restoreBackupButton = document.getElementById("restoreBackupButton");
const backupFileInput = document.getElementById("backupFileInput");
const backupRestorePassword = document.getElementById("backupRestorePassword");
const backupStatus = document.getElementById("backupStatus");
const changePasswordForm = document.getElementById("changeEncryptionPasswordForm");
const currentEncryptionPassword = document.getElementById("currentEncryptionPassword");
const newEncryptionPassword = document.getElementById("newEncryptionPassword");
const confirmNewEncryptionPassword = document.getElementById("confirmNewEncryptionPassword");
const changeEncryptionPasswordButton = document.getElementById("changeEncryptionPasswordButton");
const changeEncryptionPasswordStatus = document.getElementById("changeEncryptionPasswordStatus");

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

forgotPasswordButton.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  loginMessage.style.color = "#a33131";
  loginMessage.textContent = "";

  if (!email) {
    loginMessage.textContent = "Digite seu e-mail acima para receber o link de recuperação.";
    loginEmail.focus();
    return;
  }
  if (!loginEmail.checkValidity()) {
    loginEmail.reportValidity();
    return;
  }

  forgotPasswordButton.disabled = true;
  forgotPasswordButton.textContent = "Enviando link…";
  try {
    await sendPasswordResetEmail(auth, email);
    loginMessage.style.color = "#527064";
    loginMessage.textContent = "Se houver uma conta cadastrada com esse e-mail, você receberá um link para redefinir a senha. Confira também o spam.";
  } catch (error) {
    console.error("Falha ao solicitar recuperação de senha:", error.code || error.message);
    const messages = {
      "auth/invalid-email": "Digite um endereço de e-mail válido.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
      "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente."
    };
    loginMessage.textContent = messages[error.code] || "Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.";
  } finally {
    forgotPasswordButton.disabled = false;
    forgotPasswordButton.textContent = "Esqueci minha senha";
  }
});

encryptionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUid || !auth.currentUser || auth.currentUser.uid !== currentUid) return;
  const password = encryptionPassword.value;
  const confirmation = encryptionConfirm.value;
  await loadCRMWithEncryption(auth.currentUser, password, confirmation);
});



changePasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth.currentUser || auth.currentUser.uid !== currentUid) return;
  const current = currentEncryptionPassword?.value || "";
  const next = newEncryptionPassword?.value || "";
  const confirm = confirmNewEncryptionPassword?.value || "";
  if (next.length < 10) {
    changeEncryptionPasswordStatus.textContent = "A nova senha precisa ter pelo menos 10 caracteres.";
    return;
  }
  if (next !== confirm) {
    changeEncryptionPasswordStatus.textContent = "A nova senha e a confirmação não coincidem.";
    return;
  }
  const confirmed = window.confirm("Antes de continuar, confirme que você guardou o backup criptografado e a senha dele. A troca vai recriptografar os dados na nuvem. Não feche nem atualize esta página até a confirmação de sucesso. Deseja continuar?");
  if (!confirmed) return;
  changeEncryptionPasswordButton.disabled = true;
  changeEncryptionPasswordButton.textContent = "Alterando senha…";
  changeEncryptionPasswordStatus.textContent = "Recriptografando os dados. Não feche esta página.";
  const appElement = document.getElementById("crmApp");
  if (appElement) appElement.inert = true;
  try {
    await changeEncryptionPassword(currentUid, current, next, confirm);
    currentEncryptionPassword.value = "";
    newEncryptionPassword.value = "";
    confirmNewEncryptionPassword.value = "";
    changeEncryptionPasswordStatus.textContent = "Senha de criptografia alterada com sucesso. Use a nova senha ao desbloquear o CRM em todos os dispositivos.";
  } catch (error) {
    console.error("Falha ao alterar senha de criptografia:", error.code || error.message);
    const messages = {
      "WRONG_ENCRYPTION_PASSWORD": "A senha atual está incorreta. Os dados não foram alterados.",
      "WEAK_ENCRYPTION_PASSWORD": "Use uma nova senha com pelo menos 10 caracteres.",
      "ENCRYPTION_PASSWORD_MISMATCH": "A nova senha e a confirmação não coincidem.",
      "SAME_ENCRYPTION_PASSWORD": "Escolha uma senha diferente da atual.",
      "SYNC_PENDING": error.message,
      "PASSWORD_CHANGE_FAILED": error.message,
      "PASSWORD_CHANGE_RECOVERY_REQUIRED": error.message,
      "CRM_LOCKED": error.message
    };
    changeEncryptionPasswordStatus.textContent = messages[error.code] || "Não foi possível alterar a senha. Confira a conexão e o estado da sincronização.";
  } finally {
    if (appElement) appElement.inert = false;
    changeEncryptionPasswordButton.disabled = false;
    changeEncryptionPasswordButton.textContent = "Alterar senha de criptografia";
  }
});

function setBackupStatus(message, isError = false) {
  if (!backupStatus) return;
  backupStatus.textContent = message;
  backupStatus.style.color = isError ? "#a33131" : "#527064";
}

createBackupButton?.addEventListener("click", async () => {
  const password = backupPassword?.value || "";
  if (password.length < 10) {
    setBackupStatus("Use uma senha de backup com pelo menos 10 caracteres.", true);
    backupPassword?.focus();
    return;
  }
  if (password !== (backupPasswordConfirm?.value || "")) {
    setBackupStatus("As senhas de backup não coincidem.", true);
    backupPasswordConfirm?.focus();
    return;
  }
  createBackupButton.disabled = true;
  createBackupButton.textContent = "Preparando backup…";
  setBackupStatus("Conferindo sincronização e criptografando o arquivo…");
  try {
    const contents = await createEncryptedBackup(password);
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lr-interiores-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    backupPassword.value = "";
    backupPasswordConfirm.value = "";
    setBackupStatus("Backup criptografado criado. Guarde o arquivo e a senha em locais seguros.");
  } catch (error) {
    console.error("Falha ao criar backup:", error.code || error.message);
    setBackupStatus(error.message || "Não foi possível criar o backup.", true);
  } finally {
    createBackupButton.disabled = false;
    createBackupButton.textContent = "Baixar backup criptografado";
  }
});

restoreBackupButton?.addEventListener("click", () => {
  if (!backupFileInput) return;
  backupFileInput.click();
});

backupFileInput?.addEventListener("change", async () => {
  const file = backupFileInput.files?.[0];
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) {
    setBackupStatus("O arquivo ultrapassa o limite de 50 MB.", true);
    backupFileInput.value = "";
    return;
  }
  const password = backupRestorePassword?.value || "";
  if (password.length < 10) {
    setBackupStatus("Informe a senha usada para proteger este backup (mínimo de 10 caracteres).", true);
    backupRestorePassword?.focus();
    backupFileInput.value = "";
    return;
  }
  const confirmed = window.confirm("Atenção: restaurar o backup substituirá os dados atuais do CRM nas cinco áreas (clientes, orçamentos, vendas, produção e financeiro). Faça isso somente se deseja substituir os dados atuais. Deseja continuar?");
  if (!confirmed) {
    backupFileInput.value = "";
    return;
  }
  restoreBackupButton.disabled = true;
  createBackupButton.disabled = true;
  setBackupStatus("Validando o backup e restaurando os dados…");
  try {
    const contents = await file.text();
    const result = await restoreEncryptedBackup(contents, password, auth.currentUser?.uid);
    backupRestorePassword.value = "";
    setBackupStatus("Backup restaurado. Clientes: " + result.counts["lr-interiores-crm-v1"] +
      "; orçamentos: " + result.counts["lr-interiores-orcamentos-v1"] +
      "; vendas: " + result.counts["lr-interiores-funil-v1"] +
      "; produção: " + result.counts["lr-interiores-producao-v1"] +
      "; financeiro: " + result.counts["lr-interiores-financeiro-v1"] + ".");
    backupFileInput.value = "";
    window.setTimeout(() => window.location.reload(), 1200);
  } catch (error) {
    console.error("Falha ao restaurar backup:", error.code || error.message);
    const messages = {
      "WRONG_BACKUP_PASSWORD": "Senha de backup incorreta ou arquivo danificado. Os dados atuais não foram substituídos.",
      "INVALID_BACKUP_FILE": error.message,
      "INVALID_BACKUP_FORMAT": error.message,
      "INVALID_BACKUP_CONTENT": error.message,
      "WEAK_BACKUP_PASSWORD": error.message,
      "CRM_LOCKED": "Desbloqueie o CRM antes de restaurar.",
      "SYNC_PENDING": error.message
    };
    setBackupStatus(messages[error.code] || error.message || "Não foi possível restaurar o backup.", true);
  } finally {
    restoreBackupButton.disabled = false;
    createBackupButton.disabled = false;
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
