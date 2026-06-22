import { useEffect, useState, useCallback } from 'react'
import { createSale } from '../api/sales'
import { getPendingSales, queueSalePayload, removePendingSale } from '../lib/offlineStorage'

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingSales()
    setPendingCount(pending.length)
  }, [])

  const flushOfflineSales = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false)
      return
    }

    const pending = await getPendingSales()
    if (!pending.length) {
      setPendingCount(0)
      return
    }

    for (const record of pending) {
      try {
        await createSale(record.payload)
        await removePendingSale(record.id)
      } catch (error) {
        break
      }
    }

    await refreshPendingCount()
  }, [refreshPendingCount])

  useEffect(() => {
    refreshPendingCount()

    const handleOnline = async () => {
      setIsOnline(true)
      await flushOfflineSales()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flushOfflineSales, refreshPendingCount])

  const queueSale = async (payload) => {
    await queueSalePayload(payload)
    await refreshPendingCount()
  }

  return {
    isOnline,
    pendingCount,
    queueSale,
    flushOfflineSales,
  }
}
