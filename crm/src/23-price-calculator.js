/* Lawn price calculator and the estimate form. */

/* ---- Lawn price calculator (rough per-visit price for lawn maintenance) ---- */
var PRICE_DEF = {
  base: 20,
  per1000: 4,
  bi: 1.2,
  minw: 35,
  minb: 40,
  step: 5,
  grass: 52,
  adderp: 8,
  maxg: 45000,
  show: 1,
  taperAt: 10000,
  taper: 75
};
var DEF_OPTS = [
  { id: "fence", en: "Is the yard fenced?", es: "¿El patio tiene cerca?", pct: 25, on: 1 },
  {
    id: "plants",
    en: "Lots of plants, trees or obstacles in the lawn?",
    es: "¿Muchas plantas, árboles u obstáculos en el césped?",
    pct: 12.5,
    on: 1
  },
  {
    id: "slope",
    en: "Steep slope or uneven ground?",
    es: "¿Pendiente pronunciada o terreno desigual?",
    pct: 12.5,
    on: 1
  },
  {
    id: "walks",
    en: "Long driveway or lots of sidewalks to edge and blow?",
    es: "¿Entrada larga o muchas aceras para bordear y soplar?",
    pct: 12.5,
    on: 1
  },
  {
    id: "water",
    en: "Pond or lake bank to trim around?",
    es: "¿Orilla de estanque o lago para recortar?",
    pct: 12.5,
    on: 1
  }
];
function pricing() {
  var o = Object.assign({}, PRICE_DEF),
    p = biz && biz.pricing && typeof biz.pricing === "object" ? biz.pricing : {};
  Object.keys(PRICE_DEF).forEach(function (k) {
    var v = parseFloat(p[k]);
    if (!isNaN(v) && v >= 0) o[k] = v;
  });
  o.options = Array.isArray(p.options)
    ? p.options
        .map(function (x, i) {
          return {
            id: String(x.id || "o" + i),
            en: String(x.en || ""),
            es: String(x.es || x.en || ""),
            pct: isNaN(parseFloat(x.pct)) ? ((parseFloat(x.amt) || 0) / 40) * 100 : parseFloat(x.pct),
            on: x.on === 0 || x.on === false ? 0 : 1
          };
        })
        .filter(function (x) {
          return x.en;
        })
    : DEF_OPTS.slice();
  return o;
}
function ceilStep(x, st) {
  return st > 0 ? Math.ceil(x / st - 1e-9) * st : Math.ceil(x - 1e-9);
}
/* Base price for a lawn, then options add a percentage of it (rounded UP to the next $5); the website adds a % cushion on top (also rounded up). */
function priceFor(g, freq, P) {
  P = P || pricing();
  var T = P.taperAt,
    eff = Math.min(g, T) + (P.taper / 100) * Math.max(g - T, 0),
    w = P.base + (P.per1000 * eff) / 1000,
    raw = freq === "biweekly" ? w * P.bi : w,
    st = P.step > 0 ? Math.round(raw / P.step) * P.step : Math.round(raw),
    mn = freq === "biweekly" ? P.minb : P.minw;
  return { price: Math.max(st, mn), atMin: st <= mn };
}
function quoteFor(g, freq, pct, P) {
  P = P || pricing();
  var b = priceFor(g, freq, P),
    raw = b.price * (1 + pct / 100);
  return {
    base: b.price,
    atMin: b.atMin,
    quote: pct > 0 ? ceilStep(raw, P.step) : b.price,
    web: ceilStep(raw * (1 + P.adderp / 100), P.step)
  };
}
function calcWidget(use) {
  var box = el("div", "calcbox"),
    P = pricing();
  var basis = fld("Square feet of", "select", "grass", [
      ["grass", "Grass only (mowed area)"],
      ["lot", "Whole property (grass is about " + Math.round(P.grass) + "%)"]
    ]),
    sq = fld("Square feet", "number", "");
  sq.input.inputMode = "numeric";
  sq.input.min = "0";
  box.appendChild(basis);
  box.appendChild(sq);
  var opts = el("div"),
    checks = [];
  P.options
    .filter(function (o) {
      return o.on;
    })
    .forEach(function (o) {
      var l = document.createElement("label");
      l.style.cssText = "display:flex;gap:8px;align-items:center;margin:6px 0;font-weight:400";
      var c = document.createElement("input");
      c.type = "checkbox";
      c.style.cssText = "width:auto;margin:0";
      c.addEventListener("change", draw);
      l.appendChild(c);
      l.appendChild(document.createTextNode(o.en + " (+" + o.pct + "%)"));
      opts.appendChild(l);
      checks.push([c, o]);
    });
  if (checks.length) {
    var oh = el("div", "note", "Options (each adds a percentage of the base price)");
    oh.style.marginTop = "10px";
    box.appendChild(oh);
    box.appendChild(opts);
  }
  var out = el("div", "calcout");
  box.appendChild(out);
  function draw() {
    out.textContent = "";
    P = pricing();
    var n = parseFloat(sq.input.value);
    if (!(n > 0)) {
      out.appendChild(el("div", "note", "Enter the square footage to see a rough price."));
      return;
    }
    var g = basis.input.value === "lot" ? (n * P.grass) / 100 : n,
      gr = Math.round(g),
      sel = checks
        .filter(function (x) {
          return x[0].checked;
        })
        .map(function (x) {
          return x[1];
        }),
      pct = sel.reduce(function (t, o) {
        return t + o.pct;
      }, 0);
    if (basis.input.value === "lot")
      out.appendChild(el("div", "note", "About " + gr.toLocaleString("en-US") + " sq ft of grass."));
    var row = el("div", "calcrow");
    [
      ["weekly", "Weekly"],
      ["biweekly", "Bi-weekly"]
    ].forEach(function (f) {
      var r = quoteFor(g, f[0], pct, P),
        q = r.quote,
        c = el("div", "calccard"),
        b = el("div", "calcbig", "$" + q);
      c.appendChild(el("div", "note", f[1] + " · quote price per visit"));
      c.appendChild(b);
      c.appendChild(el("div", "note", "Website shows $" + r.web + (r.atMin ? " · minimum applies" : "")));
      if (use)
        c.appendChild(
          btn("Use this price", "btn alt sm", function () {
            use(
              "Lawn maintenance, " +
                f[1].toLowerCase() +
                " (about " +
                gr.toLocaleString("en-US") +
                " sq ft of grass" +
                (sel.length
                  ? "; " +
                    sel
                      .map(function (o) {
                        return o.en.replace(/\?$/, "");
                      })
                      .join("; ")
                  : "") +
                ")",
              q
            );
          })
        );
      row.appendChild(c);
    });
    out.appendChild(row);
    out.appendChild(
      el(
        "div",
        "note",
        "A rough guide, rounded to the nearest $" +
          P.step +
          ". Adjust for hills, gates, heavy overgrowth or distance."
      )
    );
  }
  sq.input.addEventListener("input", draw);
  basis.input.addEventListener("change", draw);
  draw();
  if (isOwner()) {
    var d = document.createElement("details");
    d.style.marginTop = "14px";
    d.appendChild(el("summary", null, "Edit rates and options (owner)"));
    var F = {
      base: fld("Starting price per visit ($)", "number", P.base),
      per1000: fld("Added per 1,000 sq ft of grass ($)", "number", P.per1000),
      bi: fld("Bi-weekly costs this many times the weekly price (1.2 = 20% more)", "number", P.bi),
      minw: fld("Weekly minimum ($)", "number", P.minw),
      minb: fld("Bi-weekly minimum ($)", "number", P.minb),
      step: fld("Round to the nearest ($)", "number", P.step),
      grass: fld("Grass is about this % of a whole property", "number", P.grass),
      adderp: fld(
        "Website estimate is this many % higher than the quote price (rounded up)",
        "number",
        P.adderp
      ),
      taperAt: fld("Bigger lawns: the rate drops after this many sq ft of grass", "number", P.taperAt),
      taper: fld(
        "...each extra 1,000 sq ft after that costs this % of the normal rate (100 = no drop)",
        "number",
        P.taper
      ),
      maxg: fld("Website asks for a custom quote above this many sq ft of grass", "number", P.maxg),
      show: fld("Show the calculator on the website", "select", P.show ? "1" : "0", [
        ["1", "Yes"],
        ["0", "No"]
      ])
    };
    Object.keys(F).forEach(function (k) {
      F[k].input.step = "any";
      d.appendChild(F[k]);
    });
    var oh2 = el("h3", null, "Options");
    oh2.style.marginTop = "14px";
    d.appendChild(oh2);
    d.appendChild(
      el(
        "p",
        "note",
        "Each checked option adds a percentage of the base price per visit, rounded up to the next $5, so it scales with bigger lawns. Spanish is what Spanish-speaking visitors see."
      )
    );
    var orow = el("div");
    d.appendChild(orow);
    var rows = [];
    function addOpt(o) {
      var r = el("div", "calcopt");
      r.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:8px;margin:8px 0";
      var en = fld("Question (English)", "text", o.en),
        es = fld("Question (Spanish)", "text", o.es),
        am = fld("Adds (% of the base price)", "number", o.pct),
        on = document.createElement("label");
      on.style.cssText = "display:flex;gap:8px;align-items:center;margin:6px 0";
      var ck = document.createElement("input");
      ck.type = "checkbox";
      ck.checked = !!o.on;
      ck.style.cssText = "width:auto;margin:0";
      on.appendChild(ck);
      on.appendChild(document.createTextNode("Show this option"));
      var rm = btn("Remove", "btn danger sm", function () {
        r.remove();
        rows = rows.filter(function (x) {
          return x.r !== r;
        });
      });
      r.appendChild(en);
      r.appendChild(es);
      r.appendChild(am);
      r.appendChild(on);
      r.appendChild(rm);
      orow.appendChild(r);
      rows.push({ r: r, id: o.id, en: en, es: es, am: am, ck: ck });
    }
    P.options.forEach(addOpt);
    d.appendChild(
      btn("+ Add option", "btn alt sm", function () {
        addOpt({ id: "o" + Date.now().toString(36), en: "", es: "", pct: 12.5, on: 1 });
      })
    );
    var sv = btn("Save rates and options", "btn", function () {
      var o = {};
      for (var k in F) {
        var v = parseFloat(F[k].input.value);
        if (isNaN(v) || v < 0) {
          alert("Every rate needs a number, zero or more.");
          return;
        }
        o[k] = v;
      }
      o.options = rows
        .map(function (x) {
          return {
            id: x.id,
            en: x.en.input.value.trim(),
            es: x.es.input.value.trim(),
            pct: parseFloat(x.am.input.value) || 0,
            on: x.ck.checked ? 1 : 0
          };
        })
        .filter(function (x) {
          return x.en;
        });
      var q =
        biz && biz.id
          ? sb.from("business").update({ pricing: o }).eq("id", biz.id)
          : sb.from("business").upsert({ id: 1, pricing: o });
      q.select().then(function (r) {
        var row = r.data && (Array.isArray(r.data) ? r.data[0] : r.data);
        if (r.error || !row) {
          alert("Could not save. Run the Stage 15 SQL in Supabase first.");
          return;
        }
        biz = row;
        closeDetail();
        render();
        alert("Saved. The website uses these within a minute or two.");
      });
    });
    sv.style.marginTop = "12px";
    d.appendChild(sv);
    box.appendChild(d);
  }
  return box;
}
function openCalc() {
  var p = panel();
  p.appendChild(el("h2", null, "Lawn price calculator"));
  p.appendChild(
    el(
      "p",
      "note",
      "Your quote price per visit for lawn maintenance, from the size of the lawn and any options. The website shows a slightly higher estimate (a % cushion), so a custom quote can come in a little lower. You can also use this inside a new estimate."
    )
  );
  p.appendChild(calcWidget(null));
}
function openEstimateForm(cid) {
  if (estErr) {
    alert("Run the Stage 11 SQL in Supabase first, then press Refresh.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "New quote or estimate"));
  var qe = qeChoice("quote");
  p.appendChild(qe);
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
  var ttl = fld("Job Title", "text", ""),
    scp = fld("Notes & Terms", "textarea", ""),
    vd = fld("Valid for (days)", "number", "30");
  vd.classList.add("short");
  p.appendChild(cs);
  // which property the work is for (shows as the service address on the estimate); blank = their Main address
  var pps = propPicker(cs, "Property", "Main address");
  p.appendChild(pps);
  p.appendChild(ttl);
  p.appendChild(scp);
  p.appendChild(vd);
  p.appendChild(el("h3", null, "Proposed Work"));
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
    r.appendChild(tt);
    r.appendChild(d);
    r.appendChild(q);
    r.appendChild(a);
    box.appendChild(r);
    rows.push({ el: r, t: tt, d: d, q: q, a: a });
  }
  var cd = document.createElement("details");
  cd.style.margin = "0 0 10px";
  cd.appendChild(el("summary", null, "Price calculator (lawn maintenance)"));
  cd.appendChild(
    calcWidget(function (desc, amt) {
      var t = rows.filter(blankRow)[0];
      if (!t) {
        addRow();
        t = rows[rows.length - 1];
      }
      t.d.input.value = desc;
      t.a.input.value = String(amt);
      syncRows();
      cd.open = false;
    })
  );
  p.appendChild(cd);
  p.appendChild(box);
  addRow();
  function linesSub() {
    return r2(
      rows.reduce(function (s2, x) {
        var v = parseFloat(x.a.input.value);
        return s2 + (isNaN(v) ? 0 : v);
      }, 0)
    );
  }
  var adj = adjEditor([], linesSub),
    dep = depEditor(null, function () {
      return estTotal(linesSub(), adj.value());
    });
  adj.el.appendChild(dep.el);
  adj.el.addEventListener("input", function () {
    setTimeout(dep.refresh, 0);
  });
  p.appendChild(adj.el);
  var go = btn("Save", "btn", function () {
    if (!cs.input.value) {
      alert("Choose a client.");
      return;
    }
    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var tt = rows[i].t.input.value.trim(),
        d = rows[i].d.input.value.trim(),
        q = rows[i].q.input.value.trim(),
        a = parseFloat(rows[i].a.input.value);
      if (!tt && !d && !q && isNaN(a)) continue;
      if ((!tt && !d) || isNaN(a)) {
        alert("Each line needs a title or description, and a total.");
        return;
      }
      items.push({ title: tt, description: d, qty: q, amount: a });
    }
    if (!items.length) {
      alert("Add at least one line.");
      return;
    }
    var days = parseInt(vd.input.value, 10),
      adjs = adj.value(),
      total = estTotal(
        r2(
          items.reduce(function (s2, x) {
            return s2 + x.amount;
          }, 0)
        ),
        adjs
      );
    go.disabled = true;
    var pid = pps.input.value || null,
      erow = {
        client_id: cs.input.value,
        title: ttl.input.value.trim(),
        scope: scp.input.value.trim(),
        valid_until: days > 0 ? addDays(today(), days) : null,
        total: total
      };
    if (pid) erow.property_id = pid;
    if (adjs.length) erow.adjustments = adjs;
    if (dep.value()) erow.deposit = dep.value();
    erow.doc_type = qe.value();
    sb.from("estimates")
      .insert(erow)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          go.disabled = false;
          alert(erow.deposit ? "Could not save. Did you run the Stage 36 SQL?" : erow.doc_type ? "Could not save. Did you run the Stage 34 SQL?" : adjs.length ? "Could not save. Did you run the Stage 33 SQL?" : pid ? "Could not save. Did you run the Stage 31 SQL?" : "Could not save. Did you run the Stage 11 SQL?");
          return;
        }
        var e = r.data;
        items.forEach(function (x) {
          x.estimate_id = e.id;
        });
        sb.from("estimate_items")
          .insert(items)
          .then(function (r2_) {
            if (r2_.error) {
              sb.from("estimates")
                .delete()
                .eq("id", e.id)
                .then(function () {
                  go.disabled = false;
                  alert("Could not save the lines. Did you run the Stage 33 SQL?");
                });
              return;
            }
            estimates.unshift(e);
            render();
            openEstimate(e.id);
          });
      });
  });
  go.style.marginTop = "14px";
  p.appendChild(go);

  // live preview of the estimate the client will get
  var show = livePreview(p);
  function draft() {
    var c = byId(clients, cs.input.value),
      days = parseInt(vd.input.value, 10),
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
      items.push({ title: tt, description: d, qty: q, amount: a });
    });
    adj.refresh();
    dep.refresh();
    show({
      kind: "estimate",
      doc: {
        number: lpNextNumber(estimates),
        title: ttl.input.value.trim(),
        scope: scp.input.value.trim(),
        issue_date: today(),
        valid_until: days > 0 ? addDays(today(), days) : null,
        status: "draft",
        total: estTotal(r2(total), adj.value()),
        adjustments: adj.value(),
        deposit: dep.value(),
        doc_type: qe.value(),
        property_address: pps.input.value ? paddr(pps.input.value) : c ? lpMainAddress(c.id) : ""
      },
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
function openEstimate(id) {
  var e = byId(estimates, id);
  if (!e) return;
  markRespSeen(e);
  var c = byId(clients, e.client_id),
    p = panel();
  p.appendChild(el("h2", null, estNum(e.number, e.doc_type) + " · " + cname(e.client_id)));
  var st =
    e.status === "accepted"
      ? "Accepted"
      : e.status === "declined"
        ? "Declined"
        : estExpired(e)
          ? "Expired"
          : e.status === "sent"
            ? "Sent"
            : "Draft";
  p.appendChild(
    el(
      "div",
      "note",
      st +
        " · issued " +
        dshort(e.issue_date) +
        (e.valid_until ? " · valid until " + dshort(e.valid_until) : "") +
        (e.sent_at ? " · sent " + dshort(String(e.sent_at).slice(0, 10)) : " · not sent yet")
    )
  );
  var body = el("div");
  body.appendChild(el("div", "note", "Loading..."));
  p.appendChild(body);
  sb.from("estimate_items")
    .select("*")
    .eq("estimate_id", e.id)
    .order("id", { ascending: true })
    .limit(500)
    .then(function (r) {
      var items = r.error ? [] : r.data || [];
      body.textContent = "";
      var edit = estOpen(e);
      if (e.status === "accepted" || e.status === "declined") {
        var ans = el(
          "div",
          "pcard",
          (e.status === "accepted" ? "✓ Accepted" : "Declined") +
            (e.response_name
              ? /^Recorded/.test(e.response_name)
                ? " (" + e.response_name.toLowerCase() + ")"
                : " by " + e.response_name
              : "") +
            (e.responded_at ? " on " + dshort(String(e.responded_at).slice(0, 10)) : "") +
            (e.response_po ? " · PO / approval # " + e.response_po : "") +
            (e.response_note ? '. Note: "' + e.response_note + '"' : "")
        );
        ans.style.fontWeight = "700";
        if (e.status === "accepted" && /^data:image\/png;base64,/.test(e.response_signature || "")) {
          var sg = document.createElement("img");
          sg.src = e.response_signature;
          sg.alt = "Client signature";
          sg.style.cssText = "display:block;height:60px;width:auto;margin-top:8px;border-bottom:1.5px solid #1d2a20";
          ans.appendChild(sg);
        }
        body.appendChild(ans);
      }
      var ttl = fld("Job Title", "text", e.title || ""),
        scp = fld("Notes & Terms", "textarea", e.scope || ""),
        vu = fld("Valid until", "date", e.valid_until || ""),
        eps = clientProps(e.client_id),
        pf = fld(
          "Property",
          "select",
          e.property_id || "",
          [["", "Main address"]].concat(
            eps.map(function (x) {
              return [x.id, (x.label ? x.label + " \u00b7 " : "") + x.address];
            })
          )
        );
      var isub = r2(
          items.reduce(function (s2, x) {
            return s2 + Number(x.amount || 0);
          }, 0)
        ),
        eadj = adjEditor(e.adjustments || [], function () {
          return isub;
        }),
        edep = depEditor(e.deposit, function () {
          return estTotal(isub, eadj.value());
        });
      eadj.el.appendChild(edep.el);
      eadj.el.addEventListener("input", function () {
        setTimeout(edep.refresh, 0);
      });
      if (edit) {
        var eqe = qeChoice(e.doc_type);
        body.appendChild(eqe);
        if (eps.length > 1 || e.property_id) body.appendChild(pf);
        body.appendChild(ttl);
        body.appendChild(scp);
        body.appendChild(vu);
        body.appendChild(eadj.el);
        var sv = btn("Save details", "btn alt sm", function () {
          var row = {
            title: ttl.input.value.trim(),
            scope: scp.input.value.trim(),
            valid_until: vu.input.value || null
          };
          if (eqe.value() !== (e.doc_type || "quote")) row.doc_type = eqe.value();
          var na = eadj.value();
          if (JSON.stringify(na) !== JSON.stringify(e.adjustments || [])) {
            row.adjustments = na;
            row.total = estTotal(isub, na);
          }
          if ((pf.input.value || null) !== (e.property_id || null)) row.property_id = pf.input.value || null;
          var nd = edep.value();
          if (JSON.stringify(nd) !== JSON.stringify(e.deposit || null)) row.deposit = nd;
          sb.from("estimates")
            .update(row)
            .eq("id", e.id)
            .then(function (r2_) {
              if (r2_.error) {
                alert(
                  "deposit" in row
                    ? "Could not save. Did you run the Stage 36 SQL?"
                    : "doc_type" in row
                    ? "Could not save. Did you run the Stage 34 SQL?"
                    : "adjustments" in row
                    ? "Could not save. Did you run the Stage 33 SQL?"
                    : "property_id" in row
                      ? "Could not save. Did you run the Stage 31 SQL?"
                      : "Could not save."
                );
                return;
              }
              if ("property_id" in row) e.property_id = row.property_id;
              if ("deposit" in row) e.deposit = row.deposit;
              if ("doc_type" in row) {
                e.doc_type = row.doc_type;
                if (!("adjustments" in row)) {
                  openEstimate(e.id);
                  return;
                }
              }
              if ("adjustments" in row) {
                e.adjustments = row.adjustments;
                e.total = row.total;
                openEstimate(e.id);
                return;
              }
              e.title = row.title;
              e.scope = row.scope;
              e.valid_until = row.valid_until;
              sv.textContent = "Saved";
              render();
              setTimeout(function () {
                sv.textContent = "Save details";
              }, 1200);
            });
        });
        sv.style.marginBottom = "10px";
        body.appendChild(sv);
      } else {
        body.appendChild(el("div", "note", estWord(e, true) + (e.doc_type === "estimate" ? " (price may change)" : " (fixed price)")));
        if (e.property_id && paddr(e.property_id)) body.appendChild(el("div", "note", "Property: " + paddr(e.property_id)));
        if (e.title) body.appendChild(el("b", null, e.title));
        if (e.scope) {
          var sc = el("div", "note", e.scope);
          sc.style.whiteSpace = "pre-wrap";
          body.appendChild(sc);
        }
      }
      var t = document.createElement("table");
      t.className = "itable";
      items.forEach(function (it) {
        var tr = document.createElement("tr");
        tr.appendChild(el("td", "ttl", it.title || ""));
        tr.appendChild(el("td", null, it.description));
        tr.appendChild(el("td", "qty", it.qty ? "× " + it.qty : ""));
        tr.appendChild(el("td", "amt", money(it.amount)));
        if (edit && items.length > 1) {
          var x = el("td");
          var rm = btn("×", "link", function () {
            sb.from("estimate_items")
              .delete()
              .eq("id", it.id)
              .then(function (r2_) {
                if (r2_.error) {
                  alert("Could not remove the line.");
                  return;
                }
                setEstTotal(e, estTotal(r2(isub - Number(it.amount)), e.adjustments), function () {
                  openEstimate(e.id);
                });
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
      var ac = estAdjCalc(isub, e.adjustments);
      if (ac.rows.length)
        body.appendChild(
          el(
            "div",
            "note",
            "Subtotal " +
              money(isub) +
              ac.rows
                .map(function (x) {
                  return " · " + adjName(x) + " " + (x.kind === "discount" ? "−" : "") + money(x.amt);
                })
                .join("")
          )
        );
      body.appendChild(el("div", "invtotal", "Total " + money(e.total)));
      var da = depAmount(e.deposit, Number(e.total));
      if (da > 0)
        body.appendChild(
          el("div", "note", "Deposit required " + money(da) + " · balance on completion " + money(r2(Number(e.total) - da)))
        );
      if (edit) {
        var add = el("div", "pcard"),
          g = el("div", "grid4"),
          ttl = fld("Add a line: title", "text", ""),
          dsc = fld("Description", "text", ""),
          qy = fld("QTY", "text", ""),
          amt = fld("Total ($)", "number", "");
        amt.input.step = "0.01";
        amt.input.inputMode = "decimal";
        g.appendChild(ttl);
        g.appendChild(dsc);
        g.appendChild(qy);
        g.appendChild(amt);
        add.appendChild(g);
        var ab = btn("Add line", "btn alt sm", function () {
          var a2 = parseFloat(amt.input.value);
          if ((!ttl.input.value.trim() && !dsc.input.value.trim()) || isNaN(a2)) {
            alert("Enter a title or description, and a total.");
            return;
          }
          var line = { estimate_id: e.id, description: dsc.input.value.trim(), amount: a2 };
          if (ttl.input.value.trim()) line.title = ttl.input.value.trim();
          if (qy.input.value.trim()) line.qty = qy.input.value.trim();
          sb.from("estimate_items")
            .insert(line)
            .then(function (r2_) {
              if (r2_.error) {
                alert(line.title || line.qty ? "Could not add the line. Did you run the Stage 33 SQL?" : "Could not add the line.");
                return;
              }
              setEstTotal(e, estTotal(r2(isub + a2), e.adjustments), function () {
                openEstimate(e.id);
              });
            });
        });
        ab.style.marginTop = "8px";
        add.appendChild(ab);
        body.appendChild(add);
      }
      var acts = el("div", "contact");
      acts.style.marginTop = "14px";
      var msg = estMessage(e, c);
      if (c && c.email) {
        var a2 = el("a", "btn", "Email " + estWord(e));
        a2.href = mailHref(
          c.email,
          estWord(e, true) + " " + estNum(e.number, e.doc_type) + " from " + bizv("name", "Latta Corp"),
          msg
        );
        a2.addEventListener("click", function () {
          markEstSent(e);
        });
        acts.appendChild(a2);
      }
      acts.appendChild(
        copyBtn("Copy message", msg, false, function () {
          markEstSent(e);
        })
      );
      acts.appendChild(
        copyBtn("Copy link", docUrl(e.share_token), false, function () {
          markEstSent(e);
        })
      );
      if (isOwner() && c && c.phone) {
        var a1 = el("a", "btn alt", "Text");
        a1.href = smsHref(c.phone, msg);
        a1.addEventListener("click", function () {
          markEstSent(e);
        });
        acts.appendChild(a1);
      }
      var pv = el("a", "btn alt", "Preview / Print");
      pv.href = docUrl(e.share_token, true);
      pv.target = "_blank";
      pv.rel = "noopener";
      acts.appendChild(pv);
      body.appendChild(acts);
      if (e.viewed_at)
        body.appendChild(el("div", "note", "✓ Client opened the link " + ago(e.viewed_at) + "."));
      else if (e.sent_at) body.appendChild(el("div", "note", "The client hasn't opened the link yet."));
      var dz = el("div", "actions");
      dz.style.marginTop = "14px";
      function setStatus(s2, extra) {
        var row = { status: s2 };
        Object.keys(extra || {}).forEach(function (k) {
          row[k] = extra[k];
        });
        sb.from("estimates")
          .update(row)
          .eq("id", e.id)
          .then(function (r2_) {
            if (r2_.error) {
              alert("Could not save.");
              return;
            }
            Object.keys(row).forEach(function (k) {
              e[k] = row[k];
            });
            render();
            openEstimate(e.id);
          });
      }
      if (edit) {
        var sp = el("span");
        sp.appendChild(
          btn("Client said yes", "btn alt sm", function () {
            setStatus("accepted", {
              responded_at: new Date().toISOString(),
              response_name: "Recorded by our team"
            });
          })
        );
        sp.appendChild(document.createTextNode(" "));
        sp.appendChild(
          btn("Client said no", "btn alt sm", function () {
            setStatus("declined", {
              responded_at: new Date().toISOString(),
              response_name: "Recorded by our team"
            });
          })
        );
        dz.appendChild(sp);
      } else
        dz.appendChild(
          btn("Reopen", "btn alt sm", function () {
            setStatus("sent", { responded_at: null, response_name: "", response_note: "" });
          })
        );
      dz.appendChild(
        btn("Delete", "btn danger", function () {
          if (!confirm("Delete this estimate for good? Its link stops working.")) return;
          sb.from("estimates")
            .delete()
            .eq("id", e.id)
            .then(function (r2_) {
              if (r2_.error) {
                alert("Could not delete.");
                return;
              }
              estimates = estimates.filter(function (z) {
                return z.id !== e.id;
              });
              closeDetail();
              render();
            });
        })
      );
      body.appendChild(dz);
      if (e.status === "accepted")
        body.appendChild(
          el("div", "note", "Next: add the work under Jobs for this client so it lands on the schedule.")
        );
    });
}
/* ---- Quote or Estimate: picked on the form, with a "?" beside each that tells office staff which to use. */
var QE_HELP = {
  quote:
    "<b>Use a Quote when the price is fixed.</b>You know the whole job and stand behind the number: lawn and HOA maintenance contracts, mulch, pine straw, hedge trimming, shrub or plant removal, measured sod, seasonal cleanups. Once the client signs, that is the price they pay.",
  estimate:
    "<b>Use an Estimate when the final cost depends on what we find.</b>Tree or stump removal with unknown roots, drainage, grading, irrigation repairs, storm cleanup, or work you haven't fully seen yet. The client's copy says the final price may change, and we contact them before any change."
};
function qeChoice(val) {
  var w = el("div", "qe"),
    cur = val === "estimate" ? "estimate" : "quote",
    help = el("div", "qhelp pop"),
    shown = "";
  help.hidden = true;
  w.appendChild(el("span", null, "Quote or Estimate?"));
  var opts = el("div", "opts"),
    labels = {};
  ["quote", "estimate"].forEach(function (k) {
    var l = el("label", "o"),
      r = document.createElement("input");
    r.type = "radio";
    r.name = "qe" + Math.random().toString(36).slice(2, 7);
    r.checked = k === cur;
    r.addEventListener("change", function () {
      cur = k;
      paint();
      w.dispatchEvent(new Event("change", { bubbles: true }));
    });
    l.appendChild(r);
    var tx = el("span", "t");
    tx.appendChild(el("b", null, k === "quote" ? "Quote" : "Estimate"));
    tx.appendChild(el("small", null, k === "quote" ? "Fixed price" : "Price may change"));
    l.appendChild(tx);
    var q = el("button", "qtip", "?");
    q.type = "button";
    q.setAttribute("aria-label", "When to use a " + k);
    // the explanation pops up over the form while you point at (or tap) the "?"; nothing moves
    function show(on) {
      shown = on ? k : "";
      help.innerHTML = on ? QE_HELP[k] : "";
      help.hidden = !on;
    }
    q.addEventListener("mouseenter", function () {
      show(true);
    });
    q.addEventListener("mouseleave", function () {
      show(false);
    });
    q.addEventListener("focus", function () {
      show(true);
    });
    q.addEventListener("blur", function () {
      show(false);
    });
    q.addEventListener("click", function (ev) {
      ev.preventDefault();
      show(shown !== k);
    });
    l.appendChild(q);
    opts.appendChild(l);
    labels[k] = l;
    l.radio = r;
  });
  // keep all radios of this picker in one group
  labels.estimate.radio.name = labels.quote.radio.name;
  function paint() {
    labels.quote.className = "o" + (cur === "quote" ? " on" : "");
    labels.estimate.className = "o" + (cur === "estimate" ? " on" : "");
  }
  paint();
  w.appendChild(opts);
  w.appendChild(help);
  w.value = function () {
    return cur;
  };
  return w;
}

/* ---- Estimate Summary: one optional row (Discount or Fee, a % of the subtotal), then Sales tax, which is always there
   and is figured on everything above it (so a discount lowers the tax). Same rules as the client's page (d/index.html).
   Type a % or a dollar amount; the other fills in. Whichever was typed last is kept, so a % follows line changes. */
var ADJ_NAMES = {
  discount: "Discount",
  trip: "Trip charge",
  disposal: "Disposal fee",
  permit: "Permit fee",
  rush: "Rush fee",
  other: "Other",
  fee: "Fee",
  tax: "Sales tax"
};
// what the optional row can be; "fee" is only kept for quotes saved before these choices existed
var OPT_KINDS = ["discount", "trip", "disposal", "permit", "rush", "other", "fee"];
function adjName(x) {
  return x.kind === "other" ? x.label || "Other" : ADJ_NAMES[x.kind] || "";
}
// reads "5", "5%", "$1,250.50" the same way
function numv(v) {
  var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? NaN : n;
}
function estAdjCalc(sub, list) {
  list = Array.isArray(list) ? list : [];
  var o = list.filter(function (a) {
      return a && OPT_KINDS.indexOf(a.kind) > -1;
    })[0],
    x = list.filter(function (a) {
      return a && a.kind === "tax";
    })[0];
  function one(a, base) {
    var pct = Number(a.pct),
      amt = Number(a.amt);
    if (a.mode === "pct" && !isNaN(pct)) amt = Math.round(base * pct) / 100;
    else {
      amt = isNaN(amt) ? 0 : amt;
      pct = base ? (amt / base) * 100 : 0;
    }
    return { kind: a.kind, label: a.label || "", pct: pct, amt: amt };
  }
  var opt = o ? one(o, sub) : null,
    run = sub + (opt ? (opt.kind === "discount" ? -opt.amt : opt.amt) : 0),
    tax = x ? one(x, run) : null;
  return { opt: opt, tax: tax, rows: [opt, tax].filter(Boolean), total: r2(run + (tax ? tax.amt : 0)) };
}
function estTotal(sub, list) {
  return estAdjCalc(sub, list).total;
}
function adjEditor(list, getSub) {
  list = Array.isArray(list) ? list : [];
  var box = el("div", "adjbox");
  box.appendChild(el("b", null, "Summary: optional row, sales tax and deposit"));
  box.appendChild(
    el("div", "note", "Type a % or a dollar amount and the other fills in. Sales tax is figured on everything above it.")
  );
  function slot(a, isTax) {
    a = a || {};
    var opts = [
      ["", "None (blank row)"],
      ["discount", "Discount"],
      ["trip", "Trip charge"],
      ["disposal", "Disposal fee"],
      ["permit", "Permit fee"],
      ["rush", "Rush fee"],
      ["other", "Other (type your own)"]
    ];
    if (a.kind === "fee") opts.push(["fee", "Fee"]);
    var r = el("div", "grid3"),
      cell = el("div"),
      k = isTax ? el("label", "f fixed") : fld("Optional row", "select", a.kind || "", opts),
      ot = document.createElement("input"),
      pc = fld("%", "text", a.mode === "pct" && a.pct != null ? String(a.pct) : ""),
      am = fld("Amount ($)", "text", a.kind && a.mode !== "pct" && a.amt != null ? String(a.amt) : "");
    pc.input.inputMode = am.input.inputMode = "decimal";
    pc.input.autocomplete = am.input.autocomplete = "off";
    pc.input.classList.add("ofs");
    am.input.classList.add("ofs");
    if (isTax) {
      // a plain label the same height as the boxes beside it, text centered both ways
      k.appendChild(el("span", null, "\u00a0"));
      k.box = el("div", "fxbox", "Sales tax");
      k.appendChild(k.box);
    } else {
      // "Other": the same box turns into a text box for the name the client sees
      ot.type = "text";
      ot.maxLength = 40;
      ot.placeholder = "Type a name, e.g. Irrigation check";
      ot.value = a.kind === "other" ? a.label || "" : "";
      ot.hidden = a.kind !== "other";
      k.input.hidden = a.kind === "other";
      k.appendChild(ot);
      k.input.addEventListener("change", function () {
        if (k.input.value === "other") {
          k.input.hidden = true;
          ot.hidden = false;
          ot.focus();
        }
      });
      ot.addEventListener("blur", function () {
        if (!ot.value.trim()) {
          ot.hidden = true;
          k.input.hidden = false;
          k.input.value = "";
          refresh();
        }
      });
      ot.addEventListener("input", refresh);
    }
    cell.appendChild(k);
    r.appendChild(cell);
    r.appendChild(pc);
    r.appendChild(am);
    box.appendChild(r);
    var s = { tax: isTax, k: k, ot: ot, pc: pc, am: am, mode: a.mode === "pct" ? "pct" : "amt" };
    s.kind = function () {
      return isTax ? (pc.input.value.trim() !== "" || am.input.value.trim() !== "" ? "tax" : "") : k.input.value;
    };
    // recalculate on every keystroke, paste or change
    ["input", "change", "keyup"].forEach(function (ev) {
      pc.input.addEventListener(ev, function () {
        s.mode = "pct";
        refresh();
      });
      am.input.addEventListener(ev, function () {
        s.mode = "amt";
        refresh();
      });
    });
    am.input.addEventListener("blur", function () {
      var v = numv(am.input.value);
      if (!isNaN(v)) am.input.value = v.toFixed(2);
    });
    pc.input.addEventListener("blur", function () {
      var v = numv(pc.input.value);
      if (!isNaN(v)) pc.input.value = String(Math.round(v * 100) / 100);
    });
    if (!isTax) k.input.addEventListener("change", refresh);
    return s;
  }
  var slots = [
    slot(
      list.filter(function (a) {
        return a && OPT_KINDS.indexOf(a.kind) > -1;
      })[0],
      false
    ),
    slot(
      list.filter(function (a) {
        return a && a.kind === "tax";
      })[0],
      true
    )
  ];
  function raw() {
    return slots
      .filter(function (s) {
        return s.kind();
      })
      .map(function (s) {
        var v = numv(s.mode === "pct" ? s.pc.input.value : s.am.input.value),
          o = s.mode === "pct" ? { kind: s.kind(), mode: "pct", pct: isNaN(v) ? 0 : v } : { kind: s.kind(), mode: "amt", amt: isNaN(v) ? 0 : r2(v) };
        if (o.kind === "other") o.label = s.ot.value.trim();
        return o;
      });
  }
  function refresh() {
    var c = estAdjCalc(getSub(), raw());
    slots.forEach(function (s) {
      var on = s.tax || !!s.k.input.value;
      // the boxes always stay; they wait (greyed) until a choice is picked
      s.pc.input.disabled = s.am.input.disabled = !on;
      if (s.tax && s.pc.input.offsetHeight) s.k.box.style.height = s.pc.input.offsetHeight + "px";
      var x = s.tax ? c.tax : c.opt;
      if (!x) return;
      if (s.mode === "pct" && document.activeElement !== s.am.input) s.am.input.value = x.amt.toFixed(2);
      if (s.mode === "amt" && document.activeElement !== s.pc.input)
        s.pc.input.value = s.am.input.value.trim() === "" ? "" : String(Math.round(x.pct * 100) / 100);
    });
  }
  refresh();
  return {
    el: box,
    refresh: refresh,
    value: function () {
      // store both numbers so the client page and lists never have to guess
      var c = estAdjCalc(getSub(), raw());
      return raw().map(function (a) {
        var x = a.kind === "tax" ? c.tax : c.opt,
          o = { kind: a.kind, mode: a.mode, pct: Math.round(x.pct * 100) / 100, amt: x.amt };
        if (a.kind === "other") o.label = a.label || "";
        return o;
      });
    }
  };
}
/* ---- Required deposit: a % of the quoted total or a set amount; shown under the total on the client's copy.
   It does not change the total. Whichever box was typed in last is kept, so a % follows price changes. */
function depAmount(dep, total) {
  if (!dep || !(dep.pct || dep.amt)) return 0;
  return dep.mode === "pct" ? Math.round(total * Number(dep.pct || 0)) / 100 : r2(Number(dep.amt || 0));
}
function depEditor(dep, getTotal) {
  dep = dep || {};
  var r = el("div", "grid3 deprow"),
    k = el("label", "f fixed"),
    pc = fld("%", "text", dep.mode === "pct" && dep.pct ? String(dep.pct) : ""),
    am = fld("Amount ($)", "text", dep.mode !== "pct" && dep.amt ? String(dep.amt) : ""),
    mode = dep.mode === "pct" ? "pct" : "amt";
  k.appendChild(el("span", null, "\u00a0"));
  k.box = el("div", "fxbox", "Deposit required");
  k.appendChild(k.box);
  pc.input.inputMode = am.input.inputMode = "decimal";
  pc.input.autocomplete = am.input.autocomplete = "off";
  pc.input.placeholder = "0";
  am.input.placeholder = "0.00";
  r.appendChild(k);
  r.appendChild(pc);
  r.appendChild(am);
  function val() {
    var v = numv(mode === "pct" ? pc.input.value : am.input.value);
    if (isNaN(v) || v <= 0) return null;
    return mode === "pct" ? { mode: "pct", pct: v } : { mode: "amt", amt: r2(v) };
  }
  function refresh() {
    var t = getTotal(),
      v = val();
    if (pc.input.offsetHeight) k.box.style.height = pc.input.offsetHeight + "px";
    if (!v) {
      if (mode === "pct" && document.activeElement !== am.input) am.input.value = "";
      if (mode === "amt" && document.activeElement !== pc.input) pc.input.value = "";
      return;
    }
    var a = depAmount(v, t);
    if (mode === "pct" && document.activeElement !== am.input) am.input.value = a.toFixed(2);
    if (mode === "amt" && document.activeElement !== pc.input) pc.input.value = t ? String(Math.round((a / t) * 10000) / 100) : "";
  }
  ["input", "change", "keyup"].forEach(function (ev) {
    pc.input.addEventListener(ev, function () {
      mode = "pct";
      refresh();
    });
    am.input.addEventListener(ev, function () {
      mode = "amt";
      refresh();
    });
  });
  setTimeout(refresh, 0);
  return {
    el: r,
    refresh: refresh,
    value: function () {
      var v = val();
      if (!v) return null;
      var t = getTotal(),
        a = depAmount(v, t);
      return { mode: v.mode, pct: v.mode === "pct" ? v.pct : t ? Math.round((a / t) * 10000) / 100 : 0, amt: a };
    }
  };
}
function setEstTotal(e, total, cb) {
  sb.from("estimates")
    .update({ total: total })
    .eq("id", e.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not update the total.");
        return;
      }
      e.total = total;
      render();
      cb();
    });
}
