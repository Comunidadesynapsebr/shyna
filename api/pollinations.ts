import { createHash } from 'node:crypto';
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
const LIMITS = { lite: 30, pro: 15, image: 4, video: 1 } as const;
type LimitKey = keyof typeof LIMITS;
type Bucket = { date: string; counts: Record<LimitKey, number> };

// Memória de curta duração por instância: o navegador também mantém a cota local.
// Para cotas antifraude fortes e persistentes, conecte Redis/KV antes de escalar.
const buckets = new Map<string, Bucket>();

function today() { return new Date().toISOString().slice(0, 10); }
function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(body);
}
function getClientIp(req: VercelRequest) {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown').slice(0, 120);
}
function getBucket(req: VercelRequest) {
  const browserId = typeof req.headers['x-shyna-browser-id'] === 'string' ? req.headers['x-shyna-browser-id'].slice(0, 100) : '';
  if (!browserId) return null;
  const identity = createHash('sha256').update(`${getClientIp(req)}:${browserId}`).digest('hex');
  const currentDate = today();
  const existing = buckets.get(identity);
  if (!existing || existing.date !== currentDate) {
    const fresh = { date: currentDate, counts: { lite: 0, pro: 0, image: 0, video: 0 } };
    buckets.set(identity, fresh);
    return fresh;
  }
  return existing;
}
function limitKey(kind: string, model: string): LimitKey {
  if (kind === 'chat') return model === 'openai/gpt-5.4-nano' ? 'pro' : 'lite';
  return kind as LimitKey;
}
function reserveQuota(bucket: Bucket, key: LimitKey) {
  if (bucket.counts[key] >= LIMITS[key]) return false;
  bucket.counts[key] += 1;
  return true;
}
function releaseQuota(bucket: Bucket, key: LimitKey) { bucket.counts[key] = Math.max(0, bucket.counts[key] - 1); }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shyna-Browser-Id');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' });

  const key = process.env.POLLINATIONS_KEY;
  if (!key) return sendJson(res, 503, { error: 'A integração ainda não está configurada. Adicione POLLINATIONS_KEY na Vercel.' });

  const body = (req.body || {}) as { kind?: string; prompt?: string; model?: string };
  const kind = body.kind || '';
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const defaultModel = kind === 'chat' ? 'deepseek/deepseek-v4.1-flash' : kind === 'image' ? 'openai/gpt-image-1-mini' : 'alibaba/wan-2.2-fast';
  const model = body.model || defaultModel;
  if (!ALLOWED_KINDS.has(kind)) return sendJson(res, 400, { error: 'Tipo de geração inválido.' });
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) return sendJson(res, 400, { error: `O prompt deve ter entre 1 e ${MAX_PROMPT_LENGTH} caracteres.` });
  if (!ALLOWED_MODELS.has(model)) return sendJson(res, 400, { error: 'Modelo não autorizado para esta aplicação.' });

  const bucket = getBucket(req);
  if (!bucket) return sendJson(res, 400, { error: 'Identificador anônimo do navegador ausente. Recarregue a página e tente novamente.' });
  const quota = limitKey(kind, model);
  if (!reserveQuota(bucket, quota)) return sendJson(res, 429, { error: `Limite diário de ${LIMITS[quota]} uso(s) para este IP e navegador atingido. Tente novamente amanhã.` });
  res.setHeader('X-Shyna-Limit-Scope', 'ip+browser');

  try {
    if (kind === 'chat') {
      const upstream = await fetch(`${API_BASE}/v1/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: 'Você é Shyna. Responda em português do Brasil quando o usuário escrever em português. Seja útil, clara e breve.' }, { role: 'user', content: prompt }], max_tokens: 900, temperature: 0.7 }) });
      if (!upstream.ok) { releaseQuota(bucket, quota); return sendJson(res, upstream.status, { error: 'A Pollinations recusou a conversa. Confira o saldo e as permissões da chave.' }); }
      const payload = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) { releaseQuota(bucket, quota); return sendJson(res, 502, { error: 'A Pollinations retornou uma resposta vazia.' }); }
      return sendJson(res, 200, { text });
    }
    if (kind === 'image') {
      const upstream = await fetch(`${API_BASE}/v1/images/generations`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024', quality: 'low', response_format: 'url', safe: true }) });
      if (!upstream.ok) { releaseQuota(bucket, quota); return sendJson(res, upstream.status, { error: 'A Pollinations não conseguiu gerar a imagem. Confira o saldo e as permissões da chave.' }); }
      const payload = await upstream.json() as { data?: Array<{ url?: string }> };
      const imageUrl = payload.data?.[0]?.url;
      if (!imageUrl) { releaseQuota(bucket, quota); return sendJson(res, 502, { error: 'A Pollinations não retornou uma imagem.' }); }
      return sendJson(res, 200, { imageUrl });
    }
    const query = new URLSearchParams({ model, duration: '5', aspectRatio: '16:9', safe: 'true' });
    const upstream = await fetch(`${API_BASE}/video/${encodeURIComponent(prompt)}?${query.toString()}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!upstream.ok) { releaseQuota(bucket, quota); return sendJson(res, upstream.status, { error: 'A Pollinations não conseguiu gerar o vídeo. Confira o saldo e as permissões da chave.' }); }
    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    res.status(200).setHeader('Content-Type', contentType).setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    releaseQuota(bucket, quota);
    return sendJson(res, 502, { error: 'Não foi possível alcançar a Pollinations agora. Tente novamente em instantes.' });
  }
}
