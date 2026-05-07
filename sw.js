const CACHE_NAME = 'mlb-jp-v15';
const STATIC_ASSETS = ['/','/index.html','/src/app.js','/src/mlb-api.js','/src/charts.js','/src/i18n.js','/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
  self.clients.matchAll({type:'window'}).then(clients => {
    clients.forEach(client => client.postMessage({type:'SW_UPDATED',version:CACHE_NAME}));
  });
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('statsapi.mlb.com') || url.pathname.includes('/data/')) {
    e.respondWith(fetch(e.request).then(res=>{const c=res.clone();caches.open(CACHE_NAME).then(cc=>cc.put(e.request,c));return res;}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
});
