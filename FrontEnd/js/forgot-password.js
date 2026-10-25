(function () {
  "use strict";
  var form = document.getElementById("forgot-form");
  var email = document.getElementById("email");
  var message = document.getElementById("form-message");
  var error = document.getElementById("email-error");
  var submit = document.getElementById("submit-button");

  function show(text, type) {
    message.textContent = text;
    message.className = "message message--" + type;
    message.hidden = false;
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    message.hidden = true;
    error.textContent = "";
    email.removeAttribute("aria-invalid");
    if (!email.validity.valid || !email.value.trim()) {
      error.textContent = "Enter a valid email address.";
      email.setAttribute("aria-invalid", "true");
      email.focus();
      show("Please enter a valid email address.", "error");
      return;
    }
    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
    submit.querySelector(".button-label").textContent = "Sending…";
    try {
      await window.BloodAppApi.forgotPassword(email.value.trim());
      show("If an account exists for this email, password-reset instructions will be sent.", "success");
      form.reset();
    } catch (err) {
      var text = err.message || "Password recovery could not be completed. Please try again later.";
      if (err.status === 429) text = "Too many requests. Please wait before requesting another reset email.";
      if (err.status === 503) text = "Password recovery is temporarily unavailable. Please try again later.";
      show(text, "error");
    } finally {
      submit.disabled = false;
      submit.setAttribute("aria-busy", "false");
      submit.querySelector(".button-label").textContent = "Send reset instructions";
    }
  });
  email.addEventListener("input", function () {
    error.textContent = "";
    email.removeAttribute("aria-invalid");
  });
})();
