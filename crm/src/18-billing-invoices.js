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
function propPicker(cs) {
  var w = fld("Property (optional: bill this to one property of the account)", "select", "", [
    ["", "Whole account / no specific property"]
  ]);
  function fill() {
    var cur = w.input.value;
    w.input.textContent = "";
    var o = document.createElement("option");
    o.value = "";
    o.textContent = "Whole account / no specific property";
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
  var pps = propPicker(cs);
  p.appendChild(pps);
  var ref = fld("Reference / PO number (optional, shows on the invoice)", "text", "");
  p.appendChild(ref);
  p.appendChild(el("h3", null, "Lines"));
  var box = el("div"),
    rows = [];
  function addRow() {
    var r = el("div", "grid2"),
      d = fld("Description", "text", ""),
      a = fld("Amount ($, negative = discount, 0 = no charge)", "number", "");
    a.input.step = "0.01";
    a.input.inputMode = "decimal";
    r.appendChild(d);
    r.appendChild(a);
    box.appendChild(r);
    rows.push({ d: d, a: a });
  }
  p.appendChild(box);
  addRow();
  p.appendChild(btn("+ Add another line", "btn alt sm", addRow));
  var nt = fld("Notes (optional)", "textarea", "");
  nt.style.marginTop = "10px";
  p.appendChild(nt);
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
      var d = rows[i].d.input.value.trim(),
        raw = rows[i].a.input.value.trim(),
        a = raw === "" ? 0 : parseFloat(raw);
      if (!d && raw === "") continue;
      if (!d || isNaN(a)) {
        alert("Each line needs a description. (Leave the amount empty or 0 for a no-charge line.)");
        return;
      }
      items.push({ description: d, amount: a });
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
        notes: nt.input.value.trim(),
        status: zero ? "paid" : "open",
        paid_at: zero ? isd.input.value + "T12:00:00" : null,
        paid_method: zero ? "No charge" : ""
      };
    if (pid) irow.property_id = pid;
    sb.from("invoices")
      .insert(irow)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          go.disabled = false;
          alert(
            pid
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
                  alert("Could not save the lines.");
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
}
