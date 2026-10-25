(function () {
  "use strict";
  var form = document.getElementById("reset-form");
  var tokenInput = document.getElementById("reset-token");
  var password = document.getElementById("password");
  var confirm = document.getElementById("confirm-password");
  var message = document.getElementById("form-message");
  var submit = document.getElementById("submit-button");
  var toggle = document.getElementById("password-toggle");
  var params = new URLSearchParams(window.location.search);
  var token = params.get("token") || "";
  tokenInput.value = token;

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

  if (!token) {
    show("This password-reset link is missing its token. Request a new reset email.", "error");
    submit.disabled = true;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    message.hidden = true;
    [password, confirm].forEach(function (field) { error(field, ""); });
    var valid = true;
    if (!token) { show("Request a new password-reset link before continuing.", "error"); return; }
    if (password.value.length < 8 || password.value.length > 72) { error(password, "Password must be between 8 and 72 characters."); valid = false; }
    if (password.value !== confirm.value) { error(confirm, "Passwords do not match."); valid = false; }
    if (!valid) {
      show("Please correct the highlighted fields.", "error");
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }

    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
    submit.querySelector(".button-label").textContent = "Updating password…";
    try {
      await window.BloodAppApi.resetPassword(token, password.value);
      window.BloodAppApi.clearSession();
      form.reset();
      show("Your password has been reset. You can now sign in with your new password.", "success");
      window.setTimeout(function () { window.location.assign("login.html?reset=success"); }, 1400);
    } catch (err) {
      var text = err.message || "The password could not be reset.";
      if (err.status === 400 || err.status === 401 || err.status === 404) {
        text = "This reset link is invalid, expired, or has already been used. Request a new password-reset email.";
      } else if (err.status === 429) {
        text = "Too many reset attempts. Please wait before trying again.";
      }
      show(text, "error");
    } finally {
      submit.disabled = false;
      submit.setAttribute("aria-busy", "false");
      submit.querySelector(".button-label").textContent = "Reset password";
    }
  });

  toggle.addEventListener("click", function () {
    var reveal = password.type === "password";
    password.type = confirm.type = reveal ? "text" : "password";
    toggle.textContent = reveal ? "Hide" : "Show";
    toggle.setAttribute("aria-pressed", String(reveal));
  });
  [password, confirm].forEach(function (field) {
    field.addEventListener("input", function () { error(field, ""); });
  });
})();
