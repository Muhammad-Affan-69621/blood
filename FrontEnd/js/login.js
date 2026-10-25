(function () {
  "use strict";
  var form = document.getElementById("login-form");
  var email = document.getElementById("email");
  var password = document.getElementById("password");
  var message = document.getElementById("form-message");
  var submit = document.getElementById("submit-button");
  var toggle = document.getElementById("password-toggle");

  function show(text, type) {
    message.textContent = text;
    message.className = "message message--" + type;
    message.hidden = false;
  }
  function setBusy(busy) {
    submit.disabled = busy;
    submit.setAttribute("aria-busy", String(busy));
    submit.querySelector(".button-label").textContent = busy ? "Signing in…" : "Sign in";
  }
  function fieldError(field, text) {
    var node = document.getElementById(field.id + "-error");
    node.textContent = text || "";
    if (text) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    message.hidden = true;
    fieldError(email, "");
    fieldError(password, "");
    var valid = true;
    if (!email.validity.valid || !email.value.trim()) {
      fieldError(email, "Enter a valid email address."); valid = false;
    }
    if (password.value.length < 8 || password.value.length > 72) {
      fieldError(password, "Password must be between 8 and 72 characters."); valid = false;
    }
    if (!valid) {
      show("Please correct the highlighted fields.", "error");
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }

    setBusy(true);
    try {
      var result = await window.BloodAppApi.login(email.value.trim(), password.value);
      window.BloodAppApi.saveSession(result);
      password.value = "";
      show("Signed in successfully. Opening your dashboard…", "success");
      window.location.replace(window.BloodAppAuth.dashboardFor(result.user));
    } catch (error) {
      var text = error.message || "Sign-in failed. Please try again.";
      if (error.status === 401) text = "Email or password is incorrect, or this account is suspended or deactivated.";
      if (error.status === 429) text = "Too many sign-in attempts. Please wait a minute before trying again.";
      show(text, "error");
    } finally {
      setBusy(false);
    }
  });

  toggle.addEventListener("click", function () {
    var reveal = password.type === "password";
    password.type = reveal ? "text" : "password";
    toggle.setAttribute("aria-pressed", String(reveal));
    toggle.textContent = reveal ? "Hide" : "Show";
    toggle.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
  });
  [email, password].forEach(function (field) {
    field.addEventListener("input", function () { fieldError(field, ""); });
  });
})();
