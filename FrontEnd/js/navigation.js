(function () {
  "use strict";
  var donorLinks = [
    ["donor-dashboard.html", "Dashboard"],
    ["donor-profile.html", "Profile"],
    ["matching-requests.html", "Matching requests"],
    ["donation-responses.html", "My responses"],
    ["donor-verification.html", "Verification"],
    ["donor-privacy.html", "Privacy & consent"],
    ["notifications.html", "Notifications"],
    ["my-organization.html", "My organization"]
  ];
  var recipientLinks = [
    ["recipient-dashboard.html", "Dashboard"],
    ["blood-requests.html", "My blood requests"],
    ["donor-search.html", "Find donors"],
    ["recipient-responses.html", "Donor responses"],
    ["recipient-notifications.html", "Notifications"],
    ["my-organization.html", "My organization"]
  ];
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }
  var organizationLinks = [["organizations.html", "Organizations"]];
  var platformOrganizationLinks = organizationLinks.concat([["create-organization.html", "Create organization"]]);
  function render() {
    var header = document.getElementById("app-header");
    if (!header) return;
    var current = window.location.pathname.split("/").pop() || "donor-dashboard.html";
    var user = window.BloodAppApi && window.BloodAppApi.currentUser();
    var email = user && user.email ? user.email : "Account";
    var roles = window.BloodAppAuth ? window.BloodAppAuth.rolesOf(user) : [];
    var isRecipient = roles.indexOf("RECIPIENT") >= 0;
    var isPlatformAdmin = roles.indexOf("PLATFORM_ADMIN") >= 0;
    var isOrganizationAdmin = roles.indexOf("ORGANIZATION_ADMIN") >= 0;
    var isModerator = roles.indexOf("MODERATOR") >= 0;
    var links = isPlatformAdmin ? [["admin-dashboard.html", "Platform admin"], ["admin-overview.html", "Platform overview"], ["admin-verification-queue.html", "Verification queue"]].concat(platformOrganizationLinks) : (isModerator ? [["moderator-dashboard.html", "Moderator dashboard"], ["moderator-abuse-reports.html", "Abuse reports"], ["moderator-verification-queue.html", "Verification queue"], ["moderator-notifications.html", "Notifications"], ["my-organization.html", "My organization"]] : (isRecipient ? recipientLinks : donorLinks).concat(isOrganizationAdmin ? organizationLinks : []));
    links = links.concat([["account-settings.html", "Account settings"]]);
    var dashboardHref = isPlatformAdmin ? "admin-dashboard.html" : (isModerator ? "moderator-dashboard.html" : (isRecipient ? "recipient-dashboard.html" : "donor-dashboard.html"));
    var navLinks = links.map(function (item) {
      var active = item[0] === current;
      return '<a class="nav-link" href="' + item[0] + '"' + (active ? ' aria-current="page"' : "") + '>' + item[1] + '</a>';
    }).join("");
    header.innerHTML = '<div class="header-inner"><a class="brand" href="' + dashboardHref + '" aria-label="Blood App dashboard"><img src="icons/blood-drop.svg" alt=""><span>Blood App</span></a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation" aria-label="Open navigation menu"><span></span><span></span><span></span></button><nav class="primary-nav" id="primary-navigation" aria-label="Primary navigation">' + navLinks + '<span class="mobile-account">Signed in as ' + escapeHtml(email) + '</span><button class="nav-signout" id="logout-button" type="button">Sign out</button></nav><span class="account-label" aria-label="Signed in as ' + escapeHtml(email) + '">' + escapeHtml(email) + '</span></div>';
    var toggle = header.querySelector(".nav-toggle");
    var nav = header.querySelector(".primary-nav");
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a") && window.matchMedia("(max-width: 1080px)").matches) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation menu");
      }
    });
    header.querySelector("#logout-button").addEventListener("click", async function () {
      this.disabled = true;
      this.textContent = "Signing out…";
      try { if (window.BloodAppApi) await window.BloodAppApi.logout(); }
      finally { window.location.replace("login.html"); }
    });
  }
  window.BloodAppNavigation = Object.freeze({ render: render });
})();
