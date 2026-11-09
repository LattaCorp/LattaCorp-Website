/* Reminder messages to clients (email, text for owners, copy). */

/* ---- Text reminders (tap-to-text: opens your own Messages app, nothing is sent until you press Send there) ---- */
function remOn() {
  return visits.some(function (v) {
    return "reminded_at" in v;
  });
}
function firstName(c) {
  return String((c && c.name) || "").split(" ")[0] || "there";
}
function remMsg(mode, c, vs) {
  var nm = bizv("name", "Latta Corp"),
    addrs = [];
  vs.forEach(function (v) {
    var a = paddr(v.property_id);
    if (a && addrs.indexOf(a) < 0) addrs.push(a);
  });
  var dts = vs
      .map(function (v) {
        return v.scheduled_date;
      })
      .sort(),
    when = dlabel(dts[0]);
  if (mode === "delay")
    return (
      "Hi " +
      firstName(c) +
      ", this is " +
      nm +
      ". Because of the weather we've moved your service" +
      (addrs.length === 1 ? " at " + addrs[0] : "") +
      " to " +
      (dts[0] === addDays(today(), 1) ? "tomorrow, " + dshort(dts[0]) : dshort(dts[0])) +
      ". Thank you for understanding!"
    );
  return (
    "Hi " +
    firstName(c) +
    ", this is " +
    nm +
    ". We're scheduled to take care of your property" +
    (addrs.length === 1 ? " at " + addrs[0] : "") +
    " " +
    (dts[0] === today()
      ? "today"
      : dts[0] === addDays(today(), 1)
        ? "tomorrow, " + dshort(dts[0])
        : "on " + dshort(dts[0])) +
    ". If anything needs to change (gate, pets, etc.), just reply here. Thank you!"
  );
}
function remindPanel(vs, mode, title) {
  var p = panel();
  p.appendChild(el("h2", null, title));
  p.appendChild(
    el(
      "p",
      "note",
      mode === "delay"
        ? "Let these clients know their visit moved. Tap Email to open a ready-to-send message in your email app. Owners also get Text, which opens Messages on a phone. Nothing goes out until you press Send."
        : "Tap Email to open a ready-to-send reminder in your email app. Owners also get Text, which opens Messages on a phone. Nothing goes out until you press Send."
    )
  );
  var by = {},
    order = [];
  vs.slice()
    .sort(
      mode === "delay"
        ? function (a, b) {
            return a.scheduled_date < b.scheduled_date ? -1 : 1;
          }
        : dayOrder
    )
    .forEach(function (v) {
      if (!by[v.client_id]) {
        by[v.client_id] = [];
        order.push(v.client_id);
      }
      by[v.client_id].push(v);
    });
  if (!order.length) {
    p.appendChild(el("div", "empty", "No stops to text about."));
  }
  var sent = {};
  order.forEach(function (cid) {
    var c = byId(clients, cid) || {},
      list = by[cid],
      card = el("div", "pcard"),
      top = el("div");
    top.style.cssText =
      "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
    var l = el("div");
    l.appendChild(el("b", null, c.name || "(deleted client)"));
    var ad = [];
    list.forEach(function (v) {
      var a = paddr(v.property_id);
      if (a && ad.indexOf(a) < 0) ad.push(a);
    });
    l.appendChild(
      el("div", "note", ad.join(" · ") + (mode === "delay" ? " · now " + dshort(list[0].scheduled_date) : ""))
    );
    top.appendChild(l);
    var r = el("div");
    r.style.cssText = "display:flex;gap:8px;align-items:center";
    var chip = el("span", "chip won", "✓ Sent");
    chip.hidden = !(
      mode === "visit" &&
      list.every(function (v) {
        return v.reminded_at;
      })
    );
    r.appendChild(chip);
    msgActions(r, c, remMsg(mode, c, list), remSubj(mode), function () {
      chip.hidden = false;
      if (mode === "visit") {
        var on = remOn(),
          now = new Date().toISOString();
        list.forEach(function (v) {
          v.reminded_at = now;
        });
        if (on)
          sb.from("visits")
            .update({ reminded_at: now })
            .in(
              "id",
              list.map(function (v) {
                return v.id;
              })
            )
            .then(function () {});
      }
    });
    top.appendChild(r);
    card.appendChild(top);
    p.appendChild(card);
  });
  var dn = btn(mode === "delay" ? "Skip / Done" : "Done", "btn alt");
  dn.style.marginTop = "10px";
  dn.addEventListener("click", function () {
    closeDetail();
    render();
  });
  p.appendChild(dn);
}
function invRemind(inv, c) {
  return (
    "Hi " +
    firstName(c) +
    ", a friendly reminder from " +
    bizv("name", "Latta Corp") +
    ": invoice " +
    invNum(inv.number) +
    " (" +
    money(inv.total) +
    ") " +
    (isOverdue(inv) ? "was due " + dshort(inv.due_date) : "is due " + dshort(inv.due_date)) +
    "." +
    (inv.share_token ? " You can view it here: " + docUrl(inv.share_token) + " " : "") +
    (bizv("zelle", "") ? " Pay with Zelle: " + biz.zelle + "." : "") +
    " If you've already paid, thank you!"
  );
}
function stampInv(inv) {
  var on = "reminded_at" in inv,
    now = new Date().toISOString();
  inv.reminded_at = now;
  if (on)
    sb.from("invoices")
      .update({ reminded_at: now })
      .eq("id", inv.id)
      .then(function () {});
}
function remindOverdue(od) {
  var p = panel();
  p.appendChild(el("h2", null, "Remind overdue clients"));
  p.appendChild(
    el(
      "p",
      "note",
      "Tap Email to open a ready-to-send payment reminder in your email app. Owners also get Text, which opens Messages on a phone. Nothing goes out until you press Send."
    )
  );
  od.slice()
    .sort(function (a, b) {
      return a.due_date < b.due_date ? -1 : 1;
    })
    .forEach(function (i) {
      var c = byId(clients, i.client_id) || {},
        card = el("div", "pcard"),
        top = el("div");
      top.style.cssText =
        "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
      var l = el("div");
      l.appendChild(el("b", null, invNum(i.number) + " · " + cname(i.client_id)));
      l.appendChild(
        el(
          "div",
          "note",
          money(i.total) +
            " · due " +
            dshort(i.due_date) +
            (i.reminded_at ? " · last reminded " + dshort(String(i.reminded_at).slice(0, 10)) : "")
        )
      );
      top.appendChild(l);
      var r = el("div");
      r.style.cssText = "display:flex;gap:8px;align-items:center";
      var chip = el("span", "chip won", "✓ Sent");
      chip.hidden = true;
      r.appendChild(chip);
      msgActions(r, c, invRemind(i, c), "Payment reminder: invoice " + invNum(i.number), function () {
        chip.hidden = false;
        stampInv(i);
      });
      top.appendChild(r);
      card.appendChild(top);
      p.appendChild(card);
    });
  var dn = btn("Done", "btn alt");
  dn.style.marginTop = "10px";
  dn.addEventListener("click", function () {
    closeDetail();
    render();
  });
  p.appendChild(dn);
}

function mailHref(to, subject, body) {
  return (
    "mailto:" +
    encodeURIComponent(to).replace("%40", "@") +
    "?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(body)
  );
}
function remSubj(mode) {
  return mode === "delay"
    ? "Schedule change from " + bizv("name", "Latta Corp")
    : "Service reminder from " + bizv("name", "Latta Corp");
}
function copyBtn(label, text, small, cb) {
  var b = btn(label, "btn alt" + (small ? " sm" : ""), function () {
    function ok() {
      var o = b.textContent;
      b.textContent = "Copied ✓";
      setTimeout(function () {
        b.textContent = o;
      }, 1400);
      if (cb) cb();
    }
    function fb() {
      var t = document.createElement("textarea");
      t.value = text;
      t.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand("copy");
        ok();
      } catch (e) {
        alert("Could not copy. Select the text and copy it yourself.");
      }
      document.body.removeChild(t);
    }
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(ok, fb);
    else fb();
  });
  return b;
}
/* Email is the normal way to reach clients. Text (opens Messages on a phone) is for owners only; Copy lets anyone paste the message elsewhere. */
function msgActions(r, c, body, subject, onUse) {
  var any = false;
  if (c.email) {
    var e = el("a", "btn sm", "Email");
    e.href = mailHref(c.email, subject, body);
    e.addEventListener("click", onUse);
    r.appendChild(e);
    any = true;
  }
  if (isOwner() && c.phone) {
    var a = el("a", "btn alt sm", "Text");
    a.href = smsHref(c.phone, body);
    a.addEventListener("click", onUse);
    r.appendChild(a);
    any = true;
  }
  if (any) r.appendChild(copyBtn("Copy", body, true, onUse));
  else r.appendChild(el("span", "note", isOwner() ? "No email or phone on file" : "No email on file"));
}
