import { boot } from 'quasar/wrappers'
import axios from 'axios'
import User from '@/services/user'
import Router from '../router'

const api = axios.create({
  baseURL: `${window.location.origin}/api`
})

let refreshPending = false
let requestsQueue = []

// Redirect to login if response is 401 (Unauthenticated)
api.interceptors.response.use(
  response => response, 
  error => {
    // Ensure error.response exists before accessing its properties
    if (!error.response) {
      return Promise.reject(error)
    }

    const originalRequest = error.config

    // **** 401 exceptions to avoid infinite loop

    // 401 after User.refreshToken function call
    if (error.response.status === 401 && originalRequest.url.endsWith('/users/refreshtoken')) {
      User.clear()
      return Promise.reject(error)
    }

    // 401 after login request
    if (error.response.status === 401 && originalRequest.url.endsWith('/users/token')) {
      return Promise.reject(error)
    }

    // 401 after settings request (needed since it is called on app loading)
    if (error.response.status === 401 && originalRequest.url.endsWith('/settings/public')) {
      return Promise.reject(error)
    }

    // 401 after totp
    if (error.response.status === 401 && originalRequest.url.endsWith('/users/totp')) {
      return Promise.reject(error)
    }

    // 401 after wrong password on profile
    if (error.response.status === 401 && originalRequest.url.endsWith('/users/me')) {
      return Promise.reject(error)
    }

    // **** End of exceptions

    // All other 401 calls
    if (error.response.status === 401) {
      if (!refreshPending) {
        refreshPending = true
        return api.get('/users/refreshtoken')
          .then(() => {
            requestsQueue.forEach(e => e())
            requestsQueue = []
          })
          .catch(err => {
            Router.push('/login')
            return Promise.reject(err)
          })
          .finally(() => {
            refreshPending = false
          })
      }
      return new Promise((resolve) => {
        requestsQueue.push(() => resolve(api.request(originalRequest)))
      })
    }
    return Promise.reject(error)
  }
)

export default boot(({ app }) => {
  // Inject axios globally
  app.config.globalProperties.$axios = api
})

export { api }