import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  serverTimestamp
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

async function writeStore(uid, storeName, records) {
  if (!Array.isArray(records)) throw new Error("Formato local inválido para " + storeName);
  const collectionRef = recordsRef(uid, storeName);
  const existing = await getDocs(collectionRef);
  const nextIds = new Set(records.map((item) => String(item?.id || "")).filter(Boolean));
  const operations = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || typeof record.id !== "string" || !record.id) {
      throw new Error("Foi encontrado um registro sem identificador em " + storeName);
    }
    operations.push({ type: "set", ref: doc(collectionRef, record.id), data: {
      record,
      position: index,
      updatedAt: serverTimestamp()
    }});
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
    initialized: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function readStore(uid, storeName) {
  const meta = await getDoc(metaRef(uid, storeName));
  const snapshot = await getDocs(recordsRef(uid, storeName));
  const records = snapshot.docs
    .map((item) => ({ ...item.data(), _documentId: item.id }))
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((item) => {
      if (!item.record || typeof item.record !== "object") {
        throw new Error("Registro inválido encontrado na nuvem em " + storeName);
      }
      return item.record;
    });
  return { initialized: meta.exists() && meta.data().initialized === true, records };
}

export async function initializeCloudData(uid) {
  if (!uid) throw new Error("Usuário não autenticado.");
  setStatus("Conectando à nuvem…", "busy");

  // A nuvem é a fonte principal quando já existe uma migração inicial.
  // Caso contrário, preserva e migra os dados locais atuais.
  for (const [storageKey, storeName] of Object.entries(stores)) {
    const localText = localStorage.getItem(storageKey);
    const localRecords = localText ? JSON.parse(localText) : [];
    if (!Array.isArray(localRecords)) {
      throw new Error("Os dados locais de " + storeName + " não estão em um formato válido.");
    }

    const cloud = await readStore(uid, storeName);
    if (cloud.initialized) {
      localStorage.setItem(storageKey, JSON.stringify(cloud.records));
    } else {
      await writeStore(uid, storeName, localRecords);
    }
  }

  // Mantém a gravação local existente e envia as alterações à nuvem.
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const queues = new Map();
  let pendingWrites = 0;
  localStorage.setItem = function(key, value) {
    originalSetItem(key, value);
    const storeName = stores[key];
    if (!storeName) return;

    let records;
    try {
      records = JSON.parse(value);
      if (!Array.isArray(records)) throw new Error("O conteúdo não é uma lista.");
    } catch (error) {
      setStatus("Erro ao preparar sincronização", "error");
      console.error("Dados locais não enviados à nuvem:", error);
      return;
    }

    pendingWrites += 1;
    setStatus("Salvando na nuvem…", "busy");
    const previous = queues.get(storeName) || Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(() => writeStore(uid, storeName, records));
    queues.set(storeName, next);
    next.then(() => {
      pendingWrites = Math.max(0, pendingWrites - 1);
      if (pendingWrites === 0) setStatus("Dados sincronizados", "ok");
    }).catch((error) => {
      pendingWrites = Math.max(0, pendingWrites - 1);
      console.error("Falha ao sincronizar " + storeName + ":", error);
      setStatus("Falha na nuvem — confira a conexão", "error");
    });
  };

  setStatus("Dados sincronizados", "ok");
}
