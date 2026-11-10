/* Billing tab: invoice list, invoice detail, printable invoice, estimates and billing settings. */

/* ---- Billing screen ---- */
function renderBilling() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var op = invoices.filter(function (i) {
      return i.status === "open";
    }),
    pd_ = invoices.filter(function (i) {
      return i.status === "paid";
    }),
    od = op.filter(isOverdue);
  var bg = billGroups();
  [
    ["tobill", "To bill", bg.order.length],
    ["open", "Open", op.length],
    ["paid", "Paid", pd_.length],
    ["payments", "Payments", invPays.length],
    [
      "estimates",
      "Estimates",
      estimates.filter(function (e) {
        return (e.status === "draft" || e.status === "sent") && !estExpired(e);
      }).length
    ]
  ].forEach(function (s) {
    var b = el("button", "tab" + (bfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + s[2] + ")"));
    b.addEventListener("click", function () {
      bfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  if (bfilter !== "estimates" && bfilter !== "payments") {
    $("topbtns").appendChild(
      btn("New invoice", "btn", function () {
        openInvoiceForm(null);
      })
    );
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(customInvoiceLink("btn alt"));
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(
      btn("Past invoice", "btn alt", function () {
        openPastInvoice(null);
      })
    );
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(
      btn("Customer payment", "btn alt", function () {
        openPayment(null);
      })
    );
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(btn("Import payments", "btn alt", openPayImport));
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(
      btn("Import history", "btn alt", function () {
        openHistImport(null);
      })
    );
    $("topbtns").appendChild(document.createTextNode(" "));
  }
  $("topbtns").appendChild(btn("Price calculator", "btn alt", openCalc));
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(btn("Billing settings", "btn alt", openBizSettings));
  var list = $("list");
  list.textContent = "";
  if (bfilter === "estimates") return renderEstimates(list);
  if (bfilter !== "payments" && !billErr) {
    var bfx = el("div");
    list.appendChild(bfx);
    backfillCards(bfx);
  }
  if (bfilter === "payments") return renderPayments(list);
  if (billErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Billing isn't set up yet. Run the Stage 5 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var mon = today().slice(0, 7),
    paidMonth = r2(
      pd_
        .filter(function (i) {
          return i.paid_at && String(i.paid_at).slice(0, 7) === mon;
        })
        .reduce(function (s, i) {
          return s + Number(i.total || 0);
        }, 0)
    );
  var stats = el("div", "stats");
  [
    ["Outstanding", money(openTotal(invoices)), ""],
    ["Overdue", money(openTotal(od)), od.length ? "bad" : ""],
    [
      "Ready to bill",
      money(
        r2(
          eligible().reduce(function (s, v) {
            return s + Number(v.price || 0);
          }, 0)
        )
      ),
      ""
    ],
    ["Paid this month", money(paidMonth), ""]
  ].forEach(function (x) {
    var c = el("div", "stat " + x[2]);
    c.appendChild(el("span", null, x[0]));
    c.appendChild(el("b", null, x[1]));
    stats.appendChild(c);
  });
  list.appendChild(stats);
  if (bfilter === "tobill") return renderToBill(list, bg);
  var set = (
    bfilter === "open"
      ? op.slice().sort(function (a, b) {
          return a.due_date < b.due_date ? -1 : 1;
        })
      : pd_
  ).filter(function (i) {
    if (!query) return true;
    return (
      [invNum(i.number), i.number, cname(i.client_id), i.reference].join(" ").toLowerCase().indexOf(query) >
      -1
    );
  });
  if (bfilter === "open" && od.length) {
    var ro = btn("Remind overdue clients (" + od.length + ")", "btn alt", function () {
      remindOverdue(od);
    });
    ro.style.margin = "8px 0";
    list.appendChild(ro);
  }
  if (!set.length) {
    list.appendChild(el("div", "empty", bfilter === "open" ? "No open invoices." : "No paid invoices yet."));
    return;
  }
  set.forEach(function (i) {
    list.appendChild(invoiceRow(i));
  });
}
function invoiceRow(i) {
  var b = el("button", "row client" + (isOverdue(i) ? " overdue" : ""));
  b.type = "button";
  var l = el("div");
  l.appendChild(el("b", null, invNum(i.number) + " · " + cname(i.client_id)));
  l.appendChild(
    el(
      "div",
      "sub",
      [
        i.property_id ? paddr(i.property_id) : "",
        i.period_end ? monthName(i.period_end) : "",
        i.status === "paid"
          ? "Paid " +
            (i.paid_at ? dshort(String(i.paid_at).slice(0, 10)) : "") +
            (i.paid_method ? " (" + i.paid_method + ")" : "")
          : "Due " + dshort(i.due_date),
        i.reference ? "Ref " + i.reference : "",
        i.status === "open" && invPaidSum(i) > 0 ? "Balance " + money(balOf(i)) : "",
        i.status === "open" && i.reminded_at ? "Reminded " + dshort(String(i.reminded_at).slice(0, 10)) : ""
      ]
        .filter(Boolean)
        .join(" · ")
    )
  );
  var r = el("div");
  r.style.textAlign = "right";
  r.appendChild(el("b", null, money(i.total)));
  var chip =
    i.status === "void"
      ? el("span", "chip lost", "Void")
      : i.status === "paid"
        ? el("span", "chip won", "Paid")
        : isOverdue(i)
          ? el("span", "chip od", "Overdue")
          : el("span", "chip", i.sent_at ? "Sent" : "Not sent");
  r.appendChild(el("div"));
  r.appendChild(chip);
  b.appendChild(l);
  b.appendChild(r);
  b.addEventListener("click", function () {
    openInvoice(i.id);
  });
  return b;
}
function renderToBill(list, bg) {
  var bar = el("div", "billbar");
  var lab = el("label", "f");
  lab.style.margin = "0";
  lab.appendChild(el("span", null, "Bill completed visits through"));
  var di = document.createElement("input");
  di.type = "date";
  di.value = billThrough;
  di.style.width = "auto";
  di.addEventListener("change", function () {
    if (di.value) {
      billThrough = di.value;
      render();
    }
  });
  lab.appendChild(di);
  bar.appendChild(lab);
  var q = el("span");
  q.appendChild(
    btn("End of last month", "btn alt sm", function () {
      billThrough = lastMonthEnd();
      render();
    })
  );
  q.appendChild(document.createTextNode(" "));
  q.appendChild(
    btn("Today", "btn alt sm", function () {
      billThrough = today();
      render();
    })
  );
  bar.appendChild(q);
  list.appendChild(bar);
  var zero = unbilled.filter(function (v) {
    return v.scheduled_date <= billThrough && !(Number(v.price) > 0);
  });
  if (zero.length) {
    var zn = el(
      "div",
      "note",
      "\u26a0 " +
        zero.length +
        " completed visit" +
        (zero.length > 1 ? "s have" : " has") +
        " no price set, so " +
        (zero.length > 1 ? "they are" : "it is") +
        " left out. Set a price below and it moves into the list to bill, or press Invoice as $0 to record it as a no-charge invoice."
    );
    zn.style.cssText = "color:#7a5b00;margin:6px 0";
    list.appendChild(zn);
    zero
      .slice()
      .sort(function (x, y) {
        return x.scheduled_date < y.scheduled_date ? -1 : 1;
      })
      .forEach(function (v) {
        var c = el("div", "pcard"),
          top = el("div");
        top.style.cssText =
          "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
        var l = el("div");
        l.appendChild(el("b", null, cname(v.client_id) + " \u00b7 " + jobTitle(v.job_id)));
        l.appendChild(
          el("div", "note", [dshort(v.scheduled_date), paddr(v.property_id)].filter(Boolean).join(" \u00b7 "))
        );
        top.appendChild(l);
        top.appendChild(
          btn("Open job", "btn alt sm", function () {
            openJob(v.job_id);
          })
        );
        c.appendChild(top);
        c.appendChild(priceFix(v, render));
        list.appendChild(c);
      });
  }
  /* visits earlier marked "No charge" (no invoice yet): make $0 invoices for them, one per client */
  var ncHost = el("div");
  list.appendChild(ncHost);
  sb.from("visits")
    .select("*")
    .eq("status", "done")
    .eq("paid_method", "No charge")
    .is("invoice_id", null)
    .limit(2000)
    .then(function (r) {
      var vs = (r.data || []).filter(function (v) {
        return !r.error && !(Number(v.price) > 0);
      });
      if (!vs.length) return;
      var gv = groupVisits(vs),
        g = gv.g,
        order = gv.order;
      var c = el("div", "pcard");
      c.style.background = "#eef6ec";
      c.appendChild(
        el("b", null, vs.length + " no-charge visit" + (vs.length > 1 ? "s have" : " has") + " no invoice")
      );
      c.appendChild(
        el(
          "div",
          "note",
          "Create a $0 invoice for each client so it shows in their invoice history: " +
            order
              .map(function (k) {
                return groupTitle(g[k]);
              })
              .join(", ") +
            "."
        )
      );
      var mk = btn("Create $0 invoices (" + order.length + ")", "btn sm", function () {
        mk.disabled = true;
        var made = 0,
          fails = [];
        order
          .reduce(function (pr, k) {
            return pr.then(function () {
              return createInvoice(g[k].cid, g[k].vs, today(), g[k].pid).then(
                function () {
                  made++;
                },
                function (e) {
                  fails.push(groupTitle(g[k]) + ": " + e);
                }
              );
            });
          }, Promise.resolve())
          .then(function () {
            return loadUnbilled();
          })
          .then(function () {
            alert(
              "Created " +
                made +
                " $0 invoice" +
                (made === 1 ? "" : "s") +
                "." +
                (fails.length ? "\n\nProblems:\n" + fails.join("\n") : "")
            );
            bfilter = "paid";
            render();
          });
      });
      mk.style.marginTop = "8px";
      c.appendChild(mk);
      ncHost.appendChild(c);
    });
  if (!bg.order.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Nothing to bill through " +
          dshort(billThrough) +
          ". Completed visits that haven't been paid or invoiced show up here."
      )
    );
    return;
  }
  var all = btn("Create all invoices (" + bg.order.length + ")", "btn", function () {
    if (
      !confirm(
        "Create " +
          bg.order.length +
          " invoice" +
          (bg.order.length > 1 ? "s" : "") +
          " for completed visits through " +
          dshort(billThrough) +
          "?"
      )
    )
      return;
    all.disabled = true;
    var made = 0,
      fails = [],
      through = billThrough;
    bg.order
      .reduce(function (p, k) {
        return p.then(function () {
          return createInvoice(bg.g[k].cid, bg.g[k].vs, through, bg.g[k].pid).then(
            function () {
              made++;
            },
            function (e) {
              fails.push(groupTitle(bg.g[k]) + ": " + e);
            }
          );
        });
      }, Promise.resolve())
      .then(function () {
        return loadUnbilled();
      })
      .then(function () {
        render();
        alert(
          "Created " +
            made +
            " invoice" +
            (made === 1 ? "" : "s") +
            "." +
            (fails.length ? "\n\nProblems:\n" + fails.join("\n") : "")
        );
        bfilter = "open";
        render();
      });
  });
  all.style.margin = "8px 0 4px";
  list.appendChild(all);
  bg.order.forEach(function (k) {
    var x = bg.g[k],
      cid = x.cid,
      vs = x.vs,
      tot = r2(
        vs.reduce(function (s, v) {
          return s + Number(v.price || 0);
        }, 0)
      ),
      card = el("div", "pcard");
    var top = el("div");
    top.style.cssText =
      "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
    var l = el("div");
    l.appendChild(el("b", null, groupTitle(x)));
    l.appendChild(el("div", "note", vs.length + " visit" + (vs.length > 1 ? "s" : "") + " · " + money(tot)));
    top.appendChild(l);
    var one = btn("Create invoice", "btn sm", function () {
      one.disabled = true;
      createInvoice(cid, vs, billThrough, x.pid).then(
        function (inv) {
          return loadUnbilled().then(function () {
            render();
            openInvoice(inv.id);
          });
        },
        function (e) {
          one.disabled = false;
          alert(e);
        }
      );
    });
    top.appendChild(one);
    card.appendChild(top);
    var det = document.createElement("details");
    det.appendChild(el("summary", null, "See the visits"));
    vs.forEach(function (v) {
      det.appendChild(
        el(
          "div",
          "note",
          dshort(v.scheduled_date) +
            " · " +
            jobTitle(v.job_id) +
            " · " +
            paddr(v.property_id) +
            " · " +
            money(v.price)
        )
      );
    });
    card.appendChild(det);
    list.appendChild(card);
  });
}

/* ---- Invoice detail ---- */
function openInvoice(id) {
  var inv = byId(invoices, id);
  if (!inv) return;
  var c = byId(clients, inv.client_id),
    p = panel();
  p.appendChild(el("h2", null, invNum(inv.number) + " · " + cname(inv.client_id)));
  var ips = clientProps(inv.client_id);
  if (ips.length > 1) {
    var ipf = fld(
      "Property",
      "select",
      inv.property_id || "",
      [["", "Not tied to a property (whole account)"]].concat(
        ips.map(function (q) {
          return [q.id, (q.label ? q.label + " \u00b7 " : "") + q.address];
        })
      )
    );
    ipf.style.cssText = "margin:6px 0;max-width:420px";
    ipf.input.addEventListener("change", function () {
      var v = ipf.input.value || null;
      ipf.input.disabled = true;
      sb.from("invoices")
        .update({ property_id: v })
        .eq("id", inv.id)
        .then(function (r) {
          ipf.input.disabled = false;
          if (r.error) {
            alert("Could not change the property.");
            ipf.input.value = inv.property_id || "";
            return;
          }
          inv.property_id = v;
          render();
        });
    });
    p.appendChild(ipf);
  } else if (inv.property_id) p.appendChild(el("div", "note", "Property: " + paddr(inv.property_id)));
  var st =
    inv.status === "paid" ? "Paid" : inv.status === "void" ? "Void" : isOverdue(inv) ? "Overdue" : "Open";
  p.appendChild(
    el(
      "div",
      "note",
      st +
        " · issued " +
        dshort(inv.issue_date) +
        " · due " +
        dshort(inv.due_date) +
        (inv.sent_at ? " · sent " + dshort(String(inv.sent_at).slice(0, 10)) : " · not sent yet")
    )
  );
  var body = el("div");
  body.appendChild(el("div", "note", "Loading..."));
  p.appendChild(body);
  sb.from("invoice_items")
    .select("*")
    .eq("invoice_id", inv.id)
    .order("service_date", { ascending: true })
    .limit(1000)
    .then(function (r) {
      var items = r.error ? [] : r.data || [];
      body.textContent = "";
      var locked = inv.status !== "open";
      var t = document.createElement("table");
      t.className = "itable";
      items.forEach(function (it) {
        var tr = document.createElement("tr");
        tr.appendChild(el("td", null, it.service_date ? dshort(it.service_date) : ""));
        tr.appendChild(el("td", "ttl", it.title || ""));
        var d = el("td", null, (it.description || "") + (it.address ? " · " + it.address : ""));
        tr.appendChild(d);
        var a = el("td", "amt", money(it.amount));
        tr.appendChild(a);
        if (!locked) {
          var x = el("td");
          var rm = btn("×", "link", function () {
            removeLine(inv, it, function () {
              openInvoice(inv.id);
            });
          });
          rm.setAttribute("aria-label", "Remove line");
          rm.style.cssText = "font-size:1.2rem;text-decoration:none;color:var(--red)";
          x.appendChild(rm);
          tr.appendChild(x);
        }
        t.appendChild(tr);
      });
      body.appendChild(t);
      var tot = el("div", "invtotal", "Total " + money(inv.total));
      body.appendChild(tot);
      if (!locked) {
        var add = el("div", "pcard"),
          g = el("div", "grid3");
        var ttl = fld("Add a line: title", "text", ""),
          dsc = fld("Description (extra work, discount, late fee)", "text", ""),
          amt = fld("Total ($, negative = discount)", "number", "");
        amt.input.step = "0.01";
        amt.input.inputMode = "decimal";
        g.appendChild(ttl);
        g.appendChild(dsc);
        g.appendChild(amt);
        add.appendChild(g);
        var ab = btn("Add line", "btn alt sm", function () {
          var a2 = parseFloat(amt.input.value);
          if ((!ttl.input.value.trim() && !dsc.input.value.trim()) || isNaN(a2)) {
            alert("Enter a title or description, and a total.");
            return;
          }
          var line = {
            invoice_id: inv.id,
            service_date: today(),
            description: dsc.input.value.trim(),
            amount: a2
          };
          if (ttl.input.value.trim()) line.title = ttl.input.value.trim();
          sb.from("invoice_items")
            .insert(line)
            .then(function (r2_) {
              if (r2_.error) {
                alert(line.title ? "Could not add the line. Did you run the Stage 32 SQL?" : "Could not add the line.");
                return;
              }
              setTotal(inv, r2(Number(inv.total) + a2), function () {
                openInvoice(inv.id);
              });
            });
        });
        ab.style.marginTop = "8px";
        add.appendChild(ab);
        body.appendChild(add);
      }
      var ref = fld("Reference / PO number (shows on the invoice)", "text", inv.reference || "");
      body.appendChild(ref);
      var rb = btn("Save reference", "btn alt sm", function () {
        sb.from("invoices")
          .update({ reference: ref.input.value.trim() })
          .eq("id", inv.id)
          .then(function (r2_) {
            if (r2_.error) {
              alert("Could not save.");
              return;
            }
            inv.reference = ref.input.value.trim();
            rb.textContent = "Saved";
            setTimeout(function () {
              rb.textContent = "Save reference";
            }, 1200);
          });
      });
      rb.style.marginTop = "6px";
      body.appendChild(rb);
      var acts = el("div", "contact");
      acts.style.marginTop = "14px";
      acts.appendChild(
        btn("View / Print / PDF", "btn", function () {
          showInvoice(inv, items);
        })
      );
      var msg = invMessage(inv, c);
      if (c && c.email) {
        var a2 = el("a", "btn", "Email invoice");
        a2.href = mailHref(
          c.email,
          "Invoice " + invNum(inv.number) + " from " + bizv("name", "Latta Corp"),
          msg + (inv.share_token ? "" : "\n\n(The invoice PDF is attached.)")
        );
        a2.addEventListener("click", function () {
          markSent(inv);
        });
        acts.appendChild(a2);
      }
      acts.appendChild(
        copyBtn("Copy message", msg, false, function () {
          markSent(inv);
        })
      );
      if (inv.share_token) {
        acts.appendChild(
          copyBtn("Copy link", docUrl(inv.share_token), false, function () {
            markSent(inv);
          })
        );
        var pv = el("a", "btn alt", "Preview link");
        pv.href = docUrl(inv.share_token, true);
        pv.target = "_blank";
        pv.rel = "noopener";
        acts.appendChild(pv);
      }
      if (isOwner() && c && c.phone) {
        var a1 = el("a", "btn alt", "Text");
        a1.href = smsHref(c.phone, msg);
        a1.addEventListener("click", function () {
          markSent(inv);
        });
        acts.appendChild(a1);
      }
      if (inv.status === "open" && c && (isOverdue(inv) || inv.sent_at)) {
        var rem = invRemind(inv, c);
        if (c.email) {
          var a4 = el("a", "btn alt", "Email a reminder");
          a4.href = mailHref(c.email, "Payment reminder: invoice " + invNum(inv.number), rem);
          a4.addEventListener("click", function () {
            stampInv(inv);
          });
          acts.appendChild(a4);
        }
        if (isOwner() && c.phone) {
          var a3 = el("a", "btn alt", "Text a reminder");
          a3.href = smsHref(c.phone, rem);
          a3.addEventListener("click", function () {
            stampInv(inv);
          });
          acts.appendChild(a3);
        }
      }
      body.appendChild(acts);
      if (inv.share_token && inv.viewed_at)
        body.appendChild(el("div", "note", "✓ Client opened the invoice link " + ago(inv.viewed_at) + "."));
      else if (inv.share_token && inv.sent_at)
        body.appendChild(el("div", "note", "The client hasn't opened the link yet."));
      if (!inv.share_token)
        body.appendChild(
          el(
            "div",
            "note",
            "Run the Stage 11 SQL in Supabase to give each invoice a private link clients can open."
          )
        );
      if (inv.status === "open" && inv.reminded_at)
        body.appendChild(
          el("div", "note", "Last reminder texted " + dshort(String(inv.reminded_at).slice(0, 10)) + ".")
        );
      if (c && !c.email)
        body.appendChild(
          el(
            "div",
            "note",
            "Tip: add an email on the client page to get an Email button here. To email the PDF: tap View / Print / PDF, choose Save as PDF, then attach it."
          )
        );
      var pay = el("div", "sec");
      if (inv.status === "open") {
        pay.appendChild(el("h3", null, "Record payment"));
        var pg = el("div", "grid2");
        var pm = fld("Method", "select", "Zelle", [
            ["Zelle", "Zelle"],
            ["Cash", "Cash"],
            ["Check", "Check"],
            ["Other", "Other"]
          ]),
          pdt = fld("Date received", "date", today());
        pg.appendChild(pm);
        pg.appendChild(pdt);
        pay.appendChild(pg);
        var pb = btn("Mark paid", "btn", function () {
          var when = (pdt.input.value || today()) + "T12:00:00";
          sb.from("invoices")
            .update({ status: "paid", paid_at: when, paid_method: pm.input.value })
            .eq("id", inv.id)
            .then(function (r2_) {
              if (r2_.error) {
                alert("Could not save.");
                return;
              }
              inv.status = "paid";
              inv.paid_at = when;
              inv.paid_method = pm.input.value;
              render();
              openInvoice(inv.id);
            });
        });
        pb.style.marginTop = "8px";
        pay.appendChild(pb);
      } else if (inv.status === "paid") {
        pay.appendChild(
          el(
            "div",
            "note",
            "Paid " +
              (inv.paid_at ? dshort(String(inv.paid_at).slice(0, 10)) : "") +
              (inv.paid_method ? " by " + inv.paid_method : "")
          )
        );
        pay.appendChild(
          btn("Mark unpaid", "btn alt sm", function () {
            sb.from("invoices")
              .update({ status: "open", paid_at: null, paid_method: "" })
              .eq("id", inv.id)
              .then(function (r2_) {
                if (r2_.error) {
                  alert("Could not save.");
                  return;
                }
                inv.status = "open";
                inv.paid_at = null;
                inv.paid_method = "";
                render();
                openInvoice(inv.id);
              });
          })
        );
      }
      var dz = el("div", "actions");
      dz.appendChild(el("span"));
      if (inv.status !== "void")
        dz.appendChild(
          btn("Void invoice", "btn danger", function () {
            if (!confirm("Void this invoice? Its visits go back to 'To bill' so you can bill them again."))
              return;
            releaseVisits(inv, function () {
              sb.from("invoices")
                .update({ status: "void" })
                .eq("id", inv.id)
                .then(function () {
                  inv.status = "void";
                  render();
                  openInvoice(inv.id);
                });
            });
          })
        );
      else
        dz.appendChild(
          btn("Delete", "btn danger", function () {
            if (!confirm("Delete this voided invoice for good?")) return;
            sb.from("invoices")
              .delete()
              .eq("id", inv.id)
              .then(function (r2_) {
                if (r2_.error) {
                  alert("Could not delete.");
                  return;
                }
                invoices = invoices.filter(function (z) {
                  return z.id !== inv.id;
                });
                closeDetail();
                render();
              });
          })
        );
      body.appendChild(pay);
      body.appendChild(dz);
    });
}
function setTotal(inv, total, cb) {
  sb.from("invoices")
    .update({ total: total })
    .eq("id", inv.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not update the total.");
        return;
      }
      inv.total = total;
      render();
      cb();
    });
}
function removeLine(inv, it, cb) {
  sb.from("invoice_items")
    .delete()
    .eq("id", it.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not remove the line.");
        return;
      }
      var after = function () {
        setTotal(inv, r2(Number(inv.total) - Number(it.amount)), function () {
          loadUnbilled().then(cb);
        });
      };
      if (it.visit_id) sb.from("visits").update({ invoice_id: null }).eq("id", it.visit_id).then(after);
      else after();
    });
}
function releaseVisits(inv, cb) {
  sb.from("visits")
    .update({ invoice_id: null })
    .eq("invoice_id", inv.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not release the visits.");
        return;
      }
      loadUnbilled().then(cb);
    });
}
function markSent(inv) {
  if (inv.sent_at) return;
  var now = new Date().toISOString();
  sb.from("invoices")
    .update({ sent_at: now })
    .eq("id", inv.id)
    .then(function (r) {
      if (!r.error) {
        inv.sent_at = now;
        render();
      }
    });
}
function invMessage(inv, c) {
  var first = String((c && c.name) || "").split(" ")[0] || "there";
  return (
    "Hi " +
    first +
    ", this is " +
    bizv("name", "Latta Corp") +
    ". Your invoice " +
    invNum(inv.number) +
    (inv.period_end ? " for " + monthName(inv.period_end) : "") +
    " is " +
    money(inv.total) +
    ", due " +
    dshort(inv.due_date) +
    "." +
    (inv.share_token ? " View or print it here: " + docUrl(inv.share_token) + " " : "") +
    (bizv("zelle", "") ? " Pay with Zelle: " + biz.zelle + "." : "") +
    " Thank you!"
  );
}

/* ---- printable invoice (works as a PDF too) ----
   Invoices with a private link show the exact page the client sees (d/index.html), with the account summary, so
   staff and clients always see the same invoice. Older invoices without a link use the simple layout below. */
function showInvoice(inv, items) {
  if (inv.share_token) return showDocFrame(docUrl(inv.share_token, true) + "&embed=1&lang=en");
  var c = byId(clients, inv.client_id) || {},
    paper = $("invpaper"),
    addrs = [];
  items.forEach(function (it) {
    if (it.address && addrs.indexOf(it.address) < 0) addrs.push(it.address);
  });
  var rows = items
    .map(function (it) {
      return (
        "<tr><td>" +
        esc(it.service_date ? dshort(it.service_date) : "") +
        "</td><td>" +
        (it.title ? "<b>" + esc(it.title) + "</b> " : "") +
        esc(it.description) +
        (it.address ? '<div class="sm">' + esc(it.address) + "</div>" : "") +
        '</td><td class="r">' +
        esc(money(it.amount)) +
        "</td></tr>"
      );
    })
    .join("");
  var paidBox =
    inv.status === "paid"
      ? '<div class="paidstamp">PAID ' +
        esc(inv.paid_at ? dshort(String(inv.paid_at).slice(0, 10)) : "") +
        (inv.paid_method ? " · " + esc(inv.paid_method) : "") +
        "</div>"
      : inv.status === "void"
        ? '<div class="paidstamp void">VOID</div>'
        : "";
  var due = inv.status === "paid" ? "Paid" : inv.status === "void" ? "Void" : money(inv.total);
  paper.innerHTML =
    '<div class="ihead"><div class="ibrand"><div class="lg"><img src="../images/logo-tree-header.png" alt=""></div><div><div class="bn">' +
    esc(bizv("name", "LattaCorp of Central Florida")) +
    '</div><div class="sm">' +
    [bizv("address", ""), bizv("phone", ""), bizv("email", "")].filter(Boolean).map(esc).join("<br>") +
    "</div></div></div>" +
    '<div class="it">INVOICE</div></div><div class="body">' +
    '<div class="facts"><div class="fact"><div class="k">Invoice</div><div class="v">' +
    esc(invNum(inv.number)) +
    '</div></div><div class="fact"><div class="k">Issued</div><div class="v">' +
    esc(dshort(inv.issue_date)) +
    '</div></div><div class="fact"><div class="k">Due</div><div class="v">' +
    esc(dshort(inv.due_date)) +
    '</div></div><div class="fact due"><div class="k">' +
    (inv.status === "open" ? "Amount due" : "Total") +
    '</div><div class="v">' +
    esc(inv.status === "open" ? money(inv.total) : inv.status === "paid" ? money(inv.total) : due) +
    "</div></div></div>" +
    '<div class="bill"><div class="k">Bill to</div><b>' +
    esc(c.name || "") +
    "</b>" +
    (c.company ? "<div>" + esc(c.company) + "</div>" : "") +
    (inv.reference ? '<div class="sm">Ref: ' + esc(inv.reference) + "</div>" : "") +
    (addrs.length
      ? '<div class="sm">Service address' +
        (addrs.length > 1 ? "es" : "") +
        ": " +
        addrs.map(esc).join("; ") +
        "</div>"
      : "") +
    "</div>" +
    '<table class="itab"><thead><tr><th>Date</th><th>Service</th><th class="r">Amount</th></tr></thead><tbody>' +
    rows +
    '</tbody><tfoot><tr><td></td><td class="r"><b>Total</b></td><td class="r"><b>' +
    esc(money(inv.total)) +
    "</b></td></tr></tfoot></table>" +
    paidBox +
    '<div class="pay"><b>How to pay</b><div>' +
    (bizv("zelle", "") ? "Zelle: " + esc(biz.zelle) + "<br>" : "") +
    esc(bizv("payment_note", "")) +
    "</div></div>" +
    '<div class="foot">' +
    esc(bizv("footer", "Thank you!")) +
    "</div></div>";
  var v = $("invview");
  v.hidden = false;
  document.body.classList.add("printing");
  v.scrollTop = 0;
}
function showDocFrame(url) {
  var paper = $("invpaper");
  paper.innerHTML = "";
  paper.classList.add("framed");
  var f = document.createElement("iframe");
  f.id = "invframe";
  f.title = "Invoice";
  f.src = url;
  // grow the frame to fit the invoice so the page scrolls as one
  var fit = function () {
    try {
      f.style.height = f.contentDocument.documentElement.scrollHeight + "px";
    } catch (e) {}
  };
  f.addEventListener("load", function () {
    fit();
    setTimeout(fit, 400);
    setTimeout(fit, 1200);
  });
  paper.appendChild(f);
  var v = $("invview");
  v.hidden = false;
  document.body.classList.add("printing");
  v.scrollTop = 0;
}
function hideInvoice() {
  var paper = $("invpaper");
  paper.classList.remove("framed");
  if ($("invframe")) paper.innerHTML = "";
  $("invview").hidden = true;
  document.body.classList.remove("printing");
}

/* ---- Estimates (clients open a private link and can accept) ---- */
function estNum(n) {
  var s = String(n || 0);
  while (s.length < 4) s = "0" + s;
  return "EST-" + s;
}
function docUrl(tok, peek) {
  return location.origin + "/d/?t=" + tok + (peek ? "&p=1" : "");
}
function estExpired(e) {
  return (e.status === "draft" || e.status === "sent") && !!e.valid_until && e.valid_until < today();
}
function estOpen(e) {
  return e.status === "draft" || e.status === "sent";
}
function estChip(e) {
  if (e.status === "accepted") return el("span", "chip won", "Accepted");
  if (e.status === "declined") return el("span", "chip lost", "Declined");
  if (estExpired(e)) return el("span", "chip od", "Expired");
  return el("span", "chip", e.status === "sent" ? (e.viewed_at ? "Viewed" : "Sent") : "Draft");
}
function estMessage(e, c) {
  return (
    "Hi " +
    firstName(c) +
    ", this is " +
    bizv("name", "Latta Corp") +
    ". Here is your estimate" +
    (e.title ? " for " + e.title : "") +
    " (" +
    money(e.total) +
    "): " +
    docUrl(e.share_token) +
    " You can look it over and accept it right on that page. Thank you!"
  );
}
function markEstSent(e) {
  if (e.status !== "draft") return;
  var now = new Date().toISOString();
  sb.from("estimates")
    .update({ status: "sent", sent_at: now })
    .eq("id", e.id)
    .then(function (r) {
      if (!r.error) {
        e.status = "sent";
        e.sent_at = now;
        render();
      }
    });
}
function estRow(e) {
  var b = el("button", "row client");
  b.type = "button";
  var l = el("div");
  l.appendChild(el("b", null, estNum(e.number) + " · " + cname(e.client_id)));
  l.appendChild(
    el(
      "div",
      "sub",
      [
        e.title,
        e.status === "accepted"
          ? "Accepted " + (e.responded_at ? dshort(String(e.responded_at).slice(0, 10)) : "")
          : e.valid_until
            ? "Valid until " + dshort(e.valid_until)
            : ""
      ]
        .filter(Boolean)
        .join(" · ")
    )
  );
  var r = el("div");
  r.style.textAlign = "right";
  r.appendChild(el("b", null, money(e.total)));
  r.appendChild(el("div"));
  r.appendChild(estChip(e));
  b.appendChild(l);
  b.appendChild(r);
  b.addEventListener("click", function () {
    openEstimate(e.id);
  });
  return b;
}
function renderEstimates(list) {
  $("topbtns").appendChild(
    btn("New estimate", "btn", function () {
      openEstimateForm(null);
    })
  );
  if (estErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Estimates aren't set up yet. Run the Stage 11 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var set = estimates.filter(function (e) {
    if (!query) return true;
    return [estNum(e.number), cname(e.client_id), e.title].join(" ").toLowerCase().indexOf(query) > -1;
  });
  if (!set.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        estimates.length
          ? "Nothing matches that."
          : "No estimates yet. Tap New estimate, write it up, and send the client a link they can accept."
      )
    );
    return;
  }
  var waiting = set.filter(function (e) {
      return estOpen(e) && !estExpired(e);
    }),
    rest = set.filter(function (e) {
      return waiting.indexOf(e) < 0;
    });
  [
    ["Waiting for a response", waiting],
    ["Accepted, declined or expired", rest]
  ].forEach(function (g) {
    if (!g[1].length) return;
    var h = el("div", "note", g[0]);
    h.style.cssText = "font-weight:700;margin:12px 0 4px";
    list.appendChild(h);
    g[1].forEach(function (e) {
      list.appendChild(estRow(e));
    });
  });
}
function clientEstimatesSection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Estimates");
  h.appendChild(
    btn("+ New estimate", "btn alt sm", function () {
      openEstimateForm(c.id);
    })
  );
  sec.appendChild(h);
  var mine = estimates.filter(function (e) {
    return e.client_id === c.id;
  });
  if (!mine.length) sec.appendChild(el("div", "note", "None yet."));
  mine.slice(0, 5).forEach(function (e) {
    var r = el("div", "pcard");
    r.style.cssText = "display:flex;justify-content:space-between;gap:10px;align-items:center;cursor:pointer";
    var l = el("div");
    l.appendChild(el("b", null, estNum(e.number) + " · " + money(e.total)));
    l.appendChild(el("div", "note", e.title || "Estimate"));
    r.appendChild(l);
    r.appendChild(estChip(e));
    r.addEventListener("click", function () {
      openEstimate(e.id);
    });
    sec.appendChild(r);
  });
  if (mine.length > 5)
    sec.appendChild(el("div", "note", "+ " + (mine.length - 5) + " older estimates in Billing > Estimates."));
  return sec;
}

/* ---- Fill-in-the-blanks PDFs in the invoice design (made by tools/build_custom_pdfs.py), for documents made by
   hand: Custom invoice (Billing) and New Estimate/Quote (Jobs). Nothing typed into them is saved here. ---- */
function customDocLink(label, file, cls, tip) {
  var a = el("a", cls, label);
  a.href = "/forms/" + file;
  a.target = "_blank";
  a.rel = "noopener";
  a.title = tip;
  return a;
}
function customInvoiceLink(cls) {
  return customDocLink(
    "Custom invoice",
    "custom-invoice.pdf",
    cls,
    "Fill-in-the-blanks invoice PDF. Not saved in Foreman, so it won't show in balances or the portal."
  );
}
function customEstimateLink(cls) {
  return customDocLink(
    "Custom estimate",
    "custom-estimate.pdf",
    cls,
    "Fill-in-the-blanks estimate/quote PDF. Not saved in Foreman."
  );
}

/* ---- billing settings ---- */
function openBizSettings() {
  var p = panel();
  p.appendChild(el("h2", null, "Billing settings"));
  p.appendChild(el("p", "note", "This is what appears on every invoice and in the text or email message."));
  var f = {
    name: fld("Business name", "text", bizv("name", "")),
    phone: fld("Phone", "tel", bizv("phone", "")),
    email: fld("Email", "email", bizv("email", "")),
    address: fld("Mailing address (optional)", "text", bizv("address", "")),
    zelle: fld(
      "Zelle info (for example: the phone number or email you receive Zelle on)",
      "text",
      bizv("zelle", "")
    ),
    payment_note: fld("Other payment note", "text", bizv("payment_note", "")),
    terms_days: fld(
      "Payment due within (days after the invoice date; 0 = due on receipt)",
      "number",
      bizv("terms_days", 10)
    ),
    footer: fld("Thank-you line at the bottom", "text", bizv("footer", ""))
  };
  Object.keys(f).forEach(function (k) {
    p.appendChild(f[k]);
  });
  var s = btn("Save", "btn", function () {
    var row = { id: 1 };
    Object.keys(f).forEach(function (k) {
      row[k] = k === "terms_days" ? parseInt(f[k].input.value, 10) || 0 : f[k].input.value.trim();
    });
    s.disabled = true;
    sb.from("business")
      .upsert(row)
      .select()
      .single()
      .then(function (r) {
        s.disabled = false;
        if (r.error || !r.data) {
          alert("Could not save. Did you run the Stage 5 SQL?");
          return;
        }
        biz = r.data;
        closeDetail();
        render();
      });
  });
  s.style.marginTop = "14px";
  p.appendChild(s);
}
