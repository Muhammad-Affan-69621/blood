/* Public shell cache only. Authenticated API responses are never cached. */
"use strict";
var CACHE_NAME = "blood-app-shell-v10";
var APP_SHELL = [
  "./login.html", "./register.html", "./forgot-password.html", "./reset-password.html",
  "./donor-dashboard.html", "./recipient-dashboard.html", "./css/recipient-dashboard.css", "./js/pages/recipient-dashboard.js",  "./notifications.html", "./donor-profile.html", "./matching-requests.html", "./donation-responses.html", "./donor-verification.html", "./donor-privacy.html", "./css/notifications.css", "./css/matching-requests.css", "./css/profile.css", "./css/donation-responses.css", "./css/verification.css", "./css/privacy.css", "./css/theme.css", "./css/auth.css", "./css/layout.css", "./css/dashboard.css",
  "./js/config.js", "./js/current-year.js", "./js/api-client.js", "./js/auth.js", "./js/navigation.js", "./js/login.js",
  "./js/register.js", "./js/forgot-password.js", "./js/reset-password.js", "./js/pwa.js",
  "./js/pages/notifications.js", "./js/pages/donor-dashboard.js", "./js/pages/donor-profile.js", "./js/pages/matching-requests.js", "./js/pages/donation-responses.js", "./js/pages/donor-verification.js", "./js/pages/donor-privacy.js", "./icons/blood-drop.svg", "./manifest.webmanifest"
];
self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (event) {
  var request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/auth/") >= 0 || url.pathname.indexOf("/api/") >= 0) return;
  event.respondWith(caches.match(request).then(function (cached) { return cached || fetch(request).then(function (response) {
    if (response && response.ok && response.type === "basic") { var copy = response.clone(); caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); }); }
    return response;
  }); }));
});
