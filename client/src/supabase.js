import { createClient } from '@supabase/supabase-js'

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

const DEV_SESSION = {
  access_token: 'dev-bypass',
  user: { id: 'dev-user-00000000-0000-0000-0000-000000000001', email: 'dev@localhost' },
}

export const supabase = DEV_MODE
  ? {
      auth: {
        getSession:          async () => ({ data: { session: DEV_SESSION }, error: null }),
        onAuthStateChange:   ()       => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut:             async () => {},
      },
    }
  : createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
    )
