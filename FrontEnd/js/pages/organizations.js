(function () {
  "use strict";
  var api = window.BloodAppApi;
  var list = document.getElementById("organization-list");
  var msg = document.getElementById("page-message");
  var search = document.getElementById("org-search");
  var items = [];
  var archivedItems = [];
  var reportTarget = null;
  var restoreTarget = null;
  var isPlatformAdmin = false;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function say(t, e) {
    msg.textContent = t || "";
    msg.hidden = !t;
    msg.className = "status-banner" + (e ? " status-banner--error" : "");
  }
  function archivedSay(t, e) {
    var el = document.getElementById("archived-org-message");
    el.textContent = t || "";
    el.hidden = !t;
    el.className = "status-banner" + (e ? " status-banner--error" : "");
  }
  function unwrap(r) {
    if (Array.isArray(r)) return r;
    if (r && Array.isArray(r.organizations)) return r.organizations;
    if (r && Array.isArray(r.items)) return r.items;
    if (r && Array.isArray(r.data)) return r.data;
    return [];
  }
  function openReport(o) {
    reportTarget = { id: o.id, name: o.name };
    document.getElementById("report-org-name").textContent = o.name;
    document.getElementById("report-category").value = "";
    document.getElementById("report-reason").value = "";
    var formMsg = document.getElementById("report-form-message");
    formMsg.hidden = true;
    formMsg.textContent = "";
    document.getElementById("report-submit").disabled = false;
    document.getElementById("report-submit").textContent = "Submit report";
    document.getElementById("report-modal").showModal();
  }
  function openRestore(o) {
    restoreTarget = { id: o.id, name: o.name };
    document.getElementById("restore-org-name").textContent = o.name || "this organization";
    var formMsg = document.getElementById("restore-org-form-message");
    formMsg.hidden = true;
    formMsg.textContent = "";
    document.getElementById("restore-org-submit").disabled = false;
    document.getElementById("restore-org-submit").textContent = "Restore organization";
    document.getElementById("restore-org-modal").showModal();
  }
  function renderActive() {
    var q = search.value.trim().toLowerCase();
    var filtered = items.filter(function (o) {
      return String(o.name || "").concat(" ", o.slug || "").toLowerCase().includes(q);
    });
    list.replaceChildren();
    if (!filtered.length) {
      list.innerHTML = '<div class="org-empty">No active organizations match your search.</div>';
      return;
    }
    filtered.forEach(function (o) {
      var card = document.createElement("article");
      card.className = "org-card";
      card.innerHTML = '<h2>' + esc(o.name) + '</h2><p>Slug: ' + esc(o.slug) + '</p><p><span class="org-badge org-badge--active">Active</span></p><div class="org-actions"><a class="button" href="organization-management.html?id=' + encodeURIComponent(o.id) + '">View details</a><button type="button" class="button button--secondary report-btn">Report</button></div>';
      card.querySelector(".report-btn").addEventListener("click", function () { openReport(o); });
      list.appendChild(card);
    });
  }
  function renderArchived() {
    var target = document.getElementById("archived-organization-list");
    var q = search.value.trim().toLowerCase();
    var filtered = archivedItems.filter(function (o) {
      return String(o.name || "").concat(" ", o.slug || "").toLowerCase().includes(q);
    });
    target.replaceChildren();
    if (!filtered.length) {
      target.innerHTML = '<div class="org-empty">No archived organizations found.</div>';
      return;
    }
    filtered.forEach(function (o) {
      var card = document.createElement("article");
      card.className = "org-card";
      card.innerHTML = '<h3>' + esc(o.name) + '</h3><p>Slug: ' + esc(o.slug) + '</p><p><span class="org-badge org-badge--suspended">Archived</span></p><div class="org-actions"><a class="button button--secondary" href="organization-management.html?id=' + encodeURIComponent(o.id) + '">View details</a><button type="button" class="button restore-card-button">Restore organization</button></div>';
      card.querySelector(".restore-card-button").addEventListener("click", function () { openRestore(o); });
      target.appendChild(card);
    });
  }
  async function loadActive() {
    say("");
    list.innerHTML = '<div class="org-empty">Loading active organizations…</div>';
    try {
      var r = await api.request("/organizations");
      items = unwrap(r).filter(function (o) { return String(o.status || "ACTIVE").toUpperCase() === "ACTIVE"; });
      renderActive();
    } catch (e) {
      list.innerHTML = '<div class="org-empty"><h2>Could not load organizations</h2><p>' + esc(e.message) + '</p><button class="button" id="retry-active">Try again</button></div>';
      document.getElementById("retry-active").onclick = loadActive;
      say(e.message, true);
    }
  }
  async function loadArchived() {
    if (!isPlatformAdmin) return;
    archivedSay("");
    var target = document.getElementById("archived-organization-list");
    target.innerHTML = '<div class="org-empty">Loading archived organizations…</div>';
    try {
      // Platform-admin listing supports status filtering. Keep this list separate from public active organizations.
      var r = await api.request("/organizations?status=ARCHIVED");
      archivedItems = unwrap(r).filter(function (o) { return String(o.status || "").toUpperCase() === "ARCHIVED"; });
      renderArchived();
    } catch (e) {
      target.innerHTML = '<div class="org-empty">Archived organizations could not be loaded.</div>';
      archivedSay((e.message || "Could not load archived organizations.") + " Ensure the backend exposes archived organization listing for platform administrators.", true);
    }
  }
  async function restoreOrganization() {
    if (!restoreTarget) return;
    var button = document.getElementById("restore-org-submit");
    var formMsg = document.getElementById("restore-org-form-message");
    if (!isPlatformAdmin) {
      formMsg.textContent = "Only platform administrators can restore organizations.";
      formMsg.className = "org-status error";
      formMsg.hidden = false;
      return;
    }
    button.disabled = true;
    button.textContent = "Restoring…";
    formMsg.hidden = true;
    try {
      await api.request("/organizations/" + encodeURIComponent(restoreTarget.id) + "/restore", { method: "PATCH" });
      formMsg.textContent = "Organization restored successfully.";
      formMsg.className = "org-status";
      formMsg.hidden = false;
      items = items.filter(function (o) { return o.id !== restoreTarget.id; });
      archivedItems = archivedItems.filter(function (o) { return o.id !== restoreTarget.id; });
      renderActive();
      renderArchived();
      await loadActive();
      setTimeout(function () { document.getElementById("restore-org-modal").close(); }, 700);
    } catch (e) {
      formMsg.textContent = e.message || "Could not restore the organization. Please try again.";
      formMsg.className = "org-status error";
      formMsg.hidden = false;
      button.disabled = false;
      button.textContent = "Restore organization";
    }
  }
  search.addEventListener("input", function () { renderActive(); if (isPlatformAdmin) renderArchived(); });
  document.getElementById("refresh-button").addEventListener("click", loadActive);
  document.getElementById("refresh-archived-button").addEventListener("click", loadArchived);
  document.getElementById("restore-org-cancel").addEventListener("click", function () { document.getElementById("restore-org-modal").close(); });
  document.getElementById("restore-org-form").addEventListener("submit", function (e) { e.preventDefault(); restoreOrganization(); });
  document.getElementById("report-cancel").addEventListener("click", function () { document.getElementById("report-modal").close(); });
  document.getElementById("report-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!reportTarget) return;
    var button = document.getElementById("report-submit"), formMsg = document.getElementById("report-form-message");
    var category = document.getElementById("report-category").value, description = document.getElementById("report-reason").value.trim();
    if (!category) { formMsg.textContent = "Choose a reason category before submitting."; formMsg.className = "org-status error"; formMsg.hidden = false; return; }
    button.disabled = true; button.textContent = "Submitting…"; formMsg.hidden = true;
    try {
      var result = await api.request("/abuse-reports/" + encodeURIComponent(reportTarget.id), { method: "POST", body: { targetType: "ORGANIZATION", category: category, description: description || undefined } });
      formMsg.textContent = (result && result.message) || "Report submitted for review."; formMsg.className = "org-status"; formMsg.hidden = false; button.textContent = "Submitted";
      setTimeout(function () { document.getElementById("report-modal").close(); }, 900);
    } catch (err) { formMsg.textContent = err.message || "Could not submit the report. Please try again."; formMsg.className = "org-status error"; formMsg.hidden = false; button.disabled = false; button.textContent = "Submit report"; }
  });
  document.addEventListener("DOMContentLoaded", function () {
    if (window.BloodAppNavigation) window.BloodAppNavigation.render();
    if (!window.BloodAppAuth || !window.BloodAppAuth.requireAuth()) return;
    var roles = window.BloodAppAuth.rolesOf(api.currentUser() || {});
    isPlatformAdmin = roles.indexOf("PLATFORM_ADMIN") >= 0;
    var isOrgAdmin = roles.indexOf("ORGANIZATION_ADMIN") >= 0;
    if (isPlatformAdmin) {
      document.getElementById("create-org-link").hidden = false;
      document.getElementById("archived-org-panel").hidden = false;
    }
    if (!isPlatformAdmin && !isOrgAdmin) {
      // Donors and recipients may see only the name of their own organization.
      // Never load the public directory or member list for these roles.
      search.hidden = true;
      document.getElementById("refresh-button").hidden = false;
      document.querySelector(".org-heading h1").textContent = "My organization";
      document.querySelector(".org-heading p:not(.eyebrow)").textContent = "View the name of the organization you belong to.";
      document.querySelector(".org-toolbar label").hidden = true;
      document.getElementById("refresh-button").addEventListener("click", loadMyOrganization);
      loadMyOrganization();
      return;
    }
    loadActive();
    if (isPlatformAdmin) loadArchived();

    async function loadMyOrganization() {
      say("");
      list.innerHTML = '<div class="org-empty">Loading your organization…</div>';
      try {
        var sessionUser = api.currentUser() || {};
        var meResult = await api.request("/users/me");
        var me = meResult && (meResult.user || meResult.data || meResult) || sessionUser;
        var embedded = me.organization || me.membership && me.membership.organization ||
          me.organizationMembership && me.organizationMembership.organization ||
          sessionUser.organization || sessionUser.membership && sessionUser.membership.organization;
        var allMemberships = []
          .concat(Array.isArray(me.memberships) ? me.memberships : [])
          .concat(Array.isArray(me.organizationMemberships) ? me.organizationMemberships : [])
          .concat(Array.isArray(me.organizationMembership) ? me.organizationMembership : [])
          .concat(me.membership ? [me.membership] : [])
          .concat(me.organizationMembership && !Array.isArray(me.organizationMembership) ? [me.organizationMembership] : [])
          .concat(Array.isArray(sessionUser.memberships) ? sessionUser.memberships : [])
          .concat(Array.isArray(sessionUser.organizationMemberships) ? sessionUser.organizationMemberships : []);
        var organization = embedded && embedded.name ? embedded : null;
        var activeMembership = allMemberships.find(function(m) {
          return String(m.status || "").toUpperCase() === "ACTIVE" && (m.organization || m.organizationId || m.organization_id);
        });
        var organizationId = (activeMembership && (activeMembership.organizationId || activeMembership.organization_id || activeMembership.organization && activeMembership.organization.id)) ||
          me.organizationId || sessionUser.organizationId;
        if (!organization && activeMembership && activeMembership.organization && activeMembership.organization.name) organization = activeMembership.organization;
        if (!organization && organizationId) {
          var orgResult = await api.request("/organizations/" + encodeURIComponent(organizationId));
          organization = orgResult && (orgResult.organization || orgResult.data || orgResult) || null;
        }
        list.replaceChildren();
        if (organization && organization.name) {
          var card = document.createElement("article");
          card.className = "org-card";
          card.innerHTML = '<h2>' + esc(organization.name) + '</h2>';
          list.appendChild(card);
        } else {
          list.innerHTML = '<div class="org-empty">You are not currently an active member of an organization.</div>';
        }

        // Prefer invitation/membership data already returned for the signed-in user.
        // Calling /organizations/my-invitations is unsafe on APIs where "my-invitations"
        // is parsed as the :id UUID parameter, producing "Validation failed (uuid is expected)".
        var invitationSource = []
          .concat(Array.isArray(me.invitations) ? me.invitations : [])
          .concat(Array.isArray(me.pendingInvitations) ? me.pendingInvitations : [])
          .concat(Array.isArray(me.memberships) ? me.memberships : [])
          .concat(Array.isArray(me.organizationMemberships) ? me.organizationMemberships : [])
          .concat(Array.isArray(me.organizationMembership) ? me.organizationMembership : [])
          .concat(me.membership ? [me.membership] : [])
          .concat(me.organizationMembership && !Array.isArray(me.organizationMembership) ? [me.organizationMembership] : [])
          .concat(Array.isArray(sessionUser.invitations) ? sessionUser.invitations : [])
          .concat(Array.isArray(sessionUser.memberships) ? sessionUser.memberships : [])
          .concat(Array.isArray(sessionUser.organizationMemberships) ? sessionUser.organizationMemberships : []);
        var seen = {};
        var invitations = invitationSource.filter(function(inv) {
          var status = String(inv.status || inv.membershipStatus || "").toUpperCase();
          var membershipId = inv.membershipId || inv.id;
          if (status !== "INVITED" || !membershipId || seen[membershipId]) return false;
          seen[membershipId] = true;
          return true;
        });
        var invitePanel = document.createElement("section");
        invitePanel.className = "org-panel";
        invitePanel.innerHTML = '<h2>Organization invitations</h2>';
        list.appendChild(invitePanel);
        if (!invitations.length) {
          invitePanel.innerHTML += '<p class="org-muted">No pending invitations are included in your account details. If an invitation was sent to you, refresh your session or ask the administrator to verify the invitation.</p>';
          return;
        }
        var grid = document.createElement("div");
        grid.className = "org-grid";
        invitePanel.appendChild(grid);
        invitations.forEach(function(inv) {
          var org = inv.organization || {};
          var orgId = inv.organizationId || inv.organization_id || org.id;
          var membershipId = inv.membershipId || inv.id;
          var item = document.createElement("article");
          item.className = "org-card";
          item.innerHTML = '<h3>' + esc(org.name || inv.organizationName || inv.name || "Organization invitation") +
            '</h3><p class="org-muted">Status: ' + esc(inv.status || inv.membershipStatus || "INVITED") +
            '</p><button type="button" class="button accept-org-invitation">Accept invitation</button>';
          var btn = item.querySelector("button");
          if (!orgId || !membershipId) {
            btn.disabled = true;
            btn.title = "The API did not provide the organization and membership IDs required to accept this invitation.";
          }
          btn.addEventListener("click", async function() {
            btn.disabled = true;
            btn.textContent = "Accepting…";
            try {
              await api.request("/organizations/" + encodeURIComponent(orgId) + "/members/" + encodeURIComponent(membershipId) + "/accept", {method:"POST"});
              say("Organization invitation accepted.");
              await loadMyOrganization();
            } catch (err) {
              say(err.message || "Could not accept invitation.", true);
              btn.disabled = false;
              btn.textContent = "Accept invitation";
            }
          });
          grid.appendChild(item);
        });
      } catch (e) {
        list.innerHTML = '<div class="org-empty"><h2>Could not load your organization</h2><p>' + esc(e.message || "Please try again.") + '</p><button class="button" id="retry-my-organization">Try again</button></div>';
        document.getElementById("retry-my-organization").addEventListener("click", loadMyOrganization);
        say(e.message || "Could not load your organization.", true);
      }
    }
  });
})();
