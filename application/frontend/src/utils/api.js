// API helper với API Key authentication
const API_KEY = import.meta.env.VITE_API_KEY
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const TOKEN_KEY = 'auth_token'

const getAuthToken = () => localStorage.getItem(TOKEN_KEY)

const request = async (url, options = {}) => {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  const body = await response.json()
  if (!response.ok) {
    const error = new Error(body.error || body.message || 'Request failed')
    error.status = response.status
    throw error
  }

  return body
}

// Helper function để gọi API với API key
export const apiClient = {
  get: async (url) => {
    return request(url, { method: 'GET' })
  },

  post: async (url, data) => {
    return request(url, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  put: async (url, data) => {
    return request(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  delete: async (url) => {
    return request(url, { method: 'DELETE' })
  }
}

// Example usage:
// import { apiClient } from './utils/api'
// 
// const users = await apiClient.get('/users')
// const newUser = await apiClient.post('/users', { name: 'John', email: 'john@example.com' })
