import axios from 'axios'

let psmToken: string | null = null
let psmExpiry: number = 0

export async function loginPSM(): Promise<string> {
  try {
    if (psmToken && Date.now() < psmExpiry) return psmToken!
    
    // Usar URL del proxy ngrok si está configurada, sino usar PSM directo
    const proxyUrl = process.env.PSM_PROXY_URL || process.env.PSM_BASE_URL
    const url = `${proxyUrl}/api/login`  // Agregar /api
    
    console.log('Connecting to:', url)
    
    const payload = {
      nombreUsuario: String(process.env.PSM_USUARIO),
      password: String(process.env.PSM_PASSWORD)
    }
    
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
    })
    
    console.log('Login response:', res.status)
    
    psmToken = res.data.access_token || res.data.token
    psmExpiry = Date.now() + 3600000
    
    if (!psmToken) {
      throw new Error('No se encontró token en la respuesta')
    }
    
    return psmToken!
  } catch (error: any) {
    console.error('Login error:', error.message)
    if (error.response) {
      console.error('  Response status:', error.response.status)
      console.error('  Response data:', error.response.data)
    }
    throw error
  }
}
