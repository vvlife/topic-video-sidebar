const $ = (id) => document.getElementById(id);
const tip = $('tip');
const DEFAULTS = { autoOpen: true, platform: 'both', order: 'views', limit: 12, youtubeApiKey: '', ytRegion: 'HK' };

function showTip(text, isErr) {
  tip.textContent = text;
  tip.className = 'tip' + (isErr ? ' err' : '');
  setTimeout(() => { if (tip.textContent === text) tip.textContent = ''; }, 2600);
}

chrome.storage.sync.get(DEFAULTS).then((cfg) => {
  $('platform').value = cfg.platform;
  $('order').value = cfg.order;
  $('limit').value = String(cfg.limit);
  $('autoOpen').checked = !!cfg.autoOpen;
  $('ytKey').value = cfg.youtubeApiKey || '';
  $('ytRegion').value = cfg.ytRegion || 'HK';
});

$('saveBtn').onclick = () => {
  chrome.storage.sync.set({
    autoOpen: $('autoOpen').checked,
    platform: $('platform').value,
    order: $('order').value,
    limit: parseInt($('limit').value, 10),
    youtubeApiKey: $('ytKey').value.trim(),
    ytRegion: $('ytRegion').value
  }, () => showTip('已保存，侧栏会自动刷新'));
};

async function withTab(fn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || '')) {
    showTip('当前页面不支持（请打开普通网页）', true);
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, fn());
  } catch (e) {
    showTip('无法连接页面脚本，请刷新页面后重试', true);
  }
}

$('toggleBtn').onclick = () => withTab(() => ({ type: 'tvs.toggle' }));

$('optBtn').onclick = () => chrome.runtime.openOptionsPage();
