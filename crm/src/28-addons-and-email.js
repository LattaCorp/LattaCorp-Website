/* Extra visits and add-ons (they bill with the month), visit counts, and emailing invoices in batches. */

/* ---- what a visit is ---- */
function vKind(v) {
  return (v && v.kind) || "visit";
}
/* the invoice line / card name: an add-on's own name, otherwise the job's */
function vTitle(v) {
  return (v && v.title) || jobTitle(v && v.job_id);
}
function monthKey(d) {
  return String(d || "").slice(0, 7);
}
/* visit counts for a job or a client in one month: done, skipped, extras, add-ons */
function visitCounts(test, ym) {
  ym = ym || monthKey(today());
  var r = { done: 0, skipped: 0, extra: 0, addon: 0, addonTotal: 0, left: 0 };
  visits.forEach(function (v) {
    if (monthKey(v.scheduled_date) !== ym || !test(v)) return;
    var k = vKind(v);
    if (k === "addon") {
      if (v.status === "done") {
        r.addon++;
        r.addonTotal += Number(v.price || 0);
      }
      return;
    }
    if (v.status === "done") {
      r.done++;
      if (k === "extra") r.extra++;
    } else if (v.status === "skipped") r.skipped++;
    else r.left++;
  });
  return r;
}
function countText(r, short) {
  var bits = [r.done + " done" + (r.extra ? " (" + r.extra + " extra)" : "")];
  if (r.skipped) bits.push(r.skipped + " skipped");
  if (r.addon) bits.push(r.addon + " add-on" + (r.addon > 1 ? "s" : ""));
  if (!short && r.left) bits.push(r.left + " still scheduled");
  return bits.join(" · ");
}
function monthWord(ym) {
  var p = String(ym || monthKey(today())).split("-");
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+p[1] - 1] || "";
}

/* ---- + Extra visit / + Add-on ----
   kind "extra": one more visit that wasn't on the schedule (callback, extra cut) at the job's price.
   kind "addon": a quick job done for the client (hedges, mulch...) with its own name and price.
   Both are saved as completed visits, so Bill the month puts them on the invoice by themselves. */
function openExtraForm(j, kind, date, back) {
  if (!j) return;
  var addon = kind === "addon",
    p = panel();
  p.appendChild(el("h2", null, addon ? "Add-on" : "Extra visit"));
  p.appendChild(el("div", "note", cname(j.client_id) + " · " + paddr(j.property_id)));
  p.appendChild(
    el(
      "p",
      "note",
      addon
        ? "A quick job done for this client. It goes on their next invoice by itself when you Bill the month."
        : "A visit that wasn't on the schedule. It goes on their next invoice by itself when you Bill the month."
    )
  );
  var ti = fld(addon ? "What was done" : "Shows on the invoice as", "text", addon ? "" : jobTitle(j.id) + " (extra visit)"),
    pr = fld("Price ($)", "number", addon ? "" : j.price || ""),
    dt = fld("Date", "date", date || today()),
    nt = fld("Note (only you see this)", "text", "");
  if (addon) acTitles(ti.input, pr.input);
  pr.input.step = "0.01";
  pr.input.min = "0";
  [ti, pr, dt, nt].forEach(function (f) {
    p.appendChild(f);
  });
  var dn = el("label", "chk");
  var cb = el("input");
  cb.type = "checkbox";
  cb.checked = true;
  dn.appendChild(cb);
  dn.appendChild(el("span", null, "Already done"));
  if (!addon) p.appendChild(dn);
  var err = el("div", "note");
  err.style.color = "var(--red)";
  p.appendChild(err);
  var a = el("div", "actions"),
    sv = btn("Save", "btn", function () {
      err.textContent = "";
      var title = ti.input.value.trim(),
        price = Number(pr.input.value),
        d = dt.input.value;
      if (addon && !title) return (err.textContent = "Say what was done (for example Hedge trimming).");
      if (!d) return (err.textContent = "Pick a date.");
      if (!(price >= 0)) return (err.textContent = "Enter a price.");
      var done = addon || cb.checked;
      var row = {
        job_id: j.id,
        client_id: j.client_id,
        property_id: j.property_id,
        orig_date: d,
        scheduled_date: d,
        status: done ? "done" : "scheduled",
        completed_at: done ? new Date().toISOString() : null,
        price: Math.round(price * 100) / 100,
        kind: addon ? "addon" : "extra",
        title: title,
        slot: Date.now() * 10 + Math.floor(Math.random() * 10),
        notes: nt.input.value.trim()
      };
      sv.disabled = true;
      sb.from("visits")
        .insert(row)
        .select()
        .single()
        .then(function (r) {
          sv.disabled = false;
          if (r.error || !r.data) {
            err.textContent = /kind|slot|title/.test(String(r.error && r.error.message))
              ? "Run the Stage 43 SQL in Supabase first."
              : "Could not save it.";
            return;
          }
          visits.push(r.data);
          (billErr ? Promise.resolve() : loadUnbilled()).then(function () {
            render();
            if (back) back();
            else closeDetail();
          });
        });
    });
  a.appendChild(sv);
  a.appendChild(btn("Cancel", "btn alt", back || closeDetail));
  p.appendChild(a);
  (addon ? ti : pr).input.focus();
}
/* the client's active jobs to hang an add-on on (the first one is their main lawn job) */
function clientJobs(cid) {
  return jobs.filter(function (j) {
    return j.client_id === cid && j.status !== "ended";
  });
}

/* ---- Batch deliver: email many invoices at once, a batch at a time ----
   The email service's free plan allows 100 emails a day for everything the website sends,
   so invoices use at most INV_DAILY a day and the rest wait for tomorrow's batch. */
var INV_DAILY = 90;
function sentTodayCount() {
  var d0 = new Date();
  d0.setHours(0, 0, 0, 0);
  return invoices.filter(function (i) {
    return i.emailed_at && new Date(i.emailed_at) >= d0;
  }).length;
}
function openBatchDeliver(onlyIds) {
  if (billErr) return alert("Billing isn't set up yet.");
  var p = panel();
  detailFull(true);
  p.appendChild(el("h2", null, "Email invoices"));
  p.appendChild(
    el(
      "p",
      "note",
      "Each client gets an email from billing@lattacorpfl.com with a button to view and print their invoice. Nothing is sent until you press Send."
    )
  );
  var tf = "all",
    picked = {},
    body = el("div");
  var bar = el("div", "bdbar");
  [
    ["all", "All"],
    ["hoa", "HOA"],
    ["commercial", "Commercial"],
    ["residential", "Residential"]
  ].forEach(function (x) {
    var b = btn(x[1], "bdpill" + (tf === x[0] ? " on" : ""), function () {
      tf = x[0];
      [].forEach.call(bar.children, function (c) {
        c.classList.toggle("on", c === b);
      });
      draw();
    });
    bar.appendChild(b);
  });
  p.appendChild(bar);
  p.appendChild(body);
  function pool() {
    return invoices
      .filter(function (i) {
        if (onlyIds) return onlyIds.indexOf(i.id) > -1;
        return i.status !== "void" && i.status !== "paid" && !i.emailed_at && Number(i.total) > 0;
      })
      .filter(function (i) {
        var c = byId(clients, i.client_id);
        return tf === "all" || ((c && c.type) || "residential") === tf;
      })
      .sort(function (a, b) {
        return cname(a.client_id).localeCompare(cname(b.client_id));
      });
  }
  function draw() {
    body.textContent = "";
    var all = pool(),
      withEmail = all.filter(function (i) {
        var c = byId(clients, i.client_id);
        return c && c.email && !i.emailed_at;
      }),
      noEmail = all.filter(function (i) {
        var c = byId(clients, i.client_id);
        return !(c && c.email);
      }),
      done = all.filter(function (i) {
        return i.emailed_at;
      }),
      left = Math.max(0, INV_DAILY - sentTodayCount());
    var info = el("div", "cstats");
    [
      ["Ready to email", String(withEmail.length)],
      ["Can send today", String(left)],
      ["No email on file", String(noEmail.length)]
    ].forEach(function (x) {
      var d = el("div");
      d.appendChild(el("span", null, x[0]));
      d.appendChild(el("b", null, x[1]));
      info.appendChild(d);
    });
    body.appendChild(info);
    if (withEmail.length > left)
      body.appendChild(
        el(
          "div",
          "qban",
          left
            ? "You can email " + left + " more today. Send this batch now and the rest tomorrow; they stay on this list until they're sent."
            : "Today's limit is used up. The rest stay on this list. Come back tomorrow to send the next batch."
        )
      );
    if (!withEmail.length && !noEmail.length) {
      body.appendChild(el("div", "pcard", done.length ? "All of these invoices have been emailed. ✓" : "No unsent invoices here."));
    }
    if (withEmail.length) {
      var tools = el("div", "qacts");
      tools.appendChild(
        btn("Select next " + Math.min(left, withEmail.length), "btn alt sm", function () {
          picked = {};
          withEmail.slice(0, left).forEach(function (i) {
            picked[i.id] = 1;
          });
          draw();
        })
      );
      tools.appendChild(
        btn("Clear", "btn alt sm", function () {
          picked = {};
          draw();
        })
      );
      body.appendChild(tools);
      var lst = el("div", "pcard bdlist");
      withEmail.forEach(function (inv) {
        var c = byId(clients, inv.client_id),
          r = el("label", "bdrow"),
          ck = el("input");
        ck.type = "checkbox";
        ck.checked = !!picked[inv.id];
        ck.addEventListener("change", function () {
          if (ck.checked) picked[inv.id] = 1;
          else delete picked[inv.id];
          sync();
        });
        r.appendChild(ck);
        var l = el("span");
        l.appendChild(el("b", null, cname(inv.client_id)));
        l.appendChild(el("span", "note", invNum(inv.number) + " · " + c.email));
        r.appendChild(l);
        r.appendChild(el("b", "bdamt", money(inv.total)));
        lst.appendChild(r);
      });
      body.appendChild(lst);
      var go = btn("Send", "btn", send);
      go.style.marginTop = "10px";
      body.appendChild(go);
      var stat = el("div", "note");
      body.appendChild(stat);
      function sync() {
        var n = Object.keys(picked).length;
        go.textContent = n ? "Send " + n + " invoice" + (n > 1 ? "s" : "") + " by email" : "Pick invoices to send";
        go.disabled = !n || n > left;
        stat.textContent = n > left ? "That's more than you can send today (" + left + "). Unpick some." : "";
      }
      sync();
      function send() {
        var ids = Object.keys(picked);
        if (!ids.length) return;
        if (!confirm("Email " + ids.length + " invoice" + (ids.length > 1 ? "s" : "") + " now?")) return;
        go.disabled = true;
        var sent = 0,
          fails = [],
          chunks = [];
        for (var k = 0; k < ids.length; k += 25) chunks.push(ids.slice(k, k + 25));
        chunks
          .reduce(function (pr, ch) {
            return pr.then(function () {
              go.textContent = "Sending " + Math.min(sent + ch.length, ids.length) + " of " + ids.length + "...";
              return callApi("/api/invoices/email", "send", { ids: ch }).then(function (res) {
                if (!res || !res.ok) {
                  fails.push((res && res.error) || "Could not reach the server.");
                  return;
                }
                (res.data.sent || []).forEach(function (s) {
                  var inv = byId(invoices, s.id);
                  if (inv) {
                    inv.emailed_at = s.at;
                    inv.emailed_to = s.to;
                    if (!inv.sent_at) inv.sent_at = s.at;
                  }
                  sent++;
                });
                (res.data.failed || []).forEach(function (f) {
                  fails.push(cname((byId(invoices, f.id) || {}).client_id) + ": " + f.error);
                });
              });
            });
          }, Promise.resolve())
          .then(function () {
            picked = {};
            render();
            draw();
            body.insertBefore(
              el("div", "qban" + (fails.length ? "" : " ok"), "✓ Emailed " + sent + " invoice" + (sent === 1 ? "" : "s") + (fails.length ? ". Not sent: " + fails.join("; ") : "")),
              body.firstChild
            );
          });
      }
    }
    if (noEmail.length) {
      var ns = el("div", "sec");
      ns.appendChild(el("h3", null, "No email on file"));
      ns.appendChild(el("div", "note", "Text these, hand them over, or add an email to the client."));
      noEmail.forEach(function (inv) {
        var c = byId(clients, inv.client_id),
          msg = invMessage(inv, c),
          r = el("div", "pcard bmsend" + (inv.sent_at ? " sent" : ""));
        var l = el("div");
        l.appendChild(el("b", null, cname(inv.client_id)));
        l.appendChild(el("div", "note", invNum(inv.number) + " · " + money(inv.total)));
        r.appendChild(l);
        var a = el("div", "qacts");
        function sentIt() {
          markSent(inv);
          r.classList.add("sent");
        }
        if (c && c.phone) {
          var tx = el("a", "btn alt sm", "Text");
          tx.href = smsHref(c.phone, msg);
          tx.addEventListener("click", sentIt);
          a.appendChild(tx);
        }
        a.appendChild(copyBtn("Copy", msg, true, sentIt));
        r.appendChild(a);
        ns.appendChild(r);
      });
      body.appendChild(ns);
    }
    if (done.length && onlyIds) {
      var ds = el("div", "note", "Already emailed: " + done.map(function (i) { return cname(i.client_id); }).join(", "));
      ds.style.marginTop = "12px";
      body.appendChild(ds);
    }
  }
  draw();
}
