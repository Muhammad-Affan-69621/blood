/* Set window.BLOOD_APP_API_BASE_URL in a deployment-specific config script before this file. */
(function () {
  "use strict";
  var configured = typeof window.BLOOD_APP_API_BASE_URL === "string" ? window.BLOOD_APP_API_BASE_URL.trim() : "";
  var fallback = window.location.protocol === "https:" ? "" : "http://localhost:3000/api/v1";
  window.BLOOD_APP_CONFIG = Object.freeze({ apiBaseUrl: (configured || fallback).replace(/\/+$/, "") });
})();
