(function () {
  "use strict";
  var api = window.BloodAppApi;
  var list = document.getElementById("request-list");
  var message = document.getElementById("page-message");
  var form = document.getElementById("filter-form");
  var cityInput = document.getElementById("city-filter");
  var limitInput = document.getElementById("page-size");
  var filterButton = document.getElementById("filter-button");
  var clearButton = document.getElementById("clear-filter-button");
  var refreshButton = document.getElementById("refresh-button");
  var previousButton = document.getElementById("previous-page");
  var nextButton = document.getElementById("next-page");
  var pageIndicator = document.getElementById("page-indicator");
  var resultsSummary = document.getElementById("results-summary");
  var state = { page: 1, limit: 20, city: "", totalPages: 1, busy: false };

  function setMessage(text, kind) {
    message.textContent = text || "";
    message.dataset.kind = kind || "info";
    message.hidden = !text;
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function pretty(value) {
    if (value === null || value === undefined || value === "") return "Not provided";
    return String(value).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function dateLabel(value) {
    if (!value) return "No expiry provided";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Expiry date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  function normalize(result) {
    if (result && Array.isArray(result.items)) return { items: result.items, pagination: result.pagination || {} };
    if (Array.isArray(result)) return { items: result, pagination: {} };
    return { items: [], pagination: {} };
  }
  function renderCards(items) {
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><h2>No matching requests found</h2><p>There are no open compatible requests for these filters right now. You can refresh or try a different city.</p></div>';
      return;
    }
    list.innerHTML = items.map(function (item) {
      var urgency = String(item.urgency || "NORMAL").toLowerCase();
      var hospital = item.hospitalName || "Hospital not specified";
      var requestId = escapeHtml(item.id || "");
      var safeBloodGroup = escapeHtml(pretty(item.bloodGroup));
      var canRespond = typeof item.id === "string" && item.id.length > 0;
      return '<article class="request-card">' +
        '<div class="request-card-header"><div class="blood-group" aria-label="Blood group ' + safeBloodGroup + '">' + safeBloodGroup + '</div>' +
        '<span class="badge badge--' + escapeHtml(urgency) + '">' + escapeHtml(pretty(item.urgency || "NORMAL")) + '</span></div>' +
        '<div><h2>' + escapeHtml(hospital) + '</h2><p class="request-subtitle">' + escapeHtml(item.city || "Location not specified") + '</p></div>' +
        '<dl class="request-details"><div><dt>Units needed</dt><dd>' + escapeHtml(item.unitsNeeded == null ? "Not specified" : item.unitsNeeded) + '</dd></div>' +
        '<div><dt>Request status</dt><dd>' + escapeHtml(pretty(item.status || "OPEN")) + '</dd></div>' +
        '<div><dt>Expires</dt><dd>' + escapeHtml(dateLabel(item.expiresAt)) + '</dd></div>' +
        '<div><dt>Posted</dt><dd>' + escapeHtml(dateLabel(item.createdAt)) + '</dd></div></dl>' +
        '<div class="request-card-footer"><p>Contact details are shared only through authorized backend flows.</p>' +
        (canRespond ? '<button class="button respond-button" type="button" data-request-id="' + requestId + '">I am willing to donate</button>' : '') + '</div></article>';
    }).join("");
  }
  function setBusy(busy) {
    state.busy = busy;
    filterButton.disabled = busy;
    clearButton.disabled = busy;
    refreshButton.disabled = busy;
    previousButton.disabled = busy || state.page <= 1;
    nextButton.disabled = busy || state.page >= state.totalPages;
  }
  async function loadRequests() {
    if (!window.BloodAppAuth.requireRole(["DONOR"])) return;
    setBusy(true);
    setMessage("");
    list.innerHTML = '<div class="empty-state loading">Loading compatible requests…</div>';
    resultsSummary.textContent = "Loading matching requests…";
    try {
      var params = new URLSearchParams({ page: String(state.page), limit: String(state.limit) });
      if (state.city) params.set("city", state.city);
      var result = await api.request("/donor-responses/requests?" + params.toString());
      var data = normalize(result);
      var pagination = data.pagination || {};
      state.totalPages = Math.max(1, Number(pagination.totalPages) || 1);
      state.page = Math.max(1, Number(pagination.page) || state.page);
      renderCards(data.items);
      var total = Number.isFinite(Number(pagination.total)) ? Number(pagination.total) : data.items.length;
      resultsSummary.textContent = total + (total === 1 ? " compatible request" : " compatible requests") + (state.city ? " in " + state.city : "");
      pageIndicator.textContent = "Page " + state.page + " of " + state.totalPages;
      previousButton.disabled = state.busy || state.page <= 1;
      nextButton.disabled = state.busy || state.page >= state.totalPages;
    } catch (error) {
      list.innerHTML = '<div class="empty-state"><h2>Unable to load matching requests</h2><p>' + escapeHtml(error.message || "Please try again.") + '</p><button class="button" type="button" id="retry-load">Try again</button></div>';
      resultsSummary.textContent = "Requests could not be loaded";
      pageIndicator.textContent = "Page " + state.page;
      setMessage(error.status === 403 ? "Your donor profile must be verified and available, and you must meet the backend eligibility rules, to browse matching requests." : "The request list could not be retrieved. No sample requests are being shown.", "error");
      var retry = document.getElementById("retry-load");
      if (retry) retry.addEventListener("click", loadRequests);
    } finally {
      setBusy(false);
    }
  }
  async function respond(requestId, button) {
    if (!requestId || button.disabled) return;
    var confirmed = window.confirm("Submit a willingness-to-donate response for this request? The backend will check eligibility, compatibility, request status, and duplicate responses.");
    if (!confirmed) return;
    button.disabled = true;
    var originalText = button.textContent;
    button.textContent = "Submitting…";
    setMessage("");
    try {
      var result = await api.request("/donor-responses/requests/" + encodeURIComponent(requestId), {
        method: "POST",
        body: { status: "WILLING" }
      });
      setMessage((result && result.message) || "Your response was submitted successfully.", "success");
      await loadRequests();
    } catch (error) {
      setMessage(error.message || "Your response could not be submitted. Please try again.", "error");
      button.disabled = false;
      button.textContent = originalText;
    }
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var city = cityInput.value.trim();
    if (city && city.length < 2) { cityInput.setCustomValidity("Enter at least 2 characters, or clear the city filter."); cityInput.reportValidity(); return; }
    cityInput.setCustomValidity("");
    state.city = city;
    state.limit = Number(limitInput.value) || 20;
    state.page = 1;
    loadRequests();
  });
  cityInput.addEventListener("input", function () { cityInput.setCustomValidity(""); });
  clearButton.addEventListener("click", function () { cityInput.value = ""; limitInput.value = "20"; state.city = ""; state.limit = 20; state.page = 1; loadRequests(); });
  refreshButton.addEventListener("click", loadRequests);
  previousButton.addEventListener("click", function () { if (state.page > 1) { state.page--; loadRequests(); } });
  nextButton.addEventListener("click", function () { if (state.page < state.totalPages) { state.page++; loadRequests(); } });
  list.addEventListener("click", function (event) {
    var button = event.target.closest(".respond-button");
    if (button) respond(button.getAttribute("data-request-id"), button);
  });
  document.addEventListener("DOMContentLoaded", function () {
    if (window.BloodAppNavigation) window.BloodAppNavigation.render();
    loadRequests();
  });
})();
