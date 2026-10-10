/* 写作乐园体检：node scripts/check-writing.js
   ① writing.js 同形异码字扫描 + 标识符一致性 + Fx/Sfx/api 存在性
   ② writing-data.js 数据对账（家长补题后请重跑本脚本） */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(root, p), 'utf8');
const s = rd('js/games/writing.js');

/* ---------- ① 代码体检 ---------- */
const strip = s.replace(/[\u2E80-\u303F\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u2460-\u24FF\u2600-\u27BF\u2B00-\u2BFF\u2190-\u21FF\u1F000-\u1FAFF\uFE0F\u200D\u00B7\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, '');
const bad = [...new Set(strip.match(/[^\x00-\x7F\n]/g) || [])].map(c => c + ' U+' + c.codePointAt(0).toString(16));
console.log('同形异码字:', bad.length ? bad.join(',') : '无');
console.log('removeWrong 残留:', (s.match(/removeWrong/g) || []).length);
console.log('kind 字面量:', [...new Set([...s.matchAll(/kind\s*={2,3}\s*'([^']+)'/g)].map(m => m[1]))].join('|'));
console.log('variant 字面量:', [...new Set([...s.matchAll(/variant\s*={2,3}\s*'([^']+)'/g)].map(m => m[1]))].join('|'));
console.log('S 属性 used:', [...new Set([...s.matchAll(/S\.([A-Za-z_$][\w$]*)/g)].map(m => m[1]))].sort().join(','));

const fx = rd('js/fx.js'), sfx = rd('js/sfx.js'), app = rd('js/app.js');
const use = (re) => [...new Set([...s.matchAll(re)].map(m => m[1]))];
const fxUsed = use(/Fx\.(\w+)/g), sfxUsed = use(/Sfx\.(\w+)/g), apiUsed = use(/api\.(\w+)/g);
console.log('Fx 调用:', fxUsed.join(','));
console.log('Sfx 调用:', sfxUsed.join(','));
console.log('api 调用:', apiUsed.join(','));
fxUsed.forEach(m => console.log('  Fx.' + m, '存在:', new RegExp('[^a-zA-Z]' + m + '\\s*[:=]').test(fx) || new RegExp('\\.' + m + '\\(').test(fx)));
sfxUsed.forEach(m => console.log('  Sfx.' + m, '存在:', new RegExp('[^a-zA-Z]' + m + '\\s*[:=]').test(sfx)));
apiUsed.forEach(m => console.log('  api.' + m, '存在:', new RegExp('\\b' + m + '\\s*[:=]').test(app)));

/* ---------- ② 数据对账 ---------- */
global.window = {};
require(path.join(root, 'js/writing-data.js'));
const D = window.WRITING_DATA;
const T = D.typos, C = D.clean, G = D.gold, A = D.abbs, K = D.cards;
console.log('数量: typos', T.length, 'clean', C.length, 'gold', G.length, 'abbs', A.length, 'cards', K.length);
const errs = [];
T.forEach(t => {
  const n = t.text.split(t.bug).length - 1;
  if (n === 0) errs.push(t.id + ' 文中无bug字');   /* 干干静静这类双虫句合法 */
  if (t.fix === t.bug) errs.push(t.id + ' fix==bug');
  if (!t.hint) errs.push(t.id + ' 缺hint');
});
const pu = {}, pg = {};
T.forEach(t => pu[t.u] = (pu[t.u] || 0) + 1);
G.forEach(g => pg[g.u] = (pg[g.u] || 0) + 1);
console.log('typos/单元:', Object.values(pu).join(','), '| gold/单元:', Object.values(pg).join(','));
G.forEach(g => {
  const m = g.s.match(/【(.+?)】/);
  if (!m) { errs.push(g.id + ' 题面缺【】平淡词标记'); return; }
  if (m[1] === g.w) errs.push(g.id + ' 升级词与平淡词相同');
  if (g.o.filter(o => o[3] === 1).length !== 1) errs.push(g.id + ' 最佳项!=1');
});
A.forEach(a => {
  if (!a.opts.includes(a.ans)) errs.push(a.id + ' ans不在opts');
  if (!a.full.includes(a.ans)) errs.push(a.id + ' full缺ans');
});
const wset = new Set(K.map(k => k.w));
if (wset.size !== K.length) errs.push('cards 有重复词');
const gmiss = [];
G.forEach(g => { if (!wset.has(g.w)) gmiss.push(g.id + ':' + g.w); });
console.log('gold.w 不在词卡:', gmiss.length ? gmiss.join(',') : '无');
const kg = {};
K.forEach(k => kg[k.g] = (kg[k.g] || 0) + 1);
console.log('cards 分组:', JSON.stringify(kg));

/* ---------- ②b 二期对账：L2 标点 / L3 连词（家长补题后同样必须重跑） ---------- */
const PU = D.puncts || [], CJ = D.conjs || [], pids = {}, cids = {};
console.log('数量: puncts', PU.length, 'conjs', CJ.length);
PU.forEach(p => {
  if (pids[p.id]) errs.push(p.id + ' punct id重复'); pids[p.id] = 1;
  if (![1, 2, 3].includes(p.t)) errs.push(p.id + ' t非法');
  if (p.segs.length !== p.marks.length) errs.push(p.id + ' 段数' + p.segs.length + '!=标点数' + p.marks.length);
  p.marks.forEach((m, i) => {
    const end = i === p.marks.length - 1;
    if (end && '。？！'.indexOf(m) < 0) errs.push(p.id + ' 句末标点非法:' + m);
    if (!end && '，、'.indexOf(m) < 0) errs.push(p.id + ' 句中标点非法:' + m);
  });
  if (p.t === 1 && p.segs.length !== 1) errs.push(p.id + ' 萌新档只考句末（应1段）');
  if (p.t === 2 && p.marks.indexOf('、') >= 0) errs.push(p.id + ' 进阶档不应含顿号');
});
CJ.forEach(c => {
  if (cids[c.id]) errs.push(c.id + ' conj id重复'); cids[c.id] = 1;
  if (c.t === 1) {
    if (c.items.length !== 4) errs.push(c.id + ' 配对应为4组');
    c.items.forEach(it => { if (it.length !== 2) errs.push(c.id + ' 配对项非[前,后]'); });
  } else if (c.t === 2) {
    const slots = c.s.split('（　）').length - 1;
    if (slots !== c.ans.length) errs.push(c.id + ' 空位数' + slots + '!=答案数' + c.ans.length);
    c.ans.forEach(w => { if (c.opts.indexOf(w) < 0) errs.push(c.id + ' 答案「' + w + '」不在opts'); });
  } else if (c.t === 3) {
    if (!Array.isArray(c.s)) { errs.push(c.id + ' s应为句数组'); return; }
    const qmap = {};
    c.qs.forEach(q => {
      if (c.s[q.i] === undefined || c.s[q.i].indexOf('然后') !== 0) errs.push(c.id + ' qs.i=' + q.i + ' 非然后句(0基)');
      if (qmap[q.i]) errs.push(c.id + ' qs.i重复:' + q.i); qmap[q.i] = 1;
      if (!q.opts || q.opts.indexOf(q.ans) < 0) errs.push(c.id + ' i=' + q.i + ' ans不在opts');
      if (!q.why) errs.push(c.id + ' i=' + q.i + ' 缺why');
    });
  } else errs.push(c.id + ' t非法');
});

console.log('数据问题:', errs.length ? errs.join(' | ') : '无');
