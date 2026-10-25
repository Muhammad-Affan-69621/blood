(function () {
  "use strict";
  var api = window.BloodAppApi;
  var list = document.getElementById("notification-list");
  var message = document.getElementById("page-message");
  var refreshButton = document.getElementById("refresh-button");
  var readAllButton = document.getElementById("read-all-button");
  var pageSize = document.getElementById("page-size");
  var page = 1, busy = false, lastItems = [], totalPages = 1;
  function unwrap(v) { return v && typeof v === "object" && v.data !== undefined ? v.data : v; }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function dateLabel(v) { if(!v)return ""; var d=new Date(v); return isNaN(d.getTime())?String(v):d.toLocaleString(); }
  function labelType(type) {
    var t=String(type||"Notification").replace(/[_-]+/g," ").toLowerCase();
    return t.replace(/\b\w/g,function(c){return c.toUpperCase();});
  }
  function setMessage(text,error) { message.textContent=text||""; message.hidden=!text; message.className="status-banner"+(error?" status-banner--error":""); }
  function render(items, pagination) {
    lastItems=items; list.replaceChildren();
    document.getElementById("total-count").textContent=String(items.length);
    if(!items.length){var empty=document.createElement("div");empty.className="empty-state";empty.textContent="You have no notifications on this page.";list.appendChild(empty);}
    items.forEach(function(item){
      var id=item.id, isRead=!!item.readAt, title=labelType(item.type), created=item.createdAt;
      var ref=item.payloadReference;
      var details="";
      if(ref && typeof ref==="object") {
        var parts=[]; ["requestId","bloodRequestId","status","reason"].forEach(function(k){ if(ref[k]!==undefined && ref[k]!==null && ref[k]!=="") { var label=k.replace(/Id$/, " ID").replace(/([A-Z])/g," $1").replace(/^./,function(c){return c.toUpperCase();}); parts.push(label+": "+String(ref[k])); } });
        details=parts.join(" · ");
      } else if(typeof ref==="string" && ref) { details="Reference: "+ref; }
      var card=document.createElement("article");card.className="notification-card"+(isRead?"":" is-unread");
      card.innerHTML='<div><h2>'+esc(title)+'</h2><p>'+esc(details||"There is an update related to your account or blood requests.")+'</p><p class="notification-meta">'+esc(dateLabel(created))+'</p></div><div class="notification-actions">'+(isRead?'<span class="read-label">Read</span>':'<button class="text-button mark-read" type="button" data-id="'+esc(id)+'">Mark as read</button>')+'</div>';
      list.appendChild(card);
    });
    var total=pagination && Number.isFinite(Number(pagination.total))?Number(pagination.total):null;
    totalPages=pagination && Number.isFinite(Number(pagination.totalPages))?Math.max(1,Number(pagination.totalPages)):(items.length===Number(pageSize.value)?page+1:page);
    document.getElementById("results-summary").textContent=total===null?(items.length?"Showing "+items.length+" notification(s).":"No notifications found."):(total?"Showing "+items.length+" of "+total+" notification(s).":"No notifications found.");
    document.getElementById("page-indicator").textContent="Page "+page+(totalPages>1?" of "+totalPages:"");
    document.getElementById("previous-page").disabled=page<=1;document.getElementById("next-page").disabled=page>=totalPages;
    list.querySelectorAll(".mark-read").forEach(function(b){b.addEventListener("click",function(){markOne(b.dataset.id,b);});});
  }
  async function load() {
    if(busy)return;busy=true;refreshButton.disabled=true;setMessage("");list.innerHTML='<div class="empty-state loading">Loading notifications…</div>';
    try {
      var result=unwrap(await api.request("/notifications?page="+page+"&limit="+Number(pageSize.value)));
      var items=Array.isArray(result)?result:(result&&Array.isArray(result.items)?result.items:null);
      if(!items)throw new Error("The server returned an unexpected notification-list format.");
      render(items,result&&result.pagination);
      try {var unread=unwrap(await api.request("/notifications/unread-count"));document.getElementById("unread-count").textContent=String(unread&&unread.count!==undefined?unread.count:"—");}
      catch(_){document.getElementById("unread-count").textContent="—";}
    } catch(error) {
      list.innerHTML='<div class="empty-state"><h2>Unable to load notifications</h2><p>'+esc(error.message||"Please try again.")+'</p><button class="button" type="button" id="retry-notifications">Try again</button></div>';
      document.getElementById("total-count").textContent="—";document.getElementById("unread-count").textContent="—";document.getElementById("results-summary").textContent="Notifications could not be loaded.";
      setMessage(error.status===403?"Your account is not authorized to view these notifications.":"Check your connection and try again.",true);
      document.getElementById("retry-notifications").addEventListener("click",load);
    } finally {busy=false;refreshButton.disabled=false;}
  }
  async function markOne(id,button) { button.disabled=true;button.textContent="Updating…";try{await api.request("/notifications/"+encodeURIComponent(id)+"/read",{method:"PATCH"});setMessage("Notification marked as read.");await load();}catch(e){button.disabled=false;button.textContent="Mark as read";setMessage(e.message||"Could not update notification status.",true);} }
  async function markAll(){if(busy)return;readAllButton.disabled=true;try{await api.request("/notifications/read-all",{method:"PATCH"});setMessage("Notifications marked as read.");await load();}catch(e){setMessage(e.message||"Could not mark notifications as read.",true);}finally{readAllButton.disabled=false;}}
  refreshButton.addEventListener("click",load);readAllButton.addEventListener("click",markAll);
  pageSize.addEventListener("change",function(){page=1;load();});
  document.getElementById("previous-page").addEventListener("click",function(){if(page>1){page--;load();}});
  document.getElementById("next-page").addEventListener("click",function(){if(page<totalPages){page++;load();}});
  document.addEventListener("DOMContentLoaded",function(){if(window.BloodAppNavigation)window.BloodAppNavigation.render();if(window.BloodAppAuth&&window.BloodAppAuth.requireRole)window.BloodAppAuth.requireRole(["RECIPIENT"]);load();});
})();
