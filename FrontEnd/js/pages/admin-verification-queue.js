(function () {
  "use strict";
  var api = window.BloodAppApi, items = [], cursor = null, active = null;
  var queue = document.getElementById("verification-queue"), message = document.getElementById("verification-message");
  function esc(v) { return String(v == null || v === "" ? "Not provided" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function date(v) { if (!v) return "Not provided"; var d = new Date(v); return Number.isNaN(d.getTime()) ? "Not provided" : d.toLocaleDateString(); }
  function dateTime(v) { if (!v) return "—"; var d = new Date(v); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(); }
  function label(text, value) { return '<div class="verification-detail"><dt>' + esc(text) + '</dt><dd>' + esc(value) + '</dd></div>'; }
  function say(t, error) { message.textContent = t || ""; message.className = "status-banner" + (error ? " status-banner--error" : ""); message.hidden = !t; }
  function render() {
    queue.replaceChildren();
    if (!items.length) { queue.innerHTML = '<div class="org-empty"><h3>No pending verifications</h3><p>The verification queue is clear.</p></div>'; return; }
    items.forEach(function (r) {
      var card = document.createElement("article"), d = r.donor || {}, u = d.user || {};
      card.className = "admin-report verification-review-card";
      card.innerHTML = '<div class="verification-review-content">' +
        '<h3>Donor verification <span class="admin-tag">' + esc(r.status) + '</span></h3>' +
        '<p class="org-muted">Submitted: ' + esc(dateTime(r.createdAt)) + ' · Donor ID: ' + esc(r.donorId) + '</p>' +
        '<h4>Submitted donor profile</h4><dl class="verification-details">' +
        label('Email', u.email) + label('Account status', u.status) + label('Blood group', d.bloodGroup) +
        label('Date of birth', date(d.dateOfBirth)) + label('Weight (kg)', d.weightKg == null ? "Not provided" : d.weightKg) +
        label('City', d.city) + label('Last donation date', date(d.lastDonationDate)) +
        label('Available to donate', d.isAvailable === true ? 'Yes' : d.isAvailable === false ? 'No' : 'Not provided') +
        label('Urgent notifications', d.urgentNotificationsEnabled === true ? 'Enabled' : d.urgentNotificationsEnabled === false ? 'Disabled' : 'Not provided') +
        label('Profile verification status', d.verificationStatus) + label('Profile last updated', dateTime(d.updatedAt)) +
        '</dl><p><strong>Submission note:</strong> ' + esc(r.reason || 'No custom message submitted; review the profile details above.') + '</p></div>' +
        '<div class="org-actions"><button type="button" class="button review-verification">Review</button></div>';
      card.querySelector("button").addEventListener("click", function () {
        active = r;
        document.getElementById("verification-summary").textContent = (u.email || "Donor") + " · " + (d.bloodGroup || "Blood group not provided") + " · " + (d.city || "City not provided");
        document.getElementById("verification-decision").value = "VERIFIED";
        document.getElementById("verification-reason").value = "";
        var m = document.getElementById("verification-form-message"); m.hidden = true; m.textContent = "";
        document.getElementById("verification-modal").showModal();
      });
      queue.appendChild(card);
    });
  }
  async function load(append) {
    say("");
    if (!append) { items = []; cursor = null; queue.innerHTML = '<div class="org-empty">Loading verification queue…</div>'; }
    try {
      var path = "/verification/queue?limit=20" + (append && cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
      var result = await api.request(path); items = items.concat(result.items || []); cursor = result.nextCursor || null;
      document.getElementById("load-more-verifications").hidden = !cursor; render();
    } catch (e) { say(e.message || "Could not load verification queue.", true); queue.innerHTML = '<div class="org-empty">Verification queue unavailable. Check reviewer permissions and retry.</div>'; }
  }
  document.getElementById("refresh-verifications").addEventListener("click", function () { load(false); });
  document.getElementById("load-more-verifications").addEventListener("click", function () { load(true); });
  document.getElementById("verification-cancel").addEventListener("click", function () { document.getElementById("verification-modal").close(); });
  document.getElementById("verification-form").addEventListener("submit", async function (e) {
    e.preventDefault(); if (!active) return;
    var button = document.getElementById("verification-submit"), m = document.getElementById("verification-form-message");
    var decision = document.getElementById("verification-decision").value, reason = document.getElementById("verification-reason").value.trim();
    button.disabled = true;
    try {
      await api.request("/verification/" + encodeURIComponent(active.donorId) + "/review", { method: "PATCH", body: { status: decision, reason: reason } });
      m.textContent = "Verification decision saved."; m.className = "org-status"; m.hidden = false;
      items = items.filter(function (x) { return x.id !== active.id; }); render();
      setTimeout(function () { document.getElementById("verification-modal").close(); }, 500);
    } catch (e2) { m.textContent = e2.message || "Could not save decision."; m.className = "org-status error"; m.hidden = false; }
    finally { button.disabled = false; }
  });
  document.addEventListener("DOMContentLoaded", function () {
    if (window.BloodAppNavigation) window.BloodAppNavigation.render();
    if (window.BloodAppAuth && !window.BloodAppAuth.requireRole("PLATFORM_ADMIN")) return;
    load(false);
  });
})();
