/* Billing: building invoices from completed visits, and manual invoices. */

/* ======================= BILLING ======================= */

function invNum(n) {
  var s = String(n || 0);
  while (s.length < 4) s = "0" + s;
  return "LC-" + s;
}
function lastMonthEnd() {
  return addDays(today().slice(0, 8) + "01", -1);
}
function bizv(k, d) {
  return biz && biz[k] != null && biz[k] !== "" ? biz[k] : d;
}
function jobTitle(id) {
  var j = byId(jobs, id);
  return j ? j.title : "Lawn service";
}
function loadUnbilled() {
  return sb
    .from("visits")
    .select("*")
    .eq("status", "done")
    .is("invoice_id", null)
    .is("paid_at", null)
    .limit(5000)
    .then(function (r) {
      if (r.error) {
        billErr = true;
        unbilled = [];
      } else unbilled = r.data || [];
    });
}
function reloadInvoices() {
  return sb
    .from("invoices")
    .select("*")
    .order("number", { ascending: false })
    .limit(3000)
    .then(function (r) {
      if (!r.error) invoices = r.data || [];
    });
}
function isOverdue(i) {
  return i.status === "open" && i.due_date && i.due_date < today();
}
function openTotal(arr) {
  return r2(
    arr
      .filter(function (i) {
        return i.status === "open";
      })
      .reduce(function (s, i) {
        return s + balOf(i);
      }, 0)
  );
}
function eligible() {
  return unbilled.filter(function (v) {
    return v.scheduled_date <= billThrough && Number(v.price) > 0;
  });
}
function byProp(cid) {
  var c = byId(clients, cid);
  return !!(c && c.bill_by_property);
}
/* Group visits into invoices: one per client, or one per client+property when that client is set to "separate invoice for each property". */
function groupVisits(vs) {
  var g = {},
    order = [];
  vs.forEach(function (v) {
    var k = v.client_id + (byProp(v.client_id) ? "|" + (v.property_id || "") : "");
    if (!g[k]) {
      g[k] = { key: k, cid: v.client_id, pid: byProp(v.client_id) ? v.property_id || null : null, vs: [] };
      order.push(k);
    }
    g[k].vs.push(v);
  });
  order.sort(function (a, b) {
    return cname(g[a].cid).localeCompare(cname(g[b].cid)) || paddr(g[a].pid).localeCompare(paddr(g[b].pid));
  });
  order.forEach(function (k) {
    g[k].vs.sort(function (a, b) {
      return a.scheduled_date < b.scheduled_date ? -1 : 1;
    });
  });
  return { g: g, order: order };
}
function billGroups() {
  return groupVisits(eligible());
}
function groupTitle(x) {
  return cname(x.cid) + (x.pid ? " \u00b7 " + paddr(x.pid) : "");
}

function createInvoice(cid, vs, through, pid) {
  vs = vs.slice().sort(function (a, b) {
    return a.scheduled_date < b.scheduled_date ? -1 : 1;
  });
  var issue = today(),
    terms = Number(bizv("terms_days", 10)),
    total = r2(
      vs.reduce(function (s, v) {
        return s + Number(v.price || 0);
      }, 0)
    );
  var row = {
    client_id: cid,
    issue_date: issue,
    due_date: addDays(issue, isNaN(terms) ? 10 : terms),
    period_start: vs[0].scheduled_date,
    period_end: through,
    total: total
  };
  if (!pid) {
    var vp = vs
      .map(function (v) {
        return v.property_id || "";
      })
      .filter(function (x, i, a) {
        return a.indexOf(x) === i;
      });
    if (vp.length === 1 && vp[0]) pid = vp[0];
  }
  if (pid) row.property_id = pid;
  if (total === 0) {
    row.status = "paid";
    row.paid_at = issue + "T12:00:00";
    row.paid_method = "No charge";
  }
  return sb
    .from("invoices")
    .insert(row)
    .select()
    .single()
    .then(function (r) {
      if (r.error || !r.data)
        return Promise.reject(
          pid
            ? "Could not create the invoice. Did you run the Stage 20 SQL?"
            : "Could not create the invoice. Did you run the Stage 5 SQL?"
        );
      var inv = r.data;
      var lines = vs.map(function (v) {
        return {
          invoice_id: inv.id,
          visit_id: v.id,
          service_date: v.scheduled_date,
          address: paddr(v.property_id),
          description: jobTitle(v.job_id),
          amount: v.price
        };
      });
      function undo(msg) {
        return sb
          .from("invoices")
          .delete()
          .eq("id", inv.id)
          .then(function () {
            return Promise.reject(msg);
          });
      }
      return sb
        .from("invoice_items")
        .insert(lines)
        .then(function (r2_) {
          if (r2_.error) return undo("Could not add the invoice lines.");
          return sb
            .from("visits")
            .update({ invoice_id: inv.id })
            .in(
              "id",
              vs.map(function (v) {
                return v.id;
              })
            )
            .is("invoice_id", null)
            .then(function (r3) {
              if (r3.error) return undo("Could not link the visits to the invoice.");
              invoices.unshift(inv);
              return inv;
            });
        });
    });
}

/* Property picker: follows the chosen client's properties. Empty = the whole account (no specific property). */
function propPicker(cs, label, emptyText) {
  emptyText = emptyText || "Whole account / no specific property";
  var w = fld(label || "Property (optional: bill this to one property of the account)", "select", "", [["", emptyText]]);
  function fill() {
    var cur = w.input.value;
    w.input.textContent = "";
    var o = document.createElement("option");
    o.value = "";
    o.textContent = emptyText;
    w.input.appendChild(o);
    clientProps(cs.input.value).forEach(function (p) {
      var op = document.createElement("option");
      op.value = p.id;
      op.textContent = (p.label ? p.label + " \u00b7 " : "") + p.address;
      w.input.appendChild(op);
    });
    w.input.value = cur;
    if (w.input.value !== cur) w.input.value = "";
  }
  cs.input.addEventListener("change", fill);
  fill();
  return w;
}
/* Manual invoice: pick a client, add the lines, and it is created ready to send (no completed visits needed). */
function openInvoiceForm(cid) {
  if (billErr) {
    alert("Billing isn't set up yet. Run the Stage 5 SQL in Supabase first.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "New invoice"));
  var list = clients.filter(function (c) {
    return !c.archived || c.id === cid;
  });
  var cs = fld(
    "Client",
    "select",
    cid || "",
    [["", "Choose a client..."]].concat(
      list.map(function (c) {
        return [c.id, dispName(c) + (c.company ? " · " + c.company : "")];
      })
    )
  );
  p.appendChild(cs);
  // laid out like the New quote form: who it's for, the job title and notes, then the dates, then the lines
  var pps = propPicker(cs);
  p.appendChild(pps);
  var ttl = fld("Job Title", "text", ""),
    nt = fld("Notes & Terms (optional; the \"Zelle to ..., or Cash upon next visit\" line is always included)", "textarea", "");
  p.appendChild(ttl);
  p.appendChild(nt);
  var terms = Number(bizv("terms_days", 10));
  terms = isNaN(terms) ? 10 : terms;
  var g = el("div", "grid2"),
    isd = fld("Invoice date", "date", today()),
    dd = fld("Due date", "date", addDays(today(), terms)),
    dueTouched = false;
  dd.input.addEventListener("change", function () {
    dueTouched = true;
  });
  isd.input.addEventListener("change", function () {
    if (!dueTouched && isd.input.value) dd.input.value = addDays(isd.input.value, terms);
  });
  g.appendChild(isd);
  g.appendChild(dd);
  p.appendChild(g);
  // service period (shows on the invoice); follows the invoice date's month until changed by hand
  var monthOf = function (d, end) {
      var m = String(d || today()).slice(0, 7),
        last = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
      return m + "-" + (end ? String(last) : "01");
    },
    gp = el("div", "grid2"),
    pbeg = fld("Period beginning", "date", monthOf(today())),
    pend = fld("Period ending", "date", monthOf(today(), true)),
    perTouched = false;
  [pbeg, pend].forEach(function (x) {
    x.input.addEventListener("change", function () {
      perTouched = true;
    });
  });
  isd.input.addEventListener("change", function () {
    if (!perTouched && isd.input.value) {
      pbeg.input.value = monthOf(isd.input.value);
      pend.input.value = monthOf(isd.input.value, true);
    }
  });
  gp.appendChild(pbeg);
  gp.appendChild(pend);
  p.appendChild(gp);
  var ref = fld("Reference / PO number (optional, shows on the invoice)", "text", "");
  p.appendChild(ref);
  p.appendChild(el("h3", null, "Work Billed"));
  var box = el("div"),
    rows = [];
  function blankRow(x) {
    return !x.t.input.value.trim() && !x.d.input.value.trim() && !x.q.input.value.trim() && !x.a.input.value.trim();
  }
  // keeps exactly one empty line at the bottom; a line left blank is removed once you move off it
  function syncRows() {
    if (!rows.length || !blankRow(rows[rows.length - 1])) addRow();
    for (var i = rows.length - 2; i >= 0; i--) {
      if (blankRow(rows[i]) && !rows[i].el.contains(document.activeElement)) {
        box.removeChild(rows[i].el);
        rows.splice(i, 1);
      }
    }
  }
  box.addEventListener("input", syncRows);
  box.addEventListener("focusout", function () {
    setTimeout(syncRows, 0);
  });
  function addRow() {
    var r = el("div", "grid4"),
      tt = fld("Title", "text", ""),
      d = fld("Description", "text", ""),
      q = fld("QTY", "text", ""),
      a = fld("Total ($)", "number", "");
    a.input.step = "0.01";
    a.input.inputMode = "decimal";
    a.input.title = "Negative = discount, 0 = no charge";
    r.appendChild(tt);
    r.appendChild(d);
    r.appendChild(q);
    r.appendChild(a);
    box.appendChild(r);
    rows.push({ el: r, t: tt, d: d, q: q, a: a });
  }
  p.appendChild(box);
  addRow();
  p.appendChild(el("p", "note", "A negative total is a discount; 0 is a no-charge line."));
  var go = btn("Create invoice", "btn", function () {
    if (!cs.input.value) {
      alert("Choose a client.");
      return;
    }
    if (!isd.input.value || !dd.input.value) {
      alert("Pick the invoice date and due date.");
      return;
    }
    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var tt = rows[i].t.input.value.trim(),
        d = rows[i].d.input.value.trim(),
        q = rows[i].q.input.value.trim(),
        raw = rows[i].a.input.value.trim(),
        a = raw === "" ? 0 : parseFloat(raw);
      if (!tt && !d && !q && raw === "") continue;
      if ((!tt && !d) || isNaN(a)) {
        alert("Each line needs a title or description. (Leave the total empty or 0 for a no-charge line.)");
        return;
      }
      var line = { title: tt, description: d, amount: a };
      if (q) line.qty = q;
      items.push(line);
    }
    if (!items.length) {
      alert("Add at least one line.");
      return;
    }
    var total = r2(
      items.reduce(function (s2, x) {
        return s2 + x.amount;
      }, 0)
    );
    if (total < 0) {
      alert("The total can't be negative.");
      return;
    }
    var zero = total === 0;
    go.disabled = true;
    var pid = pps.input.value || null,
      irow = {
        client_id: cs.input.value,
        issue_date: isd.input.value,
        due_date: dd.input.value,
        total: total,
        reference: ref.input.value.trim(),

        status: zero ? "paid" : "open",
        paid_at: zero ? isd.input.value + "T12:00:00" : null,
        paid_method: zero ? "No charge" : ""
      };
    if (pid) irow.property_id = pid;
    if (ttl.input.value.trim()) irow.title = ttl.input.value.trim();
    if (nt.input.value.trim()) irow.terms = nt.input.value.trim();
    if (pbeg.input.value) irow.period_start = pbeg.input.value;
    if (pend.input.value) irow.period_end = pend.input.value;
    sb.from("invoices")
      .insert(irow)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          go.disabled = false;
          alert(
            irow.title || irow.terms
              ? "Could not create the invoice. Did you run the Stage 37 SQL?"
              : pid
              ? "Could not create the invoice. Did you run the Stage 20 SQL?"
              : "Could not create the invoice. Did you run the Stage 5 SQL?"
          );
          return;
        }
        var inv = r.data;
        items.forEach(function (x) {
          x.invoice_id = inv.id;
          x.service_date = isd.input.value;
          if (pid) x.address = paddr(pid);
        });
        sb.from("invoice_items")
          .insert(items)
          .then(function (r2_) {
            if (r2_.error) {
              sb.from("invoices")
                .delete()
                .eq("id", inv.id)
                .then(function () {
                  go.disabled = false;
                  alert("Could not save the lines. Did you run the Stage 37 SQL?");
                });
              return;
            }
            invoices.unshift(inv);
            repData = null;
            bfilter = zero ? "paid" : "open";
            render();
            openInvoice(inv.id);
          });
      });
  });
  go.style.marginTop = "14px";
  p.appendChild(go);

  // live preview of the invoice the client will get
  var show = livePreview(p);
  function draft() {
    var c = byId(clients, cs.input.value),
      pid = pps.input.value || null,
      items = [],
      total = 0;
    rows.forEach(function (r) {
      var tt = r.t.input.value.trim(),
        d = r.d.input.value.trim(),
        q = r.q.input.value.trim(),
        a = parseFloat(r.a.input.value);
      if (!tt && !d && !q && isNaN(a)) return;
      a = isNaN(a) ? 0 : a;
      total += a;
      items.push({ date: isd.input.value, title: tt, description: d, qty: q, amount: a });
    });
    total = r2(total);
    show({
      kind: "invoice",
      doc: {
        number: lpNextNumber(invoices),
        issue_date: isd.input.value,
        due_date: dd.input.value,
        status: "open",
        total: total,
        reference: ref.input.value.trim(),
        title: ttl.input.value.trim(),
        terms: nt.input.value.trim(),
        period_start: pbeg.input.value,
        period_end: pend.input.value,
        property_address: pid ? paddr(pid) : c ? lpMainAddress(c.id) : ""
      },
      summary: lpSummary(c, pid, total),
      items: items,
      client: lpClient(c),
      business: lpBusiness()
    });
  }
  p.addEventListener("input", draft);
  p.addEventListener("change", draft);
  p.addEventListener("click", function () {
    setTimeout(draft, 0);
  });
  draft();
}
