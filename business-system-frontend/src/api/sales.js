import { API_BASE, defaultFetchOptions } from './config'

export async function createSale(order) {
  const response = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    ...defaultFetchOptions,
    body: JSON.stringify(order),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.detail || 'Unable to submit sale')
  }

  return response.json()
}
