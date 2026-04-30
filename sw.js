const CACHE_NAME = 'pvzquest-v12';
const CHECK_INTERVAL = 60 * 1000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function checkReminders() {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const today = now.toISOString().split('T')[0];

    let gameState, reminderState;
    try {
        // Read from the same localStorage keys the main app uses
        // SW can't access localStorage directly, so we use the message channel
    } catch(e) {}

    self.clients.matchAll({ type: 'window' }).then(clients => {
        if (clients.length > 0) {
            clients[0].postMessage({ type: 'checkReminders' });
        } else {
            // No open tabs — try to show notification from cached state
            showOfflineReminder(nowMin, today);
        }
    });
}

async function showOfflineReminder(nowMin, today) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const resp = await cache.match('reminder-state');
        if (!resp) return;
        const data = await resp.json();
        if (data.date !== today || !data.tasks) return;

        data.tasks.forEach(task => {
            if (task.completed) return;
            const [h, m] = task.time.split(':').map(Number);
            const taskMin = h * 60 + m;
            const reminded = data.reminded || {};
            if (nowMin >= taskMin && nowMin <= taskMin + (task.duration || 10) && !reminded[task.id]) {
                self.registration.showNotification('🌻 PVZ Quest 提醒', {
                    body: task.icon + ' 该做「' + task.name + '」啦！完成可获得化肥和金币哦！',
                    tag: 'routine_' + task.id,
                    requireInteraction: true,
                    renotify: true,
                    vibrate: [200, 100, 200, 100, 300]
                });
            }
        });
    } catch(e) {}
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'updateReminderCache') {
        caches.open(CACHE_NAME).then(cache => {
            cache.put('reminder-state', new Response(JSON.stringify(event.data.payload)));
        });
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(clients => {
            if (clients.length > 0) {
                clients[0].focus();
            } else {
                self.clients.openWindow('./index.html');
            }
        })
    );
});

// Periodic check using setTimeout chain (setInterval not reliable in SW)
function scheduleCheck() {
    setTimeout(() => {
        checkReminders();
        scheduleCheck();
    }, CHECK_INTERVAL);
}
scheduleCheck();
