(function () {
  "use strict";
  var api = window.BloodAppApi;
  var auth = window.BloodAppAuth;
  var message = document.getElementById("page-message");
  function set(id, value) { var node = document.getElementById(id); if (node) node.textContent = value; }
  function first(obj, keys) { if (!obj || typeof obj !== "object") return undefined; for (var i = 0; i < keys.length; i++) if (obj[keys[i]] !== undefined && obj[keys[i]] !== null) return obj[keys[i]]; }
  function unwrap(value) { if (value && typeof value === "object") return value.data !== undefined ? value.data : value.profile !== undefined ? value.profile : value.result !== undefined ? value.result : value; return value; }
  function listOf(value) { value = unwrap(value); if (Array.isArray(value)) return value; var found = first(value, ["items", "results", "requests", "responses"]); return Array.isArray(found) ? found : []; }
  function label(value, fallback) { if (value === undefined || value === null || value === "") return fallback || "Not provided"; return String(value).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function chipClass(status) { var s = String(status || "").toUpperCase(); if (["VERIFIED", "APPROVED", "ELIGIBLE", "ACTIVE", "AVAILABLE", "ACCEPTED", "COMPLETED"].indexOf(s) >= 0) return "status-chip status-chip--good"; if (["PENDING", "UNDER_REVIEW", "UNKNOWN", "IN_REVIEW"].indexOf(s) >= 0) return "status-chip status-chip--pending"; if (["REJECTED", "SUSPENDED", "INELIGIBLE", "DEACTIVATED"].indexOf(s) >= 0) return "status-chip status-chip--bad"; return "status-chip"; }
  function setChip(id, value, fallback) { var node = document.getElementById(id); node.textContent = label(value, fallback); node.className = chipClass(value); }
  function banner(text) { message.textContent = text; message.className = "status-banner status-banner--error"; message.hidden = false; }
  function renderProfile(raw) {
    var p = unwrap(raw) || {}, blood = first(p, ["bloodGroup", "bloodType"]), city = first(p, ["city", "locationName", "location"]), available = first(p, ["isAvailable", "available"]);
    var completion = first(p, ["completionPercentage", "profileCompletion", "completionPercent"]);
    if (completion === undefined) { var fields = [blood, p.dateOfBirth, p.weightKg, city]; completion = Math.round(fields.filter(function (v) { return v !== undefined && v !== null && v !== ""; }).length / fields.length * 100); set("profile-completion-detail", "Estimated from required profile fields"); }
    else { completion = Number(completion); set("profile-completion-detail", "Based on your saved profile"); }
    set("profile-completion", isFinite(completion) ? Math.max(0, Math.min(100, completion)) + "%" : "—"); set("blood-group", label(blood));
    set("donor-city", typeof city === "object" ? label(first(city, ["name", "city", "label"])) : label(city));
    set("profile-status", blood && city && p.dateOfBirth && p.weightKg ? "Profile details present" : "Profile may be incomplete");
    setChip("availability-status", available === true ? "AVAILABLE" : available === false ? "UNAVAILABLE" : undefined, "Not set");
    var eligibility = first(p, ["eligibilityStatus", "eligibility", "donationEligibility"]), waiting = first(p, ["waitingPeriodDays", "donationWaitingPeriodDays", "daysUntilEligible"]);
    set("eligibility-detail", eligibility !== undefined ? "Eligibility: " + label(eligibility) : waiting !== undefined ? "Waiting period: " + waiting + " days" : "Eligibility is checked by the backend when you respond to a request.");
    set("donation-eligibility", waiting !== undefined ? String(waiting) + " days remaining" : label(eligibility, "Not provided by backend"));
    var v = first(p, ["verificationStatus", "verificationState"]); if (v !== undefined) setChip("verification-status", v, "Not submitted");
  }
  function renderVerification(raw) {
    var v = unwrap(raw) || {}, status = first(v, ["status", "verificationStatus", "state"]) || "NOT_SUBMITTED";
    setChip("verification-status", status, "Not submitted");
    var feedback = first(v, ["reviewerFeedback", "feedback", "reason", "reviewNote"]), updated = first(v, ["reviewedAt", "updatedAt", "submittedAt"]);
    set("verification-summary", label(status) + (feedback ? ". Reviewer feedback: " + feedback : "") + (updated ? ". Last update: " + String(updated).slice(0, 10) : status === "NOT_SUBMITTED" ? ". Submit your profile for verification when ready." : ""));
    set("verification-detail", updated ? "Updated " + String(updated).slice(0, 10) : "Current review status");
  }
  function renderRequests(raw) {
    var items = listOf(raw).slice(0, 3), root = document.getElementById("matching-request-list"); root.replaceChildren();
    if (!items.length) { var empty = document.createElement("li"); empty.className = "empty-state"; empty.textContent = "No compatible open requests are available right now."; root.appendChild(empty); return; }
    items.forEach(function (item) {
      var li = document.createElement("li"), title = document.createElement("div"), name = document.createElement("span"), badge = document.createElement("span"), meta = document.createElement("p");
      li.className = "request-item"; title.className = "request-title"; name.textContent = label(first(item, ["bloodGroup", "bloodType"]), "Blood") + " request";
      var urgency = first(item, ["urgency", "priority"]); badge.className = chipClass(urgency); badge.textContent = label(urgency, "Open"); title.append(name, badge);
      var city = first(item, ["city", "locationName", "hospitalName"]), units = first(item, ["unitsNeeded", "units"]);
      meta.className = "request-meta"; meta.textContent = [city ? label(city) : "Location not provided", units !== undefined ? units + " unit(s) needed" : "", item.createdAt ? "Posted " + String(item.createdAt).slice(0, 10) : ""].filter(Boolean).join(" · ");
      li.append(title, meta); root.appendChild(li);
    });
  }
  function renderResponses(raw) {
    var items = listOf(raw), counts = {}; items.forEach(function (item) { var s = String(first(item, ["status", "responseStatus"]) || "UNKNOWN").toUpperCase(); counts[s] = (counts[s] || 0) + 1; });
    var summary = items.length + (items.length === 1 ? " response submitted" : " responses submitted"), parts = Object.keys(counts).map(function (s) { return label(s) + ": " + counts[s]; });
    if (parts.length) summary += " · " + parts.join(" · "); set("response-summary", items.length ? summary : "You haven't submitted any donation responses yet.");
  }
  function renderUnread(raw) { var v = unwrap(raw), count = typeof v === "number" ? v : first(v, ["count", "unreadCount", "total"]); set("unread-count", count === undefined ? "—" : String(count)); }
  async function main() {
    if (!api || !auth || !auth.requireRole("DONOR")) return;
    window.BloodAppNavigation.render(); var user = api.currentUser(), email = user && user.email ? user.email : "";
    set("welcome-title", "Welcome back, " + (email ? email.split("@")[0] : "donor"));
    var jobs = [["profile", "/donor-profile/me", renderProfile], ["requests", "/donor-responses/requests?page=1&limit=3", renderRequests], ["responses", "/donor-responses/me", renderResponses], ["verification", "/verification/me", renderVerification], ["notifications", "/notifications/unread-count", renderUnread]], failed = [];
    await Promise.all(jobs.map(async function (job) { try { job[2](await api.request(job[1])); } catch (error) {
      failed.push(job[0]); if (error.status === 401) { api.clearSession(); window.location.replace("login.html"); return; }
      if (job[0] === "profile") { set("profile-completion", "—"); set("profile-completion-detail", "Profile could not be loaded"); set("availability-status", "Unavailable"); set("blood-group", "—"); set("donor-city", "—"); set("profile-status", "Unable to load"); }
      if (job[0] === "requests") { var root = document.getElementById("matching-request-list"); root.replaceChildren(); var li = document.createElement("li"); li.className = "empty-state"; li.textContent = "Matching requests could not be loaded. Please try again."; root.appendChild(li); }
      if (job[0] === "responses") set("response-summary", "Your responses could not be loaded.");
      if (job[0] === "verification") { set("verification-status", "Unavailable"); set("verification-summary", "Verification status could not be loaded."); }
      if (job[0] === "notifications") set("unread-count", "—");
    }}));
    if (failed.length) banner("Some dashboard information could not be loaded. Check your connection and refresh to try again.");
  }
  main().catch(function () { banner("The dashboard could not be initialized. Please sign in again or refresh the page."); });
})();
