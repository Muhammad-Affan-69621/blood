(function () {
  "use strict";
  var form = document.getElementById("register-form");
  var email = document.getElementById("email");
  var password = document.getElementById("password");
  var confirm = document.getElementById("confirm-password");
  var role = document.getElementById("role");
  var message = document.getElementById("form-message");
  var submit = document.getElementById("submit-button");
  var toggle = document.getElementById("password-toggle");

  function show(text, type) {
    message.textContent = text;
    message.className = "message message--" + type;
    message.hidden = false;
  }
  function error(field, text) {
    var node = document.getElementById(field.id + "-error");
    node.textContent = text || "";
    if (text) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }
  function busy(value) {
    submit.disabled = value;
    submit.setAttribute("aria-busy", String(value));
    submit.querySelector(".button-label").textContent = value ? "Creating account…" : "Create account";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    message.hidden = true;
    [email, password, confirm, role].forEach(function (field) { error(field, ""); });
    var valid = true;
    if (!email.validity.valid || !email.value.trim()) { error(email, "Enter a valid email address."); valid = false; }
    if (password.value.length < 8 || password.value.length > 72) { error(password, "Password must be between 8 and 72 characters."); valid = false; }
    if (confirm.value !== password.value) { error(confirm, "Passwords do not match."); valid = false; }
    if (!role.value) { error(role, "Choose donor or recipient."); valid = false; }
    if (!valid) {
      show("Please correct the highlighted fields.", "error");
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }

    busy(true);
    try {
      var result = await window.BloodAppApi.register(email.value.trim(), password.value, role.value);
      window.BloodAppApi.saveSession(result);
      password.value = "";
      confirm.value = "";
      show("Your account was created. Taking you to the next step…", "success");
      window.location.replace(window.BloodAppAuth.onboardingFor(result.user, role.value));
    } catch (err) {
      var text = err.message || "Registration could not be completed.";
      if (err.status === 409) text = "An account with this email address already exists. Sign in or use password recovery.";
      if (err.status === 429) text = "Too many registration attempts. Please wait before trying again.";
      show(text, "error");
    } finally {
      busy(false);
    }
  });

  toggle.addEventListener("click", function () {
    var reveal = password.type === "password";
    password.type = confirm.type = reveal ? "text" : "password";
    toggle.textContent = reveal ? "Hide" : "Show";
    toggle.setAttribute("aria-pressed", String(reveal));
  });
  [email, password, confirm, role].forEach(function (field) {
    field.addEventListener("input", function () { error(field, ""); });
    field.addEventListener("change", function () { error(field, ""); });
  });
})();
