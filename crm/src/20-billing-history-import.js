/* Billing: importing a client's old account statement, and recording past invoices. */

/* ---- Import account history: an old statement (charges and payments) for one client or many, from a CSV file or rows pasted from a spreadsheet.
   Charges become invoices; payments are applied to the oldest unpaid invoice first, the way the old software did it; anything left over stays as credit on account.
   Rows already in the CRM (same client, date and amount) are skipped, so running the same file twice is safe. Nothing is emailed. ---- */
var HIST_COLS = {
  date: ["date", "trans date", "transaction date", "invoice date"],
  customer: ["customer", "customer name", "name", "client", "client name"],
  address: ["address", "service address", "property"],
  type: ["type", "trans type", "transaction type"],
  desc: ["description", "desc", "item", "service", "comment", "memo", "details"],
  amount: ["amount", "amt", "total"],
  charge: ["charges", "charge", "debit", "debits"],
  pay: ["payments", "payment", "credits", "credit"],
  method: ["method", "pmt. method", "pmt method", "payment method", "paid by"],
  ref: ["reference", "ref", "inv#", "inv #", "invoice #", "invoice number", "check #", "check number"],
  bal: ["balance", "running balance"]
};
function histDate(x) {
  x = String(x || "").trim();
  var m = x.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  m = x.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?!\d)/);
  if (!m) return "";
  var mo = +m[1],
    d = +m[2];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return (m[3].length === 2 ? "20" + m[3] : m[3]) + "-" + ("0" + mo).slice(-2) + "-" + ("0" + d).slice(-2);
}
function histNum(x) {
  var s = String(x == null ? "" : x).trim();
  if (!s) return null;
  var neg = /^\(.*\)$/.test(s) || /^-|-$/.test(s.replace(/[\s$]/g, ""));
  s = s.replace(/[^0-9.]/g, "");
  if (!s || isNaN(parseFloat(s))) return null;
  return r2(neg ? -parseFloat(s) : parseFloat(s));
}
function histMeth(x) {
  x = String(x || "").toLowerCase();
  return /zelle/.test(x)
    ? "Zelle"
    : /cash/.test(x)
      ? "Cash"
      : /\bche(ck|que)\b|\bchk\b/.test(x)
        ? "Check"
        : /other|card|venmo|paypal|ach|transfer/.test(x)
          ? "Other"
          : "";
}
function histRows(text) {
  var t = String(text || "")
    .replace(/^﻿/, "")
    .replace(/\r/g, "");
  var ls = t.split("\n").filter(function (l) {
    return l.trim();
  });
  if (!ls.length) return [];
  if (
    ls.some(function (l) {
      return l.indexOf("\t") > -1;
    })
  )
    return ls.map(function (l) {
      return l.split("\t");
    });
  return parseCSV(t);
}
/* Read the rows into charges and payments. A file with no header row is read as: Date, Description, Charges, Payments, Balance. */
function histParse(rows) {
  if (!rows.length) return { err: "There's nothing to read. Choose a file or paste the rows." };
  var hd = rows[0].map(function (h) {
      return String(h).trim().toLowerCase().replace(/\s+/g, " ");
    }),
    col = {};
  Object.keys(HIST_COLS).forEach(function (k) {
    col[k] = -1;
    HIST_COLS[k].some(function (n) {
      var i = hd.indexOf(n);
      if (
        i > -1 &&
        !Object.keys(col).some(function (o) {
          return col[o] === i;
        })
      ) {
        col[k] = i;
        return true;
      }
      return false;
    });
  });
  var body = rows.slice(1),
    noHead = false;
  if (col.date < 0) {
    if (!histDate(rows[0][0]))
      return {
        err: "I can't find a Date column. Put a header row on top (Date, Description, Charges, Payments...), or paste the rows in the order Date, Description, Charges, Payments, Balance."
      };
    col = {
      date: 0,
      desc: 1,
      charge: 2,
      pay: 3,
      bal: 4,
      customer: -1,
      address: -1,
      type: -1,
      amount: -1,
      method: -1,
      ref: -1
    };
    body = rows;
    noHead = true;
  }
  if (col.amount < 0 && col.charge < 0 && col.pay < 0)
    return {
      err: "I can't find the money columns. The file needs an Amount column (with a Type column saying Invoice or Payment), or separate Charges and Payments columns."
    };
  function g(r, k) {
    return col[k] > -1 && r[col[k]] != null ? String(r[col[k]]).trim() : "";
  }
  var recs = [],
    bad = [],
    zero = 0;
  body.forEach(function (r, ix) {
    if (!r.join("").trim()) return;
    var d = histDate(g(r, "date")),
      desc = g(r, "desc"),
      ty = g(r, "type").toLowerCase();
    if (!d) {
      if (!/balance forward|beginning balance|total/i.test(r.join(" ")))
        bad.push(r.join(" ").replace(/\s+/g, " ").trim().slice(0, 70));
      return;
    }
    var ch = histNum(g(r, "charge")),
      py = histNum(g(r, "pay")),
      am = histNum(g(r, "amount")),
      kind = "",
      amt = 0;
    if (ch) {
      kind = ch > 0 ? "charge" : "pay";
      amt = Math.abs(ch);
    } else if (py) {
      kind = py > 0 ? "pay" : "charge";
      amt = Math.abs(py);
    } else if (am) {
      amt = Math.abs(am);
      if (/pay|credit|receipt|deposit/.test(ty)) kind = "pay";
      else if (/inv|charge|bill|sale|debit|service/.test(ty)) kind = am < 0 ? "pay" : "charge";
      else if (am < 0) kind = "pay";
      else if (/payment|paid|zelle|cash|check|account credit/i.test(desc)) kind = "pay";
      else kind = "charge";
    } else {
      zero++;
      return;
    }
    var ref = g(r, "ref");
    if (!ref) {
      var im = desc.match(/inv(?:oice)?\s*#?\s*(\d+)/i);
      if (im) ref = im[1];
    }
    recs.push({
      ix: ix,
      d: d,
      kind: kind,
      amt: r2(amt),
      desc: desc,
      ref: ref.replace(/^inv\s*#?\s*/i, ""),
      meth: histMeth(g(r, "method")) || (kind === "pay" ? histMeth(desc) : ""),
      cust: g(r, "customer"),
      addr: g(r, "address"),
      bal: histNum(g(r, "bal"))
    });
  });
  if (!recs.length)
    return {
      err:
        "No charges or payments found. Check that each row has a date and an amount." +
        (bad.length ? " Rows I couldn't read: " + bad.slice(0, 3).join(" | ") : "")
    };
  return {
    recs: recs,
    bad: bad,
    zero: zero,
    hasCust: col.customer > -1,
    hasBal: col.bal > -1,
    noHead: noHead
  };
}
/* Which of the client's properties an address belongs to: same house number and the street's first word. */
function histProp(cid, addr) {
  var ps = clientProps(cid);
  if (!addr) return null;
  var w = String(addr)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
    num = w[0] && /^\d+$/.test(w[0]) ? w[0] : "",
    st = w[1] || "";
  if (!num) return null;
  var hit = ps.filter(function (p) {
    var a =
      " " +
      String(p.address || "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ") +
      " ";
    return a.indexOf(" " + num + " ") > -1 && (!st || a.indexOf(" " + st) > -1);
  });
  return hit.length === 1 ? hit[0].id : null;
}
/* Plan one client's import: new invoices, payments, and which invoice each payment pays. Nothing is saved here. */
function histPlan(cid, recs, opt) {
  var haveInv = {},
    havePay = {},
    dupC = 0,
    dupP = 0;
  invoices.forEach(function (i) {
    if (i.client_id === cid && i.status !== "void") {
      var k = String(i.issue_date).slice(0, 10) + "|" + r2(i.total);
      haveInv[k] = (haveInv[k] || 0) + 1;
    }
  });
  invPays.forEach(function (x) {
    var iv = x.invoice_id ? byId(invoices, x.invoice_id) : null;
    if (x.client_id !== cid && !(iv && iv.client_id === cid)) return;
    var k = String(x.paid_on).slice(0, 10);
    havePay[k] = r2((havePay[k] || 0) + Number(x.amount));
  });
  var single = clientProps(cid).length === 1 ? clientProps(cid)[0].id : null;
  var sorted = recs.slice().sort(function (a, b) {
    return a.d < b.d ? -1 : a.d > b.d ? 1 : a.ix - b.ix;
  });
  var invs = [],
    byKey = {};
  sorted.forEach(function (r) {
    if (r.kind !== "charge") return;
    var pid = histProp(cid, r.addr) || opt.pid || single || null,
      key = r.d + "|" + (pid || ""),
      inv = opt.group ? byKey[key] : null;
    if (!inv) {
      inv = { d: r.d, pid: pid, lines: [], total: 0, ref: "", refs: [] };
      invs.push(inv);
      if (opt.group) byKey[key] = inv;
    }
    inv.lines.push({ desc: r.desc || "Lawn maintenance", amt: r.amt, addr: pid ? paddr(pid) : r.addr || "" });
    inv.total = r2(inv.total + r.amt);
    if (r.ref && inv.refs.indexOf(r.ref) < 0) inv.refs.push(r.ref);
  });
  invs.forEach(function (v) {
    v.ref = v.refs.join(", ");
    var k = v.d + "|" + v.total;
    if (haveInv[k] > 0) {
      haveInv[k]--;
      v.dup = true;
      dupC++;
    }
  });
  var pays = sorted
    .filter(function (r) {
      return r.kind === "pay";
    })
    .map(function (r) {
      var p = { d: r.d, amt: r.amt, meth: r.meth || opt.meth, ref: r.ref, desc: r.desc, apps: [] };
      if ((havePay[r.d] || 0) >= r.amt - 0.005) {
        havePay[r.d] = r2(havePay[r.d] - r.amt);
        p.dup = true;
        dupP++;
      }
      return p;
    });
  var pool = openInvsFor(cid)
    .filter(function (i) {
      return balOf(i) > 0.005;
    })
    .map(function (i) {
      return { exist: i, d: String(i.issue_date).slice(0, 10), bal: balOf(i) };
    });
  invs.forEach(function (v) {
    if (!v.dup) {
      v.bal = v.total;
      v.paidBy = null;
      pool.push(v);
    }
  });
  pool.sort(function (a, b) {
    return a.d < b.d ? -1 : a.d > b.d ? 1 : (a.exist ? 0 : 1) - (b.exist ? 0 : 1);
  });
  pays.forEach(function (p) {
    if (p.dup) return;
    var left = p.amt;
    pool.forEach(function (v) {
      if (left <= 0.005 || v.bal <= 0.005) return;
      var a = r2(Math.min(v.bal, left));
      p.apps.push({ to: v, a: a });
      v.bal = r2(v.bal - a);
      left = r2(left - a);
      if (v.bal <= 0.005) v.paidBy = p;
    });
    if (left > 0.005) p.apps.push({ to: null, a: left });
  });
  var newI = invs.filter(function (v) {
      return !v.dup;
    }),
    newP = pays.filter(function (p) {
      return !p.dup;
    });
  return {
    cid: cid,
    invs: invs,
    pays: pays,
    newI: newI,
    newP: newP,
    dupC: dupC,
    dupP: dupP,
    paidNew: newI.filter(function (v) {
      return v.bal <= 0.005;
    }).length,
    openNew: newI.filter(function (v) {
      return v.bal > 0.005;
    }),
    existPaid: pool.filter(function (v) {
      return v.exist && v.bal <= 0.005;
    }),
    credit: r2(
      newP.reduce(function (s, p) {
        return (
          s +
          p.apps
            .filter(function (a) {
              return !a.to;
            })
            .reduce(function (t, a) {
              return t + a.a;
            }, 0)
        );
      }, 0)
    ),
    tC: r2(
      newI.reduce(function (s, v) {
        return s + v.total;
      }, 0)
    ),
    tP: r2(
      newP.reduce(function (s, p) {
        return s + p.amt;
      }, 0)
    )
  };
}
/* Save one client's plan: invoices first (all or none), then every payment in one step. */
function histSave(plan, terms) {
  var made = [],
    cid = plan.cid;
  function undo() {
    return Promise.all(
      made.map(function (v) {
        return sb.from("invoices").delete().eq("id", v.id);
      })
    );
  }
  return plan.newI
    .reduce(function (pr, v) {
      return pr.then(function () {
        var paid = v.bal <= 0.005,
          row = {
            client_id: cid,
            issue_date: v.d,
            due_date: addDays(v.d, terms),
            total: v.total,
            reference: v.ref,
            notes: "Imported account history" + (v.ref ? " (old #" + v.ref + ")" : "") + ".",
            status: paid ? "paid" : "open",
            paid_at: paid ? (v.paidBy ? v.paidBy.d : v.d) + "T12:00:00" : null,
            paid_method: paid ? (v.total > 0 && v.paidBy ? v.paidBy.meth : "No charge") : ""
          };
        if (v.pid) row.property_id = v.pid;
        return sb
          .from("invoices")
          .insert(row)
          .select()
          .single()
          .then(function (r) {
            if (r.error || !r.data) return Promise.reject("an invoice dated " + mdy(v.d));
            v.id = r.data.id;
            v.row = r.data;
            made.push(v);
            return sb
              .from("invoice_items")
              .insert(
                v.lines.map(function (l) {
                  return {
                    invoice_id: v.id,
                    service_date: v.d,
                    address: l.addr,
                    description: l.desc,
                    amount: l.amt
                  };
                })
              )
              .then(function (r2_) {
                if (r2_.error) return Promise.reject("the lines of an invoice dated " + mdy(v.d));
              });
          });
      });
    }, Promise.resolve())
    .then(function () {
      var recs = [];
      plan.newP.forEach(function (p) {
        p.apps.forEach(function (a) {
          recs.push({
            invoice_id: a.to ? (a.to.exist ? a.to.exist.id : a.to.id) : null,
            client_id: cid,
            paid_on: p.d,
            amount: a.a,
            method: p.meth,
            reference: p.ref || "",
            note:
              "Imported account history" +
              (p.desc ? ": " + p.desc : "") +
              (a.to ? "" : " (credit on account)")
          });
        });
      });
      if (!recs.length) return [];
      return sb
        .from("invoice_payments")
        .insert(recs)
        .select()
        .then(function (r) {
          if (r.error || !r.data)
            return Promise.reject(
              plan.credit > 0 ? "the payments (credit on account needs the Stage 18b SQL)" : "the payments"
            );
          return r.data;
        });
    })
    .then(
      function (rows) {
        rows.forEach(function (x) {
          invPays.unshift(x);
        });
        made.forEach(function (v) {
          invoices.unshift(v.row);
        });
        return Promise.all(
          plan.existPaid.map(function (v) {
            var last = plan.newP
              .filter(function (p) {
                return p.apps.some(function (a) {
                  return a.to === v;
                });
              })
              .pop();
            return syncInvPaid(v.exist, last ? last.d : today(), last ? last.meth : "");
          })
        ).then(function () {
          return { ok: true, inv: made.length, pay: plan.newP.length };
        });
      },
      function (why) {
        return undo().then(function () {
          return { ok: false, why: String(why) };
        });
      }
    );
}
function openHistImport(cid) {
  if (billErr || payErr) {
    alert("Run the Stage 5 and Stage 18 SQL in Supabase first, then press Refresh.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Import account history"));
  p.appendChild(
    el(
      "p",
      "note",
      "Bring in a statement from the old software: every charge and payment. Charges become invoices, and each payment pays the oldest unpaid invoice first, the way your old statement did. Anything paid ahead stays as credit on the account. You'll see a preview first, nothing is emailed, and rows already in the CRM are skipped, so running the same file twice is safe."
    )
  );
  var list = clients.filter(function (c) {
    return !c.archived || c.id === cid;
  });
  var cs = fld(
    "Whose history is this?",
    "select",
    cid || "",
    [["", "A file with a Customer column (several clients)"]].concat(
      list.map(function (c) {
        return [c.id, dispName(c) + (c.company ? " · " + c.company : "")];
      })
    )
  );
  p.appendChild(cs);
  var pp = fld("Property for rows with no address", "select", "", [
    ["", "Whole account / no specific property"]
  ]);
  p.appendChild(pp);
  function fillProps() {
    var ps = cs.input.value ? clientProps(cs.input.value) : [];
    pp.input.textContent = "";
    [["", "Whole account / no specific property"]]
      .concat(
        ps.map(function (x) {
          return [x.id, (x.label ? x.label + " · " : "") + x.address];
        })
      )
      .forEach(function (o) {
        var op = document.createElement("option");
        op.value = o[0];
        op.textContent = o[1];
        pp.input.appendChild(op);
      });
    var mn = ps.filter(isMainProp);
    pp.input.value = ps.length === 1 ? ps[0].id : mn.length ? mn[0].id : "";
    pp.hidden = ps.length < 2;
  }
  cs.input.addEventListener("change", function () {
    fillProps();
    if (parsed) preview();
  });
  fillProps();
  p.appendChild(el("h3", null, "1. The statement"));
  var file = document.createElement("input");
  file.type = "file";
  file.accept = ".csv,.tsv,.txt,text/csv";
  p.appendChild(file);
  var tx = fld("Or paste the rows (copy them from a spreadsheet or the old software)", "textarea", "");
  tx.input.style.minHeight = "120px";
  tx.input.placeholder =
    "Date\tDescription\tCharges\tPayments\tBalance\n07/19/2025\tLawn Maintenance\t30.00\t\t30.00\n08/02/2025\tPayment - Zelle\t\t30.00\t0.00";
  p.appendChild(tx);
  var tpl = btn("Download blank template (CSV)", "btn alt sm", function () {
    downloadCsv("account-history-template.csv", [
      ["Customer", "Address", "Date", "Type", "Description", "Amount", "Method", "Reference"],
      ["Smith, Anna", "3122 Bass Boat Way", "07/19/2025", "Invoice", "Lawn Maintenance", "30.00", "", ""],
      ["Smith, Anna", "3122 Bass Boat Way", "08/02/2025", "Payment", "", "30.00", "Zelle", "956"]
    ]);
  });
  p.appendChild(tpl);
  p.appendChild(el("h3", null, "2. Options"));
  var gl = document.createElement("label");
  gl.style.cssText = "display:flex;gap:8px;align-items:center;margin:6px 0";
  var gk = document.createElement("input");
  gk.type = "checkbox";
  gk.checked = true;
  gk.style.cssText = "width:auto;margin:0";
  gl.appendChild(gk);
  gl.appendChild(document.createTextNode("Combine a client's charges on the same day into one invoice"));
  p.appendChild(gl);
  var me = fld("Payment method when the statement doesn't say", "select", "Other", PAYMETH);
  p.appendChild(me);
  var pv = btn("Preview", "btn", function () {
    var t = tx.input.value;
    if (t.trim()) {
      read(t);
      return;
    }
    var f = file.files[0];
    if (!f) {
      alert("Choose a file or paste the rows first.");
      return;
    }
    var rd = new FileReader();
    rd.onload = function () {
      read(String(rd.result));
    };
    rd.readAsText(f);
  });
  pv.style.marginTop = "10px";
  p.appendChild(pv);
  file.addEventListener("change", function () {
    if (file.files[0]) tx.input.value = "";
    pv.click();
  });
  var out = el("div");
  out.style.marginTop = "14px";
  p.appendChild(out);
  var parsed = null,
    map = {},
    plans = [];
  gk.addEventListener("change", function () {
    if (parsed) preview();
  });
  me.input.addEventListener("change", function () {
    if (parsed) preview();
  });
  pp.input.addEventListener("change", function () {
    if (parsed) preview();
  });
  function read(text) {
    parsed = histParse(histRows(text));
    map = {};
    if (parsed.recs && !cs.input.value) {
      var seen = {};
      parsed.recs.forEach(function (r) {
        var k = r.cust || "";
        if (!(k in seen)) {
          seen[k] = 1;
          map[k] = guessClient(k);
        }
      });
    }
    preview();
  }
  function preview() {
    out.textContent = "";
    plans = [];
    if (parsed.err) {
      out.appendChild(el("div", "empty", parsed.err));
      return;
    }
    var recs = parsed.recs,
      groups = {},
      order = [];
    if (cs.input.value) {
      var names = {};
      recs.forEach(function (r) {
        if (r.cust) names[normNm(r.cust)] = 1;
      });
      if (Object.keys(names).length > 1) {
        out.appendChild(
          el(
            "div",
            "empty",
            "This file has " +
              Object.keys(names).length +
              ' different customers. Choose "A file with a Customer column" at the top instead.'
          )
        );
        return;
      }
      groups[cs.input.value] = recs;
      order.push(cs.input.value);
    } else {
      if (!parsed.hasCust) {
        out.appendChild(
          el("div", "empty", "This file has no Customer column, so choose whose history it is at the top.")
        );
        return;
      }
      var h = el("h3", null, "Match each customer to a CRM client");
      out.appendChild(h);
      var opts = [
        ["", "Choose a client..."],
        ["skip", "Skip this customer"]
      ].concat(
        clients.map(function (c) {
          return [c.id, dispName(c) + (c.company ? " · " + c.company : "")];
        })
      );
      Object.keys(map).forEach(function (k) {
        var n = recs.filter(function (r) {
            return r.cust === k;
          }).length,
          s = fld(
            (k || "(no customer name)") + " · " + n + " row" + (n > 1 ? "s" : ""),
            "select",
            map[k],
            opts
          );
        s.input.addEventListener("change", function () {
          map[k] = s.input.value;
          preview();
        });
        out.appendChild(s);
      });
      recs.forEach(function (r) {
        var c = map[r.cust || ""];
        if (!c || c === "skip") return;
        if (!groups[c]) {
          groups[c] = [];
          order.push(c);
        }
        groups[c].push(r);
      });
    }
    var unmatched = Object.keys(map).filter(function (k) {
      return !map[k];
    }).length;
    var opt = { group: gk.checked, meth: me.input.value, pid: cs.input.value ? pp.input.value : "" };
    order.forEach(function (c) {
      plans.push(histPlan(c, groups[c], opt));
    });
    if (parsed.bad.length) {
      var bd = el(
        "div",
        "note",
        "Skipped " +
          parsed.bad.length +
          " row" +
          (parsed.bad.length > 1 ? "s" : "") +
          " with no date I could read: " +
          parsed.bad.slice(0, 3).join(" | ") +
          (parsed.bad.length > 3 ? " ..." : "")
      );
      bd.style.color = "#9a3412";
      out.appendChild(bd);
    }
    plans.forEach(function (pl) {
      var c = byId(clients, pl.cid),
        card = el("div", "pcard");
      card.style.marginTop = "10px";
      card.appendChild(el("b", null, c ? dispName(c) : "Client"));
      var rs = groups[pl.cid],
        run = 0,
        w = el("div", "invwrap"),
        t = document.createElement("table");
      t.className = "ptable";
      var hr = document.createElement("tr");
      ["Date", "Description", "Charges", "Payments", "Balance"].forEach(function (x, i) {
        var th = document.createElement("th");
        th.textContent = x;
        if (i > 1) th.className = "r";
        hr.appendChild(th);
      });
      t.appendChild(hr);
      rs.slice()
        .sort(function (a, b) {
          return a.d < b.d ? -1 : a.d > b.d ? 1 : a.ix - b.ix;
        })
        .forEach(function (r) {
          run = r2(run + (r.kind === "charge" ? r.amt : -r.amt));
          var tr = document.createElement("tr");
          [
            mdy(r.d),
            (r.desc || (r.kind === "pay" ? "Payment" : "Charge")) + (r.ref ? " (#" + r.ref + ")" : ""),
            r.kind === "charge" ? money(r.amt) : "",
            r.kind === "pay" ? money(r.amt) : "",
            money(run)
          ].forEach(function (v, k) {
            var td = document.createElement("td");
            td.textContent = v;
            if (k > 1) td.className = "r";
            tr.appendChild(td);
          });
          t.appendChild(tr);
        });
      w.appendChild(t);
      card.appendChild(w);
      var fileEnd = null;
      rs.forEach(function (r) {
        if (r.bal != null) fileEnd = r.bal;
      });
      if (parsed.hasBal && fileEnd != null) {
        var ok = Math.abs(Math.abs(fileEnd) - Math.abs(run)) < 0.01,
          bx = el(
            "div",
            "note",
            ok
              ? "✓ Ends at " + money(run) + ", the same as the statement's last balance."
              : "⚠ This adds up to " +
                  money(run) +
                  ", but the statement's last balance is " +
                  money(fileEnd) +
                  ". Check for a missing or misread row before importing."
          );
        bx.style.cssText = "margin-top:6px;font-weight:600;color:" + (ok ? "#166534" : "#9a3412");
        card.appendChild(bx);
      }
      var lines = [];
      if (pl.newI.length || pl.newP.length)
        lines.push(
          "Creates " +
            pl.newI.length +
            " invoice" +
            (pl.newI.length === 1 ? "" : "s") +
            " (" +
            money(pl.tC) +
            ") and " +
            pl.newP.length +
            " payment" +
            (pl.newP.length === 1 ? "" : "s") +
            " (" +
            money(pl.tP) +
            ")."
        );
      if (pl.newI.length)
        lines.push(
          (pl.paidNew ? pl.paidNew + " will be paid in full" : "None will be paid in full") +
            (pl.openNew.length
              ? "; " +
                pl.openNew.length +
                " will still have " +
                money(
                  r2(
                    pl.openNew.reduce(function (s, v) {
                      return s + v.bal;
                    }, 0)
                  )
                ) +
                " owing"
              : "") +
            "."
        );
      if (pl.existPaid.length)
        lines.push(
          "Also pays " +
            pl.existPaid.length +
            " invoice" +
            (pl.existPaid.length > 1 ? "s" : "") +
            " already in the CRM: " +
            pl.existPaid
              .map(function (v) {
                return invNum(v.exist.number);
              })
              .join(", ") +
            "."
        );
      if (pl.credit > 0)
        lines.push(money(pl.credit) + " is more than what's owed, so it stays as credit on account.");
      if (pl.dupC || pl.dupP)
        lines.push(
          "Already in the CRM, skipped: " +
            (pl.dupC ? pl.dupC + " charge" + (pl.dupC > 1 ? "s" : "") : "") +
            (pl.dupC && pl.dupP ? " and " : "") +
            (pl.dupP ? pl.dupP + " payment" + (pl.dupP > 1 ? "s" : "") : "") +
            "."
        );
      lines.forEach(function (l) {
        var d = el("div", "note", l);
        d.style.marginTop = "4px";
        card.appendChild(d);
      });
      out.appendChild(card);
    });
    var nI = plans.reduce(function (s, x) {
        return s + x.newI.length;
      }, 0),
      nP = plans.reduce(function (s, x) {
        return s + x.newP.length;
      }, 0);
    if (unmatched) {
      var u = el(
        "div",
        "note",
        "Match or skip " + unmatched + " customer" + (unmatched > 1 ? "s" : "") + " above to continue."
      );
      u.style.cssText = "margin-top:10px;font-weight:600";
      out.appendChild(u);
    }
    if (!plans.length) return;
    if (!nI && !nP) {
      out.appendChild(
        el("div", "empty", "Everything in this file is already in the CRM. Nothing to import.")
      );
      return;
    }
    var go = btn(
      "Import " + nI + " invoice" + (nI === 1 ? "" : "s") + " and " + nP + " payment" + (nP === 1 ? "" : "s"),
      "btn",
      function () {
        if (
          !confirm(
            "Import this history" +
              (plans.length > 1 ? " for " + plans.length + " clients" : "") +
              "? Nothing is emailed."
          )
        )
          return;
        go.disabled = true;
        var terms = Number(bizv("terms_days", 10));
        terms = isNaN(terms) ? 10 : terms;
        var res = [];
        plans
          .reduce(function (pr, pl, i) {
            return pr.then(function () {
              go.textContent = "Importing " + (i + 1) + " of " + plans.length + "...";
              return histSave(pl, terms).then(function (r) {
                r.cid = pl.cid;
                res.push(r);
              });
            });
          }, Promise.resolve())
          .then(function () {
            return Promise.all([
              reloadInvoices(),
              sb
                .from("invoice_payments")
                .select("*")
                .order("paid_on", { ascending: false })
                .limit(10000)
                .then(function (q) {
                  if (!q.error) invPays = q.data || [];
                })
            ]);
          })
          .then(function () {
            repData = null;
            render();
            out.textContent = "";
            var good = res.filter(function (r) {
                return r.ok;
              }),
              bad = res.filter(function (r) {
                return !r.ok;
              });
            var ok = el(
              "div",
              "pcard",
              "✓ Imported " +
                good.reduce(function (s, r) {
                  return s + r.inv;
                }, 0) +
                " invoices and " +
                good.reduce(function (s, r) {
                  return s + r.pay;
                }, 0) +
                " payments" +
                (good.length > 1 ? " for " + good.length + " clients" : "") +
                "."
            );
            ok.style.cssText = "background:var(--mint);font-weight:700";
            out.appendChild(ok);
            bad.forEach(function (r) {
              var d = el(
                "div",
                "note",
                "Nothing was imported for " +
                  cname(r.cid) +
                  ": I couldn't save " +
                  r.why +
                  ". Its other rows were undone, so you can fix it and run the file again."
              );
              d.style.cssText = "color:#9a3412;margin-top:6px";
              out.appendChild(d);
            });
            if (res.length === 1 && good.length) {
              var oc = btn("Open " + cname(res[0].cid), "btn alt", function () {
                openClient(res[0].cid);
              });
              oc.style.marginTop = "10px";
              out.appendChild(oc);
            }
          });
      }
    );
    go.disabled = unmatched > 0;
    go.style.marginTop = "12px";
    out.appendChild(go);
  }
}
/* Past invoice: record an old invoice that was already sent and paid (one step: invoice + payment, nothing is sent or left owed). */
function openPastInvoice(cid, pre) {
  pre = pre || {};
  if (billErr) {
    alert("Billing isn't set up yet. Run the Stage 5 SQL in Supabase first.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Past invoice (already sent and paid)"));
  p.appendChild(
    el(
      "div",
      "note",
      "For old invoices you already sent and collected on. It is saved as Paid with its payment, nothing is emailed, and it never shows as owed."
    )
  );
  if (pre.saved) {
    var ok = el("div", "pcard", "\u2713 Saved " + pre.saved + ". Enter the next one below.");
    ok.style.cssText = "background:var(--mint);font-weight:700;margin-top:8px";
    p.appendChild(ok);
  }
  var list = clients.filter(function (c) {
    return !c.archived || c.id === cid;
  });
  var cs = fld(
    "Client",
    "select",
    cid || "",
    [["", "Choose a client..."]].concat(
      list.map(function (c) {
        return [c.id, dispName(c) + (c.company ? " \u00b7 " + c.company : "")];
      })
    )
  );
  p.appendChild(cs);
  var g = el("div", "grid2"),
    isd = fld("Original invoice date", "date", pre.date || ""),
    on = fld("Original invoice number", "text", "");
  on.input.placeholder = "Their old number, if any";
  g.appendChild(isd);
  g.appendChild(on);
  p.appendChild(g);
  var g2 = el("div", "grid2"),
    am = fld("Amount ($)", "number", ""),
    ds = fld("Description", "text", pre.desc || "Lawn maintenance");
  am.input.step = "0.01";
  am.input.min = "0";
  am.input.inputMode = "decimal";
  g2.appendChild(am);
  g2.appendChild(ds);
  p.appendChild(g2);
  var g3 = el("div", "grid2"),
    pd = fld("Date paid", "date", pre.paidOn || ""),
    me = fld("Paid by", "select", pre.method || "Zelle", PAYMETH);
  g3.appendChild(pd);
  g3.appendChild(me);
  p.appendChild(g3);
  var pps = propPicker(cs);
  p.appendChild(pps);
  var nt = fld("Note (optional)", "text", "");
  p.appendChild(nt);
  var ids = el(
    "div",
    "note",
    "If the invoice and payment were the same day, enter the same date in both. Leave the number empty if there wasn't one."
  );
  p.appendChild(ids);
  var acts = el("div", "acts");
  acts.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:14px";
  function save(another) {
    if (!cs.input.value) {
      alert("Choose a client.");
      return;
    }
    if (!isd.input.value) {
      alert("Enter the original invoice date.");
      return;
    }
    var a = parseFloat(am.input.value);
    if (isNaN(a) || a < 0) {
      alert("Enter the amount (0 if it was no charge).");
      return;
    }
    if (!ds.input.value.trim()) {
      alert("Enter a description.");
      return;
    }
    if (!pd.input.value) {
      alert("Enter the date it was paid.");
      return;
    }
    var terms = Number(bizv("terms_days", 10));
    terms = isNaN(terms) ? 10 : terms;
    a = r2(a);
    acts.querySelectorAll("button").forEach(function (b) {
      b.disabled = true;
    });
    var row = {
      client_id: cs.input.value,
      issue_date: isd.input.value,
      due_date: addDays(isd.input.value, terms),
      total: a,
      reference: on.input.value.trim(),
      notes: ("Past invoice entered for records. " + nt.input.value.trim()).trim(),
      status: "paid",
      paid_at: pd.input.value + "T12:00:00",
      paid_method: a === 0 ? "No charge" : me.input.value
    };
    var ppid = pps.input.value || null;
    if (ppid) row.property_id = ppid;
    function fail(msg, invId) {
      (invId ? sb.from("invoices").delete().eq("id", invId) : Promise.resolve()).then(function () {
        acts.querySelectorAll("button").forEach(function (b) {
          b.disabled = false;
        });
        alert(msg);
      });
    }
    sb.from("invoices")
      .insert(row)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          fail("Could not save the invoice. Did you run the Stage 5 SQL?");
          return;
        }
        var inv = r.data;
        sb.from("invoice_items")
          .insert({
            invoice_id: inv.id,
            service_date: isd.input.value,
            description: ds.input.value.trim(),
            amount: a,
            address: ppid ? paddr(ppid) : ""
          })
          .then(function (r2_) {
            if (r2_.error) {
              fail("Could not save the invoice line.", inv.id);
              return;
            }
            function done() {
              invoices.unshift(inv);
              repData = null;
              render();
              var label = invNum(inv.number) + (inv.reference ? " (old #" + inv.reference + ")" : "");
              if (another)
                openPastInvoice(cs.input.value, {
                  saved: label,
                  method: me.input.value,
                  desc: ds.input.value.trim()
                });
              else openInvoice(inv.id);
            }
            if (a > 0 && !payErr) {
              sb.from("invoice_payments")
                .insert({
                  invoice_id: inv.id,
                  client_id: inv.client_id,
                  paid_on: pd.input.value,
                  amount: a,
                  method: me.input.value,
                  reference: on.input.value.trim(),
                  note: "Past invoice"
                })
                .select()
                .single()
                .then(function (r3) {
                  if (r3.error || !r3.data) {
                    fail("Could not save the payment.", inv.id);
                    return;
                  }
                  invPays.unshift(r3.data);
                  done();
                });
            } else done();
          });
      });
  }
  acts.appendChild(
    btn("Save and add another", "btn", function () {
      save(true);
    })
  );
  acts.appendChild(
    btn("Save", "btn alt", function () {
      save(false);
    })
  );
  p.appendChild(acts);
}
