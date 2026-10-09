const $ = (id) => document.getElementById(id);
const PRESETS = window.TVS_PRESETS || [];
let subs = [];

const tip = (el, text, isErr) => {
  el.textContent = text;
  el.className = 'tip' + (isErr ? ' err' : '');
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3200);
};

const subKey = (s) => `${s.platform}:${s.uid}`;
const avatarColor = (name) => {
  const colors = ['#6b7cff', '#fb7299', '#ff4e45', '#00a1d6', '#f5a623', '#8f5bff'];
  let h = 0;
  for (const c of String(name || '')) h = (h + c.charCodeAt(0)) % colors.length;
  return colors[h];
};

async function load() {
  const cfg = await chrome.storage.sync.get({
    subscriptions: [], notifyEnabled: true, platform: 'both', order: 'views',
    youtubeApiKey: '', autoOpen: false, toastSeconds: 8
  });
  subs = cfg.subscriptions || [];
  $('notifyEnabled').checked = !!cfg.notifyEnabled;
  $('toastSeconds').value = String(Number(cfg.toastSeconds) || 8);
  $('platform').value = cfg.platform;
  $('order').value = cfg.order;
  $('ytKey').value = cfg.youtubeApiKey || '';
  $('autoOpen').checked = !!cfg.autoOpen;
  renderSubs();
  renderPresets();
}

function renderSubs() {
  const list = $('subList');
  list.innerHTML = '';
  $('subCount').textContent = subs.length ? `（${subs.length}）` : '';
  $('subEmpty').style.display = subs.length ? 'none' : 'block';

  subs.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'sub-item';

    const av = document.createElement('div');
    av.className = 'avatar';
    av.style.background = avatarColor(s.name);
    if (s.avatar) {
      const img = document.createElement('img');
      img.className = 'avatar';
      img.src = s.avatar;
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => { img.replaceWith(av); };
      item.appendChild(img);
    } else {
      av.textContent = (s.name || '?').slice(0, 1).toUpperCase();
      item.appendChild(av);
    }

    const info = document.createElement('div');
    const nm = document.createElement('div');
    nm.className = 'sub-name';
    nm.textContent = s.name || s.uid;
    const meta = document.createElement('div');
    meta.className = 'sub-meta';
    meta.textContent = s.platform === 'bilibili' ? `哔哩哔哩 · UID ${s.uid}` : `YouTube · ${s.uid}`;
    info.appendChild(nm);
    info.appendChild(meta);
    item.appendChild(info);

    const del = document.createElement('button');
    del.className = 'mini';
    del.style.marginLeft = 'auto';
    del.textContent = '移除';
    del.onclick = () => {
      subs = subs.filter((x) => subKey(x) !== subKey(s));
      save({ refresh: true });
    };
    item.appendChild(del);
    list.appendChild(item);
  });
}

function renderPresets() {
  const box = $('presetList');
  box.innerHTML = '';
  PRESETS.forEach((g) => {
    const owned = g.ups.filter((u) => subs.some((s) => subKey(s) === subKey(u))).length;
    const all = owned === g.ups.length;

    const card = document.createElement('div');
    card.className = 'preset';
    const hd = document.createElement('div');
    hd.className = 'preset-hd';
    const nm = document.createElement('div');
    nm.className = 'preset-name';
    nm.textContent = g.name;
    const desc = document.createElement('div');
    desc.className = 'preset-desc';
    desc.textContent = `${g.desc} · 已订阅 ${owned}/${g.ups.length}`;
    const btn = document.createElement('button');
    btn.className = all ? 'mini on' : 'mini pri';
    btn.style.marginLeft = 'auto';
    btn.textContent = all ? '已订阅（点击取消）' : (owned ? '订阅全部' : '订阅整组');
    btn.onclick = () => {
      if (all) {
        const keys = new Set(g.ups.map(subKey));
        subs = subs.filter((s) => !keys.has(subKey(s)));
      } else {
        g.ups.forEach((u) => {
          if (!subs.some((s) => subKey(s) === subKey(u))) subs.push({ ...u });
        });
      }
      save({ refresh: true });
    };
    hd.appendChild(nm);
    hd.appendChild(desc);
    hd.appendChild(btn);
    card.appendChild(hd);

    const ups = document.createElement('div');
    ups.className = 'preset-ups';
    g.ups.forEach((u) => {
      const t = document.createElement('span');
      t.className = 'up-tag ' + u.platform;
      t.textContent = (u.platform === 'bilibili' ? '' : '') + u.name;
      const on = subs.some((s) => subKey(s) === subKey(u));
      t.style.opacity = on ? '1' : '.55';
      t.style.cursor = 'pointer';
      t.title = on ? '点击取消订阅' : '点击单独订阅';
      t.onclick = () => {
        if (on) subs = subs.filter((s) => subKey(s) !== subKey(u));
        else subs.push({ ...u });
        save({ refresh: true });
      };
      ups.appendChild(t);
    });
    card.appendChild(ups);
    box.appendChild(card);
  });
}

async function save({ refresh } = {}) {
  await chrome.storage.sync.set({ subscriptions: subs });
  renderSubs();
  renderPresets();
  if (refresh) {
    // 让已打开的页面侧栏重新检查订阅
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    tabs.forEach((t) => chrome.tabs.sendMessage(t.id, { type: 'tvs.refreshSubs' }).catch(() => {}));
  }
}

$('addBtn').onclick = async () => {
  const input = $('addInput').value.trim();
  if (!input) { tip($('addTip'), '请输入名称或链接', true); return; }
  const btn = $('addBtn');
  btn.disabled = true;
  btn.textContent = '解析中…';
  try {
    const res = await chrome.runtime.sendMessage({ type: 'tvs.resolveUp', platform: $('addPlatform').value, input });
    if (!res || !res.ok) throw new Error(res?.error || '解析失败');
    const up = res.up;
    if (subs.some((s) => subKey(s) === subKey(up))) {
      tip($('addTip'), '已订阅过该博主', true);
    } else {
      subs.push(up);
      await save({ refresh: true });
      tip($('addTip'), `已订阅：${up.name}`);
      $('addInput').value = '';
    }
  } catch (e) {
    tip($('addTip'), e?.message || '添加失败', true);
  } finally {
    btn.disabled = false;
    btn.textContent = '添加';
  }
};

$('addInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('addBtn').click(); });

$('notifyEnabled').onchange = () => {
  chrome.storage.sync.set({ notifyEnabled: $('notifyEnabled').checked });
};

$('toastSeconds').onchange = () => {
  chrome.storage.sync.set({ toastSeconds: parseInt($('toastSeconds').value, 10) || 8 });
};

$('clearSeenBtn').onclick = async () => {
  await chrome.storage.local.set({ tvsSeen: {} });
  await chrome.runtime.sendMessage({ type: 'tvs.clearCache' });
  tip($('seenTip'), '已清除，下次命中会重新提醒');
};

$('saveBtn').onclick = () => {
  chrome.storage.sync.set({
    platform: $('platform').value,
    order: $('order').value,
    youtubeApiKey: $('ytKey').value.trim(),
    autoOpen: $('autoOpen').checked
  });
  tip($('saveTip'), '已保存');
};

load();
