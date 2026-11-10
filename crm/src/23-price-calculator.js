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
  p.appendChild(el("h2", null, "New estimate"));
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
  var ttl = fld("Job Title (shows under ESTIMATE / QUOTE, for example: Spring cleanup and mulch)", "text", ""),
    scp = fld("Details the client will see (optional)", "textarea", ""),
    vd = fld("Valid for (days)", "number", "30");
  p.appendChild(cs);
  // which property the work is for (shows as the service address on the estimate); blank = their Main address
  var pps = propPicker(cs, "Property (which property this estimate is for)", "Main address");
  p.appendChild(pps);
  p.appendChild(ttl);
  p.appendChild(scp);
  p.appendChild(vd);
  p.appendChild(el("h3", null, "Lines"));
  var box = el("div"),
    rows = [];
  function addRow() {
    var r = el("div", "grid3"),
      tt = fld("Title", "text", ""),
      d = fld("Description", "text", ""),
      a = fld("Total ($)", "number", "");
    a.input.step = "0.01";
    a.input.inputMode = "decimal";
    r.appendChild(tt);
    r.appendChild(d);
    r.appendChild(a);
    box.appendChild(r);
    rows.push({ t: tt, d: d, a: a });
  }
  var cd = document.createElement("details");
  cd.style.margin = "0 0 10px";
  cd.appendChild(el("summary", null, "Price calculator (lawn maintenance)"));
  cd.appendChild(
    calcWidget(function (desc, amt) {
      var t = rows.filter(function (x) {
        return !x.t.input.value.trim() && !x.d.input.value.trim() && x.a.input.value === "";
      })[0];
      if (!t) {
        addRow();
        t = rows[rows.length - 1];
      }
      t.d.input.value = desc;
      t.a.input.value = String(amt);
      cd.open = false;
    })
  );
  p.appendChild(cd);
  p.appendChild(box);
  addRow();
  var more = btn("+ Add another line", "btn alt sm", addRow);
  p.appendChild(more);
  var go = btn("Save estimate", "btn", function () {
    if (!cs.input.value) {
      alert("Choose a client.");
      return;
    }
    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var tt = rows[i].t.input.value.trim(),
        d = rows[i].d.input.value.trim(),
        a = parseFloat(rows[i].a.input.value);
      if (!tt && !d && isNaN(a)) continue;
      if ((!tt && !d) || isNaN(a)) {
        alert("Each line needs a title or description, and a total.");
        return;
      }
      items.push({ title: tt, description: d, amount: a });
    }
    if (!items.length) {
      alert("Add at least one line.");
      return;
    }
    var days = parseInt(vd.input.value, 10),
      total = r2(
        items.reduce(function (s2, x) {
          return s2 + x.amount;
        }, 0)
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
    sb.from("estimates")
      .insert(erow)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          go.disabled = false;
          alert(pid ? "Could not save. Did you run the Stage 31 SQL?" : "Could not save. Did you run the Stage 11 SQL?");
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
                  alert("Could not save the lines. Did you run the Stage 32 SQL?");
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
        a = parseFloat(r.a.input.value);
      if (!tt && !d && isNaN(a)) return;
      a = isNaN(a) ? 0 : a;
      total += a;
      items.push({ title: tt, description: d, amount: a });
    });
    show({
      kind: "estimate",
      doc: {
        number: lpNextNumber(estimates),
        title: ttl.input.value.trim(),
        scope: scp.input.value.trim(),
        issue_date: today(),
        valid_until: days > 0 ? addDays(today(), days) : null,
        status: "draft",
        total: r2(total),
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
  var c = byId(clients, e.client_id),
    p = panel();
  p.appendChild(el("h2", null, estNum(e.number) + " · " + cname(e.client_id)));
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
        scp = fld("Details the client will see", "textarea", e.scope || ""),
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
      if (edit) {
        if (eps.length > 1 || e.property_id) body.appendChild(pf);
        body.appendChild(ttl);
        body.appendChild(scp);
        body.appendChild(vu);
        var sv = btn("Save details", "btn alt sm", function () {
          var row = {
            title: ttl.input.value.trim(),
            scope: scp.input.value.trim(),
            valid_until: vu.input.value || null
          };
          if ((pf.input.value || null) !== (e.property_id || null)) row.property_id = pf.input.value || null;
          sb.from("estimates")
            .update(row)
            .eq("id", e.id)
            .then(function (r2_) {
              if (r2_.error) {
                alert("property_id" in row ? "Could not save. Did you run the Stage 31 SQL?" : "Could not save.");
                return;
              }
              if ("property_id" in row) e.property_id = row.property_id;
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
                setEstTotal(e, r2(Number(e.total) - Number(it.amount)), function () {
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
      body.appendChild(el("div", "invtotal", "Total " + money(e.total)));
      if (edit) {
        var add = el("div", "pcard"),
          g = el("div", "grid3"),
          ttl = fld("Add a line: title", "text", ""),
          dsc = fld("Description", "text", ""),
          amt = fld("Total ($)", "number", "");
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
          var line = { estimate_id: e.id, description: dsc.input.value.trim(), amount: a2 };
          if (ttl.input.value.trim()) line.title = ttl.input.value.trim();
          sb.from("estimate_items")
            .insert(line)
            .then(function (r2_) {
              if (r2_.error) {
                alert(line.title ? "Could not add the line. Did you run the Stage 32 SQL?" : "Could not add the line.");
                return;
              }
              setEstTotal(e, r2(Number(e.total) + a2), function () {
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
        var a2 = el("a", "btn", "Email estimate");
        a2.href = mailHref(
          c.email,
          "Estimate " + estNum(e.number) + " from " + bizv("name", "Latta Corp"),
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
