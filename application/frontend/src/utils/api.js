// API helper với API Key authentication
const API_KEY = import.meta.env.VITE_API_KEY

// Helper function để gọi API với API key
export const apiClient = {
  get: async (url) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    })
    return response.json()
  },

  post: async (url, data) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(data)
    })
    return response.json()
  },

  put: async (url, data) => {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(data)
    })
    return response.json()
  },

  delete: async (url) => {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    })
    return response.json()
  }
}

// Example usage:
// import { apiClient } from './utils/api'
// 
// const users = await apiClient.get('/users')
// const newUser = await apiClient.post('/users', { name: 'John', email: 'john@example.com' })
