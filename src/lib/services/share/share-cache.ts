import { browser } from '$app/environment';
import type { PlannerInput, PlannerResult } from '$lib/types/planner';

const DATABASE_NAME = 'mytrip-london-share-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'shared-trips';

export interface CachedSharedTrip {
  shareId: string;
  input: PlannerInput;
  result: PlannerResult;
  generatedAt: string;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!browser || typeof window.indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'shareId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
  });
}

export async function readCachedSharedTrip(shareId: string): Promise<CachedSharedTrip | null> {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const result = await requestToPromise(store.get(shareId) as IDBRequest<CachedSharedTrip | undefined>);
    return result ?? null;
  } finally {
    database.close();
  }
}

export async function writeCachedSharedTrip(entry: CachedSharedTrip): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await requestToPromise(store.put(entry));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to cache shared trip.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Caching shared trip was aborted.'));
    });
  } finally {
    database.close();
  }
}