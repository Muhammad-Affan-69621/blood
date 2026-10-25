(function () {
  "use strict";
  var api = window.BloodAppApi;
  var main = document.getElementById("main-content");
  var message = document.getElementById("page-message");
  var MAX_PAGE_SIZE = 100;

  function unwrap(value) { return value && value.data !== undefined ? value.data : value; }
  function arrayFrom(value) {
    value = unwrap(value);
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.requests)) return value.requests;
    if (value && Array.isArray(value.results)) return value.results;
    if (value && value.data && Array.isArray(value.data.items)) return value.data.items;
    return [];
  }
  function text(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }
  function showError(value) { message.textContent = value; message.className = "status-banner status-banner--error"; message.hidden = false; }
  function first(obj, keys) {
    for (var i = 0; obj && i < keys.length; i++) if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== "") return obj[keys[i]];
    return undefined;
  }
  function human(value) {
    if (value === undefined || value === null || value === "") return "Unknown";
    return String(value).replace(/[_-]+/g, " ").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function statusOf(item) { return String(first(item, ["status", "requestStatus", "state"]) || "UNKNOWN").toUpperCase().replace(/[\s-]+/g, "_"); }
  function dateText(value) {
    if (!value) return "Date not provided";
    var date = new Date(value);
    return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  function chipClass(status) {
    if (["FULFILLED", "COMPLETED", "CLOSED"].indexOf(status) >= 0) return "status-chip status-chip--good";
    if (["CANCELLED", "EXPIRED", "REJECTED"].indexOf(status) >= 0) return "status-chip status-chip--bad";
    if (["IN_PROGRESS", "MATCHED", "PENDING", "OPEN", "ACTIVE"].indexOf(status) >= 0) return "status-chip status-chip--pending";
    return "status-chip";
  }
  function renderRequests(raw) {
    var items = arrayFrom(raw).slice(0, 5);
    var list = document.getElementById("recent-request-list");
    list.replaceChildren();
    var counts = { active: 0, progress: 0, fulfilled: 0, closed: 0 };
    arrayFrom(raw).forEach(function (item) {
      var s = statusOf(item);
      if (["OPEN", "ACTIVE", "PENDING", "SEARCHING", "ACCEPTING_RESPONSES"].indexOf(s) >= 0) counts.active++;
      else if (["IN_PROGRESS", "MATCHED", "DONOR_ACCEPTED", "COORDINATION"].indexOf(s) >= 0) counts.progress++;
      else if (["FULFILLED", "COMPLETED"].indexOf(s) >= 0) counts.fulfilled++;
      else if (["CANCELLED", "EXPIRED"].indexOf(s) >= 0) counts.closed++;
    });
    text("count-active", counts.active); text("count-progress", counts.progress); text("count-fulfilled", counts.fulfilled); text("count-closed", counts.closed);
    if (!items.length) {
      var empty = document.createElement("li"); empty.className = "empty-state"; empty.textContent = "No blood requests to show yet. Create a request when you are ready."; list.appendChild(empty); return;
    }
    items.forEach(function (item) {
      var li = document.createElement("li"); li.className = "request-item";
      var titleRow = document.createElement("div"); titleRow.className = "request-title";
      var title = document.createElement("span");
      title.textContent = first(item, ["title", "requestNumber", "reference"]) || ("Blood request · " + human(first(item, ["bloodGroup", "bloodType"]) || ""));
      var chip = document.createElement("span"); var status = statusOf(item); chip.className = chipClass(status); chip.textContent = human(status);
      titleRow.appendChild(title); titleRow.appendChild(chip);
      var meta = document.createElement("p"); meta.className = "request-meta";
      var blood = first(item, ["bloodGroup", "bloodType", "requiredBloodGroup"]);
      var units = first(item, ["unitsRequired", "units", "quantity", "bagsRequired"]);
      var city = first(item, ["city", "hospitalCity", "location"]);
      var created = first(item, ["createdAt", "created_at", "neededBy", "requiredBy"]);
      meta.textContent = [blood ? "Blood group: " + human(blood) : "", units ? "Units: " + units : "", city ? "Location: " + (typeof city === "object" ? human(first(city, ["name", "city"])) : city) : "", created ? "Date: " + dateText(created) : ""].filter(Boolean).join(" · ");
      li.appendChild(titleRow); li.appendChild(meta); list.appendChild(li);
    });
  }
  function renderResponses(raw) {
    var value = unwrap(raw), items = arrayFrom(raw);
    var total = value && typeof value.total === "number" ? value.total : items.length;
    text("response-summary", total ? total + " donor response" + (total === 1 ? "" : "s") + " are available for review." : "No donor responses are available yet.");
    text("response-detail", "Open the response review page to choose a request and review the information the API permits you to see.");
  }
  function renderUnread(raw) {
    var value = unwrap(raw);
    var count = typeof value === "number" ? value : Number(first(value, ["unreadCount", "count", "unread"]) || 0);
    text("unread-count", Number.isFinite(count) ? String(count) : "—");
    text("notification-summary", count ? "You have updates that may need your attention." : "You're all caught up.");
  }
  async function mainLoad() {
    if (!window.BloodAppAuth || !window.BloodAppAuth.requireRole(["RECIPIENT"])) return;
    if (window.BloodAppNavigation) window.BloodAppNavigation.render();
    var user = api.currentUser();
    text("welcome-title", "Welcome back" + (user && user.email ? ", " + user.email.split("@")[0] : ""));
    text("response-summary", "Review donor responses to your blood requests.");
    text("response-detail", "Open Donor responses to view and accept or reject responses for your requests.");
    var failures = [];
    var jobs = [
      ["requests", "/blood-requests/me?page=1&limit=" + MAX_PAGE_SIZE, renderRequests],
      ["notifications", "/notifications/unread-count", renderUnread]
    ];
    await Promise.all(jobs.map(async function (job) {
      try { job[2](await api.request(job[1])); }
      catch (error) {
        failures.push(job[0]);
        if (error.status === 401) { api.clearSession(); window.location.replace("login.html"); return; }
        if (job[0] === "requests") {
          ["count-active", "count-progress", "count-fulfilled", "count-closed"].forEach(function (id) { text(id, "—"); });
          var list = document.getElementById("recent-request-list"); list.replaceChildren();
          var li = document.createElement("li"); li.className = "empty-state"; li.textContent = "Your requests could not be loaded. Refresh to try again."; list.appendChild(li);
        } else { text("unread-count", "—"); text("notification-summary", "Notification status could not be loaded."); }
      }
    }));
    if (failures.length) { showError("Some dashboard sections could not be loaded. Your saved data has not been changed; refresh to safely retry."); var retry=document.createElement("button"); retry.type="button"; retry.className="button button--secondary"; retry.textContent="Retry loading"; retry.style.marginTop=".75rem"; retry.onclick=function(){ message.hidden=true; mainLoad(); }; message.appendChild(document.createElement("br")); message.appendChild(retry); }
  }
  mainLoad().catch(function () { showError("The dashboard could not be initialized. Please sign in again or refresh the page."); });
})();