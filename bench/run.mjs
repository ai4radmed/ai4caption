// 배포된 중계 서버로 엔진별 지연·번역 결과를 실측한다 (서울 → Vercel icn1 → 엔진).
// node bench/run.mjs [엔진...]   기본: claude gemini google
const BASE = process.env.API_BASE || 'https://ai4caption.vercel.app';
const ENGINES = process.argv.slice(2).length ? process.argv.slice(2) : ['claude', 'gemini', 'google'];
const SENTENCES = [
  '오늘은 방사선 피폭과 선량한도에 대해 말씀드리겠습니다.',
  '핵의학 검사에서 방사성의약품을 투여한 후에는 일정 시간 동안 다른 사람과 거리를 유지해야 합니다.',
  '방사선작업종사자의 유효선량은 연간 50밀리시버트를 넘으면 안 되고 5년간 100밀리시버트를 넘으면 안 됩니다.',
  '갑상선암 환자에게 고용량 방사성 요오드 치료를 할 때는 격리 병실을 사용합니다.',
  '차폐와 거리 그리고 시간이 외부 피폭을 줄이는 세 가지 기본 원칙입니다.',
  '제염 작업을 할 때는 오염이 퍼지지 않도록 바깥쪽에서 안쪽으로 닦아야 합니다.',
];
const med = a => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length / 2)]); };
const rows = [];
await fetch(BASE + '/api/translate');                       // 예열
for (const engine of ENGINES) {
  const ttft = [], total = [];
  for (const text of SENTENCES) {
    const t0 = performance.now();
    const r = await fetch(BASE + '/api/translate', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ text, engine }) });
    if (!r.ok) { console.log(`[${engine}] ${r.status} ${await r.text()}`); break; }
    let first = null, out = '';
    for await (const c of r.body.pipeThrough(new TextDecoderStream())) { first ??= performance.now() - t0; out += c; }
    ttft.push(first); total.push(performance.now() - t0);
    console.log(`[${engine}] ${Math.round(first)}/${Math.round(performance.now() - t0)}ms  ${out.trim()}`);
  }
  if (ttft.length) rows.push({ engine, n: ttft.length, ttft_median: med(ttft), total_median: med(total) });
}
console.table(rows);
