(function () {
  "use strict";
  var api = window.BloodAppApi, $ = function (id) { return document.getElementById(id); };
  var requests = [], records = [], page = 1, pageSize = 5, busy = false, pendingDecision = null;
  function unwrap(x) { return x && x.data !== undefined ? x.data : x; }
  function listOf(x) { x = unwrap(x); if (Array.isArray(x)) return x; if (x && Array.isArray(x.items)) return x.items; if (x && Array.isArray(x.requests)) return x.requests; return []; }
  function pretty(x) { return String(x || "Unknown").replace(/[_-]+/g, " ").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function dateLabel(x) { if (!x) return "Not provided"; var d = new Date(x); return isNaN(d.getTime()) ? "Not provided" : d.toLocaleString(); }
  function say(text, kind) { var el = $("page-message"); el.textContent = text || ""; el.dataset.kind = kind || "info"; el.hidden = !text; }
  function decisionOf(r) { return String(r.recipientDecision || r.status || "PENDING").toUpperCase(); }
  function statusClass(s) { return s === "ACCEPTED" ? "status-pill--accepted" : s === "REJECTED" ? "status-pill--rejected" : "status-pill--pending"; }
  function updateCounts() {
    var accepted = records.filter(function (r) { return decisionOf(r.response) === "ACCEPTED"; }).length;
    var rejected = records.filter(function (r) { return decisionOf(r.response) === "REJECTED"; }).length;
    $("total-count").textContent = records.length; $("accepted-count").textContent = accepted; $("rejected-count").textContent = rejected; $("pending-count").textContent = records.length - accepted - rejected;
  }
  function render() {
    var list = $("response-list"); list.replaceChildren();
    var pages = Math.max(1, Math.ceil(requests.length / pageSize)); if (page > pages) page = pages;
    var subset = requests.slice((page - 1) * pageSize, page * pageSize);
    if (!subset.length) { var empty = document.createElement("div"); empty.className = "empty-state"; empty.innerHTML = "<h2>No donor responses yet</h2><p>When donors respond to your open requests, they will appear here.</p>"; list.append(empty); }
    subset.forEach(function (req) {
      var card = document.createElement("article"); card.className = "response-card";
      var head = document.createElement("div"); head.className = "response-card-header";
      var title = document.createElement("div"); title.innerHTML = "<h2>" + esc(pretty(req.bloodGroup)) + " blood request</h2><p class=\"response-subtitle\">" + esc(req.hospitalName || req.city || "Location not provided") + " · " + esc(pretty(req.status)) + "</p>";
      var count = document.createElement("span"); count.className = "blood-group"; count.textContent = (req.responses || []).length + " response(s)"; head.append(title, count); card.append(head);
      var body = document.createElement("div"); body.className = "request-responses";
      if (!req.responses || !req.responses.length) { var no = document.createElement("p"); no.className = "empty-state"; no.textContent = "No donor responses for this request yet."; body.append(no); }
      (req.responses || []).forEach(function (r) {
        var row = document.createElement("section"); row.className = "response-message";
        var status = decisionOf(r); var donor = r.donor && r.donor.donorProfile || {};
        row.innerHTML = '<div class="response-card-header"><strong>' + esc(pretty(donor.bloodGroup)) + ' donor</strong><span class="status-pill ' + statusClass(status) + '">' + esc(pretty(status)) + '</span></div>' +
          '<dl class="response-details"><div><dt>City</dt><dd>' + esc(donor.city || "Not provided") + '</dd></div><div><dt>Responded</dt><dd>' + esc(dateLabel(r.createdAt)) + '</dd></div><div><dt>Decision updated</dt><dd>' + esc(dateLabel(r.recipientDecisionAt)) + '</dd></div></dl>' +
          (r.message ? '<p>' + esc(r.message) + '</p>' : '<p class="response-subtitle">No message provided.</p>');
        if (status !== "ACCEPTED" && status !== "REJECTED" && String(req.status).toUpperCase() === "OPEN") {
          var actions = document.createElement("div"); actions.className = "response-actions";
          var accept = document.createElement("button"); accept.type = "button"; accept.className = "button"; accept.textContent = "Accept response"; accept.onclick = function () { openDecision(req, r, "ACCEPTED"); };
          var reject = document.createElement("button"); reject.type = "button"; reject.className = "button button--secondary"; reject.textContent = "Reject response"; reject.onclick = function () { openDecision(req, r, "REJECTED"); };
          actions.append(accept, reject); row.append(actions);
        }
        body.append(row);
      });
      card.append(body); list.append(card);
    });
    $("results-summary").textContent = records.length + " donor response(s) across " + requests.length + " of your blood request(s).";
    $("page-label").textContent = "Page " + page + " of " + pages; $("prev-page").disabled = page <= 1; $("next-page").disabled = page >= pages;
  }
  async function load() {
    if (busy) return; busy = true; $("refresh-button").disabled = true; say(""); $("response-list").innerHTML = '<div class="empty-state loading">Loading donor responses…</div>';
    try {
      var raw = unwrap(await api.request("/blood-requests/me?page=1&limit=100"));
      var own = listOf(raw).slice(0, 100); records = []; requests = [];
      var settled = await Promise.all(own.map(async function (req) {
        try { var data = unwrap(await api.request("/donor-responses/requests/" + encodeURIComponent(req.id))); return { request: req, responses: Array.isArray(data.responses) ? data.responses : [] }; }
        catch (e) { if (e.status === 404) return { request: req, responses: [] }; throw e; }
      }));
      requests = settled.map(function (x) { return Object.assign({}, x.request, { responses: x.responses }); });
      requests.forEach(function (req) { req.responses.forEach(function (response) { records.push({ request: req, response: response }); }); });
      updateCounts(); page = Math.min(page, Math.max(1, Math.ceil(requests.length / pageSize))); render();
    } catch (e) { say("Could not load donor responses: " + (e.message || "Please try again."), "error"); $("response-list").innerHTML = '<div class="empty-state"><h2>Responses unavailable</h2><p>Refresh to safely retry.</p></div>'; }
    finally { busy = false; $("refresh-button").disabled = false; }
  }
  function openDecision(req, response, decision) {
    pendingDecision = { request: req, response: response, decision: decision };
    $("dialog-title").textContent = decision === "ACCEPTED" ? "Accept donor response?" : "Reject donor response?";
    $("dialog-copy").textContent = "Confirm that you want to " + decision.toLowerCase() + " this response for your " + pretty(req.bloodGroup) + " request. This decision will be saved by the backend.";
    $("decision-note").value = ""; $("decision-dialog").showModal();
  }
  $("decision-form").addEventListener("submit", async function (event) {
    if (!pendingDecision || event.submitter && event.submitter.value !== "confirm") return;
    event.preventDefault(); var p = pendingDecision; $("confirm-decision").disabled = true;
    try {
      await api.request("/donor-responses/requests/" + encodeURIComponent(p.request.id) + "/responses/" + encodeURIComponent(p.response.id) + "/decision", { method: "POST", body: { decision: p.decision } });
      $("decision-dialog").close(); say("Donor response " + p.decision.toLowerCase() + ".", "success"); await load();
    } catch (e) { say("Could not update response: " + (e.message || "Please try again."), "error"); }
    finally { $("confirm-decision").disabled = false; pendingDecision = null; }
  });
  $("refresh-button").onclick = load; $("prev-page").onclick = function () { if (page > 1) { page--; render(); } }; $("next-page").onclick = function () { if (page < Math.ceil(requests.length / pageSize)) { page++; render(); } };
  if (!window.BloodAppAuth || !window.BloodAppAuth.requireRole(["RECIPIENT"])) return;
  if (window.BloodAppNavigation) window.BloodAppNavigation.render(); load();
})();
