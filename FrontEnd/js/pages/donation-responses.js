(function () {
  "use strict";
  var api = window.BloodAppApi;
  var list = document.getElementById("response-list");
  var message = document.getElementById("page-message");
  var refreshButton = document.getElementById("refresh-button");
  var resultsSummary = document.getElementById("results-summary");
  var counts = {
    total: document.getElementById("total-count"),
    pending: document.getElementById("pending-count"),
    accepted: document.getElementById("accepted-count"),
    rejected: document.getElementById("rejected-count")
  };
  var busy = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }
  function pretty(value) {
    if (value === null || value === undefined || value === "") return "Not provided";
    return String(value).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function dateLabel(value) {
    if (!value) return "Not provided";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  function setMessage(text, kind) {
    message.textContent = text || "";
    message.dataset.kind = kind || "info";
    message.hidden = !text;
  }
  function statusClass(value) {
    var normalized = String(value || "").toLowerCase();
    if (normalized === "accepted") return "status-pill--accepted";
    if (normalized === "rejected") return "status-pill--rejected";
    if (normalized === "pending") return "status-pill--pending";
    if (normalized === "willing") return "status-pill--willing";
    return "";
  }
  function normalize(result) {
    if (result && Array.isArray(result.responses)) return result.responses;
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.items)) return result.items;
    return null;
  }
  function renderResponses(responses) {
    var accepted = responses.filter(function (item) { return String(item.recipientDecision || "").toUpperCase() === "ACCEPTED"; }).length;
    var rejected = responses.filter(function (item) { return String(item.recipientDecision || "").toUpperCase() === "REJECTED"; }).length;
    var pending = responses.filter(function (item) { return !item.recipientDecision || String(item.recipientDecision).toUpperCase() === "PENDING"; }).length;
    counts.total.textContent = String(responses.length);
    counts.pending.textContent = String(pending);
    counts.accepted.textContent = String(accepted);
    counts.rejected.textContent = String(rejected);
    resultsSummary.textContent = responses.length + (responses.length === 1 ? " response submitted" : " responses submitted");
    if (!responses.length) {
      list.innerHTML = '<div class="empty-state"><h2>No donation responses yet</h2><p>When you respond to a compatible blood request, it will appear here with its latest status.</p><a class="button" href="matching-requests.html">Find matching requests</a></div>';
      return;
    }
    list.innerHTML = responses.map(function (item) {
      var request = item.request || {};
      var decision = item.recipientDecision || "PENDING";
      var requestStatus = request.status || "Not provided";
      var hospital = request.hospitalName || "Blood request";
      var bloodGroup = pretty(request.bloodGroup);
      var messageText = item.message ? '<p class="response-message"><strong>Your message:</strong> ' + escapeHtml(item.message) + '</p>' : "";
      var decisionDate = item.recipientDecisionAt ? dateLabel(item.recipientDecisionAt) : "No decision recorded";
      return '<article class="response-card"><div class="response-card-header"><div><h2>' + escapeHtml(hospital) + '</h2><p class="response-subtitle">' + escapeHtml(request.city || "Location not specified") + '</p></div><span class="status-pill ' + statusClass(decision) + '">' + escapeHtml(pretty(decision)) + '</span></div>' +
        '<div class="response-details"><div><dt>Requested blood group</dt><dd><span class="blood-group">' + escapeHtml(bloodGroup) + '</span></dd></div><div><dt>Your response</dt><dd>' + escapeHtml(pretty(item.status)) + '</dd></div><div><dt>Recipient decision</dt><dd>' + escapeHtml(pretty(decision)) + '</dd></div><div><dt>Units needed</dt><dd>' + escapeHtml(request.unitsNeeded == null ? "Not provided" : request.unitsNeeded) + '</dd></div><div><dt>Request status</dt><dd>' + escapeHtml(pretty(requestStatus)) + '</dd></div><div><dt>Submitted</dt><dd>' + escapeHtml(dateLabel(item.createdAt)) + '</dd></div><div><dt>Decision date</dt><dd>' + escapeHtml(decisionDate) + '</dd></div><div><dt>Request expiry</dt><dd>' + escapeHtml(dateLabel(request.expiresAt)) + '</dd></div><div><dt>Last updated</dt><dd>' + escapeHtml(dateLabel(item.updatedAt)) + '</dd></div></div>' + messageText + '</article>';
    }).join("");
  }
  async function loadResponses() {
    if (busy) return;
    busy = true;
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing…";
    setMessage("");
    list.innerHTML = '<div class="empty-state loading">Loading your donation responses…</div>';
    resultsSummary.textContent = "Loading your responses…";
    try {
      var result = await api.request("/donor-responses/me");
      var responses = normalize(result);
      if (!responses) throw new Error("The server returned an unexpected response format. Please contact support.");
      renderResponses(responses);
      setMessage("");
    } catch (error) {
      counts.total.textContent = counts.pending.textContent = counts.accepted.textContent = counts.rejected.textContent = "—";
      resultsSummary.textContent = "Responses could not be loaded";
      list.innerHTML = '<div class="empty-state"><h2>Unable to load your responses</h2><p>' + escapeHtml(error.message || "Please try again.") + '</p><button class="button" type="button" id="retry-load">Try again</button></div>';
      setMessage(error.status === 403 ? "This area is available to active donor accounts." : "Your responses could not be retrieved. No sample data is being shown.", "error");
      var retry = document.getElementById("retry-load");
      if (retry) retry.addEventListener("click", loadResponses);
    } finally {
      busy = false;
      refreshButton.disabled = false;
      refreshButton.textContent = "Refresh";
    }
  }
  refreshButton.addEventListener("click", loadResponses);
  document.addEventListener("DOMContentLoaded", function () {
    if (window.BloodAppNavigation) window.BloodAppNavigation.render();
    loadResponses();
  });
})();
