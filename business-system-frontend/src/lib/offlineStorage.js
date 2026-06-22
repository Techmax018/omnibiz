const DB_NAME = 'omnibiz_offline'
const STORE_NAME = 'offline_sales'
const DB_VERSION = 1

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(mode, callback) {
  const db = await openDatabase()
  const transaction = db.transaction(STORE_NAME, mode)
  const store = transaction.objectStore(STORE_NAME)
  const result = await callback(store)

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function queueSalePayload(payload) {
  return withStore('readwrite', (store) => store.add({ payload, createdAt: new Date().toISOString() }))
}

export async function getPendingSales() {
  return withStore('readonly', (store) => store.getAll())
}

export async function removePendingSale(id) {
  return withStore('readwrite', (store) => store.delete(id))
}
