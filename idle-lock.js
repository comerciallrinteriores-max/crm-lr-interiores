import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { isCloudDataSafeToLock, lockCloudData } from "./firebase-data.js?v=6";

const auth = getAuth();
const crm = document.getElementById("crmApp");
let user = null;
let timer = null;
const idleMs = 600000;

function arm(delay = idleMs) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    if (!user || !auth.currentUser || auth.currentUser.uid !== user.uid || !crm || crm.hidden) return;
    if (!isCloudDataSafeToLock()) {
      arm(60000);
      return;
    }
    crm.hidden = true;
    lockCloudData();
    window.location.reload();
  }, delay);
}

["pointerdown", "pointermove", "keydown", "touchstart", "scroll"].forEach((name) => {
  document.addEventListener(name, () => {
    if (user && crm && !crm.hidden) arm();
  }, { passive: true });
});

onAuthStateChanged(auth, (nextUser) => {
  user = nextUser || null;
  if (!user && timer) clearTimeout(timer);
});

if (crm) {
  const observer = new MutationObserver(() => {
    if (user && !crm.hidden) arm();
    else if (timer) clearTimeout(timer);
  });
  observer.observe(crm, { attributes: true, attributeFilter: ["hidden"] });
}
