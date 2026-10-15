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
  "lr-interiores-producao-v1": "producao"
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
    records.push({ record, position: Number(value.position || 0), documentId: item.id });
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
    const next = previous.catch(() => {}).then(() => writeEncryptedStore(uid, storeName, records, key));
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

  setStatus("Preparando criptografia…", "busy");
  const securityDocument = securityRef(uid);
  let securitySnapshot = await getDoc(securityDocument);
  let security = securitySnapshot.exists() ? securitySnapshot.data() : null;
  let key;

  if (security && security.cryptoVersion === 1 && security.salt && security.verifier) {
    key = await deriveKey(password, base64ToBytes(security.salt));
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
    key = await deriveKey(password, salt);
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

    const cloud = await readCloudStore(uid, storeName, key);
    // Preserve the cloud as the source of truth once it has been initialized.
    const records = cloud.initialized || cloud.rawRecords.length > 0 ? cloud.records : localRecords;
    await writeEncryptedStore(uid, storeName, records, key);
    initialValues[storageKey] = JSON.stringify(records);
  }

  await setDoc(securityDocument, { initialized: true, updatedAt: serverTimestamp() }, { merge: true });
  activeKey = key;
  queues = new Map();
  pendingWrites = 0;
  lastWriteError = false;
  installMemoryStorage(uid, key, initialValues);
  setStatus("Dados criptografados e sincronizados", "ok");
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
