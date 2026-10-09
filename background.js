/**
 * Topic Video Sidebar - background service worker
 * 负责：B站 / YouTube 视频搜索、WBI 签名、结果缓存
 */

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE = 120;

/* ------------------------------ 工具 ------------------------------ */

// 轻量 md5（service worker 环境无第三方库，crypto.subtle 不支持 MD5）
function md5(input) {
  const bytes = new TextEncoder().encode(String(input));
  const bitLen = bytes.length * 8;
  const totalLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  // 64 位长度（低位在前）
  const dv = new DataView(buf.buffer);
  dv.setUint32(totalLen - 8, bitLen >>> 0, true);
  dv.setUint32(totalLen - 4, Math.floor(bitLen / 4294967296), true);

  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
             5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
             4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
             6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = new Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  const rotl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < totalLen; off += 64) {
    for (let j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + rotl(F, S[i])) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const hex = (n) => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const byte = (n >>> (i * 8)) & 0xff;
      s += (byte < 16 ? '0' : '') + byte.toString(16);
    }
    return s;
  };
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
}

function fmtCount(n) {
  n = Number(n) || 0;
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  return String(n);
}

// 解析 "5,352,547次观看" / "1.2万次观看" / "1,234 views" / "No views"
function parseViewText(text) {
  if (!text) return 0;
  const s = String(text).replace(/,/g, '');
  let m = s.match(/([\d.]+)\s*万/);
  if (m) return Math.round(parseFloat(m[1]) * 10000);
  m = s.match(/([\d.]+)\s*亿/);
  if (m) return Math.round(parseFloat(m[1]) * 100000000);
  m = s.match(/([\d.]+)\s*[Kk]/);
  if (m) return Math.round(parseFloat(m[1]) * 1000);
  m = s.match(/([\d.]+)\s*[Mm]/);
  if (m) return Math.round(parseFloat(m[1]) * 1000000);
  m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// B站 duration: "2:28" / "2037:30" / "1:02:33"
function fmtBiliDuration(d) {
  const s = String(d || '');
  const parts = s.split(':').map((x) => parseInt(x, 10) || 0);
  if (parts.length === 3) return s;
  if (parts.length === 2) {
    let [m, sec] = parts;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `${h}:${String(mm).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${m}:${String(sec).padStart(2, '0')}`;
  }
  return s;
}

// ISO8601 PT1H2M3S -> 1:02:03
function fmtIsoDuration(iso) {
  const m = String(iso || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return '';
  const [, d, h, mi, s] = m;
  const H = (parseInt(d || 0, 10) * 24) + parseInt(h || 0, 10);
  const M = parseInt(mi || 0, 10);
  const S = parseInt(s || 0, 10);
  if (H > 0) return `${H}:${String(M).padStart(2, '0')}:${String(S).padStart(2, '0')}`;
  return `${M}:${String(S).padStart(2, '0')}`;
}

function cacheGet(key) {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.data;
  if (hit) CACHE.delete(key);
  return null;
}

function cacheSet(key, data) {
  if (CACHE.size > MAX_CACHE) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].t - b[1].t)[0];
    if (oldest) CACHE.delete(oldest[0]);
  }
  CACHE.set(key, { t: Date.now(), data });
}

/* ------------------------------ B站 ------------------------------ */

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
];

const BILI_ORDER = { relevance: 'totalrank', views: 'click', date: 'pubdate' };
let wbiState = { key: null, ts: 0 };

async function getWbiKey() {
  if (wbiState.key && Date.now() - wbiState.ts < 20 * 60 * 1000) return wbiState.key;
  const res = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { Accept: 'application/json' },
    credentials: 'omit'
  });
  const json = await res.json();
  const img = json?.data?.wbi_img?.img_url || '';
  const sub = json?.data?.wbi_img?.sub_url || '';
  if (!img || !sub) throw new Error('获取 B站 wbi 密钥失败');
  const a = img.split('/').pop().split('.')[0];
  const b = sub.split('/').pop().split('.')[0];
  const raw = a + b;
  const key = MIXIN_KEY_ENC_TAB.map((i) => raw[i]).join('').slice(0, 32);
  wbiState = { key, ts: Date.now() };
  return key;
}

function wbiSign(params, key) {
  const clean = (v) => String(v).replace(/[!'()*]/g, '');
  const p = { ...params, wts: Math.floor(Date.now() / 1000) };
  const query = Object.keys(p).sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(clean(p[k]))}`)
    .join('&');
  const w_rid = md5(query + key);
  return `${query}&w_rid=${w_rid}`;
}

async function searchBilibili(query, order, limit) {
  const cacheKey = `bili|${query}|${order}|${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const key = await getWbiKey();
  const url = 'https://api.bilibili.com/x/web-interface/wbi/search/type?' +
    wbiSign({ search_type: 'video', keyword: query, order: BILI_ORDER[order] || 'click', page: 1 }, key);

  const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit' });
  const json = await res.json();
  if (json?.code !== 0) throw new Error(`B站接口 ${json?.code}：${json?.message || '未知错误'}`);

  const items = (json?.data?.result || []).slice(0, limit).map((v) => {
    const pic = String(v.pic || '').startsWith('//') ? `https:${v.pic}` : (v.pic || '');
    return {
      platform: 'bilibili',
      id: v.bvid,
      url: `https://www.bilibili.com/video/${v.bvid}`,
      title: stripHtml(v.title),
      author: stripHtml(v.author),
      thumb: pic ? `${pic}@400w_250h_1c.webp` : '',
      duration: fmtBiliDuration(v.duration),
      views: Number(v.play) || 0,
      viewsText: fmtCount(v.play),
      danmaku: Number(v.video_review) || 0,
      published: v.pubdate ? v.pubdate * 1000 : 0
    };
  });
  cacheSet(cacheKey, items);
  return items;
}

/* ------------------------------ YouTube ------------------------------ */

const YT_ORDER = { relevance: 'relevance', views: 'viewCount', date: 'date' };

async function getSettings() {
  const s = await chrome.storage.sync.get({ youtubeApiKey: '', ytRegion: 'HK' });
  return s;
}

async function searchYoutubeApi(query, order, limit, apiKey, region) {
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', String(Math.min(limit * 2, 25)));
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('order', YT_ORDER[order] || 'viewCount');
  searchUrl.searchParams.set('regionCode', region || 'HK');
  searchUrl.searchParams.set('key', apiKey);

  const r1 = await fetch(searchUrl.toString(), { headers: { Accept: 'application/json' } });
  const j1 = await r1.json();
  if (j1?.error) throw new Error(`YouTube API：${j1.error.message || j1.error.code}`);
  const ids = (j1.items || []).map((i) => i?.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  let stats = {};
  try {
    const detailUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    detailUrl.searchParams.set('part', 'contentDetails,statistics');
    detailUrl.searchParams.set('id', ids.join(','));
    detailUrl.searchParams.set('key', apiKey);
    const r2 = await fetch(detailUrl.toString());
    const j2 = await r2.json();
    (j2.items || []).forEach((i) => {
      stats[i.id] = {
        duration: fmtIsoDuration(i?.contentDetails?.duration),
        views: Number(i?.statistics?.viewCount) || 0
      };
    });
  } catch (_) { /* 详情失败不影响主结果 */ }

  const items = (j1.items || []).slice(0, limit).map((i) => {
    const id = i?.id?.videoId;
    const sn = i?.snippet || {};
    const st = stats[id] || {};
    return {
      platform: 'youtube',
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: stripHtml(sn.title),
      author: stripHtml(sn.channelTitle),
      thumb: (sn.thumbnails?.medium || sn.thumbnails?.default || {}).url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      duration: st.duration || '',
      views: st.views || 0,
      viewsText: st.views ? fmtCount(st.views) : '',
      published: sn.publishedAt ? Date.parse(sn.publishedAt) : 0
    };
  });
  if (order === 'views') items.sort((a, b) => b.views - a.views);
  return items;
}

function extractYtInitialData(html) {
  const marker = html.search(/ytInitialData"?\s*[:=]/);
  if (marker < 0) throw new Error('未能解析 YouTube 搜索结果');
  const start = html.indexOf('{', marker);
  if (start < 0) throw new Error('未能解析 YouTube 搜索结果');
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
  }
  if (end < 0) throw new Error('未能解析 YouTube 搜索结果');
  return JSON.parse(html.slice(start, end));
}

function walkJson(node, key, out) {
  if (Array.isArray(node)) {
    for (const n of node) walkJson(n, key, out);
  } else if (node && typeof node === 'object') {
    if (node[key]) out.push(node[key]);
    for (const k of Object.keys(node)) walkJson(node[k], key, out);
  }
}

async function searchYoutubeScrape(query, order, limit) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=zh-CN&gl=HK`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
    credentials: 'omit'
  });
  if (!res.ok) throw new Error(`YouTube 请求失败 (${res.status})`);
  const html = await res.text();
  const data = extractYtInitialData(html);
  const renderers = [];
  walkJson(data, 'videoRenderer', renderers);

  const items = [];
  const seen = new Set();
  for (const v of renderers) {
    const id = v?.videoId;
    if (!id || seen.has(id)) continue;
    const title = v?.title?.runs?.[0]?.text || v?.title?.simpleText || '';
    if (!title) continue;
    seen.add(id);
    const thumbs = v?.thumbnail?.thumbnails || [];
    const thumb = thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    const views = parseViewText(v?.viewCountText?.simpleText || v?.viewCountText?.runs?.[0]?.text);
    items.push({
      platform: 'youtube',
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title,
      author: v?.ownerText?.runs?.[0]?.text || v?.longBylineText?.runs?.[0]?.text || '',
      thumb,
      duration: v?.lengthText?.simpleText || '',
      views,
      viewsText: views ? fmtCount(views) : '',
      published: 0
    });
    if (items.length >= limit * 2) break;
  }
  if (order === 'views') items.sort((a, b) => b.views - a.views);
  return items.slice(0, limit);
}

async function searchYoutube(query, order, limit) {
  const cacheKey = `yt|${query}|${order}|${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const { youtubeApiKey, ytRegion } = await getSettings();
  let items = [];
  if (youtubeApiKey) {
    items = await searchYoutubeApi(query, order, limit, youtubeApiKey, ytRegion);
  } else {
    try {
      items = await searchYoutubeScrape(query, order, limit);
    } catch (e) {
      // 瞬时失败重试一次
      await new Promise((r) => setTimeout(r, 900));
      items = await searchYoutubeScrape(query, order, limit);
    }
  }
  cacheSet(cacheKey, items);
  return items;
}

/* ------------------------------ 订阅博主 ------------------------------ */

const SUB_CACHE = new Map();
const SUB_TTL = 30 * 60 * 1000;
const SEEN_TTL = 7 * 24 * 60 * 60 * 1000;

function decodeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

async function pool(tasks, size) {
  const queue = tasks.slice();
  const workers = new Array(Math.min(size, queue.length)).fill(0).map(async () => {
    while (queue.length) {
      const t = queue.shift();
      try { await t(); } catch (_) { /* 单个失败不影响整体 */ }
    }
  });
  await Promise.all(workers);
}

async function getSeenMap() {
  const { tvsSeen } = await chrome.storage.local.get({ tvsSeen: {} });
  const now = Date.now();
  const out = {};
  for (const [k, t] of Object.entries(tvsSeen || {})) {
    if (now - t < SEEN_TTL) out[k] = t;
  }
  return out;
}

/* --- 解析博主 --- */

async function resolveBiliUp(keyword) {
  const kw = String(keyword || '').trim();
  if (!kw) throw new Error('请输入 UP 主名称或空间链接');
  const midMatch = kw.match(/space\.bilibili\.com\/(\d+)/) || kw.match(/^(\d{3,})$/);
  if (midMatch) {
    const mid = midMatch[1];
    try {
      const r = await fetch(`https://api.bilibili.com/x/web-interface/card?mid=${mid}&photo=false`, {
        headers: { Accept: 'application/json' }
      });
      const j = await r.json();
      if (j?.code === 0 && j?.data?.card?.name) {
        return {
          platform: 'bilibili', uid: mid, name: j.data.card.name,
          avatar: String(j.data.card.face || '').replace(/^http:/, 'https:')
        };
      }
    } catch (_) { /* 走搜索兜底 */ }
  }
  const url = 'https://api.bilibili.com/x/web-interface/wbi/search/type?' +
    wbiSign({ search_type: 'bili_user', keyword: kw, order: 'fans', page: 1 }, await getWbiKey());
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const j = await res.json();
  if (j?.code !== 0) throw new Error(`B站接口 ${j?.code}：${j?.message || '未知错误'}`);
  const u = (j?.data?.result || [])[0];
  if (!u) throw new Error('未找到该 UP 主，换个名字试试');
  let pic = u.upic || '';
  if (pic.startsWith('//')) pic = 'https:' + pic;
  return { platform: 'bilibili', uid: String(u.mid), name: u.uname, avatar: pic };
}

async function ytChannelName(cid) {
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`);
    const xml = await r.text();
    const m = xml.match(/<title>([^<]*)<\/title>/);
    if (m) return decodeXml(m[1]);
  } catch (_) { /* 忽略 */ }
  return cid;
}

async function resolveYtUp(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('请输入频道名、@handle 或频道链接');
  const UA_HEADERS = { 'Accept-Language': 'en-US,en;q=0.9' };

  let cid = '';
  let m = raw.match(/(UC[\w-]{20,})/);
  if (m) {
    cid = m[1];
  } else {
    let url = '';
    const hm = raw.match(/youtube\.com\/(@[\w.-]+)/) || raw.match(/^(@[\w.-]+)$/);
    if (hm) {
      url = 'https://www.youtube.com/' + (hm[1].startsWith('@') ? hm[1] : '@' + hm[1]);
    } else {
      url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(raw) + '&sp=EgIQAg%3D%3D';
    }
    const r = await fetch(url, { headers: UA_HEADERS, credentials: 'omit' });
    const html = await r.text();
    const cm = html.match(/"channelId":"(UC[\w-]{20,})"/) || html.match(/channel_id=(UC[\w-]{20,})/) ||
      html.match(/\/(UC[\w-]{20,})/);
    if (!cm) throw new Error('未找到该频道，试试 @handle 或频道链接');
    cid = cm[1];
  }
  const name = await ytChannelName(cid);
  const handleMatch = raw.match(/@([\w.-]+)/);
  return { platform: 'youtube', uid: cid, name, handle: handleMatch ? handleMatch[1] : '', avatar: '' };
}

async function resolveUp({ platform, input }) {
  const r = platform === 'youtube' ? await resolveYtUp(input) : await resolveBiliUp(input);
  return { ok: true, up: r };
}

/* --- 订阅博主的匹配视频 --- */

function mapBiliItem(v, sub) {
  const pic = String(v.pic || '').startsWith('//') ? `https:${v.pic}` : (v.pic || '');
  return {
    platform: 'bilibili',
    id: v.bvid,
    url: `https://www.bilibili.com/video/${v.bvid}`,
    title: stripHtml(v.title),
    author: stripHtml(v.author),
    thumb: pic ? `${pic}@400w_250h_1c.webp` : '',
    duration: fmtBiliDuration(v.duration),
    views: Number(v.play) || 0,
    viewsText: fmtCount(v.play),
    published: v.pubdate ? v.pubdate * 1000 : 0,
    subName: sub.name
  };
}

async function subBiliVideos(sub, topic, limit) {
  const ck = `sub|bili|${sub.uid}|${topic}`;
  const cached = SUB_CACHE.get(ck);
  if (cached && Date.now() - cached.t < SUB_TTL) return cached.data;

  const q = `${sub.name} ${topic}`.slice(0, 80);
  const url = 'https://api.bilibili.com/x/web-interface/wbi/search/type?' +
    wbiSign({ search_type: 'video', keyword: q, order: 'click', page: 1 }, await getWbiKey());
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const j = await res.json();
  if (j?.code !== 0) throw new Error(`B站接口 ${j?.code}`);
  const items = (j?.data?.result || [])
    .filter((v) => String(v.author || '').includes(sub.name))
    .slice(0, limit)
    .map((v) => mapBiliItem(v, sub));
  SUB_CACHE.set(ck, { t: Date.now(), data: items });
  return items;
}

function parseYtFeed(xml, sub) {
  const entries = xml.split('<entry>').slice(1);
  const out = [];
  for (const e of entries) {
    const id = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const titleRaw = (e.match(/<media:title>([^<]*)<\/media:title>/) || e.match(/<title>([^<]*)<\/title>/) || [])[1];
    const pub = (e.match(/<published>([^<]+)<\/published>/) || [])[1];
    const thumb = (e.match(/<media:thumbnail url="([^"]+)"/) || [])[1];
    if (!id || !titleRaw) continue;
    out.push({
      platform: 'youtube',
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: decodeXml(titleRaw),
      author: sub.name,
      thumb: thumb || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      duration: '',
      views: 0,
      viewsText: '',
      published: pub ? Date.parse(pub) : 0,
      subName: sub.name
    });
  }
  return out;
}

function titleMatch(text, words) {
  const t = String(text || '').toLowerCase();
  return words.some((w) => {
    const lw = String(w || '').toLowerCase().trim();
    if (lw.length < 2) return false;
    if (/[\u4e00-\u9fa5]/.test(lw)) return t.includes(lw);
    // 英文用单词边界，避免 "ai" 命中 "said"
    const re = new RegExp('(^|[^a-z0-9])' + lw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i');
    return re.test(t);
  });
}

async function subYtVideos(sub, words, topic, limit, apiKey) {
  const ck = `sub|yt|${sub.uid}|${topic}`;
  const cached = SUB_CACHE.get(ck);
  if (cached && Date.now() - cached.t < SUB_TTL) return cached.data;

  let items = [];
  if (apiKey) {
    try {
      const u = new URL('https://www.googleapis.com/youtube/v3/search');
      u.searchParams.set('part', 'snippet');
      u.searchParams.set('type', 'video');
      u.searchParams.set('channelId', sub.uid);
      u.searchParams.set('q', topic);
      u.searchParams.set('order', 'date');
      u.searchParams.set('maxResults', String(limit));
      u.searchParams.set('key', apiKey);
      const r = await fetch(u.toString());
      const j = await r.json();
      if (j?.error) throw new Error(j.error.message || 'API 错误');
      items = (j.items || []).map((i) => ({
        platform: 'youtube',
        id: i?.id?.videoId,
        url: `https://www.youtube.com/watch?v=${i?.id?.videoId}`,
        title: stripHtml(i?.snippet?.title),
        author: i?.snippet?.channelTitle || sub.name,
        thumb: (i?.snippet?.thumbnails?.medium || {}).url || `https://i.ytimg.com/vi/${i?.id?.videoId}/mqdefault.jpg`,
        duration: '', views: 0, viewsText: '',
        published: i?.snippet?.publishedAt ? Date.parse(i.snippet.publishedAt) : 0,
        subName: sub.name
      }));
    } catch (_) { items = []; }
  }
  if (!items.length) {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${sub.uid}`, { credentials: 'omit' });
    if (!r.ok) throw new Error(`YouTube RSS ${r.status}`);
    const xml = await r.text();
    const all = parseYtFeed(xml, sub);
    items = all.filter((it) => titleMatch(it.title, words)).slice(0, limit);
  }
  SUB_CACHE.set(ck, { t: Date.now(), data: items });
  return items;
}

async function doCheckSubs({ query, keywords }) {
  const cfg = await chrome.storage.sync.get({ subscriptions: [], youtubeApiKey: '' });
  const subs = cfg.subscriptions || [];
  if (!subs.length) return { ok: true, hits: [] };
  const topic = String(query || '').trim();
  if (!topic) return { ok: true, hits: [] };
  const words = (keywords && keywords.length ? keywords : topic.split(/\s+/)).filter((w) => w && w.length >= 2);

  const seen = await getSeenMap();
  const hits = [];
  const seenDirty = { v: false };

  await pool(subs.map((sub) => async () => {
    let items = [];
    try {
      items = sub.platform === 'bilibili'
        ? await subBiliVideos(sub, topic, 3)
        : await subYtVideos(sub, words, topic, 3, cfg.youtubeApiKey);
    } catch (_) { return; }
    if (!items.length) return;
    const fresh = items.filter((it) => {
      const k = it.platform + ':' + it.id;
      if (seen[k]) return false;
      seen[k] = Date.now();
      seenDirty.v = true;
      return true;
    });
    hits.push({ sub, videos: items, fresh });
  }), 5);

  if (seenDirty.v) {
    // 限制体积：只保留最近 400 条
    const keys = Object.keys(seen).sort((a, b) => seen[b] - seen[a]).slice(0, 400);
    const trimmed = {};
    keys.forEach((k) => { trimmed[k] = seen[k]; });
    await chrome.storage.local.set({ tvsSeen: trimmed });
  }

  hits.sort((a, b) => (b.fresh.length - a.fresh.length) || ((b.videos[0]?.views || 0) - (a.videos[0]?.views || 0)));
  return { ok: true, hits };
}

/* ------------------------------ 调度 ------------------------------ */

async function searchPlatform(platform, query, order, limit) {
  const run = (q) => (platform === 'bilibili' ? searchBilibili(q, order, limit) : searchYoutube(q, order, limit));
  let items = [];
  let error = null;
  let usedQuery = query;
  try {
    items = await run(query);
  } catch (e) {
    error = e?.message || String(e);
  }
  // 多关键词过窄时自动降级为前一半关键词
  if (items.length < 3) {
    const words = query.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      const q2 = words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(' ');
      try {
        const more = await run(q2);
        if (more.length > items.length) { items = more; usedQuery = q2; error = null; }
      } catch (e) {
        if (!error) error = e?.message || String(e);
      }
    }
  }
  return { platform, items, error, query: usedQuery };
}

async function doSearch({ query, platforms, order, limit }) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: '未能识别页面主题，请手动输入关键词' };
  const list = (platforms && platforms.length ? platforms : ['bilibili', 'youtube']);
  const lim = Math.min(Math.max(parseInt(limit, 10) || 12, 3), 30);
  const ord = order || 'views';
  const results = await Promise.all(list.map((p) => searchPlatform(p, q, ord, lim)));
  return { ok: true, query: q, order: ord, results };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'tvs.search') {
    doSearch(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
    return true;
  }
  if (msg.type === 'tvs.clearCache') {
    CACHE.clear();
    SUB_CACHE.clear();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'tvs.resolveUp') {
    resolveUp(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
    return true;
  }
  if (msg.type === 'tvs.checkSubs') {
    doCheckSubs(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({
    autoOpen: true, platform: 'both', order: 'views', limit: 12,
    youtubeApiKey: '', ytRegion: 'HK', subscriptions: [], notifyEnabled: true
  }).then((cfg) => {
    chrome.storage.sync.set({
      autoOpen: cfg.autoOpen,
      platform: cfg.platform,
      order: cfg.order,
      limit: cfg.limit,
      youtubeApiKey: cfg.youtubeApiKey,
      ytRegion: cfg.ytRegion,
      subscriptions: cfg.subscriptions,
      notifyEnabled: cfg.notifyEnabled
    });
  });
});
