// 로컬에서 handler 를 직접 호출해 엔진 동작·지연을 본다: node bench/local-test.mjs <engine> "<문장>"
import handler from '../api/translate.js';
const [engine = 'auto', text = '오늘은 방사선 피폭과 선량한도에 대해 말씀드리겠습니다.'] = process.argv.slice(2);
const t0 = performance.now();
const res = await handler(new Request('http://localhost/api/translate', {
  method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
  body: JSON.stringify({ text, engine }),
}));
console.log('status', res.status, 'engine', res.headers.get('x-engine'));
let first = null, out = '';
for await (const c of res.body.pipeThrough(new TextDecoderStream())) { first ??= performance.now() - t0; out += c; }
console.log(out.trim());
console.log(`첫 글자 ${Math.round(first)}ms · 완료 ${Math.round(performance.now() - t0)}ms`);
