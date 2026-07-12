import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await supabase.auth.signOut()
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

// FastAPI's own validation errors (422) send `detail` as an array of
// {loc, msg, ...} objects, not a string — unlike our hand-raised
// HTTPException(detail="...") calls. Rendering that array directly as a
// React child throws and takes down the whole app via the top-level
// ErrorBoundary, so every call site needs to go through this instead of
// reading err.response?.data?.detail directly.
export function getErrorMessage(err, fallback = 'Something went wrong.') {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(d => (typeof d === 'string' ? d : d?.msg)).filter(Boolean).join('; ') || fallback
  }
  return fallback
}

export default api
