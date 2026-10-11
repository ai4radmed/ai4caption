// AI4Caption 번역 중계 서버 (Vercel Edge, 서울 리전)
// - 키는 Vercel env 에만 둔다 (노트북·저장소에 없음)
// - 엔진: claude → gemini → google 순서로 시도(auto), 하나를 지정할 수도 있다
// - 응답은 text/plain 스트림 — 앱이 받는 대로 자막에 그린다
import Anthropic from '@anthropic-ai/sdk';
import { glossary, matchTerms } from '../glossary/glossary.js';

export const config = { runtime: 'edge', regions: ['icn1'] };

const ALLOWED_ORIGINS = [/^https:\/\/ai4radmed\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-5-5';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const MAX_TEXT = 600, MAX_CTX = 3;

const SYSTEM = [
  'You are a live interpreter producing English subtitles for a lecture by a Korean nuclear medicine physician',
  'to an international audience (IAEA scientific visit on radiation safety and nuclear medicine).',
  'Input is Korean speech-recognition text; it may contain recognition errors, fillers or be an unfinished sentence.',
  'Translate it into natural, concise spoken English suitable for a subtitle.',
  'Fix obvious speech-recognition errors only when the intended meaning is clear from context. Drop fillers.',
  'Output ONLY the English translation — no quotes, notes, or explanations.',
  'When required term translations are listed, use each English term exactly as given (you may adjust singular/plural or article).',
].join('\n');

// 이 문장에 나온 용어만 프롬프트에 넣는다 — 용어집이 커져도 프롬프트가 짧고 지시가 선명하다
function userPrompt(text, context, interim, terms) {
  const ctx = context.length ? 'Previous sentences (context only, do not translate):\n' + context.map(c => '- ' + c).join('\n') + '\n\n' : '';
  const req = terms.length ? 'Required term translations:\n' + terms.map(t => `- ${t.heard} → ${t.en}`).join('\n') + '\n\n' : '';
  return ctx + req + (interim ? 'Unfinished sentence (translate what is there):\n' : 'Sentence:\n') + text;
}

/* ---------------- 엔진 ---------------- */
const engines = {
  claude: {
    ready: () => !!process.env.ANTHROPIC_API_KEY,
    async *run(text, context, interim, terms) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
      const stream = client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: 400,
        thinking: { type: 'disabled' },          // 번역은 사고가 필요 없다 — 지연 최소화
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt(text, context, interim, terms) }],
      });
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield ev.delta.text;
      }
    },
  },
  gemini: {
    ready: () => !!process.env.GEMINI_API_KEY,
    async *run(text, context, interim, terms) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt(text, context, interim, terms) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
        }),
      });
      if (!r.ok) throw new Error('gemini ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          const d = JSON.parse(line.slice(5));
          for (const p of d.candidates?.[0]?.content?.parts || []) if (p.text && !p.thought) yield p.text;
        }
      }
    },
  },
  google: {
    // Cloud Translation v2 (번역 전용, 가장 빠름). 용어집은 한국어 용어를 영어로 미리 치환해 근사한다.
    ready: () => !!process.env.GOOGLE_TRANSLATE_API_KEY,
    async *run(text, context, interim, terms) {
      let q = text;
      for (const t of terms) { t.re.lastIndex = 0; q = q.replace(t.re, ' ' + t.en + ' '); }
      const r = await fetch('https://translation.googleapis.com/language/translate/v2?key=' + process.env.GOOGLE_TRANSLATE_API_KEY, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q, source: 'ko', target: 'en', format: 'text' }),
      });
      if (!r.ok) throw new Error('google ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const d = await r.json();
      yield d.data.translations[0].translatedText;
    },
  },
};
const ORDER = ['claude', 'gemini', 'google'];

/* ---------------- HTTP ---------------- */
function cors(req) {
  const o = req.headers.get('origin') || '';
  const h = { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type',
              'access-control-expose-headers': 'x-engine, x-terms', vary: 'origin' };
  if (ALLOWED_ORIGINS.some(re => re.test(o))) h['access-control-allow-origin'] = o;
  return h;
}

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  // 예열(콜드 스타트 제거) + 엔진 설정 상태
  if (req.method === 'GET') {
    const ready = Object.fromEntries(ORDER.map(k => [k, engines[k].ready()]));
    const g = await glossary();
    return Response.json({ ok: true, ready, models: { claude: CLAUDE_MODEL, gemini: GEMINI_MODEL },
                           glossary: { terms: g.entries.length, from: g.from } }, { headers: h });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: h });
  if (!h['access-control-allow-origin'] && req.headers.get('origin')) return new Response('origin not allowed', { status: 403, headers: h });

  let body;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400, headers: h }); }
  const text = String(body.text || '').trim().slice(0, MAX_TEXT);
  const context = (Array.isArray(body.context) ? body.context : []).slice(-MAX_CTX).map(c => String(c).slice(0, 300));
  const interim = !!body.interim;
  if (!text) return new Response('empty', { status: 400, headers: h });

  const want = body.engine && body.engine !== 'auto' ? [body.engine] : ORDER;
  const chain = want.filter(k => engines[k]?.ready());
  if (!chain.length) return new Response('no engine configured', { status: 503, headers: h });

  // 첫 조각이 나올 때까지는 다음 엔진으로 넘어갈 수 있다 (스트림 시작 후에는 그대로 끝까지)
  const terms = matchTerms((await glossary()).entries, text);
  // 앱이 번역 결과에 용어가 지켜졌는지 검사하도록 적용 용어를 헤더로 돌려준다 (헤더는 ASCII 만 → URI 인코딩)
  const termsHeader = encodeURIComponent(JSON.stringify(terms.map(t => [t.ko, t.en])));
  const errors = [];
  for (const name of chain) {
    const it = engines[name].run(text, context, interim, terms)[Symbol.asyncIterator]();
    let first;
    try { first = await it.next(); } catch (e) { errors.push(name + ': ' + e.message); continue; }
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(ctrl) {
        try {
          if (!first.done) ctrl.enqueue(enc.encode(first.value));
          for (let n = await it.next(); !n.done; n = await it.next()) ctrl.enqueue(enc.encode(n.value));
        } catch (e) { /* 중간 실패 — 받은 데까지만 */ }
        ctrl.close();
      },
    });
    return new Response(stream, { headers: { ...h, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-engine': name, 'x-terms': termsHeader } });
  }
  return new Response('all engines failed: ' + errors.join(' | '), { status: 502, headers: h });
}
