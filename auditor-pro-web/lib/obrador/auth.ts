import axios from 'axios'

let obradorToken: string | null = null
let obradorExpiry: number = 0

export async function loginObrador(): Promise<string> {
  if (obradorToken && Date.now() < obradorExpiry) return obradorToken!

  const baseUrl = process.env.OBRADOR_URL!.trim()
  const email = process.env.OBRADOR_EMAIL?.trim()
  const pass = process.env.OBRADOR_PASSWORD?.trim()

  console.log('[Obrador Auth] Email:', email, '| URL:', baseUrl)

  const res = await axios.post(
    `${baseUrl}/login/`,
    {
      email: email,
      pass: pass
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      timeout: 15000
    }
  )

  obradorToken = res.data.access_token || res.data.token
  obradorExpiry = Date.now() + 3600000 // 1 hora

  if (!obradorToken) throw new Error('No se encontró token en respuesta del Obrador')

  return obradorToken!
}
