const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function embedTextos(textos, intento = 1) {
  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, input: textos }),
  });
  if (res.status === 429 && intento <= 4) {
    const espera = intento * 22000; // 22s, 44s, 66s, 88s
    console.log(`[Voyage] Rate limit, reintento ${intento} en ${espera / 1000}s...`);
    await sleep(espera);
    return embedTextos(textos, intento + 1);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage AI error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

export async function embedTexto(texto) {
  const [emb] = await embedTextos([texto]);
  return emb;
}
