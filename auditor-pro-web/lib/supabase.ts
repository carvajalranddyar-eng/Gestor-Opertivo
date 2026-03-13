import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://dffhvutwwqeumyikinkc.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX2tleSIsImV4cCI6MTc3NDk4MjI4OX0.8HGJMhJpZDZN_2YNQeR8oJF8sFxylpSj0XQ7PfB3nVU'

export const supabase = createClient(supabaseUrl, supabaseKey)
