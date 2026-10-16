import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA722B8KStlkMsherNQN5aDXPxLxqsnpmA",
  authDomain: "crm-lr-interiores.firebaseapp.com",
  projectId: "crm-lr-interiores",
  storageBucket: "crm-lr-interiores.firebasestorage.app",
  messagingSenderId: "916787768354",
  appId: "1:916787768354:web:e55272a3b260e0d9ff2e7b"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const stores = {
  "lr-interiores-crm-v1": "clientes",
  "lr-interiores-orcamentos-v1": "orcamentos",
  "lr-interiores-financeiro-v1": "financeiro",
  "lr-interiores-funil-v1": "vendas",
  "lr-interiores-producao-v1": "producao",
  "lr-interiores-parceiros-v1": "parceiros",
  "lr-interiores-comissoes-v1": "comissoes",
  "lr-interiores-equipe-v1": "equipe"
};
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let activeKey = null;
let memoryStores = new Map();
let originalGetItem = null;
let originalSetItem = null;
let originalRemoveItem = null;
let queues = new Map();
let pendingWrites = 0;
let lastWriteError = false;

function startupDiagnosticsEnabled() {
  return new URLSearchParams(globalThis.location?.search || "").get("debugPerformance") === "1";
}

function logStartupTiming(label, startedAt, details = {}) {
  if (!startupDiagnosticsEnabled()) return;
  console.info("[CRM startup]", label, {
    durationMs: Math.round(performance.now() - startedAt),
    ...details
  });
}

const statusElement = () => document.getElementById("cloudSyncStatus");
function setStatus(message, state = "ok") {
  const element = statusElement();
  if (!element) return;
  element.textContent = message;
  element.dataset.state = state;
  element.setAttribute("aria-live", "polite");
}
function recordsRef(uid, storeName) {
  return collection(db, "users", uid, "crm", storeName, "records");
}
function metaRef(uid, storeName) {
  return doc(db, "users", uid, "crmMeta", storeName);
}
function securityRef(uid) {
  return doc(db, "users", uid, "security", "encryption");
}
function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, encoder.encode(text)
  );
  return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) };
}
async function decryptText(key, encrypted) {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(encrypted.iv) },
    key,
    base64ToBytes(encrypted.data)
  );
  return decoder.decode(plaintext);
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function getEncryptionState(uid) {
  if (!uid) throw new Error("Usuário não autenticado.");
  const snapshot = await getDoc(securityRef(uid));
  return { configured: snapshot.exists() && snapshot.data().cryptoVersion === 1 };
}

async function readCloudStore(uid, storeName, key) {
  const [meta, snapshot] = await Promise.all([
    getDoc(metaRef(uid, storeName)),
    getDocs(recordsRef(uid, storeName))
  ]);
  const records = [];
  for (const item of snapshot.docs) {
    const value = item.data();
    let record;
    if (value.encrypted === true) {
      if (!key) throw fail("ENCRYPTION_KEY_MISSING", "A chave de criptografia não está disponível.");
      record = JSON.parse(await decryptText(key, { iv: value.iv, data: value.data }));
    } else if (value.record && typeof value.record === "object") {
      // Formato antigo: registros legíveis. Eles serão migrados antes de abrir o CRM.
      record = value.record;
    } else {
      throw fail("INVALID_CLOUD_RECORD", "Foi encontrado um registro inválido na nuvem em " + storeName + ".");
    }
    records.push({
      record,
      position: Number(value.position || 0),
      documentId: item.id,
      encrypted: value.encrypted === true
    });
  }
  records.sort((a, b) => a.position - b.position);
  return {
    initialized: meta.exists() && meta.data().initialized === true,
    records: records.map((entry) => entry.record),
    rawRecords: records
  };
}

async function writeEncryptedStore(uid, storeName, records, key) {
  if (!Array.isArray(records)) throw new Error("Formato inválido para " + storeName + ".");
  const collectionRef = recordsRef(uid, storeName);
  const existing = await getDocs(collectionRef);
  const nextIds = new Set();
  const operations = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || typeof record.id !== "string" || !record.id) {
      throw new Error("Foi encontrado um registro sem identificador em " + storeName + ".");
    }
    if (nextIds.has(record.id)) throw new Error("Identificador duplicado em " + storeName + ".");
    nextIds.add(record.id);
    const encrypted = await encryptText(key, JSON.stringify(record));
    operations.push({
      type: "set",
      ref: doc(collectionRef, record.id),
      data: { encrypted: true, ...encrypted, position: index, updatedAt: serverTimestamp() }
    });
  }
  existing.docs.forEach((snapshot) => {
    if (!nextIds.has(snapshot.id)) operations.push({ type: "delete", ref: snapshot.ref });
  });

  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = writeBatch(db);
    operations.slice(offset, offset + 400).forEach((operation) => {
      if (operation.type === "set") batch.set(operation.ref, operation.data);
      else batch.delete(operation.ref);
    });
    await batch.commit();
  }
  await setDoc(metaRef(uid, storeName), {
    initialized: true, encryptionVersion: 1, updatedAt: serverTimestamp()
  }, { merge: true });
}

function installMemoryStorage(uid, key, initialValues) {
  // The CRM keeps plaintext records in memory only. Do not persist its data arrays in localStorage.
  memoryStores = new Map(Object.entries(initialValues));
  originalGetItem = localStorage.getItem.bind(localStorage);
  originalSetItem = localStorage.setItem.bind(localStorage);
  originalRemoveItem = localStorage.removeItem.bind(localStorage);

  for (const storageKey of Object.keys(stores)) originalRemoveItem(storageKey);

  localStorage.getItem = function(storageKey) {
    if (memoryStores.has(storageKey)) return memoryStores.get(storageKey);
    return originalGetItem(storageKey);
  };
  localStorage.setItem = function(storageKey, value) {
    if (!stores[storageKey]) return originalSetItem(storageKey, value);
    memoryStores.set(storageKey, String(value));
    let records;
    try {
      records = JSON.parse(value);
      if (!Array.isArray(records)) throw new Error("O conteúdo não é uma lista.");
    } catch (error) {
      setStatus("Erro ao preparar sincronização", "error");
      console.error("Dados não enviados à nuvem:", error);
      return;
    }
    pendingWrites += 1;
    lastWriteError = false;
    setStatus("Salvando na nuvem…", "busy");
    const storeName = stores[storageKey];
    const previous = queues.get(storeName) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => writeEncryptedStore(uid, storeName, records, activeKey));
    queues.set(storeName, next);
    next.then(() => {
      pendingWrites = Math.max(0, pendingWrites - 1);
      if (pendingWrites === 0 && !lastWriteError) setStatus("Dados criptografados e sincronizados", "ok");
    }).catch((error) => {
      pendingWrites = Math.max(0, pendingWrites - 1);
      lastWriteError = true;
      console.error("Falha ao sincronizar " + storeName + ":", error);
      setStatus("Falha na nuvem — alterações ainda não confirmadas", "error");
    });
  };
}

export async function initializeCloudData(uid, password, confirmation = "") {
  if (!uid) throw new Error("Usuário não autenticado.");
  if (typeof password !== "string" || password.length < 10) {
    throw fail("WEAK_ENCRYPTION_PASSWORD", "Use uma senha de criptografia com pelo menos 10 caracteres.");
  }

  const startupStartedAt = performance.now();
  setStatus("Preparando criptografia…", "busy");
  const securityDocument = securityRef(uid);
  let phaseStartedAt = performance.now();
  let securitySnapshot = await getDoc(securityDocument);
  logStartupTiming("security-document-read", phaseStartedAt);
  let security = securitySnapshot.exists() ? securitySnapshot.data() : null;
  let key;

  if (security && security.cryptoVersion === 1 && security.salt && security.verifier) {
    phaseStartedAt = performance.now();
    key = await deriveKey(password, base64ToBytes(security.salt));
    logStartupTiming("key-derivation", phaseStartedAt);
    try {
      const verifier = await decryptText(key, security.verifier);
      if (verifier !== "LR-INTERIORES-CRM-ENCRYPTION-KEY-CHECK-v1") {
        throw new Error("Verificador inválido");
      }
    } catch {
      throw fail("WRONG_ENCRYPTION_PASSWORD", "Senha de criptografia incorreta. Os dados não foram alterados.");
    }
  } else {
    if (password !== confirmation) {
      throw fail("ENCRYPTION_PASSWORD_MISMATCH", "As senhas de criptografia não coincidem.");
    }
    if (security) {
      throw fail("UNSUPPORTED_ENCRYPTION_STATE", "O estado de criptografia precisa ser verificado antes de continuar.");
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    phaseStartedAt = performance.now();
    key = await deriveKey(password, salt);
    logStartupTiming("key-derivation-first-setup", phaseStartedAt);
    const verifier = await encryptText(key, "LR-INTERIORES-CRM-ENCRYPTION-KEY-CHECK-v1");
    security = {
      cryptoVersion: 1,
      salt: bytesToBase64(salt),
      verifier,
      initialized: false,
      createdAt: serverTimestamp()
    };
    // Save migration parameters first, so an interrupted migration can resume with the same password.
    await setDoc(securityDocument, security);
  }

  const initialValues = {};
  for (const [storageKey, storeName] of Object.entries(stores)) {
    const localText = localStorage.getItem(storageKey);
    let localRecords = [];
    if (localText) {
      try {
        localRecords = JSON.parse(localText);
        if (!Array.isArray(localRecords)) throw new Error("Formato local inválido");
      } catch {
        throw fail("INVALID_LOCAL_DATA", "Os dados locais de " + storeName + " não puderam ser lidos. Nenhum dado da nuvem foi apagado.");
      }
    }

    phaseStartedAt = performance.now();
    const cloud = await readCloudStore(uid, storeName, key);
    logStartupTiming("cloud-read-and-decrypt:" + storeName, phaseStartedAt, {
      records: cloud.records.length
    });

    // Preserve the cloud as the source of truth once it has been initialized.
    const records = cloud.initialized || cloud.rawRecords.length > 0 ? cloud.records : localRecords;

    // A fully initialized store that is already encrypted and in canonical order
    // does not need to be encrypted and written back again during every login.
    // Legacy/plaintext stores and incomplete migrations still go through the full write path.
    const cloudAlreadyCanonical = cloud.initialized &&
      cloud.rawRecords.length === records.length &&
      cloud.rawRecords.every((entry, index) =>
        entry.encrypted === true &&
        entry.documentId === records[index]?.id &&
        entry.position === index
      );

    if (cloudAlreadyCanonical) {
      if (startupDiagnosticsEnabled()) {
        console.info("[CRM startup]", "cloud-write-skipped:" + storeName, {
          records: records.length,
          reason: "already-encrypted-and-canonical"
        });
      }
    } else {
      phaseStartedAt = performance.now();
      await writeEncryptedStore(uid, storeName, records, key);
      logStartupTiming("cloud-migration-write:" + storeName, phaseStartedAt, {
        records: records.length
      });
    }
    initialValues[storageKey] = JSON.stringify(records);
  }

  await setDoc(securityDocument, { initialized: true, updatedAt: serverTimestamp() }, { merge: true });
  activeKey = key;
  queues = new Map();
  pendingWrites = 0;
  lastWriteError = false;
  installMemoryStorage(uid, key, initialValues);
  setStatus("Dados criptografados e sincronizados", "ok");
  logStartupTiming("initialize-cloud-data-total", startupStartedAt, {
    stores: Object.keys(stores).length
  });
}


export async function changeEncryptionPassword(uid, currentPassword, newPassword, confirmation) {
  if (!uid || !activeKey || !originalGetItem) {
    throw fail("CRM_LOCKED", "Desbloqueie o CRM antes de alterar a senha.");
  }
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 10) {
    throw fail("WEAK_ENCRYPTION_PASSWORD", "A nova senha precisa ter pelo menos 10 caracteres.");
  }
  if (newPassword !== confirmation) {
    throw fail("ENCRYPTION_PASSWORD_MISMATCH", "A nova senha e a confirmação não coincidem.");
  }
  if (currentPassword === newPassword) {
    throw fail("SAME_ENCRYPTION_PASSWORD", "A nova senha precisa ser diferente da senha atual.");
  }

  await Promise.all([...queues.values()]);
  if (lastWriteError) {
    throw fail("SYNC_PENDING", "Há alterações que não foram confirmadas na nuvem. Resolva a sincronização antes de trocar a senha.");
  }

  const securityDocument = securityRef(uid);
  const securitySnapshot = await getDoc(securityDocument);
  if (!securitySnapshot.exists()) throw fail("ENCRYPTION_STATE_MISSING", "Não foi possível encontrar a configuração de criptografia.");
  const security = securitySnapshot.data();
  let verifiedOldKey;
  try {
    verifiedOldKey = await deriveKey(currentPassword, base64ToBytes(security.salt));
    const verifier = await decryptText(verifiedOldKey, security.verifier);
    if (verifier !== "LR-INTERIORES-CRM-ENCRYPTION-KEY-CHECK-v1") throw new Error("Verificador inválido");
  } catch {
    throw fail("WRONG_ENCRYPTION_PASSWORD", "A senha atual está incorreta. Nenhum dado foi alterado.");
  }

  const oldKey = activeKey;
  const payload = {};
  for (const [storageKey, storeName] of Object.entries(stores)) {
    let records;
    try {
      records = JSON.parse(memoryStores.get(storageKey) ?? "[]");
    } catch {
      throw fail("INVALID_LOCAL_DATA", "Não foi possível validar os dados de " + storeName + ". Nenhum dado foi alterado.");
    }
    if (!Array.isArray(records)) throw fail("INVALID_LOCAL_DATA", "Formato inválido em " + storeName + ".");
    payload[storageKey] = records;
  }
  validateBackupStores(payload);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const newKey = await deriveKey(newPassword, salt);
  const verifier = await encryptText(newKey, "LR-INTERIORES-CRM-ENCRYPTION-KEY-CHECK-v1");
  const newSaltBase64 = bytesToBase64(salt);
  const writtenStores = [];
  let metadataUpdateAttempted = false;

  setStatus("Alterando a senha e recriptografando os dados…", "busy");
  try {
    for (const [storageKey, storeName] of Object.entries(stores)) {
      writtenStores.push([storageKey, storeName]);
      await writeEncryptedStore(uid, storeName, payload[storageKey], newKey);
    }
    metadataUpdateAttempted = true;
    await setDoc(securityDocument, {
      cryptoVersion: 1,
      salt: newSaltBase64,
      verifier,
      initialized: true,
      passwordChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    activeKey = newKey;
    lastWriteError = false;
    setStatus("Senha alterada; dados criptografados e sincronizados", "ok");
    return true;
  } catch (error) {
    // If the metadata write returned a network error, first check what Firestore actually stored.
    // Never roll records back blindly when the server may already have committed the new password.
    if (metadataUpdateAttempted) {
      try {
        const currentSnapshot = await getDoc(securityDocument);
        const current = currentSnapshot.exists() ? currentSnapshot.data() : null;
        const isNewConfig = current &&
          current.cryptoVersion === 1 &&
          current.salt === newSaltBase64 &&
          current.verifier?.iv === verifier.iv &&
          current.verifier?.data === verifier.data;
        if (isNewConfig) {
          activeKey = newKey;
          lastWriteError = false;
          setStatus("Nova senha confirmada no Firebase; dados sincronizados", "ok");
          return true;
        }

        const isOldConfig = current &&
          current.cryptoVersion === 1 &&
          current.salt === security.salt &&
          current.verifier?.iv === security.verifier?.iv &&
          current.verifier?.data === security.verifier?.data;
        if (!isOldConfig) {
          activeKey = null;
          lastWriteError = true;
          setStatus("Estado da senha incerto. Não saia nem atualize o CRM; procure suporte.", "error");
          throw fail("PASSWORD_CHANGE_RECOVERY_REQUIRED", "Não foi possível confirmar qual configuração de senha está ativa. Não saia nem atualize a página e não faça novas alterações; mantenha esta sessão aberta e procure suporte.");
        }
      } catch (verificationError) {
        if (verificationError?.code === "PASSWORD_CHANGE_RECOVERY_REQUIRED") throw verificationError;
        activeKey = null;
        lastWriteError = true;
        setStatus("Não foi possível verificar a senha no Firebase. Não saia nem atualize o CRM.", "error");
        throw fail("PASSWORD_CHANGE_RECOVERY_REQUIRED", "A conexão impediu confirmar qual senha está ativa. Não saia nem atualize a página e não faça novas alterações; mantenha esta sessão aberta e procure suporte.");
      }
    }

    let rollbackFailed = false;
    for (const [storageKey, storeName] of writtenStores.reverse()) {
      try {
        await writeEncryptedStore(uid, storeName, payload[storageKey], oldKey);
      } catch (rollbackError) {
        rollbackFailed = true;
        console.error("Falha ao reverter a criptografia de " + storeName + ":", rollbackError);
      }
    }
    if (rollbackFailed) {
      activeKey = null;
      lastWriteError = true;
      setStatus("Atenção: a troca foi interrompida. Não saia do CRM; mantenha esta sessão aberta e procure suporte.", "error");
      throw fail("PASSWORD_CHANGE_RECOVERY_REQUIRED", "A troca foi interrompida e a reversão não foi concluída por completo. Não saia nem atualize a página. Mantenha esta sessão aberta e procure suporte.");
    }
    activeKey = oldKey;
    setStatus("A troca de senha falhou; os dados foram mantidos com a senha antiga.", "error");
    throw fail("PASSWORD_CHANGE_FAILED", "Não foi possível concluir a troca. Os dados foram revertidos para a senha antiga. Verifique a conexão e tente novamente.");
  }
}

const BACKUP_FORMAT = "lr-interiores-encrypted-backup";
const BACKUP_VERSION = 1;
const BACKUP_ITERATIONS = 310000;

function validateBackupStores(value) {
  if (!value || typeof value !== "object") throw new Error("O conteúdo do backup não é válido.");
  for (const storageKey of Object.keys(stores)) {
    if (!Array.isArray(value[storageKey])) {
      throw new Error("O backup não contém uma lista válida para " + stores[storageKey] + ".");
    }
    const ids = new Set();
    for (const record of value[storageKey]) {
      if (!record || typeof record.id !== "string" || !record.id || ids.has(record.id)) {
        throw new Error("O backup contém um registro inválido ou duplicado em " + stores[storageKey] + ".");
      }
      ids.add(record.id);
    }
  }
  return true;
}

export async function createEncryptedBackup(password) {
  if (!activeKey || !originalGetItem) throw fail("CRM_LOCKED", "Desbloqueie o CRM antes de criar um backup.");
  if (typeof password !== "string" || password.length < 10) {
    throw fail("WEAK_BACKUP_PASSWORD", "Use uma senha de backup com pelo menos 10 caracteres.");
  }
  await Promise.all([...queues.values()]);
  if (lastWriteError) throw fail("SYNC_PENDING", "Há alterações que não foram confirmadas na nuvem. Verifique a sincronização antes de criar o backup.");

  const payload = {};
  for (const storageKey of Object.keys(stores)) {
    const serialized = memoryStores.get(storageKey) ?? originalGetItem(storageKey);
    let records = [];
    if (serialized) records = JSON.parse(serialized);
    payload[storageKey] = records;
  }
  validateBackupStores(payload);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const backupKey = await deriveKey(password, salt);
  const encrypted = await encryptText(backupKey, JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    stores: payload
  }));
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    kdf: "PBKDF2-SHA-256",
    iterations: BACKUP_ITERATIONS,
    salt: bytesToBase64(salt),
    encrypted
  }, null, 2);
}

export async function restoreEncryptedBackup(fileContents, password, uid) {
  if (!activeKey || !originalGetItem) throw fail("CRM_LOCKED", "Desbloqueie o CRM antes de restaurar um backup.");
  if (!uid) throw fail("NOT_AUTHENTICATED", "Usuário não autenticado.");
  if (typeof password !== "string" || password.length < 10) {
    throw fail("WEAK_BACKUP_PASSWORD", "Informe a senha usada para proteger este backup.");
  }
  await Promise.all([...queues.values()]);

  let backup;
  try {
    backup = JSON.parse(fileContents);
  } catch {
    throw fail("INVALID_BACKUP_FILE", "O arquivo selecionado não é um backup JSON válido.");
  }
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION ||
      backup.kdf !== "PBKDF2-SHA-256" || backup.iterations !== BACKUP_ITERATIONS ||
      typeof backup.salt !== "string" || !backup.encrypted?.iv || !backup.encrypted?.data) {
    throw fail("INVALID_BACKUP_FORMAT", "Formato de backup não reconhecido ou versão incompatível.");
  }

  let decoded;
  try {
    const backupKey = await deriveKey(password, base64ToBytes(backup.salt));
    decoded = JSON.parse(await decryptText(backupKey, backup.encrypted));
  } catch {
    throw fail("WRONG_BACKUP_PASSWORD", "Não foi possível abrir o backup. Confira a senha e tente novamente.");
  }
  if (!decoded || decoded.format !== BACKUP_FORMAT || decoded.version !== BACKUP_VERSION) {
    throw fail("INVALID_BACKUP_CONTENT", "O conteúdo descriptografado do backup não é válido.");
  }
  // Older backups may not contain stores added in later CRM versions.
  // Treat those optional stores as empty during restore so valid older backups remain usable.
  for (const storageKey of ["lr-interiores-parceiros-v1", "lr-interiores-comissoes-v1", "lr-interiores-equipe-v1"]) {
    if (!Array.isArray(decoded.stores[storageKey])) decoded.stores[storageKey] = [];
  }
  validateBackupStores(decoded.stores);

  // Validate every store before writing anything. If interrupted, importing the same backup again is safe.
  for (const [storageKey, storeName] of Object.entries(stores)) {
    await writeEncryptedStore(uid, storeName, decoded.stores[storageKey], activeKey);
  }
  for (const storageKey of Object.keys(stores)) {
    memoryStores.set(storageKey, JSON.stringify(decoded.stores[storageKey]));
  }
  lastWriteError = false;
  setStatus("Backup restaurado e sincronizado", "ok");
  return { createdAt: decoded.createdAt, counts: Object.fromEntries(
    Object.keys(stores).map((storageKey) => [storageKey, decoded.stores[storageKey].length])
  ) };
}

// Automatic inactivity lock is allowed only when every queued cloud write has settled successfully.
export function isCloudDataSafeToLock() {
  return Boolean(activeKey && originalGetItem && pendingWrites === 0 && !lastWriteError);
}

export function lockCloudData() {
  activeKey = null;
  memoryStores.clear();
  queues.clear();
  pendingWrites = 0;
  lastWriteError = false;
  if (originalGetItem && originalSetItem && originalRemoveItem) {
    localStorage.getItem = originalGetItem;
    localStorage.setItem = originalSetItem;
    localStorage.removeItem = originalRemoveItem;
  }
  originalGetItem = null;
  originalSetItem = null;
  originalRemoveItem = null;
}
