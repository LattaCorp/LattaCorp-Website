/* Billing > Zelle: payments read from Bank of America's Zelle alert emails.
   Sure matches are recorded by the website on their own; the rest wait here for a one-tap match.
   The alerts reach the website through a Gmail filter that forwards them to ZELLE_ADDRESS. */
var ZELLE_ADDRESS = "zelle-pay@lattacorpfl.com";
var zelleRows = null,
  zelleErr = false,
  zelleOpen = {};
function loadZelle() {
  return sb
    .from("zelle_payments")
    .select("id,created_at,received_on,amount,sender,memo,subject,verified,status,invoice_id,invoice_ids,client_id,payment_id,payment_ids,reason")
    .order("created_at", { ascending: false })
    .limit(300)
    .then(
      function (r) {
        zelleErr = !!r.error;
        zelleRows = r.error ? [] : r.data || [];
      },
      function () {
        zelleErr = true;
        zelleRows = [];
      }
    );
}
function zelleToMatch() {
  return (zelleRows || []).filter(function (z) {
    return z.status === "suggested" || z.status === "unmatched";
  });
}
function invBal(inv) {
  return r2(Number(inv.total || 0) - invPaidSum(inv));
}
/* records the Zelle payment on one or more invoices (oldest first; any extra stays on the last one)
   or on a client's account, and marks the alert matched */
function zelleApply(z, invs, clientId) {
  invs = (invs || []).filter(Boolean);
  var cid = invs.length ? invs[0].client_id : clientId,
    left = r2(z.amount),
    owed = r2(invs.reduce(function (s, i) {
      return s + invBal(i);
    }, 0));
  if (invs.length && left > owed + 0.005 &&
    !confirm(money(z.amount) + " is more than the " + money(owed) + " owed on " + invs.map(function (i) { return invNum(i.number); }).join(", ") + ". Record it anyway? The extra stays as a credit."))
    return;
  var parts = invs.length
    ? invs.map(function (i, k) {
        var a = k === invs.length - 1 ? left : Math.min(left, invBal(i));
        left = r2(left - a);
        return { inv: i, a: r2(a) };
      }).filter(function (p) {
        return p.a > 0;
      })
    : [{ inv: null, a: left }];
  var rowsIn = parts.map(function (p) {
    return {
      invoice_id: p.inv ? p.inv.id : null,
      client_id: cid,
      paid_on: z.received_on,
      amount: p.a,
      method: "Zelle",
      reference: [z.sender, z.memo].filter(Boolean).join(" · ").slice(0, 200),
      note: "Matched from a Zelle alert"
    };
  });
  sb.from("invoice_payments")
    .insert(rowsIn)
    .select()
    .then(function (r) {
      if (r.error || !r.data || !r.data.length) {
        alert("Could not record the payment.");
        return;
      }
      r.data.forEach(function (x) {
        invPays.unshift(x);
      });
      repData = null;
      var ids = r.data.map(function (x) {
        return x.id;
      });
      var p = {
        status: "recorded",
        payment_id: ids[0],
        payment_ids: ids,
        invoice_id: invs.length ? invs[0].id : null,
        invoice_ids: invs.map(function (i) {
          return i.id;
        }),
        client_id: cid
      };
      Promise.all(
        invs.map(function (i) {
          return syncInvPaid(i, z.received_on, "Zelle");
        }).concat([sb.from("zelle_payments").update(p).eq("id", z.id)])
      ).then(function () {
        Object.assign(z, p);
        render();
      });
    });
}
/* takes a recorded Zelle payment back off (its invoices reopen) and puts the alert back in "To match" */
function zelleInvs(z) {
  var ids = z.invoice_ids && z.invoice_ids.length ? z.invoice_ids : z.invoice_id ? [z.invoice_id] : [];
  return ids.map(function (id) {
    return byId(invoices, id);
  }).filter(Boolean);
}
function zelleUndo(z) {
  var invs = zelleInvs(z),
    pids = z.payment_ids && z.payment_ids.length ? z.payment_ids : z.payment_id ? [z.payment_id] : [];
  if (!confirm("Take this " + money(z.amount) + " Zelle payment back off" + (invs.length ? " " + invs.map(function (i) { return invNum(i.number); }).join(", ") : "") + "?")) return;
  var step = pids.length ? sb.from("invoice_payments").delete().in("id", pids) : Promise.resolve({});
  step.then(function (r) {
    if (r && r.error) {
      alert("Could not undo that.");
      return;
    }
    invPays = invPays.filter(function (x) {
      return pids.indexOf(x.id) < 0;
    });
    repData = null;
    var p = { status: "suggested", payment_id: null, payment_ids: [] };
    Promise.all(
      invs.map(function (i) {
        return syncInvPaid(i, z.received_on, "");
      }).concat([sb.from("zelle_payments").update(p).eq("id", z.id)])
    ).then(function () {
      Object.assign(z, p);
      render();
    });
  });
}
function zelleSet(z, status) {
  sb.from("zelle_payments")
    .update({ status: status })
    .eq("id", z.id)
    .then(function (r) {
      if (r.error) return alert("Could not save that.");
      z.status = status;
      render();
    });
}
/* the email itself (fetched only when asked), with links you can tap (Gmail's confirm link, for example) */
function zelleEmail(z, host) {
  host.textContent = "Loading…";
  sb.from("zelle_payments")
    .select("body")
    .eq("id", z.id)
    .single()
    .then(function (r) {
      host.textContent = "";
      var txt = (r.data && r.data.body) || "(empty)";
      txt.split(/(https?:\/\/[^\s<>"]+)/).forEach(function (part, i) {
        if (i % 2) {
          var a = el("a", null, part.length > 60 ? part.slice(0, 57) + "…" : part);
          a.href = part;
          a.target = "_blank";
          a.rel = "noopener";
          host.appendChild(a);
        } else host.appendChild(document.createTextNode(part));
      });
    });
}
function zelleCard(z) {
  var invs = zelleInvs(z),
    inv = invs[0] || null,
    card = el("div", "pcard zcard zs-" + z.status),
    hd = el("div", "zhd");
  hd.appendChild(el("b", "zamt", z.status === "other" ? "Email" : z.amount != null ? money(z.amount) : "$?"));
  var who = el("div", "zwho");
  who.appendChild(el("b", null, z.status === "other" ? z.subject || "(no subject)" : z.sender || "Unknown sender"));
  who.appendChild(el("div", "note", fdate(z.received_on) + (z.memo ? " · “" + z.memo + "”" : "")));
  hd.appendChild(who);
  var chip = { recorded: ["Recorded", "won"], suggested: ["To match", "zmatch"], unmatched: ["To match", "zmatch"], ignored: ["Ignored", ""], other: ["Not a payment", ""] }[z.status] || ["", ""];
  hd.appendChild(el("span", "chip " + chip[1], chip[0]));
  card.appendChild(hd);
  if (z.reason) card.appendChild(el("div", "zwhy", z.reason));
  if (z.status !== "other" && !z.verified)
    card.appendChild(el("div", "zwarn", "Couldn't confirm this email came straight from Bank of America. Check your bank before matching."));
  var acts = el("div", "acts");
  if (z.status === "suggested" || z.status === "unmatched") {
    var openInvs = invs.filter(function (i) {
      return i.status === "open";
    });
    if (openInvs.length)
      card.appendChild(
        btn(
          "Match to " + openInvs.map(function (i) { return invNum(i.number); }).join(" + ") + " · " + cname(openInvs[0].client_id) + " (" +
            money(openInvs.reduce(function (s, i) { return s + invBal(i); }, 0)) + " due)",
          "btn sm",
          function () {
            zelleApply(z, openInvs);
          }
        )
      );
    else if (z.client_id)
      card.appendChild(
        btn("Record on " + cname(z.client_id) + "'s account (no invoice)", "btn sm", function () {
          zelleApply(z, [], z.client_id);
        })
      );
    if (card.lastChild.tagName === "BUTTON") card.lastChild.classList.add("zgo");
    // pick any open invoice (this client's and same-amount ones first) or record it on a client's account
    var opts = [["", inv && inv.status === "open" ? "Or choose another invoice…" : "Choose the invoice…"]],
      open = invoices.filter(function (i) {
        return i.status === "open";
      });
    open.sort(function (a, b) {
      var ka = (a.client_id === z.client_id ? 0 : 2) + (Math.abs(invBal(a) - Number(z.amount)) < 0.005 ? 0 : 1),
        kb = (b.client_id === z.client_id ? 0 : 2) + (Math.abs(invBal(b) - Number(z.amount)) < 0.005 ? 0 : 1);
      return ka - kb || cname(a.client_id).localeCompare(cname(b.client_id));
    });
    open.forEach(function (i) {
      opts.push(["i:" + i.id, invNum(i.number) + " · " + cname(i.client_id) + " · " + money(invBal(i)) + " due"]);
    });
    clients
      .filter(function (c) {
        return !c.archived;
      })
      .forEach(function (c) {
        opts.push(["c:" + c.id, "On account: " + c.name]);
      });
    var pick = fld("", "select", "", opts);
    pick.classList.add("zpick");
    pick.input.addEventListener("change", function () {
      var v = pick.input.value;
      if (!v) return;
      if (v.indexOf("i:") === 0) zelleApply(z, [byId(invoices, v.slice(2))]);
      else zelleApply(z, [], v.slice(2));
    });
    card.appendChild(pick);
    acts.appendChild(
      btn("Not a client payment", "btn alt sm", function () {
        zelleSet(z, "ignored");
      })
    );
  } else if (z.status === "recorded") {
    if (invs.length) acts.appendChild(el("span", "note", "On " + invs.map(function (i) { return invNum(i.number); }).join(", ") + " · " + cname(invs[0].client_id)));
    else if (z.client_id) acts.appendChild(el("span", "note", "On account · " + cname(z.client_id)));
    acts.appendChild(
      btn("Undo", "btn alt sm", function () {
        zelleUndo(z);
      })
    );
  } else if (z.status === "ignored") {
    acts.appendChild(
      btn("Put back", "btn alt sm", function () {
        zelleSet(z, z.invoice_id || z.client_id ? "suggested" : "unmatched");
      })
    );
  }
  var mail = el("div", "zmail");
  mail.hidden = !zelleOpen[z.id];
  if (zelleOpen[z.id]) zelleEmail(z, mail);
  acts.appendChild(
    btn(zelleOpen[z.id] ? "Hide email" : "Show email", "btn alt sm", function () {
      zelleOpen[z.id] = !zelleOpen[z.id];
      render();
    })
  );
  card.appendChild(acts);
  card.appendChild(mail);
  return card;
}
function zelleSetup(host, open) {
  var box = el("details", "zsetup");
  box.open = !!open;
  box.appendChild(el("summary", null, "How Zelle payments get here"));
  var addr = el("p");
  addr.appendChild(document.createTextNode("Zelle alerts are forwarded to "));
  addr.appendChild(el("b", null, ZELLE_ADDRESS));
  addr.appendChild(document.createTextNode(". "));
  addr.appendChild(
    btn("Copy", "btn alt sm", function () {
      try {
        navigator.clipboard.writeText(ZELLE_ADDRESS);
      } catch (e) {}
    })
  );
  box.appendChild(addr);
  var ol = el("ol");
  [
    "Bank of America app: Menu → Alerts → turn on “Zelle: money received” by email.",
    "Gmail on a computer: Settings → See all settings → Forwarding and POP/IMAP → Add a forwarding address → " + ZELLE_ADDRESS + ".",
    "Gmail's confirmation email shows up below (“Not a payment”). Press Show email and open the confirm link.",
    "Gmail search box: from:bankofamerica.com zelle received → Create filter → Forward it to " + ZELLE_ADDRESS + ".",
    "From then on, every Zelle alert lands here on its own."
  ].forEach(function (s) {
    ol.appendChild(el("li", null, s));
  });
  box.appendChild(ol);
  if (isOwner()) {
    var lb = el("label", "chk"),
      cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !biz || biz.zelle_auto !== false;
    cb.addEventListener("change", function () {
      sb.from("business")
        .update({ zelle_auto: cb.checked })
        .eq("id", 1)
        .then(function (r) {
          if (r.error) {
            cb.checked = !cb.checked;
            alert("Could not save that.");
          } else if (biz) biz.zelle_auto = cb.checked;
        });
    });
    lb.appendChild(cb);
    lb.appendChild(document.createTextNode(" Record sure matches on their own: an invoice number, account number, phone, email, service address or client name in the memo, or the sender's name, when the amount fits that client's invoices. Turn off to approve every Zelle by hand."));
    box.appendChild(lb);
  }
  host.appendChild(box);
}
function renderZelle(list) {
  if (zelleRows === null) {
    list.appendChild(el("div", "empty", "Loading Zelle payments…"));
    loadZelle().then(render);
    return;
  }
  if (zelleErr) {
    list.appendChild(el("div", "empty", "Zelle isn't set up yet. Run the Stage 52 SQL in Supabase, then press Refresh."));
    return;
  }
  zelleSetup(list, !zelleRows.length);
  var todo = zelleToMatch(),
    rec = zelleRows.filter(function (z) {
      return z.status === "recorded";
    }),
    rest = zelleRows.filter(function (z) {
      return z.status === "ignored" || z.status === "other";
    });
  if (!zelleRows.length) {
    list.appendChild(el("div", "empty", "No Zelle alerts yet. Once the Gmail filter is on, each Zelle payment shows up here."));
    return;
  }
  [["To match", todo, "Nothing to match. Every Zelle payment is recorded."], ["Recorded", rec.slice(0, 60), "None yet."], ["Other emails and ignored", rest.slice(0, 30), null]].forEach(function (s) {
    if (!s[1].length && !s[2]) return;
    list.appendChild(el("h3", "zsec", s[0] + (s[1].length ? " (" + s[1].length + ")" : "")));
    if (!s[1].length) list.appendChild(el("div", "note", s[2]));
    s[1].forEach(function (z) {
      list.appendChild(zelleCard(z));
    });
  });
}
