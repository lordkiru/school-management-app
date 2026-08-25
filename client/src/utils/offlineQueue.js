/**
 * offlineQueue.js
 * IndexedDB-based queue for offline attendance submissions.
 * When the teacher marks attendance without internet, records are stored here.
 * When connectivity returns, syncOfflineQueue() is called to push them to the server.
 */

const DB_NAME = 'lemida-offline';
const DB_VERSION = 1;
const STORE_NAME = 'attendance-queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('classId', 'classId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Queue an attendance submission for later sync.
 * @param {Object} submission - { classId, date, records: [{studentId, status, notes}] }
 */
export async function queueAttendance(submission) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add({
      ...submission,
      queuedAt: new Date().toISOString(),
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending submissions from the queue.
 */
export async function getPendingSubmissions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove a submission from the queue by its local ID.
 * @param {number} id - The local IndexedDB id
 */
export async function removeFromQueue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Count how many submissions are queued.
 */
export async function getPendingCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Sync all queued submissions to the server.
 * Called automatically when online event fires, or manually.
 * @param {string} token - Auth token
 * @param {string} apiUrl - Base API URL
 * @returns {Promise<{synced: number, failed: number}>}
 */
export async function syncOfflineQueue(token, apiUrl) {
  const pending = await getPendingSubmissions();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  // Use the batch sync endpoint
  try {
    const submissions = pending.map(({ id, queuedAt, ...rest }) => rest);
    const res = await fetch(`${apiUrl}/attendance/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ submissions }),
    });

    if (res.ok) {
      const data = await res.json();
      // Remove all from queue regardless of individual result (server handles duplicates)
      for (const item of pending) {
        await removeFromQueue(item.id);
        const result = data.results?.find(
          (r) => r.classId === item.classId && r.date === item.date
        );
        if (result?.status === 'synced') synced++;
        else failed++;
      }
    } else {
      failed = pending.length;
    }
  } catch (err) {
    failed = pending.length;
  }

  return { synced, failed };
}
