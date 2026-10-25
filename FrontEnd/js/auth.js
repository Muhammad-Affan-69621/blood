(function () {
  "use strict";
  var DASHBOARDS = Object.freeze({
    DONOR: "donor-dashboard.html",
    RECIPIENT: "recipient-dashboard.html",
    PLATFORM_ADMIN: "admin-dashboard.html",
    ADMIN: "admin-dashboard.html",
    SUPER_ADMIN: "admin-dashboard.html",
    ORGANIZATION_ADMIN: "organization-dashboard.html",
    VERIFIER: "verification-queue.html",
    REQUEST_MANAGER: "organization-dashboard.html"
  });

  function rolesOf(user) {
    if (!user) return [];
    var roles = user.roles || user.role || [];
    if (!Array.isArray(roles)) roles = [roles];
    return roles.map(function (entry) {
      return String(entry && typeof entry === "object" ? entry.role || entry.name || "" : entry)
        .trim().toUpperCase();
    }).filter(Boolean);
  }
  function dashboardFor(user) {
    var roles = rolesOf(user);
    for (var i = 0; i < roles.length; i++) {
      if (DASHBOARDS[roles[i]]) return DASHBOARDS[roles[i]];
    }
    return "login.html?reason=role";
  }
  function onboardingFor(user, selectedRole) {
    var roles = rolesOf(user);
    var role = (selectedRole || roles[0] || "").toUpperCase();
    if (role === "DONOR") return "donor-profile.html";
    if (role === "RECIPIENT") return "recipient-dashboard.html";
    return dashboardFor(user);
  }
  function hasSession() {
    return !!(window.BloodAppApi && window.BloodAppApi.currentUser());
  }
  function requireAuth() {
    if (!hasSession()) { window.location.replace("login.html"); return false; }
    return true;
  }
  function requireRole(allowedRoles) {
    if (!requireAuth()) return false;
    var roles = rolesOf(window.BloodAppApi.currentUser());
    var allowed = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map(function (r) { return String(r).toUpperCase(); });
    if (!roles.some(function (r) { return allowed.indexOf(r) !== -1; })) {
      window.location.replace(dashboardFor(window.BloodAppApi.currentUser()));
      return false;
    }
    return true;
  }
  window.BloodAppAuth = Object.freeze({ dashboardFor: dashboardFor, onboardingFor: onboardingFor, rolesOf: rolesOf, requireAuth: requireAuth, requireRole: requireRole });
})();
