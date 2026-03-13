import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import axios from 'axios'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { odtId, urlsFotos, consumos } = await req.json()

    // Descargar fotos desde S3 y convertir a base64
    const fotosBase64: string[] = []
    for (const url of (urlsFotos || []).slice(0, 4)) {
      try {
        const res = await axios.get(url, { responseType: 'arraybuffer' })
        fotosBase64.push(Buffer.from(res.data).toString('base64'))
      } catch {
        // Si falla una foto, continuar con las demás
      }
    }

    // Armar descripción de materiales registrados
    const materialesStr = (consumos || []).map((c: any) =>
      `- Código: ${c.codigoProducto} | ${c.descripcionProducto} | Cantidad: ${c.cantidad} | Serie: ${c.series || 'N/A'}`
    ).join('\n')

    const prompt = `Sos un auditor experto de instalaciones de medidores de agua para AYSA Argentina.

Analizá las fotos de la ODT ${odtId} y verificá:

MATERIALES REGISTRADOS EN EL SISTEMA:
${materialesStr}

REGLAS DE AUDITORÍA:
1. MEDIDOR (código 072003015): debe haber exactamente 1. Leé el número de serie grabado físicamente en el cuerpo del medidor y verificá que coincida con el registrado en el sistema.
2. PRECINTO (código 072002015): debe haber exactamente 1 instalado visualmente.
3. CAJA (código 070008001): debe haber exactamente 1 instalada visualmente.
4. OTROS MATERIALES: verificá que lo que se ve en las fotos sea consistente con lo registrado.

IMPORTANTE: El número de serie del medidor está grabado físicamente en el cuerpo metálico o plástico del medidor. Buscalo en todas las fotos.

Respondé SOLO en JSON sin markdown ni texto extra:
{
  "estado": "conforme" | "observacion" | "no_conforme",
  "confianza": número del 1 al 100,
  "medidor_serie_foto": "número leído o 'no legible' o 'no visible'",
  "medidor_serie_sistema": "número del sistema o 'N/A'",
  "medidor_coincide": true | false | null,
  "caja_presente": true | false | null,
  "precinto_presente": true | false | null,
  "cantidad_fotos_analizadas": número,
  "hallazgos": [
    {"tipo": "ok" | "warn" | "error", "descripcion": "texto claro y concreto"}
  ],
  "requiere_humano": true | false,
  "motivo_humano": "motivo si requiere intervención humana, sino null"}
`

    // Construir contenido con texto + fotos
    const content: any[] = [{ type: 'text', text: prompt }]
    fotosBase64.forEach(b64 => {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: b64 }
      })
    })

    // Si no hay fotos, igual analizamos con los datos
    if (fotosBase64.length === 0) {
      content[0].text += '\n\nNOTA: No se pudieron cargar fotos. Analizá solo con los datos registrados.'
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content }]
    })

    const rawText = response.content
      .map((c: any) => c.text || '')
      .join('')
    const clean = rawText.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    return NextResponse.json({ odtId, ...result })
  } catch (error: any) {
    console.error('Error ai-analyze:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
