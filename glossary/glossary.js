// 용어집 로더·매처 — 정본은 glossary/ko-en.tsv (ko · en · aliases · source · note)
// 서버는 TSV 를 GitHub Pages 에서 런타임에 읽는다 → 용어집만 고치면 push 후 1~2분 안에 반영(서버 재배포 불필요).
import SEED from './seed.js';

const SOURCES = [
  process.env.GLOSSARY_URL || 'https://ai4radmed.github.io/ai4caption/glossary/ko-en.tsv',
  'https://raw.githubusercontent.com/ai4radmed/ai4caption/main/glossary/ko-en.tsv',
];
const TTL = 60_000;
let cache = { entries: build(SEED.map(([ko, en]) => ({ ko, en, aliases: [] }))), ts: 0, from: 'seed' };
let loading = null;

export function parseTsv(text) {
  const rows = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  const head = rows.shift().split('\t').map(s => s.trim());
  const ix = k => head.indexOf(k);
  return rows.map(l => l.split('\t')).map(c => ({
    ko: (c[ix('ko')] || '').trim(),
    en: (c[ix('en')] || '').trim(),
    aliases: (c[ix('aliases')] || '').split(';').map(s => s.trim()).filter(Boolean),
  })).filter(e => e.ko && e.en);
}

// 띄어쓰기 무시 매칭: "선량한도" 가 "선량 한도" 로 인식돼도 잡는다
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function pattern(term) { return term.replace(/\s+/g, '').split('').map(esc).join('\\s*'); }
function build(list) {
  return list.map(e => ({ ...e, re: new RegExp([e.ko, ...e.aliases].sort((a, b) => b.length - a.length).map(pattern).join('|'), 'g') }));
}

async function refresh() {
  for (const url of SOURCES) {
    try {
      const r = await fetch(url + '?t=' + Math.floor(Date.now() / TTL), { signal: AbortSignal.timeout(1500) });   // 분 단위 캐시 무력화
      if (!r.ok) continue;
      const list = parseTsv(await r.text());
      if (list.length) { cache = { entries: build(list), ts: Date.now(), from: url }; return; }
    } catch (e) { /* 다음 출처 */ }
  }
  cache.ts = Date.now();                      // 실패해도 TTL 동안은 재시도하지 않는다 (기존 목록 유지)
}

// 오래되면(1분) 새로 읽는다. Edge 런타임은 응답 후 남은 작업을 끊으므로 백그라운드 갱신이 안 된다 → 기다려서 읽는다.
// (분당 1회 · 같은 서울 CDN 이라 수십 ms)
export async function glossary() {
  if (Date.now() - cache.ts > TTL) {
    loading ??= refresh().finally(() => { loading = null; });
    await loading;
  }
  return cache;
}

// 문장에 나온 용어만 골라낸다. 긴 용어가 짧은 용어를 덮으면(예: 한국원자력의학원 ⊃ 원자력의학원) 짧은 것은 뺀다.
export function matchTerms(entries, text) {
  const hits = [];
  for (const e of entries) {
    e.re.lastIndex = 0;
    let m;
    while ((m = e.re.exec(text))) hits.push({ e, s: m.index, t: m.index + m[0].length, hit: m[0] });
  }
  hits.sort((a, b) => (b.t - b.s) - (a.t - a.s));
  const taken = [], out = new Map();
  for (const h of hits) {
    if (taken.some(x => h.s < x.t && x.s < h.t)) continue;
    taken.push(h);
    if (!out.has(h.e.ko)) out.set(h.e.ko, { ko: h.e.ko, en: h.e.en, heard: h.hit, re: h.e.re });
  }
  return [...out.values()];
}
