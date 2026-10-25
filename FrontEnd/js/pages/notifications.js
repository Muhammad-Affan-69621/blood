(function () {
  "use strict";
  var api = window.BloodAppApi;
  var list = document.getElementById("notification-list");
  var message = document.getElementById("page-message");
  var refreshButton = document.getElementById("refresh-button");
  var readAllButton = document.getElementById("read-all-button");
  var pageSize = document.getElementById("page-size");
  var page = 1, busy = false, lastItems = [];
  function unwrap(value) { if (!value || typeof value !== "object") return value; return value.data !== undefined ? value.data : value; }
  function getItems(value) {
    value = unwrap(value);
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      var candidates = [value.items, value.results, value.notifications, value.data && value.data.items];
      for (var i=0;i<candidates.length;i++) if (Array.isArray(candidates[i])) return candidates[i];
    }
    return null;
  }
  function getCount(value) {
    value=unwrap(value);
    if (typeof value === "number") return value;
    if (value && typeof value === "object") {
      var n = value.count !== undefined ? value.count : value.unreadCount !== undefined ? value.unreadCount : value.total;
      if (n !== undefined && isFinite(Number(n))) return Number(n);
    }
    return null;
  }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function first(obj, keys) { for(var i=0;obj && i<keys.length;i++) if(obj[keys[i]]!==undefined && obj[keys[i]]!==null && obj[keys[i]]!=="") return obj[keys[i]]; }
  function dateLabel(value) { if(!value) return ""; var d=new Date(value); return isNaN(d.getTime()) ? String(value) : d.toLocaleString(); }
  function setMessage(text, type) { message.textContent=text||""; message.hidden=!text; message.className="status-banner"+(type==="error"?" status-banner--error":""); }
  function render(items) {
    lastItems=items;
    document.getElementById("total-count").textContent=String(items.length);
    list.replaceChildren();
    if(!items.length) { var empty=document.createElement("div"); empty.className="empty-state"; empty.textContent="You have no notifications on this page."; list.appendChild(empty); }
    items.forEach(function(item) {
      var id=first(item,["id","notificationId","uuid"]);
      var read=first(item,["isRead","read","readAt"]) ;
      var isRead=read===true || (typeof read==="string" && read!=="");
      var title=first(item,["title","subject","type"]) || "Notification";
      var body=first(item,["message","body","description","content"]) || "No additional details were provided.";
      var created=first(item,["createdAt","sentAt","timestamp","date"]);
      var card=document.createElement("article");
      card.className="notification-card"+(isRead?"":" is-unread");
      card.innerHTML='<div><h2>'+esc(title)+'</h2><p>'+esc(body)+'</p><p class="notification-meta">'+esc(dateLabel(created))+'</p></div><div class="notification-actions">'+(isRead?'<span class="read-label">Read</span>':id?'<button class="text-button mark-read" type="button" data-id="'+esc(id)+'">Mark as read</button>':'<span class="notification-meta">Unread</span>')+'</div>';
      list.appendChild(card);
    });
    document.getElementById("results-summary").textContent=items.length ? "Showing "+items.length+" notification"+(items.length===1?"":"s")+" on this page." : "No notifications found.";
    document.getElementById("page-indicator").textContent="Page "+page;
    document.getElementById("previous-page").disabled=page<=1;
    document.getElementById("next-page").disabled=items.length<Number(pageSize.value);
    list.querySelectorAll(".mark-read").forEach(function(button){button.addEventListener("click",function(){markOne(button.dataset.id,button);});});
  }
  async function load() {
    if(busy)return; busy=true; refreshButton.disabled=true; setMessage(""); list.innerHTML='<div class="empty-state loading">Loading notifications…</div>';
    try {
      var results=await Promise.all([
        api.request("/notifications?page="+page+"&limit="+Number(pageSize.value)),
        api.request("/notifications/unread-count")
      ]);
      var items=getItems(results[0]); if(!items) throw new Error("The server returned an unexpected notification-list format.");
      render(items);
      var count=getCount(results[1]);
      document.getElementById("unread-count").textContent=count===null?"—":String(count);
    } catch(error) {
      list.innerHTML='<div class="empty-state"><h2>Unable to load notifications</h2><p>'+esc(error.message||"Please try again.")+'</p><button class="button" type="button" id="retry-notifications">Try again</button></div>';
      document.getElementById("total-count").textContent="—"; document.getElementById("unread-count").textContent="—";
      document.getElementById("results-summary").textContent="Notifications could not be loaded.";
      setMessage(error.status===403?"Your account is not authorized to view these notifications.":"No sample notifications are shown. Check your connection and try again.","error");
      document.getElementById("retry-notifications").addEventListener("click",load);
    } finally {busy=false;refreshButton.disabled=false;}
  }
  async function markOne(id,button) {
    button.disabled=true; button.textContent="Updating…";
    try { await api.request("/notifications/"+encodeURIComponent(id)+"/read",{method:"PATCH"}); setMessage("Notification marked as read."); await load(); }
    catch(error){button.disabled=false;button.textContent="Mark as read";setMessage(error.message||"Could not update notification status.","error");}
  }
  async function markAll() {
    if(busy)return; readAllButton.disabled=true; readAllButton.textContent="Updating…";
    try { await api.request("/notifications/read-all",{method:"PATCH"}); setMessage("Notifications marked as read."); await load(); }
    catch(error){setMessage(error.message||"Could not mark notifications as read.","error");}
    finally {readAllButton.disabled=false;readAllButton.textContent="Mark all as read";}
  }
  refreshButton.addEventListener("click",load);
  readAllButton.addEventListener("click",markAll);
  pageSize.addEventListener("change",function(){page=1;load();});
  document.getElementById("previous-page").addEventListener("click",function(){if(page>1){page--;load();}});
  document.getElementById("next-page").addEventListener("click",function(){if(lastItems.length===Number(pageSize.value)){page++;load();}});
  document.addEventListener("DOMContentLoaded",function(){if(window.BloodAppNavigation)window.BloodAppNavigation.render(); if(window.BloodAppAuth && typeof window.BloodAppAuth.requireRole==="function") window.BloodAppAuth.requireRole(["DONOR"]); load();});
})();