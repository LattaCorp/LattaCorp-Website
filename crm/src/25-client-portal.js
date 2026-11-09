/* Client portal controls on the client page: the client's account status (the same badge they see in the portal),
   who can sign in, and the "Send invite" email. Clients sign in at lattacorpfl.com/portal/ with a code sent to their
   email; the main email can sign in unless switched off here, and Other contacts only when "Portal access" is ticked. */

/* Account status, worked out the same way as the portal (supabase/stages/stage23_client_portal.sql). */
function acctStatus(c) {
  var bal = 0,
    pastDue = 0;
  invoices.forEach(function (i) {
    if (i.client_id !== c.id) return;
    var b = balOf(i);
    bal += b;
    if (b > 0 && i.due_date && i.due_date < today()) pastDue += b;
  });
  bal = Math.max(0, r2(bal - creditOf(c.id)));
  if (pastDue > 0 && bal > 0) return { key: "past_due", label: "Past due", cls: "od", bal: bal };
  if (bal > 0) return { key: "due", label: "Payment due", cls: "new", bal: bal };
  var upcoming = visits.some(function (v) {
    return v.client_id === c.id && v.status === "scheduled" && v.scheduled_date >= today();
  });
  var activeJob = jobs.some(function (j) {
    return j.client_id === c.id && j.status === "active";
  });
  if (!upcoming && !activeJob) return { key: "paused", label: "Paused", cls: "lost", bal: 0 };
  return { key: "active", label: "Active", cls: "won", bal: 0 };
}
function acctChip(c) {
  var s = acctStatus(c);
  return el("span", "chip " + s.cls, s.label + (s.bal ? " · " + money(s.bal) : ""));
}

var portalBoxRedraw = null;
function clientPortalSection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Client portal"),
    box = el("div");
  sec.appendChild(h);
  sec.appendChild(box);
  function draw() {
    box.textContent = "";
    if (c.portal_access === undefined) {
      box.appendChild(
        el(
          "div",
          "note",
          "Run the Stage 23 SQL in Supabase to turn on the client portal, then press Refresh."
        )
      );
      return;
    }
    var st = el("div", "pcard"),
      top = el("div");
    top.appendChild(el("b", null, "Account status: "));
    top.appendChild(acctChip(c));
    st.appendChild(top);
    st.appendChild(
      el(
        "div",
        "note",
        "This is the badge the client sees at the top of their portal. It turns red when an invoice is past its due date."
      )
    );
    box.appendChild(st);

    var who = el("div", "pcard");
    who.appendChild(el("b", null, "Who can sign in"));
    if (c.email) {
      var lab = el("label");
      lab.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:8px;font-weight:600";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.style.width = "auto";
      cb.checked = c.portal_access !== false;
      cb.addEventListener("change", function () {
        cb.disabled = true;
        sb.from("clients")
          .update({ portal_access: cb.checked })
          .eq("id", c.id)
          .then(function (r) {
            cb.disabled = false;
            if (r.error) {
              alert("Could not save.");
              cb.checked = !cb.checked;
              return;
            }
            c.portal_access = cb.checked;
            draw();
          });
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode("Main email (" + c.email + ")"));
      who.appendChild(lab);
    } else {
      who.appendChild(
        el("div", "note", "No email on file. Use Edit details to add one so this client can sign in.")
      );
    }
    var ccOn = clientCC(c.id).filter(function (x) {
      return x.portal_access && x.email;
    });
    ccOn.forEach(function (x) {
      who.appendChild(
        el("div", "note", "✓ " + (x.name || x.email) + (x.role ? " (" + x.role + ")" : "") + " · " + x.email)
      );
    });
    who.appendChild(
      el(
        "div",
        "note",
        "To give a spouse, board member or property manager access, edit them under Other contacts and tick Portal access."
      )
    );
    box.appendChild(who);

    var targets = [];
    if (c.email && c.portal_access !== false) targets.push({ email: c.email, name: c.name });
    ccOn.forEach(function (x) {
      targets.push({ email: x.email, name: x.name || c.name });
    });
    var inv = el("div", "pcard");
    inv.appendChild(el("b", null, "Invite to the portal"));
    if (!targets.length) {
      inv.appendChild(el("div", "note", "Give someone access above first."));
    } else {
      var row = el("div", "grid2");
      var to = fld(
        "Send to",
        "select",
        "0",
        targets.map(function (x, k) {
          return [String(k), x.name + " · " + x.email];
        })
      );
      var lg = fld("Language", "select", "en", [
        ["en", "English"],
        ["es", "Spanish"]
      ]);
      row.appendChild(to);
      row.appendChild(lg);
      inv.appendChild(row);
      var send = btn(c.portal_invited_at ? "Send invite again" : "Send invite", "btn sm", function () {
        var x = targets[Number(to.input.value) || 0];
        send.disabled = true;
        callApi("/api/portal/invite", "invite", {
          client_id: c.id,
          email: x.email,
          name: x.name,
          lang: lg.input.value
        }).then(function (res) {
          send.disabled = false;
          if (!res.ok) {
            alert(res.error);
            return;
          }
          c.portal_invited_at = new Date().toISOString();
          alert("Invite sent to " + x.email + ".");
          draw();
        });
      });
      inv.appendChild(send);
    }
    if (c.portal_invited_at)
      inv.appendChild(
        el("div", "note", "Last invited " + new Date(c.portal_invited_at).toLocaleDateString() + ".")
      );
    inv.appendChild(
      el("div", "note", "They sign in at lattacorpfl.com/portal with a one-time code sent to their email.")
    );
    box.appendChild(inv);
  }
  portalBoxRedraw = draw;
  draw();
  return sec;
}
