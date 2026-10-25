(function () {
  "use strict";
  var api = window.BloodAppApi;
  var form = document.getElementById("donor-profile-form");
  var message = document.getElementById("page-message");
  var saveButton = document.getElementById("save-profile-button");
  var availabilityToggle = document.getElementById("availability-toggle");
  var initialValues = null;
  var currentProfile = null;

  function setMessage(text, kind) {
    message.textContent = text || "";
    message.dataset.kind = kind || "info";
    message.hidden = !text;
  }
  function getProfile(result) { return result && result.profile ? result.profile : result; }
  function dateInput(value) {
    if (!value) return "";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toISOString().slice(0, 10);
  }
  function pretty(value) {
    if (value === null || value === undefined || value === "") return "Not provided";
    return String(value).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function dateLabel(value) {
    if (!value) return "Not provided";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
  }
  function captureForm() {
    return {
      bloodGroup: form.elements.bloodGroup.value,
      dateOfBirth: form.elements.dateOfBirth.value,
      weightKg: form.elements.weightKg.value,
      city: form.elements.city.value.trim(),
      lastDonationDate: form.elements.lastDonationDate.value
    };
  }
  function populate(profile) {
    currentProfile = profile || null;
    form.elements.bloodGroup.value = profile && profile.bloodGroup || "";
    form.elements.dateOfBirth.value = dateInput(profile && profile.dateOfBirth);
    form.elements.weightKg.value = profile && profile.weightKg != null ? String(profile.weightKg) : "";
    form.elements.city.value = profile && profile.city || "";
    form.elements.lastDonationDate.value = dateInput(profile && profile.lastDonationDate);
    initialValues = captureForm();
    var hasRequired = !!(initialValues.bloodGroup && initialValues.dateOfBirth && initialValues.weightKg && initialValues.city);
    document.getElementById("profile-status").textContent = hasRequired ? "Required details completed" : "Profile needs completion";
    document.getElementById("verification-status").textContent = pretty(profile && profile.verificationStatus);
    document.getElementById("availability-status").textContent = profile && profile.isAvailable ? "Available" : "Not available";
    document.getElementById("last-donation-summary").textContent = dateLabel(profile && profile.lastDonationDate);
    var wait = profile && (profile.waitingPeriod || profile.waitingPeriodEndsAt || profile.nextEligibleDonationDate || profile.eligibilityReason);
    document.getElementById("waiting-period").textContent = wait ? (typeof wait === "string" && /\d{4}-\d{2}-\d{2}/.test(wait) ? dateLabel(wait) : pretty(wait)) : "Not supplied by the profile endpoint";
    availabilityToggle.checked = !!(profile && profile.isAvailable);
    availabilityToggle.disabled = false;
    document.getElementById("availability-label").textContent = availabilityToggle.checked ? "On" : "Off";
  }
  async function loadProfile() {
    if (!window.BloodAppAuth.requireRole(["DONOR"])) return;
    window.BloodAppNavigation.render();
    try {
      var result = await api.request("/donor-profile/me");
      populate(getProfile(result));
    } catch (error) {
      if (error.status === 404) {
        populate(null);
        document.getElementById("profile-status").textContent = "Not created yet";
        setMessage("Create your donor profile by completing the required fields below.", "info");
      } else {
        availabilityToggle.disabled = true;
        setMessage(error.message || "Could not load your donor profile.", "error");
      }
    }
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setMessage("");
    if (!form.reportValidity()) return;
    var values = captureForm();
    var weight = Number(values.weightKg);
    if (!Number.isFinite(weight) || weight < 1 || weight > 999.99) {
      setMessage("Enter a weight between 1 and 999.99 kg.", "error");
      form.elements.weightKg.focus();
      return;
    }
    if (values.lastDonationDate && values.lastDonationDate > new Date().toISOString().slice(0, 10)) {
      setMessage("Last donation date cannot be in the future.", "error");
      form.elements.lastDonationDate.focus();
      return;
    }
    var body = {
      bloodGroup: values.bloodGroup,
      dateOfBirth: values.dateOfBirth,
      weightKg: weight,
      city: values.city,
      lastDonationDate: values.lastDonationDate || null
    }; // Do not send account fields (email/userId); the authenticated backend resolves the user.
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    try {
      var result = await api.request("/donor-profile/me", { method: "PUT", body: body });
      var profile = getProfile(result);
      if (profile && typeof profile === "object" && profile.bloodGroup) populate(profile);
      else await loadProfile();
      setMessage(result && result.message ? result.message : "Profile saved successfully.", "success");
    } catch (error) {
      setMessage(error.message || "Could not save your profile.", "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save profile";
    }
  });
  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      if (initialValues) {
        form.elements.bloodGroup.value = initialValues.bloodGroup;
        form.elements.dateOfBirth.value = initialValues.dateOfBirth;
        form.elements.weightKg.value = initialValues.weightKg;
        form.elements.city.value = initialValues.city;
        form.elements.lastDonationDate.value = initialValues.lastDonationDate;
      }
    }, 0);
  });
  availabilityToggle.addEventListener("change", async function () {
    var requested = availabilityToggle.checked;
    availabilityToggle.disabled = true;
    setMessage("");
    try {
      var result = await api.request("/donor-profile/me/availability", { method: "PATCH", body: { isAvailable: requested } });
      var profile = result && result.profile ? result.profile : Object.assign({}, currentProfile || {}, { isAvailable: requested });
      populate(profile);
      setMessage(result && result.message ? result.message : "Availability updated.", "success");
    } catch (error) {
      availabilityToggle.checked = !!(currentProfile && currentProfile.isAvailable);
      document.getElementById("availability-label").textContent = availabilityToggle.checked ? "On" : "Off";
      setMessage(error.message || "The backend could not update availability. Your previous setting has been restored.", "error");
    } finally {
      availabilityToggle.disabled = false;
    }
  });
  loadProfile();
})();
