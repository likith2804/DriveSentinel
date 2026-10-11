// sessionStorage.js - IndexedDB persistent storage for safety monitoring sessions
const DB_NAME = 'SmartVehicleSafetyDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

let dbInstance = null;

/**
 * Initializes and opens IndexedDB connection
 */
export async function getDB() {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            resolve(null);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('startTime', 'startTime', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('IndexedDB open error:', event.target.error);
            resolve(null); // Return null to fallback to localStorage
        };
    });
}

/**
 * Saves a completed session record to IndexedDB
 */
export async function saveSessionToStorage(sessionData) {
    const db = await getDB();
    if (db) {
        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put(sessionData);

                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => {
                    console.error('Error saving session to IndexedDB:', e.target.error);
                    fallbackSaveToLocalStorage(sessionData);
                    resolve(true);
                };
            } catch (err) {
                fallbackSaveToLocalStorage(sessionData);
                resolve(true);
            }
        });
    } else {
        fallbackSaveToLocalStorage(sessionData);
        return true;
    }
}

/**
 * Retrieves all saved sessions ordered newest first
 */
export async function getAllSessionsFromStorage() {
    const db = await getDB();
    if (db) {
        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_NAME], 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();

                req.onsuccess = () => {
                    const sessions = req.result || [];
                    sessions.sort((a, b) => b.startTime - a.startTime);
                    resolve(sessions);
                };

                req.onerror = () => {
                    resolve(fallbackGetFromLocalStorage());
                };
            } catch (e) {
                resolve(fallbackGetFromLocalStorage());
            }
        });
    } else {
        return fallbackGetFromLocalStorage();
    }
}

/**
 * Retrieves a single session by its unique ID
 */
export async function getSessionByIdFromStorage(sessionId) {
    const sessions = await getAllSessionsFromStorage();
    return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Deletes a session by ID
 */
export async function deleteSessionFromStorage(sessionId) {
    const db = await getDB();
    if (db) {
        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.delete(sessionId);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    } else {
        fallbackDeleteFromLocalStorage(sessionId);
        return true;
    }
}

/**
 * Deletes all stored sessions
 */
export async function clearAllSessionsFromStorage() {
    // Clear both in-memory and localStorage fallbacks
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.removeItem('smart_vehicle_safety_sessions_fallback');
        } catch (e) {}
    }
    inMemoryFallback = [];

    const db = await getDB();
    if (db) {
        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_NAME], 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.clear();
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    } else {
        return true;
    }
}

// Memory & LocalStorage Fallbacks
let inMemoryFallback = [];

function fallbackSaveToLocalStorage(session) {
    if (inMemoryFallback.length === 0) {
        inMemoryFallback = fallbackGetFromLocalStorage();
    }
    inMemoryFallback = inMemoryFallback.filter(s => s.id !== session.id);
    inMemoryFallback.unshift(session);
    if (typeof localStorage !== 'undefined') {
        try {
            const key = 'smart_vehicle_safety_sessions_fallback';
            localStorage.setItem(key, JSON.stringify(inMemoryFallback.slice(0, 50)));
        } catch (e) {}
    }
}

function fallbackGetFromLocalStorage() {
    if (typeof localStorage !== 'undefined') {
        try {
            const key = 'smart_vehicle_safety_sessions_fallback';
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    inMemoryFallback = parsed;
                    return inMemoryFallback;
                }
            }
        } catch (e) {}
    }
    return [...inMemoryFallback];
}

function fallbackDeleteFromLocalStorage(sessionId) {
    if (inMemoryFallback.length === 0) {
        inMemoryFallback = fallbackGetFromLocalStorage();
    }
    inMemoryFallback = inMemoryFallback.filter(s => s.id !== sessionId);
    if (typeof localStorage !== 'undefined') {
        try {
            const key = 'smart_vehicle_safety_sessions_fallback';
            localStorage.setItem(key, JSON.stringify(inMemoryFallback));
        } catch (e) {}
    }
}
