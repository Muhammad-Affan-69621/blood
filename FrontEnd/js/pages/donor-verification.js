(function () {
  "use strict";
  var api = window.BloodAppApi;
  var message = document.getElementById("page-message");
  var title = document.getElementById("status-title");
  var description = document.getElementById("status-description");
  var submittedAt = document.getElementById("submitted-at");
  var updatedAt = document.getElementById("updated-at");
  var feedback = document.getElementById("review-feedback");
  var feedbackText = document.getElementById("feedback-text");
  var form = document.getElementById("verification-form");
  var submitButton = document.getElementById("submit-button");
  var guidance = document.getElementById("submit-guidance");
  var currentStatus = null;
  var loading = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]; });
  }
  function pretty(value) { return String(value || "UNKNOWN").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function dateLabel(value) {
    if (!value) return "Not available";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  function setMessage(text, kind) { message.textContent = text || ""; message.dataset.kind = kind || "info"; message.hidden = !text; }
  function canSubmit(status) { return status !== "PENDING" && status !== "VERIFIED"; }
  function updateSubmitState() {
    var allowed = currentStatus !== null && canSubmit(currentStatus) && !loading;
    submitButton.disabled = !allowed;
    if (currentStatus === "PENDING") guidance.textContent = "Your verification is awaiting review. You cannot submit again while it is pending.";
    else if (currentStatus === "VERIFIED") guidance.textContent = "Your donor profile is already verified. No new submission is needed.";
    else if (currentStatus === "SUSPENDED") guidance.textContent = "Your status is suspended. Contact support if you believe this is incorrect; the server will determine whether resubmission is allowed.";
    else if (currentStatus === "REJECTED") guidance.textContent = "Your previous submission was rejected. You may submit again; include the requested corrections if reviewer feedback is available.";
    else if (currentStatus === "NOT_SUBMITTED") guidance.textContent = "Your profile has not been submitted for verification yet.";
    else guidance.textContent = "Submission availability will be checked by the server.";
  }
  function renderStatus(result) {
    if (!result || typeof result.status !== "string") throw new Error("The server returned an unexpected verification response.");
    currentStatus = result.status.toUpperCase();
    title.innerHTML = '<span class="status-label" data-status="' + escapeHtml(currentStatus) + '">' + escapeHtml(pretty(currentStatus)) + '</span>';
    var descriptions = {
      PENDING: "Your donor profile is awaiting review. You will see the latest reviewer feedback here when available.",
      VERIFIED: "Your donor profile has been verified.",
      REJECTED: "Your latest verification was rejected. Review the feedback below before submitting again.",
      SUSPENDED: "Your verification status is suspended. Contact the relevant support team if you need clarification."
    };
    description.textContent = descriptions[currentStatus] || "Your current verification status is shown above.";
    var review = result.latestReview || null;
    submittedAt.textContent = review ? dateLabel(review.createdAt) : "No submission recorded";
    updatedAt.textContent = review ? dateLabel(review.updatedAt) : "Not available";
    if (review && review.reason) { feedbackText.textContent = review.reason; feedback.hidden = false; }
    else { feedback.hidden = true; feedbackText.textContent = ""; }
    updateSubmitState();
  }
  async function loadStatus() {
    loading = true; updateSubmitState(); setMessage("");
    title.textContent = "Loading verification status…";
    try {
      var result = await api.request("/verification/me");
      renderStatus(result);
    } catch (error) {
      currentStatus = null;
      title.textContent = "Unable to load status";
      description.textContent = error.message || "Please try again.";
      guidance.textContent = "Refresh your verification status before attempting to submit.";
      submitButton.disabled = true;
      setMessage(error.status === 404 ? "Create your donor profile before requesting verification." : "Verification status could not be retrieved. No sample data is being shown.", "error");
    } finally { loading = false; updateSubmitState(); }
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!canSubmit(currentStatus) || loading) return;
    loading = true; submitButton.disabled = true; submitButton.textContent = "Submitting…"; setMessage("");
    try {
      var result = await api.request("/verification/me/submit", { method: "POST", body: {} });
      setMessage((result && result.message) || "Verification submitted for review.", "success");
      await loadStatus();
    } catch (error) {
      setMessage(error.message || "The verification submission failed.", "error");
      // The server is authoritative about whether resubmission is permitted.
      await loadStatus();
    } finally { loading = false; submitButton.textContent = "Submit for review"; updateSubmitState(); }
  });
  document.addEventListener("DOMContentLoaded", function () {
    if (window.BloodAppNavigation) window.BloodAppNavigation.render();
    if (window.BloodAppAuth && typeof window.BloodAppAuth.requireRole === "function") window.BloodAppAuth.requireRole(["DONOR"]);
    loadStatus();
  });
})();
