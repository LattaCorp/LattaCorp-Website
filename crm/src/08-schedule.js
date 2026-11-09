/* Schedule tab: visit cards, day/week/month views, weather delays and smart catch-up. */

/* ---- visit card (used in Schedule and in job detail) ---- */
/* A completed visit with no price can't be billed. These controls fix it on the spot: set a price, or mark it "No charge" (kept in the history, never billed). */
function noPrice(v) {
  return v.status === "done" && !v.invoice_id && !v.paid_at && !(Number(v.price) > 0);
}
function priceFix(v, after) {
  var w = el("div");
  w.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px";
  var inp = document.createElement("input");
  inp.type = "number";
  inp.step = "0.01";
  inp.min = "0";
  inp.inputMode = "decimal";
  inp.placeholder = "Price $";
  inp.style.cssText = "width:96px";
  inp.setAttribute("aria-label", "Price for this visit");
  w.appendChild(inp);
  w.appendChild(
    btn("Set price", "btn sm", function () {
      var n = parseFloat(inp.value);
      if (!(n > 0)) {
        alert("Enter the price for this visit.");
        return;
      }
      sb.from("visits")
        .update({ price: n })
        .eq("id", v.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not save the price.");
            return;
          }
          v.price = n;
          loadUnbilled().then(after);
        });
    })
  );
  w.appendChild(
    btn("Invoice as $0 (no charge)", "btn alt sm", function () {
      if (
        !confirm(
          "Create a $0 invoice for this visit? It is kept as a paid, no-charge record in the client's invoice history."
        )
      )
        return;
      createInvoice(v.client_id, [v], today()).then(
        function (inv) {
          return loadUnbilled().then(function () {
            render();
            openInvoice(inv.id);
          });
        },
        function (e) {
          alert(e);
        }
      );
    })
  );
  return w;
}
function visitCard(v, after, showJob, opts) {
  opts = opts || {};
  var j = byId(jobs, v.job_id),
    card = el("div", "pcard"),
    top = el("div");
  top.style.cssText = "display:flex;justify-content:space-between;gap:8px";
  var l = el("div");
  l.appendChild(
    el("b", null, (opts.num ? opts.num + ". " : "") + cname(v.client_id) + (j ? " · " + j.title : ""))
  );
  l.appendChild(el("div", "note", [paddr(v.property_id), money(v.price)].filter(Boolean).join(" · ")));
  if (opts.detail) {
    var pp = byId(props, v.property_id),
      tips = [pp && pp.notes, j && j.instructions].filter(Boolean).join("  |  ");
    if (tips) {
      var tn = el("div", "note", "⚠ " + tips);
      tn.style.cssText = "color:#7a5b00;white-space:pre-wrap";
      l.appendChild(tn);
    }
  }
  if (s3 && crew.length && v.crew_id && crewName(v.crew_id))
    l.appendChild(el("div", "note", "Crew: " + crewName(v.crew_id)));
  if (v.status !== "scheduled" || showJob === false)
    l.appendChild(el("div", "note", dshort(v.scheduled_date)));
  if (v.status === "scheduled" && v.weather_from) {
    var wn = el("div", "note", "Moved by weather from " + dshort(v.weather_from));
    wn.style.color = "#1f5f9a";
    l.appendChild(wn);
  }
  top.appendChild(l);
  if (v.status !== "scheduled")
    top.appendChild(
      el("span", "chip " + (v.status === "done" ? "won" : "lost"), v.status === "done" ? "Done" : "Skipped")
    );
  if (!billErr && noPrice(v)) {
    var npc = el("span", "chip od", "\u26a0 No price");
    npc.title = "This visit can't be billed until it has a price";
    npc.style.marginLeft = "6px";
    top.appendChild(npc);
  }
  card.appendChild(top);
  var a = el("div", "acts");
  function patch(p, cb) {
    function fin() {
      if (cb) {
        cb();
        return;
      }
      if (!billErr && (p.status !== undefined || p.paid_at !== undefined)) loadUnbilled().then(after);
      else after();
    }
    sb.from("visits")
      .update(p)
      .eq("id", v.id)
      .then(function (r) {
        if (r.error) {
          alert("Could not save that.");
          return;
        }
        Object.assign(v, p);
        if (
          j &&
          j.frequency === "once" &&
          (p.status === "done" || p.status === "skipped") &&
          j.status === "active"
        ) {
          sb.from("jobs")
            .update({ status: "ended" })
            .eq("id", j.id)
            .then(function () {
              j.status = "ended";
              fin();
            });
          return;
        }
        if (j && j.frequency === "once" && p.status === "scheduled" && j.status === "ended") {
          sb.from("jobs")
            .update({ status: "active" })
            .eq("id", j.id)
            .then(function () {
              j.status = "active";
              fin();
            });
          return;
        }
        fin();
      });
  }
  function btns() {
    a.textContent = "";
    if (v.status === "scheduled") {
      a.appendChild(
        btn("Done", "btn sm", function () {
          var pp = { status: "done", completed_at: new Date().toISOString() };
          if (!billErr && !(Number(v.price) > 0)) {
            var ans = prompt(
              "This visit has no price yet, so it can't be billed. Enter the price for this visit, or leave it blank to set it later:",
              ""
            );
            var n = ans == null ? NaN : parseFloat(ans);
            if (n > 0) pp.price = n;
          }
          patch(pp);
        })
      );
      a.appendChild(
        btn("Skip", "btn alt sm", function () {
          patch(
            wxOn() ? { status: "skipped", weather_from: null, weather_batch: null } : { status: "skipped" }
          );
        })
      );
      a.appendChild(
        btn("Move", "btn alt sm", function () {
          a.textContent = "";
          var di = document.createElement("input");
          di.type = "date";
          di.value = v.scheduled_date;
          di.style.width = "auto";
          a.appendChild(di);
          a.appendChild(
            btn("Save date", "btn sm", function () {
              if (!di.value) return;
              var nd = di.value,
                od = v.scheduled_date,
                pp = { scheduled_date: nd };
              if (wxOn()) {
                pp.weather_from = null;
                pp.weather_batch = null;
              }
              if (remOn()) pp.reminded_at = null;
              patch(
                pp,
                nd > od
                  ? function () {
                      catchup([v], "m|" + Date.now(), after);
                    }
                  : null
              );
            })
          );
          a.appendChild(btn("Cancel", "btn alt sm", btns));
        })
      );
    } else {
      if (!v.invoice_id && !v.paid_at)
        a.appendChild(
          btn("Undo", "btn alt sm", function () {
            patch({ status: "scheduled", completed_at: null });
          })
        );
      if (!billErr && noPrice(v)) card.appendChild(priceFix(v, after));
      if (!billErr && v.status === "done") {
        if (v.invoice_id) {
          var oi = el("span", "note", "On an invoice");
          oi.style.alignSelf = "center";
          a.appendChild(oi);
        } else if (v.paid_at) {
          var pn = el("span", "chip won", "Paid" + (v.paid_method ? " · " + v.paid_method : ""));
          pn.style.alignSelf = "center";
          a.appendChild(pn);
          a.appendChild(
            btn("Undo paid", "btn alt sm", function () {
              patch({ paid_at: null, paid_method: "" });
            })
          );
        } else {
          var pl = el("span", "note", "Paid at visit:");
          pl.style.alignSelf = "center";
          a.appendChild(pl);
          ["Cash", "Zelle", "Check"].forEach(function (m) {
            a.appendChild(
              btn(m, "btn alt sm", function () {
                patch({ paid_at: new Date().toISOString(), paid_method: m });
              })
            );
          });
        }
      }
    }
    if (!photoErr && v.status !== "skipped") {
      var pb = btn("Photo", "btn alt sm", function () {
        pickPhotos(true, function (fs) {
          pb.textContent = "Uploading...";
          uploadMany(fs, {
            client_id: v.client_id,
            property_id: v.property_id,
            visit_id: v.id,
            kind: v.status === "done" ? "after" : "before"
          }).then(function (res) {
            pb.textContent = res.ok ? "Photo added ✓" : "Photo";
            var msg = uploadMsg(res);
            if (msg) alert(msg);
            render();
          });
        });
      });
      a.appendChild(pb);
    }
    var pr = byId(props, v.property_id);
    if (pr) {
      var m = el("a", "btn alt sm", "Map");
      m.href = mapsUrl(pr.address);
      m.target = "_blank";
      m.rel = "noopener";
      a.appendChild(m);
    }
    if (showJob !== false && j)
      a.appendChild(
        btn("Job", "btn alt sm", function () {
          openJob(j.id);
        })
      );
    if (opts.up !== undefined || opts.down !== undefined) {
      var u = btn("▲", "btn alt sm", opts.up || null);
      u.disabled = !opts.up;
      u.setAttribute("aria-label", "Move earlier");
      var dn2 = btn("▼", "btn alt sm", opts.down || null);
      dn2.disabled = !opts.down;
      dn2.setAttribute("aria-label", "Move later");
      a.appendChild(u);
      a.appendChild(dn2);
    }
    if (s3 && crew.length && v.status === "scheduled") {
      var sel = document.createElement("select");
      sel.style.cssText = "width:auto;padding:6px 8px;font-size:.88rem";
      sel.setAttribute("aria-label", "Assign to");
      [["", "Me / unassigned"]]
        .concat(
          crew
            .filter(function (c) {
              return c.active !== false;
            })
            .map(function (c) {
              return [c.id, c.name];
            })
        )
        .forEach(function (o) {
          var op = document.createElement("option");
          op.value = o[0];
          op.textContent = o[1];
          sel.appendChild(op);
        });
      sel.value = v.crew_id || "";
      sel.addEventListener("change", function () {
        patch({ crew_id: sel.value || null });
      });
      a.appendChild(sel);
    }
  }
  btns();
  card.appendChild(a);
  return card;
}

/* ---- Schedule: Today/Day, Week, Month, Upcoming, Overdue, Done ---- */
var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function mondayOf(s) {
  var d = pd(s),
    k = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - k);
  return ymd(d);
}
function longDate(s) {
  return pd(s).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}
function monthName(s) {
  return pd(s).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function onDay(d) {
  return visits.filter(function (v) {
    return v.scheduled_date === d;
  });
}
function crewName(id) {
  var c = byId(crew, id);
  return c ? c.name : "";
}
function crewOk(v) {
  return crewF === "all" || (crewF === "none" ? !v.crew_id : v.crew_id === crewF);
}
function dayOrder(a, b) {
  var sa = a.status === "scheduled" ? 0 : 1,
    sb2 = b.status === "scheduled" ? 0 : 1;
  if (sa !== sb2) return sa - sb2;
  if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0);
  return cname(a.client_id).localeCompare(cname(b.client_id));
}
function ensureFrom(d) {
  if (d >= histFrom) return Promise.resolve();
  return sb
    .from("visits")
    .select("*")
    .gte("scheduled_date", d)
    .lt("scheduled_date", histFrom)
    .limit(5000)
    .then(function (r) {
      if (!r.error) {
        visits = visits.concat(r.data || []);
        histFrom = d;
      }
    });
}
function crewChips(list) {
  if (!s3 || !crew.length) return;
  var row = el("div", "tabs");
  row.style.marginTop = "8px";
  [
    ["all", "Everyone"],
    ["none", "Me"]
  ]
    .concat(
      crew.map(function (c) {
        return [c.id, c.name];
      })
    )
    .forEach(function (x) {
      var b = el("button", "tab" + (crewF === x[0] ? " on" : ""), x[1]);
      b.type = "button";
      b.addEventListener("click", function () {
        crewF = x[0];
        render();
      });
      row.appendChild(b);
    });
  list.appendChild(row);
}
function calNav(title, prev, next, todayFn, showToday) {
  var n = el("div", "calnav");
  n.appendChild(btn("‹", "btn alt sm", prev));
  var b = el("b", null, title);
  n.appendChild(b);
  n.appendChild(btn("›", "btn alt sm", next));
  if (showToday) n.appendChild(btn("Today", "btn alt sm", todayFn));
  return n;
}

function renderSchedule() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var t = today();
  var up = visits.filter(function (v) {
      return v.status === "scheduled" && v.scheduled_date >= t;
    }),
    od = visits.filter(function (v) {
      return v.status === "scheduled" && v.scheduled_date < t;
    }),
    dn = visits.filter(function (v) {
      return v.status !== "scheduled";
    });
  [
    ["day", selDate === t ? "Today" : "Day", -1],
    ["week", "Week", -1],
    ["month", "Month", -1],
    ["upcoming", "Upcoming", up.length],
    ["overdue", "Overdue", od.length],
    ["done", "Done", dn.length]
  ].forEach(function (s) {
    var b = el("button", "tab" + (smode === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    if (s[2] >= 0) b.appendChild(el("span", null, "(" + s[2] + ")"));
    b.addEventListener("click", function () {
      smode = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  if (s3 && isOwner()) $("topbtns").appendChild(btn("Crew", "btn alt", openCrew));
  var list = $("list");
  list.textContent = "";
  if (jobsErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "The schedule isn't set up yet. Run the Stage 2 SQL in Supabase, then press Refresh."
      )
    );
    return;
  }
  if (smode === "day") return renderDay(list, od.length);
  if (smode === "week") return renderWeek(list);
  if (smode === "month") return renderMonth(list);
  var set = smode === "upcoming" ? up : smode === "overdue" ? od : dn;
  set = set.filter(function (v) {
    if (!query) return true;
    var j = byId(jobs, v.job_id);
    return (
      [cname(v.client_id), paddr(v.property_id), j ? j.title : ""].join(" ").toLowerCase().indexOf(query) > -1
    );
  });
  set.sort(function (a, b) {
    return smode === "done"
      ? a.scheduled_date < b.scheduled_date
        ? 1
        : -1
      : a.scheduled_date < b.scheduled_date
        ? -1
        : 1;
  });
  if (smode === "done") set = set.slice(0, 150);
  if (!set.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        smode === "upcoming"
          ? "Nothing scheduled. Add a job to a client and its visits appear here."
          : smode === "overdue"
            ? "Nothing overdue. Nice."
            : "No completed visits yet."
      )
    );
    return;
  }
  var groups = {},
    order = [];
  set.forEach(function (v) {
    if (!groups[v.scheduled_date]) {
      groups[v.scheduled_date] = [];
      order.push(v.scheduled_date);
    }
    groups[v.scheduled_date].push(v);
  });
  order.forEach(function (d) {
    var g = groups[d],
      box = el("div"),
      h = el(
        "h3",
        null,
        dlabel(d) +
          "  ·  " +
          g.length +
          " stop" +
          (g.length > 1 ? "s" : "") +
          "  ·  " +
          money(
            g.reduce(function (s, v) {
              return s + Number(v.price || 0);
            }, 0)
          )
      );
    h.style.cssText =
      "margin:14px 0 6px;font-size:.98rem;color:var(--forest);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap";
    var go = btn("Open day", "btn alt sm", function () {
      selDate = d;
      smode = "day";
      render();
    });
    h.appendChild(go);
    if (smode !== "done") {
      h.appendChild(
        btn("Push to next day", "btn alt sm", function () {
          pushDay(d, g.length);
        })
      );
    }
    box.appendChild(h);
    g.forEach(function (v) {
      box.appendChild(
        visitCard(v, function () {
          render();
        })
      );
    });
    list.appendChild(box);
  });
}

function routeUrl(stops) {
  var addrs = stops
    .map(function (v) {
      return paddr(v.property_id);
    })
    .filter(Boolean)
    .slice(0, 10);
  if (!addrs.length) return "";
  var dest = addrs[addrs.length - 1],
    w = addrs.slice(0, -1);
  return (
    "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" +
    encodeURIComponent(dest) +
    (w.length ? "&waypoints=" + encodeURIComponent(w.join("|")) : "")
  );
}
function moveVisit(v, dir, filtered) {
  var ds = onDay(v.scheduled_date)
    .filter(function (x) {
      return x.status === "scheduled";
    })
    .sort(dayOrder);
  var fi = filtered.indexOf(v),
    nb = filtered[fi + dir];
  if (!nb) return;
  var i = ds.indexOf(v),
    j = ds.indexOf(nb);
  ds[i] = nb;
  ds[j] = v;
  var jobsToDo = [];
  ds.forEach(function (x, k) {
    var n = k * 10;
    if ((x.sort_order || 0) !== n) {
      x.sort_order = n;
      jobsToDo.push(sb.from("visits").update({ sort_order: n }).eq("id", x.id));
    }
  });
  Promise.all(jobsToDo).then(function (rs) {
    if (
      rs.some(function (r) {
        return r.error;
      })
    )
      alert("Could not save the new order.");
    render();
  });
}

function renderDay(list, odCount) {
  var d = selDate,
    t = today();
  list.appendChild(
    calNav(
      longDate(d),
      function () {
        selDate = addDays(d, -1);
        render();
      },
      function () {
        selDate = addDays(d, 1);
        render();
      },
      function () {
        selDate = t;
        render();
      },
      d !== t
    )
  );
  var di = document.createElement("input");
  di.type = "date";
  di.value = d;
  di.style.cssText = "width:auto;margin-left:auto";
  di.setAttribute("aria-label", "Jump to date");
  di.addEventListener("change", function () {
    if (di.value) {
      selDate = di.value;
      render();
    }
  });
  list.lastChild.appendChild(di);
  if (d === t && odCount) {
    var ob = btn(
      odCount + " overdue visit" + (odCount > 1 ? "s" : "") + " need attention. Tap to review.",
      "btn alt",
      function () {
        smode = "overdue";
        render();
      }
    );
    ob.style.cssText = "margin-bottom:10px;border-color:#b3261e;color:#b3261e;width:100%";
    list.appendChild(ob);
  }
  crewChips(list);
  wxBanners(list, d);
  var all = onDay(d).filter(crewOk).sort(dayOrder),
    sched = all.filter(function (v) {
      return v.status === "scheduled";
    });
  if (!all.length) {
    list.appendChild(el("div", "empty", "Nothing scheduled for this day."));
    return;
  }
  var done = all.filter(function (v) {
      return v.status === "done";
    }).length,
    total = all.reduce(function (s, v) {
      return s + (v.status === "skipped" ? 0 : Number(v.price || 0));
    }, 0);
  var sum = el("div", "daysum");
  sum.appendChild(
    el(
      "b",
      null,
      all.length +
        " stop" +
        (all.length > 1 ? "s" : "") +
        " · " +
        money(total) +
        (done ? " · " + done + " done" : "")
    )
  );
  var bt = el("span");
  if (sched.length) {
    var ru = routeUrl(sched);
    if (ru) {
      var a = el("a", "btn sm", "Start route");
      a.href = ru;
      a.target = "_blank";
      a.rel = "noopener";
      bt.appendChild(a);
      bt.appendChild(document.createTextNode(" "));
    }
    if (s3 && isOwner()) {
      bt.appendChild(
        btn("Send route", "btn alt sm", function () {
          openSendRoute(d);
        })
      );
      bt.appendChild(document.createTextNode(" "));
    }
    bt.appendChild(
      btn("Reminders", "btn alt sm", function () {
        remindPanel(sched, "visit", "Reminders · " + dlabel(d));
      })
    );
    bt.appendChild(document.createTextNode(" "));
    bt.appendChild(
      btn("Weather delay", "btn alt sm", function () {
        openWeather(d);
      })
    );
  }
  sum.appendChild(bt);
  list.appendChild(sum);
  if (sched.length > 10)
    list.appendChild(el("div", "note", "The route link covers the first 10 stops in your order."));
  all.forEach(function (v) {
    var idx = sched.indexOf(v),
      opts = { detail: true };
    if (s3 && idx > -1) {
      opts.up =
        idx > 0
          ? function () {
              moveVisit(v, -1, sched);
            }
          : null;
      opts.down =
        idx < sched.length - 1
          ? function () {
              moveVisit(v, 1, sched);
            }
          : null;
      opts.num = idx + 1;
    }
    list.appendChild(
      visitCard(
        v,
        function () {
          render();
        },
        true,
        opts
      )
    );
  });
}

function renderWeek(list) {
  var ws = mondayOf(selDate),
    we = addDays(ws, 6),
    t = today();
  list.appendChild(
    calNav(
      pd(ws).toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " – " +
        pd(we).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      function () {
        selDate = addDays(ws, -7);
        render();
      },
      function () {
        selDate = addDays(ws, 7);
        render();
      },
      function () {
        selDate = t;
        render();
      },
      !(t >= ws && t <= we)
    )
  );
  if (ws < histFrom) {
    ensureFrom(ws).then(function () {
      if (smode === "week") render();
    });
  }
  crewChips(list);
  var g = el("div", "weekgrid");
  for (var i = 0; i < 7; i++) {
    (function (d, i) {
      var vs = onDay(d).filter(crewOk).sort(dayOrder),
        col = el("div", "daycol" + (d === t ? " today" : "") + (i >= 5 ? " wkend" : ""));
      var h = el("button", "dayhd");
      h.type = "button";
      h.appendChild(el("b", null, DOW[i] + " " + pd(d).getDate()));
      var tot = vs.reduce(function (s, v) {
        return s + (v.status === "skipped" ? 0 : Number(v.price || 0));
      }, 0);
      h.appendChild(
        el(
          "span",
          null,
          vs.length ? vs.length + " stop" + (vs.length > 1 ? "s" : "") + " · " + money(tot) : "—"
        )
      );
      h.addEventListener("click", function () {
        selDate = d;
        smode = "day";
        render();
      });
      col.appendChild(h);
      vs.slice(0, 8).forEach(function (v) {
        var b = el("button", "vline " + v.status);
        b.type = "button";
        b.textContent =
          cname(v.client_id) +
          (v.crew_id && crewName(v.crew_id) ? " (" + crewName(v.crew_id).split(" ")[0] + ")" : "");
        b.addEventListener("click", function () {
          selDate = d;
          smode = "day";
          render();
        });
        col.appendChild(b);
      });
      if (vs.length > 8) col.appendChild(el("div", "note", "+" + (vs.length - 8) + " more"));
      g.appendChild(col);
    })(addDays(ws, i), i);
  }
  list.appendChild(g);
}

function renderMonth(list) {
  var first = selDate.slice(0, 8) + "01",
    t = today(),
    gs = mondayOf(first);
  list.appendChild(
    calNav(
      monthName(first),
      function () {
        selDate = addDays(first, -1).slice(0, 8) + "01";
        render();
      },
      function () {
        selDate = addDays(first, 32).slice(0, 8) + "01";
        render();
      },
      function () {
        selDate = t;
        render();
      },
      t.slice(0, 7) !== first.slice(0, 7)
    )
  );
  if (gs < histFrom) {
    ensureFrom(gs).then(function () {
      if (smode === "month") render();
    });
  }
  crewChips(list);
  var g = el("div", "monthgrid");
  DOW.forEach(function (n) {
    g.appendChild(el("div", "mh", n));
  });
  for (var i = 0; i < 42; i++) {
    (function (d) {
      if (i >= 35 && d.slice(0, 7) !== first.slice(0, 7)) return;
      var vs = onDay(d).filter(crewOk),
        cell = el(
          "button",
          "mcell" + (d.slice(0, 7) !== first.slice(0, 7) ? " other" : "") + (d === t ? " today" : "")
        );
      cell.type = "button";
      cell.appendChild(el("span", "mn", String(pd(d).getDate())));
      if (vs.length) {
        cell.appendChild(el("span", "mc", vs.length + (vs.length > 1 ? " stops" : " stop")));
        cell.appendChild(
          el(
            "span",
            "mt",
            money(
              vs.reduce(function (s, v) {
                return s + (v.status === "skipped" ? 0 : Number(v.price || 0));
              }, 0)
            )
          )
        );
      }
      cell.addEventListener("click", function () {
        selDate = d;
        smode = "day";
        render();
      });
      g.appendChild(cell);
    })(addDays(gs, i));
  }
  list.appendChild(g);
}
function wxOn() {
  return visits.some(function (v) {
    return "weather_batch" in v;
  });
}
function gk(v) {
  return v.weather_batch ? String(v.weather_batch).split("#")[0] : "L|" + v.weather_from;
}
function ddiff(a, b) {
  return Math.round((pd(b) - pd(a)) / 86400000);
}

/* Weather delay: pick "just this day" or roll the next few days forward too. Every moved stop remembers where it came from so one tap can undo it. */
function openWeather(d) {
  var p = panel();
  p.appendChild(el("h2", null, "Weather delay"));
  p.appendChild(
    el(
      "p",
      "note",
      "Moves scheduled stops to the following day. Done and skipped stops stay put. Rolling forward keeps your route order and stops days from piling up on top of each other. You can undo it afterward."
    )
  );
  var lab = el("label", null, "How many days?"),
    sel = document.createElement("select");
  for (var n = 0; n <= 6; n++) {
    var o = document.createElement("option");
    o.value = n;
    o.textContent =
      n === 0
        ? "Just this day (" + dlabel(d) + ")"
        : "This day and the next " + n + " day" + (n > 1 ? "s" : "") + " (rolls everything forward)";
    sel.appendChild(o);
  }
  lab.appendChild(sel);
  p.appendChild(lab);
  var pv = el("div", "note");
  pv.style.cssText = "margin:10px 0;white-space:pre-line";
  p.appendChild(pv);
  function cnt(day) {
    return onDay(day).filter(function (v) {
      return v.status === "scheduled";
    }).length;
  }
  function prev() {
    var n = +sel.value,
      ls = [],
      tot = 0;
    for (var i = 0; i <= n; i++) {
      var day = addDays(d, i),
        c = cnt(day);
      tot += c;
      ls.push(dshort(day) + ": " + c + " stop" + (c === 1 ? "" : "s") + " → " + dshort(addDays(day, 1)));
    }
    pv.textContent = ls.join("\n");
    go.disabled = !tot;
    go.textContent = tot ? "Delay " + tot + " stop" + (tot > 1 ? "s" : "") : "Nothing to move";
  }
  var go = btn("Delay", "btn", function () {
    go.disabled = true;
    doDelay(d, +sel.value);
  });
  go.style.marginTop = "6px";
  sel.addEventListener("change", prev);
  p.appendChild(go);
  prev();
}
function doDelay(d, n) {
  var key = "w|" + d + "|" + Date.now(),
    chain = Promise.resolve(null);
  for (var i = n; i >= 0; i--) {
    (function (day) {
      chain = chain.then(function (err) {
        if (err) return err;
        return sb
          .from("visits")
          .update(
            Object.assign(
              { scheduled_date: addDays(day, 1), weather_from: day, weather_batch: key },
              remOn() ? { reminded_at: null } : {}
            )
          )
          .eq("scheduled_date", day)
          .eq("status", "scheduled")
          .then(function (r) {
            return r.error || null;
          });
      });
    })(addDays(d, i));
  }
  chain.then(function (err) {
    if (err) {
      closeDetail();
      alert(
        /weather_/.test(err.message || "")
          ? "Weather delay needs a one-time setup. Run the weather SQL in Supabase (SQL Editor), then try again."
          : "Something went wrong while moving the stops. Check the schedule; Undo weather delay will put back anything that moved."
      );
      loadVisits().then(render);
      return;
    }
    loadVisits().then(function () {
      closeDetail();
      render();
      catchup(
        visits.filter(function (v) {
          return v.weather_batch === key && v.status === "scheduled";
        }),
        key,
        function () {
          render();
          remindPanel(
            visits.filter(function (v) {
              return v.weather_batch === key && v.status === "scheduled";
            }),
            "delay",
            "Let clients know"
          );
        }
      );
    });
  });
}
function undoWeather(key) {
  var vs = visits.filter(function (v) {
    return v.weather_from && gk(v) === key && (v.status === "scheduled" || v.status === "skipped");
  });
  if (!vs.length) return;
  if (
    !confirm(
      "Put " +
        vs.length +
        " visit" +
        (vs.length > 1 ? "s" : "") +
        " back on their original days (including any catch-up changes made with this)?"
    )
  )
    return;
  var by = {};
  vs.forEach(function (v) {
    (by[v.weather_from] = by[v.weather_from] || []).push(v.id);
  });
  Promise.all(
    Object.keys(by).map(function (f) {
      return sb
        .from("visits")
        .update({ scheduled_date: f, weather_from: null, weather_batch: null, status: "scheduled" })
        .in("id", by[f]);
    })
  ).then(function (rs) {
    if (
      rs.some(function (r) {
        return r.error;
      })
    )
      alert("Could not undo everything.");
    loadVisits().then(render);
  });
}
function wxBanners(list, d) {
  var g = {};
  visits.forEach(function (v) {
    if (!v.weather_from) return;
    var rst = /#R$/.test(v.weather_batch || "");
    if (v.status === "skipped" && !v.weather_batch) return;
    if (v.status !== "scheduled" && v.status !== "skipped") return;
    if (v.status === "scheduled" && v.scheduled_date === v.weather_from) return;
    var k = gk(v),
      x = (g[k] = g[k] || { moved: 0, adj: 0, first: null, hit: false });
    if (v.status === "skipped" || rst) x.adj++;
    else {
      x.moved++;
      if (!x.first || v.weather_from < x.first) x.first = v.weather_from;
    }
    if (v.weather_from === d || v.scheduled_date === d) x.hit = true;
  });
  Object.keys(g)
    .sort()
    .forEach(function (k) {
      var x = g[k];
      if (!x.hit) return;
      var man = k.charAt(0) === "m",
        t = man
          ? "↔ Catch-up change: " + x.adj + " visit" + (x.adj > 1 ? "s" : "") + " adjusted."
          : "☔ Weather delay" +
            (x.first ? " from " + dshort(x.first) : "") +
            ": " +
            x.moved +
            " stop" +
            (x.moved === 1 ? "" : "s") +
            " moved" +
            (x.adj ? " · " + x.adj + " catch-up change" + (x.adj > 1 ? "s" : "") : "") +
            ".";
      var b = el("div", "wxbar");
      b.appendChild(el("span", null, t));
      b.appendChild(
        btn(man ? "Undo" : "Undo weather delay", "btn alt sm", function () {
          undoWeather(k);
        })
      );
      list.appendChild(b);
    });
}

/* Smart catch-up: after a repeating (weekly / every 2 weeks) visit is pushed later, check whether the next one is now too close. */
function catchup(moved, key, after) {
  var cons = [],
    seen = {};
  moved
    .slice()
    .sort(function (a, b) {
      return a.orig_date < b.orig_date ? -1 : 1;
    })
    .forEach(function (mv) {
      var jb = byId(jobs, mv.job_id);
      if (
        !jb ||
        jb.status !== "active" ||
        (jb.frequency !== "weekly" && jb.frequency !== "biweekly") ||
        seen[jb.id]
      )
        return;
      seen[jb.id] = 1;
      var iv = jb.frequency === "weekly" ? 7 : 14,
        nx = visits
          .filter(function (v) {
            return (
              v.job_id === jb.id && v.status === "scheduled" && v.id !== mv.id && v.orig_date > mv.orig_date
            );
          })
          .sort(function (a, b) {
            return a.orig_date < b.orig_date ? -1 : 1;
          })[0];
      if (!nx) return;
      var gap = ddiff(mv.scheduled_date, nx.scheduled_date);
      if (gap <= Math.floor(iv / 2)) cons.push({ mv: mv.id, nx: nx.id, job: jb, iv: iv, gap: gap });
    });
  if (!cons.length) {
    after();
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Catch-up check"));
  p.appendChild(
    el(
      "p",
      "note",
      "These repeating jobs now have a cut very close to the next one. Choose what to do for each. Leaving it alone keeps both visits."
    )
  );
  var cards = [];
  function act(c, kind, card, row) {
    var mv = byId(visits, c.mv),
      nx = byId(visits, c.nx);
    if (!mv || !nx) return Promise.resolve();
    var f = wxOn() ? { weather_from: nx.scheduled_date, weather_batch: key } : {},
      ps;
    if (kind === "skip") {
      ps = [
        sb
          .from("visits")
          .update(Object.assign({ status: "skipped" }, f))
          .eq("id", nx.id)
      ];
    } else {
      var delta = ddiff(nx.scheduled_date, addDays(mv.scheduled_date, c.iv));
      ps = visits
        .filter(function (v) {
          return v.job_id === c.job.id && v.status === "scheduled" && v.orig_date >= nx.orig_date;
        })
        .map(function (v) {
          return sb
            .from("visits")
            .update(
              Object.assign(
                { scheduled_date: addDays(v.scheduled_date, delta) },
                wxOn() ? { weather_from: v.scheduled_date, weather_batch: key + "#R" } : {}
              )
            )
            .eq("id", v.id);
        });
    }
    return Promise.all(ps).then(function (rs) {
      row.textContent = "";
      row.appendChild(
        el(
          "div",
          "note",
          rs.some(function (r) {
            return r.error;
          })
            ? "Could not save that."
            : kind === "skip"
              ? "✓ Next visit skipped."
              : "✓ Schedule reset: every " +
                (c.iv === 7 ? "week" : "2 weeks") +
                " from " +
                dshort(mv.scheduled_date) +
                "."
        )
      );
      return loadVisits().then(render);
    });
  }
  cons.forEach(function (c) {
    var mv = byId(visits, c.mv),
      nx = byId(visits, c.nx),
      card = el("div", "pcard"),
      row = el("div", "acts");
    card.appendChild(
      el(
        "b",
        null,
        cname(mv.client_id) + " · " + c.job.title + " (" + flabel(c.job.frequency).toLowerCase() + ")"
      )
    );
    card.appendChild(
      el(
        "div",
        "note",
        "This cut is now " +
          dshort(mv.scheduled_date) +
          " and the next is " +
          dshort(nx.scheduled_date) +
          (c.gap > 0
            ? ", only " + c.gap + " day" + (c.gap > 1 ? "s" : "") + " later."
            : ", the same day or earlier.")
      )
    );
    var rs = btn(
      "Reset: next one " + (c.iv === 7 ? "1 week" : "2 weeks") + " after this cut (recommended)",
      "btn sm",
      function () {
        act(c, "reset", card, row);
      }
    );
    row.appendChild(rs);
    row.appendChild(
      btn("Skip the next one", "btn alt sm", function () {
        act(c, "skip", card, row);
      })
    );
    row.appendChild(
      btn("Keep both", "btn alt sm", function () {
        row.textContent = "";
        row.appendChild(el("div", "note", "Kept as scheduled."));
      })
    );
    card.appendChild(row);
    card.style.marginBottom = "10px";
    p.appendChild(card);
    cards.push({ c: c, card: card, row: row });
  });
  var dn = btn("Done", "btn", function () {
    closeDetail();
    after();
  });
  dn.style.marginTop = "8px";
  p.appendChild(dn);
}
