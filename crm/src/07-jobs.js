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

/* ---- Jobs list ---- */
function renderJobs() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var rec = jobs.filter(function (j) {
      return j.status === "active" && j.frequency !== "once";
    }),
    one = jobs.filter(function (j) {
      return j.status === "active" && j.frequency === "once";
    }),
    off = jobs.filter(function (j) {
      return j.status !== "active";
    });
  [
    ["active", "Recurring", rec.length],
    ["once", "One-time", one.length],
    ["inactive", "Paused / ended", off.length]
  ].forEach(function (s) {
    var b = el("button", "tab" + (jfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + s[2] + ")"));
    b.addEventListener("click", function () {
      jfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
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
  var shown = (jfilter === "active" ? rec : jfilter === "once" ? one : off).filter(function (j) {
    if (!query) return true;
    return [cname(j.client_id), j.title, paddr(j.property_id)].join(" ").toLowerCase().indexOf(query) > -1;
  });
  if (!shown.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        jobs.length ? "Nothing here." : "No jobs yet. Add one here, or from a client's page."
      )
    );
    return;
  }
  shown.forEach(function (j) {
    // lawn maintenance jobs are green; any other work (trimming, cleanups, installs...) is blue
    var lawn = /^lawn\s*maint/i.test(j.title || ""),
      tier = lawn ? ((j.title.split(/\s+-\s+/)[1] || "").toLowerCase().match(/basic|plus|premier/) || [""])[0] : "",
      b = el("button", "row client job " + (lawn ? "lawn" : "other") + (tier ? " t-" + tier : ""));
    b.type = "button";
    var left = el("div");
    left.appendChild(el("b", null, cname(j.client_id)));
    var plan = lawn ? "Lawn maintenance" + ((j.title.split(/\s+-\s+/)[1] || "") ? " \u00b7 " + j.title.split(/\s+-\s+/)[1] : "") : j.title;
    left.appendChild(el("span", "jtype", plan));
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
function openJob(id) {
  var j = byId(jobs, id);
  if (!j) return;
  var c = byId(clients, j.client_id),
    pr = byId(props, j.property_id),
    p = panel();
  p.appendChild(el("h2", null, j.title));
  p.appendChild(
    el(
      "div",
      "note",
      flabel(j.frequency) +
        " · " +
        money(j.price) +
        " per visit · " +
        (j.status === "active" ? "Active" : j.status === "paused" ? "Paused" : "Ended") +
        " · starts " +
        dshort(j.start_date) +
        (j.end_date ? " · ends " + dshort(j.end_date) : "")
    )
  );
  var who = el("div", "pcard");
  who.style.marginTop = "12px";
  if (c) {
    var cl = el("button", "link", c.name);
    cl.type = "button";
    cl.addEventListener("click", function () {
      openClient(c.id);
    });
    who.appendChild(cl);
  }
  if (pr) {
    var ad = el("div", null, pr.address);
    who.appendChild(ad);
    if (pr.notes) who.appendChild(el("div", "note", pr.notes));
    var m = el("a", "btn alt sm", "Map");
    m.href = mapsUrl(pr.address);
    m.target = "_blank";
    m.rel = "noopener";
    m.style.marginTop = "6px";
    who.appendChild(m);
  }
  p.appendChild(who);
  if (j.instructions) {
    var ins = el("div", "note", "Instructions: " + j.instructions);
    ins.style.cssText = "margin-top:8px;white-space:pre-wrap";
    p.appendChild(ins);
  }
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
  p.appendChild(acts);
  var sec = el("div", "sec");
  sec.appendChild(el("h3", null, "Visits"));
  p.appendChild(sec);
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
      .slice(0, 8),
    past = mine
      .filter(function (v) {
        return upc.indexOf(v) < 0;
      })
      .reverse()
      .slice(0, 6);
  if (!upc.length && !past.length) sec.appendChild(el("div", "note", "No visits yet."));
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
  if (past.length) {
    var h = el("div", "note", "Recent history");
    h.style.margin = "10px 0 4px";
    sec.appendChild(h);
    past.forEach(function (v) {
      sec.appendChild(visitCard(v, again, false));
    });
  }
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
  p.appendChild(d);
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
function openJobForm(client, job) {
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
  var svcs = services.filter(function (s) {
    return s.active !== false;
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
    pr = fld("Price per visit ($)", "number", job ? job.price : "");
  pr.input.step = "0.01";
  pr.input.min = "0";
  pr.input.inputMode = "decimal";
  var fq = fld("How often", "select", job ? job.frequency : "weekly", FREQ);
  var sd = fld("First visit / start date", "date", job ? job.start_date : today());
  var ed = fld("Ends on (optional)", "date", (job && job.end_date) || "");
  var ins = fld(
    "Instructions for the crew (gate, dogs, edging, etc.)",
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
      d = fld("Default price ($, optional)", "number", s && s.default_price != null ? s.default_price : "");
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
