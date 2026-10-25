(function () {
  "use strict";
  var api = window.BloodAppApi;
  var message = document.getElementById("page-message");
  var form = document.getElementById("preference-form");
  var sharingMode = document.getElementById("sharing-mode");
  var consentVersion = document.getElementById("consent-version");
  var urgent = document.getElementById("urgent-enabled");
  var urgentDescription = document.getElementById("urgent-description");
  var urgentError = document.getElementById("urgent-error");
  var history = document.getElementById("consent-history");
  var saveButton = document.getElementById("save-preference");
  var refreshButton = document.getElementById("refresh-consents");
  var grantForm = document.getElementById("grant-consent-form");
  var grantButton = document.getElementById("grant-consent");
  var grantScope = document.getElementById("grant-scope");
  var currentUrgent = false;
  var scopeLabels = { PHONE: "Phone number", EMAIL: "Email address", CONTACT_DETAILS: "Contact details" };
  function showMessage(text, kind) { message.textContent = text; message.dataset.kind = kind || "info"; message.hidden = !text; }
  function getDate(value) { if (!value) return "Date not supplied"; var date = new Date(value); return Number.isNaN(date.getTime()) ? "Date not supplied" : date.toLocaleString(); }
  function setBusy(button, busy, label) { if (busy) { button.dataset.originalText = button.textContent; button.textContent = label; button.disabled = true; } else { button.textContent = button.dataset.originalText || button.textContent; button.disabled = false; } }
  function renderHistory(consents) {
    history.replaceChildren();
    if (!Array.isArray(consents) || !consents.length) { var empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "No consent records were returned for your account."; history.appendChild(empty); return; }
    consents.forEach(function (item) {
      var card = document.createElement("article"); card.className = "history-item";
      var top = document.createElement("div"); top.className = "history-item-top";
      var title = document.createElement("strong"); title.textContent = scopeLabels[item.scope] || String(item.scope || "Consent").replace(/_/g, " ");
      var status = document.createElement("span"); status.className = "history-status"; status.textContent = item.revokedAt ? "Revoked" : "Active";
      top.append(title, status); card.appendChild(top);
      var granted = document.createElement("p"); granted.textContent = "Granted: " + getDate(item.grantedAt); card.appendChild(granted);
      if (item.revokedAt) { var revoked = document.createElement("p"); revoked.textContent = "Revoked: " + getDate(item.revokedAt); card.appendChild(revoked); }
      if (item.requestId) { var request = document.createElement("p"); request.textContent = "Associated request: " + item.requestId; card.appendChild(request); }
      if (!item.revokedAt && item.id) { var revoke = document.createElement("button"); revoke.type = "button"; revoke.className = "button button--secondary"; revoke.textContent = "Revoke consent"; revoke.addEventListener("click", function () { revokeConsent(item.id, revoke); }); card.appendChild(revoke); }
      history.appendChild(card);
    });
  }
  async function load() {
    history.innerHTML = '<p class="muted">Loading consent history…</p>';
    try {
      var data = await api.request("/consents/me");
      // Support the documented API shape and common response envelopes.
      var payload = data && data.data && !data.preference && !data.consents ? data.data : data;
      var preference = payload && payload.preference;
      var consents = payload && payload.consents;
      if (preference) { sharingMode.value = preference.sharingMode || "WITH_CONSENT"; consentVersion.value = preference.consentVersion || "v1"; }
      else { sharingMode.value = "WITH_CONSENT"; consentVersion.value = "v1"; }
      renderHistory(Array.isArray(consents) ? consents : (consents && Array.isArray(consents.items) ? consents.items : []));
      showMessage("", "info");
    } catch (error) {
      history.innerHTML = '<p class="muted">Could not load consent history.</p>';
      showMessage(error.message || "Could not load privacy settings.", "error");
    }
    try {
      var profile = await api.request("/donor-profile/me");
      currentUrgent = Boolean(profile && (profile.urgentNotificationsEnabled !== undefined ? profile.urgentNotificationsEnabled : profile.profile && profile.profile.urgentNotificationsEnabled));
      urgent.checked = currentUrgent; urgent.disabled = false;
      urgentDescription.textContent = currentUrgent ? "You are opted in to urgent blood-request notifications." : "You are currently opted out of urgent blood-request notifications.";
    } catch (error) {
      urgent.disabled = true; urgentDescription.textContent = "Could not load this preference. Refresh or try again later.";
      urgentError.hidden = false; urgentError.textContent = error.message || "Could not load urgent notification preference.";
    }
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    setBusy(saveButton, true, "Saving…");
    try {
      var result = await api.request("/consents/me/preferences", { method: "PUT", body: { sharingMode: sharingMode.value, consentVersion: consentVersion.value.trim() } });
      showMessage((result && result.message) || "Contact-sharing preference saved.", "success");
    } catch (error) { showMessage(error.message || "Could not save contact-sharing preference.", "error"); }
    finally { setBusy(saveButton, false); }
  });
  grantForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setBusy(grantButton, true, "Recording…");
    try {
      var result = await api.request("/consents/me", { method: "POST", body: { scope: grantScope.value } });
      showMessage((result && result.message) || "Consent recorded.", "success");
      await load();
    } catch (error) {
      showMessage(error.message || "Could not record consent.", "error");
    } finally {
      setBusy(grantButton, false);
    }
  });
  urgent.addEventListener("change", async function () {
    var requested = urgent.checked; urgent.disabled = true; urgentError.hidden = true;
    try {
      var result = await api.request("/consents/me/urgent-notifications", { method: "PUT", body: { enabled: requested } });
      currentUrgent = requested; urgentDescription.textContent = requested ? "You are opted in to urgent blood-request notifications." : "You are currently opted out of urgent blood-request notifications.";
      showMessage((result && result.message) || "Urgent notification preference updated.", "success");
    } catch (error) {
      urgent.checked = currentUrgent; urgentError.hidden = false; urgentError.textContent = error.message || "Could not update urgent notification preference.";
      showMessage(urgentError.textContent, "error");
    } finally { urgent.disabled = false; }
  });
  async function revokeConsent(id, button) {
    if (!window.confirm("Revoke this active consent? This may prevent contact disclosure for the associated request.")) return;
    setBusy(button, true, "Revoking…");
    try { await api.request("/consents/me/" + encodeURIComponent(id) + "/revoke", { method: "POST" }); showMessage("Consent revoked.", "success"); await load(); }
    catch (error) { showMessage(error.message || "Could not revoke consent.", "error"); setBusy(button, false); }
  }
  refreshButton.addEventListener("click", async function () { setBusy(refreshButton, true, "Refreshing…"); await load(); setBusy(refreshButton, false); });
  if (window.BloodAppAuth && typeof window.BloodAppAuth.requireRole === "function") window.BloodAppAuth.requireRole(["DONOR"]);
  if (window.BloodAppNavigation) window.BloodAppNavigation.render();
  load();
})();
