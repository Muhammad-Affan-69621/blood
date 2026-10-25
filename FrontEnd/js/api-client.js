(function () {
  "use strict";

  var ACCESS_KEY = "bloodApp.accessToken";
  var REFRESH_KEY = "bloodApp.refreshToken";
  var USER_KEY = "bloodApp.user";
  var refreshInFlight = null;
  var AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

  // Keep authentication across same-origin page transitions and accidental new tabs.
  // Migrate any existing sessionStorage tokens so users are not unexpectedly logged out.
  function storage() {
    // Prefer persistent same-origin storage. Do not let an unavailable sessionStorage
    // API force a fallback that makes the login disappear on the next page load.
    try {
      var persistent = window.localStorage;
      var probe = "__bloodAppStorageProbe";
      persistent.setItem(probe, "1");
      persistent.removeItem(probe);
      try {
        var temporary = window.sessionStorage;
        [ACCESS_KEY, REFRESH_KEY, USER_KEY].forEach(function (key) {
          if (!persistent.getItem(key)) {
            var legacy = temporary.getItem(key);
            if (legacy) persistent.setItem(key, legacy);
          }
        });
      } catch (_) { /* sessionStorage may be disabled; localStorage still works */ }
      return persistent;
    } catch (_) {
      try { return window.sessionStorage; }
      catch (e) { throw new Error("Browser storage is unavailable. Enable site storage and try again."); }
    }
  }

  function baseUrl() {
    var value = window.BLOOD_APP_CONFIG && window.BLOOD_APP_CONFIG.apiBaseUrl;
    if (!value || typeof value !== "string") {
      throw new Error("API address is not configured. Update FrontEnd/js/config.js.");
    }
    return value.replace(/\/+$/, "");
  }

  function parseBody(response) {
    if (response.status === 204) return Promise.resolve(null);
    var type = response.headers.get("content-type") || "";
    return type.indexOf("application/json") >= 0
      ? response.json().catch(function () { return null; })
      : response.text().catch(function () { return null; });
  }

  function makeError(response, body) {
    var message = body && typeof body === "object" ? body.message : "";
    if (Array.isArray(message)) message = message.join(" ");
    if (typeof message !== "string" || !message.trim()) {
      var messages = {
        400: "Some submitted information is invalid. Check the fields and try again.",
        401: "The credentials are invalid or the session has expired.",
        403: "You do not have permission to perform this action.",
        404: "The requested resource was not found.",
        409: "An account with these details may already exist.",
        429: "Too many attempts. Please wait before trying again."
      };
      message = messages[response.status] ||
        (response.status >= 500 ? "The service is temporarily unavailable. Please try again later." :
        "The request could not be completed.");
    }
    var error = new Error(message);
    error.status = response.status;
    error.body = body;
    return error;
  }

  async function rawRequest(path, options, tokenOverride) {
    var settings = options || {};
    var headers = new Headers(settings.headers || {});
    headers.set("Accept", "application/json");
    if (settings.body !== undefined) headers.set("Content-Type", "application/json");
    var isAuthEndpoint = AUTH_PATHS.some(function (route) { return path === route; });
    var token = tokenOverride === undefined ? (isAuthEndpoint ? null : (settings.token || storage().getItem(ACCESS_KEY))) : tokenOverride;
    if (token) headers.set("Authorization", "Bearer " + token);

    var response;
    try {
      response = await fetch(baseUrl() + path, {
        method: settings.method || "GET",
        headers: headers,
        body: settings.body === undefined ? undefined : JSON.stringify(settings.body),
        credentials: "omit",
        cache: "no-store"
      });
    } catch (cause) {
      var networkError = new Error("Could not connect to the server. Check your connection and the backend CORS configuration.");
      networkError.network = true;
      networkError.cause = cause;
      throw networkError;
    }
    var body = await parseBody(response);
    if (!response.ok) throw makeError(response, body);
    return body;
  }

  function clearSession() {
    [ACCESS_KEY, REFRESH_KEY, USER_KEY].forEach(function (key) {
      try { localStorage.removeItem(key); } catch (_) {}
      try { sessionStorage.removeItem(key); } catch (_) {}
    });
  }

  function saveSession(result) {
    if (!result || typeof result.accessToken !== "string" ||
        typeof result.refreshToken !== "string" || !result.user) {
      throw new Error("The server returned an incomplete session. Please contact the administrator.");
    }
    try {
      storage().setItem(ACCESS_KEY, result.accessToken);
      storage().setItem(REFRESH_KEY, result.refreshToken);
      storage().setItem(USER_KEY, JSON.stringify(result.user));
    } catch (_) {
      clearSession();
      throw new Error("This browser could not store your session. Enable session storage and try again.");
    }
    return result;
  }

  async function refreshSession() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async function () {
      var refreshToken = storage().getItem(REFRESH_KEY);
      if (!refreshToken) throw new Error("Your session has expired. Please sign in again.");
      var result = await rawRequest("/auth/refresh", {
        method: "POST", body: { refreshToken: refreshToken }
      }, null);
      saveSession(result);
      return result.accessToken;
    })().catch(function (error) {
      // A transient network/server failure must not destroy a valid refresh token.
      // Clear credentials only when the API explicitly rejects the refresh token.
      if (error && (error.status === 401 || error.status === 403)) clearSession();
      throw error;
    }).finally(function () {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function request(path, options) {
    var settings = options || {};
    var authRoute = AUTH_PATHS.some(function (route) { return path === route; });
    try {
      return await rawRequest(path, settings);
    } catch (error) {
      if (error.status === 401 && !authRoute && !settings._retried) {
        try {
          var token = await refreshSession();
          return await rawRequest(path, Object.assign({}, settings, { _retried: true }), token);
        } catch (refreshError) {
          if (refreshError && (refreshError.status === 401 || refreshError.status === 403)) clearSession();
          throw refreshError;
        }
      }
      throw error;
    }
  }

  function currentUser() {
    try {
      var raw = storage().getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function logout() {
    var refreshToken = storage().getItem(REFRESH_KEY);
    var result = refreshToken
      ? rawRequest("/auth/logout", { method: "POST", body: { refreshToken: refreshToken } }, null)
          .catch(function () { return null; })
      : Promise.resolve(null);
    clearSession();
    return result;
  }

  window.BloodAppApi = Object.freeze({
    request: request,
    login: function (email, password) {
      return request("/auth/login", { method: "POST", body: { email: email, password: password } });
    },
    register: function (email, password, role) {
      return request("/auth/register", { method: "POST", body: { email: email, password: password, role: role } });
    },
    forgotPassword: function (email) {
      return request("/auth/forgot-password", { method: "POST", body: { email: email } });
    },
    resetPassword: function (token, newPassword) {
      return request("/auth/reset-password", { method: "POST", body: { token: token, newPassword: newPassword } });
    },
    saveSession: saveSession,
    clearSession: clearSession,
    currentUser: currentUser,
    logout: logout
  });
})();
