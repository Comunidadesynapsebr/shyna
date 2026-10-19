import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE = 'https://gen.pollinations.ai';
const ALLOWED_MODELS = new Set([
  'deepseek/deepseek-v4.1-flash',
  'openai/gpt-5.4-nano',
  'openai/gpt-image-1-mini',
  'alibaba/wan-2.2-fast',
]);
const ALLOWED_KINDS = new Set(['chat', 'image', 'video']);
const MAX_PROMPT_LENGTH = 1200;

function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' });

  const key = process.env.POLLINATIONS_KEY;
  if (!key) return sendJson(res, 503, { error: 'A integração ainda não está configurada. Adicione POLLINATIONS_KEY na Vercel.' });

  const body = (req.body || {}) as { kind?: string; prompt?: string; model?: string };
  const kind = body.kind || '';
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const defaultModel = kind === 'chat'
    ? 'deepseek/deepseek-v4.1-flash'
    : kind === 'image'
      ? 'openai/gpt-image-1-mini'
      : 'alibaba/wan-2.2-fast';
  const model = body.model || defaultModel;

  if (!ALLOWED_KINDS.has(kind)) return sendJson(res, 400, { error: 'Tipo de geração inválido.' });
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) return sendJson(res, 400, { error: `O prompt deve ter entre 1 e ${MAX_PROMPT_LENGTH} caracteres.` });
  if (!ALLOWED_MODELS.has(model)) return sendJson(res, 400, { error: 'Modelo não autorizado para esta aplicação.' });

  try {
    if (kind === 'chat') {
      const upstream = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: 'Você é Shyna. Responda em português do Brasil quando o usuário escrever em português. Seja útil, clara e breve.' }, { role: 'user', content: prompt }],
          max_tokens: 900,
          temperature: 0.7,
        }),
      });
      if (!upstream.ok) return sendJson(res, upstream.status, { error: 'A Pollinations recusou a conversa. Confira o saldo e as permissões da chave.' });
      const payload = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) return sendJson(res, 502, { error: 'A Pollinations retornou uma resposta vazia.' });
      return sendJson(res, 200, { text });
    }

    if (kind === 'image') {
      const upstream = await fetch(`${API_BASE}/v1/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024', quality: 'low', response_format: 'url', safe: true }),
      });
      if (!upstream.ok) return sendJson(res, upstream.status, { error: 'A Pollinations não conseguiu gerar a imagem. Confira o saldo e as permissões da chave.' });
      const payload = await upstream.json() as { data?: Array<{ url?: string }> };
      const imageUrl = payload.data?.[0]?.url;
      if (!imageUrl) return sendJson(res, 502, { error: 'A Pollinations não retornou uma imagem.' });
      return sendJson(res, 200, { imageUrl });
    }

    const query = new URLSearchParams({ model, duration: '5', aspectRatio: '16:9', safe: 'true' });
    const upstream = await fetch(`${API_BASE}/video/${encodeURIComponent(prompt)}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!upstream.ok) return sendJson(res, upstream.status, { error: 'A Pollinations não conseguiu gerar o vídeo. Confira o saldo e as permissões da chave.' });
    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    res.status(200).setHeader('Content-Type', contentType).setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return sendJson(res, 502, { error: 'Não foi possível alcançar a Pollinations agora. Tente novamente em instantes.' });
  }
}
