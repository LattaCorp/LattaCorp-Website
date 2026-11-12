/* Jobs tab: recurring and one-time jobs, how visits are generated, job detail and form, services list, jobs and history on the client page. */

/* ======================= STAGE 2: services, jobs, visits ======================= */
var FREQ = [
  ["weekly", "Weekly"],
  ["biweekly", "Every 2 weeks"],
  ["once", "One-time"]
];

function flabel(f) {
  var x = FREQ.filter(function (a) {
    return a[0] === f;
  })[0];
  return x ? x[1] : f;
}
function needSql() {
  alert("Run the Stage 2 SQL in Supabase first (SQL Editor), then press Refresh.");
}

function loadVisits() {
  histFrom = addDays(today(), -45);
  return sb
    .from("visits")
    .select("*")
    .gte("scheduled_date", addDays(today(), -45))
    .order("scheduled_date", { ascending: true })
    .limit(5000)
    .then(function (r) {
      if (!r.error) visits = r.data || [];
    });
}
function visitDates(job) {
  var t = today(),
    end = addDays(t, 84);
  if (job.frequency === "once") return [job.start_date];
  if (job.end_date && job.end_date < end) end = job.end_date;
  var step = job.frequency === "weekly" ? 7 : 14,
    out = [],
    d = job.start_date,
    floor = addDays(t, -7);
  if (d < floor) {
    var days = Math.round((pd(floor) - pd(d)) / 86400000);
    d = addDays(d, Math.ceil(days / step) * step);
  }
  while (d <= end) {
    out.push(d);
    d = addDays(d, step);
  }
  return out;
}
function topUp() {
  if (jobsErr) return Promise.resolve(0);
  var rows = [];
  jobs.forEach(function (j) {
    if (j.status !== "active") return;
    var lastV = visits
        .filter(function (v) {
          return v.job_id === j.id;
        })
        .sort(function (a, b) {
          return a.orig_date < b.orig_date ? 1 : -1;
        })[0],
      off =
        lastV && /#R$/.test(lastV.weather_batch || "")
          ? Math.round((pd(lastV.scheduled_date) - pd(lastV.orig_date)) / 86400000)
          : 0;
    visitDates(j).forEach(function (d) {
      if (
        visits.some(function (v) {
          return v.job_id === j.id && v.orig_date === d;
        })
      )
        return;
      var row = {
        job_id: j.id,
        client_id: j.client_id,
        property_id: j.property_id,
        orig_date: d,
        scheduled_date: addDays(d, off),
        status: "scheduled",
        price: j.price
      };
      if (s3) row.crew_id = j.crew_id || null;
      rows.push(row);
    });
  });
  if (!rows.length) return Promise.resolve(0);
  return sb
    .from("visits")
    .upsert(rows, { onConflict: "job_id,orig_date", ignoreDuplicates: true })
    .then(function (r) {
      if (r.error) return 0;
      return loadVisits().then(function () {
        return rows.length;
      });
    });
}
function nextVisit(j) {
  var t = today(),
    a = visits
      .filter(function (v) {
        return v.job_id === j.id && v.status === "scheduled" && v.scheduled_date >= t;
      })
      .sort(function (x, y) {
        return x.scheduled_date < y.scheduled_date ? -1 : 1;
      });
  return a[0];
}
function cname(id) {
  var c = byId(clients, id);
  return c ? c.name : "(deleted client)";
}
function paddr(id) {
  var p = byId(props, id);
  return p ? p.address : "";
}

/* ---- Jobs list: filters and sorting ---- */
var JF = { status: ["active"], freq: [], plan: [], client: [] },
  JSORT = "name";
var JF_GROUPS = [
  ["status", "Status", [["active", "Active"], ["paused", "Paused"], ["ended", "Ended"]]],
  ["freq", "How often", [["weekly", "Weekly"], ["biweekly", "Every 2 weeks"], ["once", "One-time"]]],
  ["plan", "Plan", [["basic", "Basic"], ["plus", "Plus"], ["premier", "Premier"], ["elite", "Elite"], ["other", "Other work"]]],
  ["client", "Client", [["hoa", "HOA"], ["commercial", "Commercial"], ["residential", "Residential"]]]
];
var JSORTS = [
  ["name", "Client name (A to Z)"],
  ["name_desc", "Client name (Z to A)"],
  ["next", "Next visit (soonest first)"],
  ["price_desc", "Price (highest first)"],
  ["price", "Price (lowest first)"],
  ["plan", "Plan (Basic to Elite)"]
];
// what each job counts as, for the filters
function jobFacet(j, g) {
  if (g === "status") return j.status === "active" ? "active" : j.status === "paused" ? "paused" : "ended";
  if (g === "freq") return j.frequency;
  if (g === "plan") {
    var m = /^lawn\s*maint/i.test(j.title || "") ? (String(j.title).toLowerCase().match(/basic|plus|premier|elite/) || [""])[0] : "";
    return m || "other";
  }
  var c = byId(clients, j.client_id);
  return (c && c.type) || "residential";
}
function jobMatches(j) {
  return JF_GROUPS.every(function (g) {
    var on = JF[g[0]];
    return !on.length || on.indexOf(jobFacet(j, g[0])) > -1;
  });
}
function jobSorter() {
  var tierN = { basic: 1, plus: 2, premier: 3, elite: 4, other: 5 },
    nm = function (j) {
      return String(cname(j.client_id) || "").toLowerCase();
    },
    nv = function (j) {
      var v = nextVisit(j);
      return v ? v.scheduled_date : "9999-12-31";
    };
  return function (a, b) {
    var r = 0;
    if (JSORT === "next") r = nv(a) < nv(b) ? -1 : nv(a) > nv(b) ? 1 : 0;
    else if (JSORT === "price_desc") r = Number(b.price || 0) - Number(a.price || 0);
    else if (JSORT === "price") r = Number(a.price || 0) - Number(b.price || 0);
    else if (JSORT === "plan") r = tierN[jobFacet(a, "plan")] - tierN[jobFacet(b, "plan")];
    if (r) return r;
    r = nm(a).localeCompare(nm(b));
    return JSORT === "name_desc" ? -r : r;
  };
}
function jobsFilterBar(tabs) {
  var bar = el("div", "fbar"),
    any = JF_GROUPS.some(function (g) {
      return JF[g[0]].length;
    });
  /* A 3-column grid so the groups line up:
       Status | Client    | Sort by
       Plan   | How often | Clear all */
  var AREA = { status: "fa-st", client: "fa-cl", plan: "fa-pl", freq: "fa-fr" };
  JF_GROUPS.forEach(function (g) {
    var grp = el("div", "fgrp " + AREA[g[0]]);
    grp.appendChild(el("span", "flbl", g[1]));
    g[2].forEach(function (o) {
      var on = JF[g[0]].indexOf(o[0]) > -1,
        n = jobs.filter(function (j) {
          return jobFacet(j, g[0]) === o[0];
        }).length,
        b = el("button", "tab fpill" + (on ? " on" : ""), o[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.appendChild(el("span", null, "(" + n + ")"));
      b.addEventListener("click", function () {
        var a = JF[g[0]],
          k = a.indexOf(o[0]);
        if (k > -1) a.splice(k, 1);
        else a.push(o[0]);
        render();
      });
      grp.appendChild(b);
    });
    bar.appendChild(grp);
  });
  if (any) {
    var clr = el("button", "tab fpill fclear", "Clear all");
    clr.type = "button";
    clr.addEventListener("click", function () {
      JF_GROUPS.forEach(function (g) {
        JF[g[0]] = [];
      });
      render();
    });
    clr.classList.add("fa-cr");
    bar.appendChild(clr);
  }
  /* Sort by: top-right corner, Clear all right under it */
  var sl = el("label", "fsort fa-so");
  sl.appendChild(el("span", "flbl", "Sort by"));
  var sel = document.createElement("select");
  JSORTS.forEach(function (o) {
    var op = document.createElement("option");
    op.value = o[0];
    op.textContent = o[1];
    sel.appendChild(op);
  });
  sel.value = JSORT;
  sel.addEventListener("change", function () {
    JSORT = sel.value;
    render();
  });
  sl.appendChild(sel);
  bar.appendChild(sl);
  tabs.appendChild(bar);
}

/* How a job looks everywhere (Jobs list and Schedule): lawn tiers shade darker Basic -> Elite, other work is blue,
   HOA / Commercial accounts are tinted and named in the tag. */
function jobLook(j, clientId) {
  var title = (j && j.title) || "",
    lawn = /^lawn\s*maint/i.test(title),
    tier = lawn
      ? ((title.split(/\s+-\s+/)[1] || "").toLowerCase().match(/basic|plus|premier|elite/) || [""])[0]
      : /^hoa\b/i.test(title)
        ? "hoa"
        : /^commercial\b/i.test(title)
          ? "commercial"
          : "",
    jc = byId(clients, (j && j.client_id) || clientId),
    ctype = jc && (jc.type === "hoa" || jc.type === "commercial") ? jc.type : "",
    plan = lawn ? "Lawn maintenance" + (title.split(/\s+-\s+/)[1] ? " \u00b7 " + title.split(/\s+-\s+/)[1] : "") : title || "Visit";
  return {
    cls: "jl " + (lawn ? "lawn" : "other") + (tier ? " t-" + tier : "") + (ctype ? " ct-" + ctype : ""),
    tag: (ctype === "hoa" ? "HOA \u00b7 " : ctype === "commercial" ? "Commercial \u00b7 " : "") + plan,
    short: lawn ? (title.split(/\s+-\s+/)[1] || "Lawn") : title,
    mini: ctype
      ? (ctype === "hoa" ? "HOA \u00b7 " : "Comm. \u00b7 ") + (lawn ? title.split(/\s+-\s+/)[1] || "Lawn" : title || "Visit")
      : lawn
        ? "Lawn \u00b7 " + (title.split(/\s+-\s+/)[1] || "")
        : title || "Visit"
  };
}

/* ---- Jobs list ---- */
function renderJobs() {
  var tabs = $("tabs");
  tabs.textContent = "";
  /* Filter pills (tap to turn on, tap again to turn off; dark green shows what's on). Active is on by default; no filters = every job.
     Inside a group any match counts (Weekly OR Every 2 weeks); across groups all must match (Weekly AND Elite). */
  jobsFilterBar(tabs);
  var tb = $("topbtns");
  tb.appendChild(
    btn("+ New job", "btn", function () {
      openJobForm(null, null);
    })
  );
  tb.appendChild(document.createTextNode(" "));
  tb.appendChild(
    btn("+ New Estimate/Quote", "btn alt", function () {
      openEstimateForm(null);
    })
  );
  tb.appendChild(document.createTextNode(" "));
  tb.appendChild(btn("Services", "btn alt", openServices));
  var list = $("list");
  list.textContent = "";
  if (jobsErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Jobs aren't set up yet. Run the Stage 2 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var shown = jobs
    .filter(jobMatches)
    .filter(function (j) {
      if (!query) return true;
      return [cname(j.client_id), j.title, paddr(j.property_id)].join(" ").toLowerCase().indexOf(query) > -1;
    })
    .sort(jobSorter());
  if (!shown.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        jobs.length ? "No jobs match these filters." : "No jobs yet. Add one here, or from a client's page."
      )
    );
    return;
  }
  shown.forEach(function (j) {
    // lawn maintenance jobs are green; any other work (trimming, cleanups, installs...) is blue
    var lawn = /^lawn\s*maint/i.test(j.title || ""),
      tier = lawn
        ? ((j.title.split(/\s+-\s+/)[1] || "").toLowerCase().match(/basic|plus|premier|elite/) || [""])[0]
        : /^hoa\b/i.test(j.title || "")
          ? "hoa"
          : /^commercial\b/i.test(j.title || "")
            ? "commercial"
            : "",
      jc = byId(clients, j.client_id),
      ctype = jc && (jc.type === "hoa" || jc.type === "commercial") ? jc.type : "",
      b = el("button", "row client job " + (lawn ? "lawn" : "other") + (tier ? " t-" + tier : "") + (ctype ? " ct-" + ctype : ""));
    b.type = "button";
    var left = el("div");
    left.appendChild(el("b", null, cname(j.client_id)));
    var plan = lawn ? "Lawn maintenance" + ((j.title.split(/\s+-\s+/)[1] || "") ? " \u00b7 " + j.title.split(/\s+-\s+/)[1] : "") : j.title;
    // HOA and Commercial accounts are named in the tag and colored like the client type; the tier still shows
    left.appendChild(el("span", "jtype", (ctype === "hoa" ? "HOA \u00b7 " : ctype === "commercial" ? "Commercial \u00b7 " : "") + plan));
    left.appendChild(
      el(
        "div",
        "sub",
        [paddr(j.property_id), flabel(j.frequency), money(j.price)].filter(Boolean).join(" · ")
      )
    );
    var right = el("div");
    right.style.textAlign = "right";
    if (j.status !== "active")
      right.appendChild(el("span", "chip lost", j.status === "paused" ? "Paused" : "Ended"));
    else {
      var nv = nextVisit(j);
      right.appendChild(el("span", "chip", nv ? "Next: " + dshort(nv.scheduled_date) : "No visit set"));
    }
    b.appendChild(left);
    b.appendChild(right);
    b.addEventListener("click", function () {
      openJob(j.id);
    });
    list.appendChild(b);
  });
}

/* ---- job detail ---- */
var jobTab = {};
function openJob(id) {
  var j = byId(jobs, id);
  if (!j) return;
  var c = byId(clients, j.client_id),
    pr = byId(props, j.property_id),
    pp = popPanel(),
    p = pp.p,
    L = pp.L;
  L.appendChild(el("h2", null, j.title));
  var hd = el("div", "qhead");
  hd.appendChild(
    el("span", "qst " + (j.status === "active" ? "ok" : j.status === "paused" ? "wait" : "no"), j.status === "active" ? "Active" : j.status === "paused" ? "Paused" : "Ended")
  );
  hd.appendChild(el("span", "qnum", flabel(j.frequency) + " · " + money(j.price) + " per visit"));
  L.appendChild(hd);
  var who = el("div", "popbox");
  who.appendChild(el("h4", null, "Client"));
  if (c) {
    var cl = el("button", "link", c.name);
    cl.type = "button";
    cl.addEventListener("click", function () {
      openClient(c.id);
    });
    who.appendChild(cl);
    popLine(who, "Phone", c.phone || c.phone2, c.phone || c.phone2 ? "tel:" + digits(c.phone || c.phone2) : "");
    popLine(who, "Email", c.email, c.email ? "mailto:" + c.email : "");
  }
  if (pr) popLine(who, "Address", pr.address, mapsUrl(pr.address));
  if (c) {
    var cr = contactRow(c.phone || c.phone2, c.email);
    cr.classList.add("qacts");
    if (cr.firstChild) who.appendChild(cr);
  }
  L.appendChild(who);
  var panes = popTabs(
    pp.R,
    [
      ["visits", "Upcoming visits"],
      ["history", "History"],
      ["details", "Details"]
    ],
    jobTab[j.id] || "visits",
    function (k) {
      jobTab[j.id] = k;
    }
  );
  var dt = document.createElement("table");
  [
    ["How often", flabel(j.frequency)],
    ["Price", money(j.price) + " per visit"],
    ["Starts", dshort(j.start_date)],
    ["Ends", j.end_date ? dshort(j.end_date) : ""],
    ["Property notes", pr && pr.notes],
    ["Instructions", j.instructions]
  ].forEach(function (r) {
    if (!r[1]) return;
    var tr = document.createElement("tr");
    tr.appendChild(el("td", null, r[0]));
    var td = el("td", null, r[1]);
    td.style.whiteSpace = "pre-wrap";
    tr.appendChild(td);
    dt.appendChild(tr);
  });
  var ds = el("div", "sec");
  ds.appendChild(el("h3", null, "Job details"));
  ds.appendChild(dt);
  panes.details.appendChild(ds);
  var acts = el("div", "contact");
  acts.appendChild(
    btn("Edit", "btn alt sm", function () {
      openJobForm(c, j);
    })
  );
  if (j.status === "active" && j.frequency !== "once")
    acts.appendChild(
      btn("Pause", "btn alt sm", function () {
        setJobStatus(j, "paused");
      })
    );
  if (j.status === "paused")
    acts.appendChild(
      btn("Resume", "btn sm", function () {
        setJobStatus(j, "active");
      })
    );
  if (j.status !== "ended")
    acts.appendChild(
      btn("End job", "btn alt sm", function () {
        if (confirm("End this job? Future visits will be removed; history stays.")) setJobStatus(j, "ended");
      })
    );
  else
    acts.appendChild(
      btn("Reactivate", "btn sm", function () {
        setJobStatus(j, "active");
      })
    );
  L.appendChild(acts);
  var sec = panes.visits,
    hsec = panes.history;
  var t = today(),
    mine = visits
      .filter(function (v) {
        return v.job_id === j.id;
      })
      .sort(function (a, b) {
        return a.scheduled_date < b.scheduled_date ? -1 : 1;
      });
  var upc = mine
      .filter(function (v) {
        return v.scheduled_date >= t || v.status === "scheduled";
      })
      .slice(0, 12),
    past = mine
      .filter(function (v) {
        return upc.indexOf(v) < 0;
      })
      .reverse()
      .slice(0, 30);
  if (!upc.length) sec.appendChild(el("div", "note", "No upcoming visits."));
  if (!past.length) hsec.appendChild(el("div", "note", "No past visits yet."));
  function again() {
    render();
    openJob(j.id);
  }
  upc.forEach(function (v) {
    var cd = visitCard(v, again, false);
    var d = el("div", "note", dshort(v.scheduled_date));
    d.style.fontWeight = "700";
    cd.insertBefore(d, cd.firstChild);
    sec.appendChild(cd);
  });
  past.forEach(function (v) {
    var cd = visitCard(v, again, false);
    var d = el("div", "note", dshort(v.scheduled_date));
    d.style.fontWeight = "700";
    cd.insertBefore(d, cd.firstChild);
    hsec.appendChild(cd);
  });
  var d = el("div", "actions");
  d.appendChild(el("span"));
  d.appendChild(
    btn("Delete job", "btn danger", function () {
      if (!confirm("Delete this job and all its visits for good? (End job keeps the history.)")) return;
      sb.from("jobs")
        .delete()
        .eq("id", j.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not delete.");
            return;
          }
          jobs = jobs.filter(function (z) {
            return z.id !== j.id;
          });
          visits = visits.filter(function (z) {
            return z.job_id !== j.id;
          });
          closeDetail();
          render();
        });
    })
  );
  panes.details.appendChild(d);
}
function setJobStatus(j, s) {
  sb.from("jobs")
    .update({ status: s })
    .eq("id", j.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not update the job.");
        return;
      }
      j.status = s;
      var clear =
        s !== "active"
          ? sb
              .from("visits")
              .delete()
              .eq("job_id", j.id)
              .eq("status", "scheduled")
              .gte("scheduled_date", today())
          : Promise.resolve({});
      Promise.resolve(clear)
        .then(function () {
          return loadVisits();
        })
        .then(function () {
          return topUp();
        })
        .then(function () {
          render();
          openJob(j.id);
        });
    });
}

/* ---- job form ---- */
// pre (optional, from Make job on a lead or quote): { title, price, frequency, property_id, instructions, onSaved(job) }
function openJobForm(client, job, pre) {
  if (jobsErr) {
    needSql();
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, job ? "Edit job" : "New job"));
  var active = clients.filter(function (c) {
    return !c.archived || (client && c.id === client.id);
  });
  if (!active.length) {
    p.appendChild(el("p", null, "Add a client first."));
    return;
  }
  var cid = job ? job.client_id : client ? client.id : active[0].id;
  var cs = fld(
    "Client",
    "select",
    cid,
    active.map(function (c) {
      return [c.id, dispName(c)];
    })
  );
  if (job || client) cs.input.disabled = true;
  var ps = fld("Property", "select", "", []);
  function fillProps() {
    ps.input.textContent = "";
    clientProps(cs.input.value).forEach(function (x) {
      var o = document.createElement("option");
      o.value = x.id;
      o.textContent = (x.label ? x.label + ": " : "") + x.address;
      ps.input.appendChild(o);
    });
    if (job && job.client_id === cs.input.value) ps.input.value = job.property_id;
  }
  cs.input.addEventListener("change", fillProps);
  fillProps();
  // lawn tiers in order (Basic, Plus, Premier, Elite), then HOA and Commercial, then everything else A-Z
  var SVC_ORDER = ["lawn maintenance - basic", "lawn maintenance - plus", "lawn maintenance - premier", "lawn maintenance - elite", "hoa", "commercial"];
  var svcs = services
    .filter(function (s) {
      return s.active !== false;
    })
    .slice()
    .sort(function (a, b) {
      var x = SVC_ORDER.indexOf(String(a.name).toLowerCase()),
        y = SVC_ORDER.indexOf(String(b.name).toLowerCase());
      if (x < 0) x = 99;
      if (y < 0) y = 99;
      return x - y || String(a.name).localeCompare(String(b.name));
    });
  var sv = fld(
    "Service",
    "select",
    (job && job.service_id) || "",
    [["", "Custom / other"]].concat(
      svcs.map(function (s) {
        return [s.id, s.name];
      })
    )
  );
  var ti = fld("Job name", "text", job ? job.title : ""),
    pr = fld("Price ($)", "number", job ? job.price : "");
  pr.input.step = "0.01";
  pr.input.min = "0";
  pr.input.inputMode = "decimal";
  var fq = fld("How often", "select", job ? job.frequency : "weekly", FREQ);
  var sd = fld("Start date", "date", job ? job.start_date : today());
  var ed = fld("End date", "date", (job && job.end_date) || "");
  var ins = fld(
    "Crew notes",
    "textarea",
    job ? job.instructions : ""
  );
  var cw = null;
  if (s3 && crew.length) {
    cw = fld(
      "Assigned to",
      "select",
      (job && job.crew_id) || "",
      [["", "Me / unassigned"]].concat(
        crew
          .filter(function (c) {
            return c.active !== false;
          })
          .map(function (c) {
            return [c.id, c.name];
          })
      )
    );
  }
  var lastSvc = sv.input.value;
  sv.input.addEventListener("change", function () {
    var s = byId(services, sv.input.value),
      old = byId(services, lastSvc);
    if (s) {
      if (!ti.input.value.trim() || (old && ti.input.value === old.name)) ti.input.value = s.name;
      if (
        (!pr.input.value ||
          Number(pr.input.value) === 0 ||
          (old && Number(pr.input.value) === Number(old.default_price))) &&
        s.default_price != null
      )
        pr.input.value = s.default_price;
    }
    lastSvc = sv.input.value;
  });
  fq.input.addEventListener("change", function () {
    ed.hidden = fq.input.value === "once";
  });
  if (pre && !job) {
    if (pre.property_id && byId(props, pre.property_id)) ps.input.value = pre.property_id;
    var ms = svcs.filter(function (x) {
      return pre.title && String(x.name).toLowerCase() === String(pre.title).toLowerCase();
    })[0];
    if (ms) sv.input.value = ms.id;
    lastSvc = sv.input.value;
    if (pre.title) ti.input.value = pre.title;
    if (pre.price != null && !isNaN(pre.price)) pr.input.value = pre.price;
    if (pre.frequency) fq.input.value = pre.frequency;
    if (pre.instructions) ins.input.value = pre.instructions;
    p.insertBefore(el("p", "note", pre.from || ""), p.children[2] || null);
  }
  ed.hidden = fq.input.value === "once";
  p.appendChild(cs);
  p.appendChild(ps);
  p.appendChild(sv);
  p.appendChild(ti);
  var g = el("div", "grid2");
  g.appendChild(pr);
  g.appendChild(fq);
  g.appendChild(sd);
  g.appendChild(ed);
  p.appendChild(g);
  if (cw) p.appendChild(cw);
  p.appendChild(ins);
  var a = el("div", "actions");
  var save = btn("Save job", "btn", function () {
    if (!ps.input.value) {
      alert("This client needs a property first. Add one on the client page.");
      return;
    }
    if (!ti.input.value.trim()) {
      alert("Enter a job name.");
      return;
    }
    if (!sd.input.value) {
      alert("Pick a start date.");
      return;
    }
    var price = parseFloat(pr.input.value);
    if (isNaN(price) || price < 0) {
      alert("Enter the price per visit (0 if unknown).");
      return;
    }
    var once = fq.input.value === "once";
    var row = {
      client_id: cs.input.value,
      property_id: ps.input.value,
      service_id: sv.input.value || null,
      title: ti.input.value.trim(),
      price: price,
      frequency: fq.input.value,
      start_date: sd.input.value,
      end_date: !once && ed.input.value ? ed.input.value : null,
      instructions: ins.input.value.trim()
    };
    if (s3 && cw) row.crew_id = cw.input.value || null;
    save.disabled = true;
    if (!job) {
      sb.from("jobs")
        .insert(row)
        .select()
        .single()
        .then(function (r) {
          if (r.error || !r.data) {
            save.disabled = false;
            alert("Could not save the job.");
            return;
          }
          jobs.push(r.data);
          if (pre && pre.onSaved) pre.onSaved(r.data);
          topUp().then(function () {
            render();
            openJob(r.data.id);
          });
        });
      return;
    }
    var sched =
      job.frequency !== row.frequency ||
      job.start_date !== row.start_date ||
      (job.end_date || null) !== row.end_date;
    sb.from("jobs")
      .update(row)
      .eq("id", job.id)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          save.disabled = false;
          alert("Could not save the job.");
          return;
        }
        Object.assign(job, r.data);
        var fut;
        if (sched && job.status === "active")
          fut = sb
            .from("visits")
            .delete()
            .eq("job_id", job.id)
            .eq("status", "scheduled")
            .gte("scheduled_date", today());
        else
          fut = sb
            .from("visits")
            .update(
              s3 && cw
                ? { price: job.price, property_id: job.property_id, crew_id: job.crew_id || null }
                : { price: job.price, property_id: job.property_id }
            )
            .eq("job_id", job.id)
            .eq("status", "scheduled")
            .gte("scheduled_date", today());
        Promise.resolve(fut)
          .then(function () {
            return loadVisits();
          })
          .then(function () {
            return topUp();
          })
          .then(function () {
            render();
            openJob(job.id);
          });
      });
  });
  a.appendChild(save);
  a.appendChild(
    btn("Cancel", "btn alt", function () {
      if (job) openJob(job.id);
      else closeDetail();
    })
  );
  p.appendChild(a);
}

/* ---- services catalog ---- */
function openServices() {
  if (jobsErr) {
    needSql();
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Services"));
  p.appendChild(
    el(
      "p",
      "note",
      "Your menu of work. The default price fills in when you pick a service on a new job. Changing it later doesn't touch existing jobs."
    )
  );
  var holder = el("div");
  p.appendChild(holder);
  function row(s) {
    var box = el("div", "pcard"),
      g = el("div", "grid2");
    var n = fld("Name", "text", s ? s.name : ""),
      d = fld("Price ($)", "number", s && s.default_price != null ? s.default_price : "");
    d.input.step = "0.01";
    d.input.min = "0";
    d.input.inputMode = "decimal";
    g.appendChild(n);
    g.appendChild(d);
    box.appendChild(g);
    var a = el("div", "acts");
    a.appendChild(
      btn(s ? "Save" : "Add service", "btn sm", function () {
        var name = n.input.value.trim();
        if (!name) {
          alert("Enter a name.");
          return;
        }
        var price = d.input.value === "" ? null : parseFloat(d.input.value);
        if (price !== null && (isNaN(price) || price < 0)) {
          alert("Enter a valid price.");
          return;
        }
        var q = s
          ? sb.from("services").update({ name: name, default_price: price }).eq("id", s.id).select().single()
          : sb.from("services").insert({ name: name, default_price: price }).select().single();
        q.then(function (r) {
          if (r.error || !r.data) {
            alert("Could not save. Is that name already in the list?");
            return;
          }
          if (s) Object.assign(s, r.data);
          else services.push(r.data);
          services.sort(function (x, y) {
            return x.name.localeCompare(y.name);
          });
          draw();
        });
      })
    );
    if (s)
      a.appendChild(
        btn("Delete", "btn danger sm", function () {
          if (!confirm("Delete this service? Jobs that use it keep their name and price.")) return;
          sb.from("services")
            .delete()
            .eq("id", s.id)
            .then(function (r) {
              if (r.error) {
                alert("Could not delete.");
                return;
              }
              services = services.filter(function (z) {
                return z.id !== s.id;
              });
              draw();
            });
        })
      );
    box.appendChild(a);
    return box;
  }
  function draw() {
    holder.textContent = "";
    services.forEach(function (s) {
      holder.appendChild(row(s));
    });
    var h = el("div", "note", "Add a new service");
    h.style.margin = "14px 0 6px";
    holder.appendChild(h);
    holder.appendChild(row(null));
  }
  draw();
}

/* ---- jobs on the client page ---- */
function clientJobsSection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Jobs");
  h.appendChild(
    btn("+ New job", "btn alt sm", function () {
      if (!clientProps(c.id).length) {
        alert("Add a property (service address) first.");
        return;
      }
      openJobForm(c, null);
    })
  );
  sec.appendChild(h);
  var mine = jobs.filter(function (j) {
    return j.client_id === c.id;
  });
  if (jobsErr) sec.appendChild(el("div", "note", "Run the Stage 2 SQL in Supabase to turn on jobs."));
  else if (!mine.length) sec.appendChild(el("div", "note", "No jobs yet."));
  mine.forEach(function (j) {
    var card = el("div", "pcard");
    card.appendChild(el("b", null, j.title));
    var nv = j.status === "active" ? nextVisit(j) : null;
    card.appendChild(
      el(
        "div",
        "note",
        [
          flabel(j.frequency),
          money(j.price),
          j.status !== "active"
            ? j.status === "paused"
              ? "Paused"
              : "Ended"
            : nv
              ? "Next: " + dshort(nv.scheduled_date)
              : ""
        ]
          .filter(Boolean)
          .join(" · ")
      )
    );
    var a = el("div", "acts");
    a.appendChild(
      btn("Open", "btn alt sm", function () {
        openJob(j.id);
      })
    );
    card.appendChild(a);
    sec.appendChild(card);
  });
  return sec;
}

/* ---- job history on the client page (all-time, not just recent) ---- */
function historySection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Job history");
  sec.appendChild(h);
  var body = el("div");
  sec.appendChild(body);
  if (jobsErr) {
    body.appendChild(el("div", "note", "Run the Stage 2 SQL in Supabase to turn on job history."));
    return sec;
  }
  body.appendChild(el("div", "note", "Loading..."));
  sb.from("visits")
    .select("*")
    .eq("client_id", c.id)
    .order("scheduled_date", { ascending: false })
    .limit(1000)
    .then(function (r) {
      body.textContent = "";
      if (r.error) {
        body.appendChild(el("div", "note", "Could not load history."));
        return;
      }
      var all = (r.data || [])
        .filter(function (v) {
          return v.status !== "scheduled";
        })
        .sort(function (a, b) {
          return a.scheduled_date < b.scheduled_date ? 1 : -1;
        });
      if (!all.length) {
        body.appendChild(
          el("div", "note", "No completed work yet. Visits show up here once you mark them Done.")
        );
        return;
      }
      var done = all.filter(function (v) {
          return v.status === "done";
        }),
        total = done.reduce(function (s, v) {
          return s + Number(v.price || 0);
        }, 0);
      var sum = el(
        "div",
        "note",
        done.length +
          " visit" +
          (done.length === 1 ? "" : "s") +
          " completed · " +
          money(total) +
          " total" +
          (all.length > done.length ? " · " + (all.length - done.length) + " skipped" : "") +
          (done[0] ? " · last: " + dshort(done[0].scheduled_date) : "")
      );
      sum.style.cssText = "margin-bottom:8px;font-weight:700";
      body.appendChild(sum);
      var list = el("div");
      body.appendChild(list);
      var shown = 0;
      function more(n) {
        all.slice(shown, shown + n).forEach(function (v) {
          var j = byId(jobs, v.job_id),
            row = el("div", "pcard");
          row.style.cssText =
            "display:flex;justify-content:space-between;gap:10px;align-items:center;cursor:" +
            (j ? "pointer" : "default");
          var l = el("div");
          l.appendChild(el("b", null, dshort(v.scheduled_date) + " · " + (j ? j.title : "(deleted job)")));
          l.appendChild(
            el("div", "note", [paddr(v.property_id), money(v.price)].filter(Boolean).join(" · "))
          );
          var rt = el(
            "span",
            "chip " + (v.status === "done" ? "won" : "lost"),
            v.status === "done" ? "Done" : "Skipped"
          );
          row.appendChild(l);
          row.appendChild(rt);
          if (j)
            row.addEventListener("click", function () {
              openJob(j.id);
            });
          list.appendChild(row);
        });
        shown = Math.min(all.length, shown + n);
        mb.hidden = shown >= all.length;
      }
      var mb = btn("Show more", "btn alt sm", function () {
        more(50);
      });
      body.appendChild(mb);
      more(15);
    });
  return sec;
}
