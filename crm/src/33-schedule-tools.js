/* Schedule tools: winter break, Reset schedule, "done on a different day" re-spacing, shifting a range of days, and
   catching up overdue visits. Done, skipped and billed visits are never moved or deleted by any of these. */

/* ---- winter break ----
   Every year between business.winter_start and winter_end (MM-DD, default Jan 25 to Feb 25), weekly jobs with
   winter_break on go every 2 weeks, then back to weekly. Every-2-weeks jobs stay as they are. */
var MONTHS3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function winterDates() {
  var s = biz && biz.winter_start,
    e = biz && biz.winter_end;
  if (!s || !e || !/^\d\d-\d\d$/.test(s) || !/^\d\d-\d\d$/.test(e)) return null;
  return { s: s, e: e };
}
function mdText(md) {
  return MONTHS3[+md.slice(0, 2) - 1] + " " + +md.slice(3);
}
function winterText() {
  var w = winterDates();
  return w ? mdText(w.s) + " – " + mdText(w.e) : "(winter dates not set)";
}
function inWinter(d) {
  var w = winterDates();
  if (!w) return false;
  var md = d.slice(5);
  return w.s <= w.e ? md >= w.s && md <= w.e : md >= w.s || md <= w.e;
}
function winterOn(j) {
  return !!(j && j.frequency === "weekly" && j.winter_break !== false && "winter_break" in j && winterDates());
}
function winterLine(j) {
  if (!j || j.frequency !== "weekly" || !("winter_break" in j)) return "";
  return winterOn(j) ? "Every 2 weeks " + winterText() + ", then weekly" : "Off (stays weekly all winter)";
}
/* days from one visit to the next, counted from visit day d */
function visitStep(job, d) {
  // inside the winter window a weekly job skips every other week; once the next week is past the window it's weekly again
  if (job.frequency === "weekly") return winterOn(job) && inWinter(d) && inWinter(addDays(d, 7)) ? 14 : 7;
  return 14;
}
/* the next date a job wants a visit on or after day d (keeps its weekday/rhythm) */
function stepFrom(job, d) {
  return addDays(d, visitStep(job, d));
}

/* Brings a job's future scheduled visits in line with its rules (after the winter break or winter dates change):
   removes upcoming visits that are no longer on its rhythm, then tops up the missing ones. */
function syncJobVisits(list) {
  var t = today(),
    end = addDays(t, 84),
    ids = [];
  list.forEach(function (j) {
    if (j.status !== "active" || j.frequency === "once") return;
    var want = {};
    visitDates(j).forEach(function (d) {
      want[d] = 1;
    });
    visits.forEach(function (v) {
      if (
        v.job_id === j.id &&
        v.status === "scheduled" &&
        vKind(v) === "visit" &&
        v.scheduled_date >= t &&
        v.orig_date <= end &&
        !want[v.orig_date]
      )
        ids.push(v.id);
    });
  });
  var del = ids.length ? sb.from("visits").delete().in("id", ids) : Promise.resolve({});
  return Promise.resolve(del).then(function () {
    return loadVisits().then(function () {
      return topUp();
    });
  });
}

/* ---- Reset schedule: start a job's rhythm over from a chosen date ---- */
function resetJobSchedule(j, start, freq, winter) {
  var t = today(),
    patch = { anchor_date: start, frequency: freq };
  if ("winter_break" in j && winter != null) patch.winter_break = !!winter;
  return sb
    .from("jobs")
    .update(patch)
    .eq("id", j.id)
    .then(function (r) {
      if (r.error) throw r.error;
      Object.assign(j, patch);
      // upcoming regular visits make way for the new rhythm (extra visits and add-ons stay)
      var ids = visits
        .filter(function (v) {
          return v.job_id === j.id && v.status === "scheduled" && vKind(v) === "visit" && v.scheduled_date >= t;
        })
        .map(function (v) {
          return v.id;
        });
      return ids.length ? sb.from("visits").delete().in("id", ids) : null;
    })
    .then(function () {
      return loadVisits();
    })
    .then(function () {
      return topUp();
    });
}
function openResetSchedule(j, back) {
  var p = panel(),
    nv = nextVisit(j);
  p.appendChild(el("h2", null, "Reset schedule"));
  p.appendChild(el("p", "note", cname(j.client_id) + " · " + j.title));
  p.appendChild(
    el(
      "p",
      "note",
      "Pick the next real visit. Every upcoming visit for this job is redone from that day. Done, skipped and billed visits stay as they are, and so do extra visits and add-ons."
    )
  );
  var nd = fld("Next visit", "date", nv ? nv.scheduled_date : today()),
    fq = fld("How often", "select", j.frequency, FREQ.filter(function (f) {
      return f[0] !== "once";
    })),
    wb = checkRow("Winter break: every 2 weeks " + winterText() + ", then weekly", j.winter_break !== false);
  wb.hidden = fq.input.value !== "weekly" || !("winter_break" in j);
  fq.input.addEventListener("change", function () {
    wb.hidden = fq.input.value !== "weekly" || !("winter_break" in j);
    prev();
  });
  var g = el("div", "grid2");
  g.appendChild(nd);
  g.appendChild(fq);
  p.appendChild(g);
  p.appendChild(wb);
  var pv = el("div", "note");
  pv.style.cssText = "margin:10px 0;white-space:pre-line";
  p.appendChild(pv);
  function prev() {
    if (!nd.input.value) {
      pv.textContent = "";
      return;
    }
    var tmp = Object.assign({}, j, { frequency: fq.input.value, winter_break: wb.box.checked }),
      d = nd.input.value,
      ls = [];
    for (var i = 0; i < 5; i++) {
      ls.push(dshort(d) + (fq.input.value === "weekly" && winterOn(tmp) && inWinter(d) ? "  ❄" : ""));
      d = stepFrom(tmp, d);
    }
    pv.textContent = "Next visits: " + ls.join(",  ") + " …";
  }
  nd.input.addEventListener("change", prev);
  wb.box.addEventListener("change", prev);
  prev();
  var a = el("div", "actions");
  var go = btn("Reset schedule", "btn", function () {
    if (!nd.input.value) {
      alert("Pick the next visit date.");
      return;
    }
    if (nd.input.value < today() && !confirm("That date is in the past. Reset from it anyway?")) return;
    go.disabled = true;
    resetJobSchedule(j, nd.input.value, fq.input.value, wb.box.checked).then(
      function () {
        render();
        if (back) back();
        else openJob(j.id);
      },
      function () {
        go.disabled = false;
        alert("Could not reset the schedule. Run the Stage 57 SQL in Supabase first.");
      }
    );
  });
  a.appendChild(go);
  a.appendChild(
    btn("Cancel", "btn alt", function () {
      if (back) back();
      else openJob(j.id);
    })
  );
  p.appendChild(a);
}

/* ---- done on a different day ----
   When a repeating visit is done on another day than planned, it moves to the day it was done, and Foreman offers to
   re-space that job's next visits from there (one week / two weeks later, winter-aware). */
function respaceCandidates(done) {
  var t = today(),
    out = [],
    seen = {};
  done
    .slice()
    .sort(function (a, b) {
      return a.scheduled_date < b.scheduled_date ? 1 : -1; // latest first: re-space from each job's latest cut
    })
    .forEach(function (v) {
      var j = byId(jobs, v.job_id);
      if (!j || j.status !== "active" || j.frequency === "once" || seen[j.id] || vKind(v) !== "visit") return;
      seen[j.id] = 1;
      var want = stepFrom(j, v.scheduled_date),
        nx = visits
          .filter(function (x) {
            return x.job_id === j.id && x.status === "scheduled" && vKind(x) === "visit" && x.scheduled_date > v.scheduled_date;
          })
          .sort(function (a, b) {
            return a.scheduled_date < b.scheduled_date ? -1 : 1;
          })[0];
      if (nx && nx.scheduled_date === want) return;
      if (want < t) {
        // already overdue by the new rhythm: start from today's side
        while (want < t) want = stepFrom(j, want);
      }
      if (nx && nx.scheduled_date === want) return;
      out.push({ j: j, v: v, nx: nx, want: want });
    });
  return out;
}
function offerRespace(done, after) {
  var cs = respaceCandidates(done);
  if (!cs.length) {
    if (after) after();
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Line up the next visits?"));
  p.appendChild(
    el(
      "p",
      "note",
      "These were done on a different day than planned. Re-spacing moves each job's upcoming visits so they keep the same rhythm from the day the work was actually done."
    )
  );
  cs.forEach(function (c) {
    var card = el("div", "pcard"),
      row = el("div", "acts");
    card.style.marginBottom = "10px";
    card.appendChild(el("b", null, cname(c.j.client_id) + " · " + c.j.title + " (" + flabel(c.j.frequency).toLowerCase() + ")"));
    card.appendChild(
      el(
        "div",
        "note",
        "Done " +
          dshort(c.v.scheduled_date) +
          ". " +
          (c.nx ? "Next visit is " + dshort(c.nx.scheduled_date) + "." : "No next visit yet.") +
          " Re-spaced, the next one is " +
          dshort(c.want) +
          (inWinter(c.want) && winterOn(c.j) ? " (winter break: every 2 weeks)" : "") +
          "."
      )
    );
    var go = btn("Re-space from " + dshort(c.want) + " (recommended)", "btn sm", function () {
      go.disabled = true;
      resetJobSchedule(c.j, c.want, c.j.frequency, null).then(
        function () {
          row.textContent = "";
          row.appendChild(el("div", "note", "✓ Next visit " + dshort(c.want) + ", then on the usual rhythm."));
        },
        function () {
          go.disabled = false;
          alert("Could not save that. Run the Stage 57 SQL in Supabase first.");
        }
      );
    });
    row.appendChild(go);
    row.appendChild(
      btn("Keep as scheduled", "btn alt sm", function () {
        row.textContent = "";
        row.appendChild(el("div", "note", "Kept as scheduled."));
      })
    );
    card.appendChild(row);
    p.appendChild(card);
  });
  var dn = btn("Done", "btn", function () {
    closeDetail();
    render();
    if (after) after();
  });
  dn.style.marginTop = "8px";
  p.appendChild(dn);
}
/* inline "which day was it done?" picker inside a visit card's buttons */
function pickDoneDay(v, a, onPick, onCancel) {
  a.textContent = "";
  var lab = el("span", "note", "Done on:");
  lab.style.alignSelf = "center";
  a.appendChild(lab);
  var di = document.createElement("input");
  di.type = "date";
  di.value = v.scheduled_date < today() ? v.scheduled_date : today();
  di.max = today();
  di.style.width = "auto";
  a.appendChild(di);
  a.appendChild(
    btn("Save", "btn sm", function () {
      if (!di.value) return;
      if (di.value > today()) {
        alert("That day hasn't happened yet.");
        return;
      }
      onPick(di.value);
    })
  );
  if (v.scheduled_date !== today() && v.scheduled_date < today())
    a.appendChild(
      btn("Today", "btn alt sm", function () {
        onPick(today());
      })
    );
  a.appendChild(btn("Cancel", "btn alt sm", onCancel));
}
function doneStamp(day) {
  return day === today() ? new Date().toISOString() : new Date(day + "T12:00:00").toISOString();
}

/* ---- shift a range of days (rainy week, holiday, equipment down) ----
   Every scheduled stop from one day through another moves the same number of days later (or earlier). Each moved
   stop remembers its old day, so one tap undoes it, and clients see "Moved from" in the portal. */
function openShiftDays(from, thru) {
  var p = panel();
  p.appendChild(el("h2", null, "Shift days"));
  p.appendChild(
    el(
      "p",
      "note",
      "Moves every scheduled stop in a range of days by the same number of days. Done and skipped stops stay put. You can undo it afterward from the Schedule."
    )
  );
  var f = fld("From", "date", from || today()),
    t = fld("Through", "date", thru || addDays(from || today(), 6)),
    n = fld(
      "Move them",
      "select",
      "1",
      [-3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 14].map(function (k) {
        return [String(k), (k > 0 ? k + " day" + (k > 1 ? "s" : "") + " later" : -k + " day" + (k < -1 ? "s" : "") + " earlier") + (k === 7 ? " (1 week)" : k === 14 ? " (2 weeks)" : "")];
      })
    ),
    why = fld("Reason (clients see this in their portal)", "select", "s", [
      ["s", "Schedule change (shows “Moved from …”)"],
      ["w", "Weather (shows “Moved because of weather”)"]
    ]);
  var g = el("div", "grid2");
  g.appendChild(f);
  g.appendChild(t);
  p.appendChild(g);
  p.appendChild(n);
  p.appendChild(why);
  var pv = el("div", "note");
  pv.style.cssText = "margin:10px 0;white-space:pre-line";
  p.appendChild(pv);
  function pick() {
    var a = f.input.value,
      b = t.input.value;
    if (!a || !b || b < a) return [];
    return visits.filter(function (v) {
      return v.status === "scheduled" && v.scheduled_date >= a && v.scheduled_date <= b;
    });
  }
  var go = btn("Shift", "btn", function () {
    var vs = pick(),
      k = +n.input.value;
    if (!vs.length) return;
    if (!confirm("Move " + vs.length + " stop" + (vs.length > 1 ? "s" : "") + " " + n.input.selectedOptions[0].textContent.toLowerCase() + "?")) return;
    go.disabled = true;
    var key = why.input.value + "|" + f.input.value + "|" + Date.now();
    Promise.all(
      vs.map(function (v) {
        var pp = { scheduled_date: addDays(v.scheduled_date, k) };
        // a stop moved before keeps its first "moved from" day, so Undo puts it back where it started
        if (wxOn()) {
          pp.weather_from = v.weather_from || v.scheduled_date;
          pp.weather_batch = key;
        }
        if (remOn()) pp.reminded_at = null;
        return sb.from("visits").update(pp).eq("id", v.id);
      })
    ).then(function (rs) {
      if (
        rs.some(function (r) {
          return r.error;
        })
      )
        alert("Some stops could not be moved. Check the schedule.");
      return loadVisits();
    }).then(function () {
      closeDetail();
      render();
      if (k > 0)
        catchup(
          visits.filter(function (v) {
            return v.weather_batch === key && v.status === "scheduled";
          }),
          key,
          function () {
            render();
          }
        );
    });
  });
  function prev() {
    var vs = pick(),
      k = +n.input.value,
      by = {};
    vs.forEach(function (v) {
      by[v.scheduled_date] = (by[v.scheduled_date] || 0) + 1;
    });
    pv.textContent = Object.keys(by)
      .sort()
      .map(function (d) {
        return dshort(d) + ": " + by[d] + " stop" + (by[d] > 1 ? "s" : "") + " → " + dshort(addDays(d, k));
      })
      .join("\n");
    go.disabled = !vs.length;
    go.textContent = vs.length ? "Shift " + vs.length + " stop" + (vs.length > 1 ? "s" : "") : "Nothing scheduled in those days";
  }
  [f, t, n].forEach(function (x) {
    x.input.addEventListener("change", prev);
  });
  go.style.marginTop = "6px";
  p.appendChild(go);
  prev();
}

/* ---- Catch up overdue visits: past stops still marked scheduled, sorted out client by client ---- */
function openCatchUp() {
  var t = today(),
    od = visits
      .filter(function (v) {
        return v.status === "scheduled" && v.scheduled_date < t;
      })
      .sort(function (a, b) {
        return cname(a.client_id) < cname(b.client_id) ? -1 : cname(a.client_id) > cname(b.client_id) ? 1 : a.scheduled_date < b.scheduled_date ? -1 : 1;
      });
  var p = panel();
  p.appendChild(el("h2", null, "Catch up overdue visits"));
  if (!od.length) {
    p.appendChild(el("p", "note", "Nothing overdue. Nice."));
    return;
  }
  p.appendChild(
    el(
      "p",
      "note",
      od.length +
        " past visit" +
        (od.length > 1 ? "s are" : " is") +
        " still marked scheduled. For each one choose Done (and the day it really happened), Skipped, or Leave. Done visits go to To bill as usual. Nothing is saved until you press Save."
    )
  );
  var rows = [];
  var bulk = el("div", "acts");
  bulk.appendChild(
    btn("Mark all skipped", "btn alt sm", function () {
      rows.forEach(function (r) {
        r.set("skip");
      });
    })
  );
  bulk.appendChild(
    btn("Mark all done on their day", "btn alt sm", function () {
      rows.forEach(function (r) {
        r.set("done");
      });
    })
  );
  bulk.appendChild(
    btn("Clear choices", "btn alt sm", function () {
      rows.forEach(function (r) {
        r.set("");
      });
    })
  );
  p.appendChild(bulk);
  var lastC = null;
  od.forEach(function (v) {
    if (v.client_id !== lastC) {
      lastC = v.client_id;
      var h = el("h3", null, cname(v.client_id));
      h.style.cssText = "margin:14px 0 4px;font-size:.98rem;color:var(--forest)";
      p.appendChild(h);
    }
    var row = el("div", "pcard"),
      top = el("div", "note", dshort(v.scheduled_date) + " · " + vTitle(v) + " · " + paddr(v.property_id) + " · " + money(v.price)),
      acts = el("div", "acts"),
      di = document.createElement("input"),
      choice = "";
    row.style.marginBottom = "6px";
    di.type = "date";
    di.value = v.scheduled_date;
    di.max = t;
    di.style.width = "auto";
    di.hidden = true;
    var bD = btn("Done", "btn alt sm", function () {
        set(choice === "done" ? "" : "done");
      }),
      bS = btn("Skipped", "btn alt sm", function () {
        set(choice === "skip" ? "" : "skip");
      });
    function set(c) {
      choice = c;
      bD.className = "btn sm" + (c === "done" ? "" : " alt");
      bS.className = "btn sm" + (c === "skip" ? "" : " alt");
      di.hidden = c !== "done";
      count();
    }
    acts.appendChild(bD);
    acts.appendChild(di);
    acts.appendChild(bS);
    row.appendChild(top);
    row.appendChild(acts);
    p.appendChild(row);
    rows.push({
      v: v,
      set: set,
      get: function () {
        return { c: choice, d: di.value || v.scheduled_date };
      }
    });
  });
  var a = el("div", "actions"),
    save = btn("Save", "btn", go);
  function count() {
    var n = rows.filter(function (r) {
      return r.get().c;
    }).length;
    save.disabled = !n;
    save.textContent = n ? "Save " + n + " change" + (n > 1 ? "s" : "") : "Choose Done or Skipped above";
  }
  function go() {
    var picks = rows
      .map(function (r) {
        return { v: r.v, x: r.get() };
      })
      .filter(function (r) {
        return r.x.c;
      });
    if (picks.some(function (r) { return r.x.c === "done" && r.x.d > t; })) {
      alert("A done date can't be in the future.");
      return;
    }
    save.disabled = true;
    var done = [];
    Promise.all(
      picks.map(function (r) {
        var pp =
          r.x.c === "skip"
            ? wxOn()
              ? { status: "skipped", weather_from: null, weather_batch: null }
              : { status: "skipped" }
            : { status: "done", completed_at: doneStamp(r.x.d), scheduled_date: r.x.d };
        if (r.x.c === "done" && r.x.d !== r.v.scheduled_date && wxOn()) {
          pp.weather_from = null;
          pp.weather_batch = null;
        }
        return sb
          .from("visits")
          .update(pp)
          .eq("id", r.v.id)
          .then(function (res) {
            if (!res.error) {
              Object.assign(r.v, pp);
              if (pp.status === "done") done.push(r.v);
            }
            return res;
          });
      })
    ).then(function (rs) {
      var bad = rs.filter(function (r) {
        return r.error;
      }).length;
      if (bad) alert(bad + " change" + (bad > 1 ? "s" : "") + " could not be saved. Check the Overdue list.");
      var jobsEnded = done
        .map(function (v) {
          return byId(jobs, v.job_id);
        })
        .filter(function (j) {
          return j && j.frequency === "once" && j.status === "active";
        });
      return Promise.all(
        jobsEnded.map(function (j) {
          return sb
            .from("jobs")
            .update({ status: "ended" })
            .eq("id", j.id)
            .then(function () {
              j.status = "ended";
            });
        })
      )
        .then(function () {
          return billErr ? null : loadUnbilled();
        })
        .then(function () {
          render();
          // offer to line up each job's next visits from the latest day it was actually done
          var latest = done.filter(function (v) {
            return v.scheduled_date >= addDays(t, -21);
          });
          offerRespace(latest, function () {
            render();
          });
          if (!respaceCandidates(latest).length) closeDetail();
        });
    });
  }
  a.appendChild(save);
  a.appendChild(btn("Cancel", "btn alt", closeDetail));
  p.appendChild(a);
  count();
}

/* a checkbox with its words beside it; .box is the checkbox */
function checkRow(text, on) {
  var l = el("label");
  l.style.cssText = "display:flex;gap:8px;align-items:center;font-weight:600;margin:8px 0";
  var c = document.createElement("input");
  c.type = "checkbox";
  c.checked = !!on;
  c.style.width = "auto";
  l.appendChild(c);
  l.appendChild(document.createTextNode(" " + text));
  l.box = c;
  return l;
}

/* ---- winter break settings (Schedule settings) ---- */
function winterSettingsBox(host) {
  var box = el("div", "sec");
  box.appendChild(el("h3", null, "Winter break"));
  if (!biz || !("winter_start" in biz)) {
    box.appendChild(el("p", "note", "Run the Stage 57 SQL in Supabase to turn on the winter break."));
    host.appendChild(box);
    return;
  }
  box.appendChild(
    el(
      "p",
      "note",
      "Every year between these days, weekly jobs go every 2 weeks, then back to weekly. Clients see it on their portal. Turn it off for one job from that job's Edit or Reset schedule. Every-2-weeks jobs don't change."
    )
  );
  var w = winterDates() || { s: "01-25", e: "02-25" };
  function mdPick(label, md) {
    var wrap = el("div", "grid2"),
      m = fld(label + " month", "select", String(+md.slice(0, 2)), MONTHS3.map(function (x, i) {
        return [String(i + 1), x];
      })),
      d = fld("Day", "number", String(+md.slice(3)));
    d.input.min = "1";
    d.input.max = "31";
    wrap.appendChild(m);
    wrap.appendChild(d);
    wrap.val = function () {
      var mm = +m.input.value,
        dd = Math.round(+d.input.value);
      var max = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1];
      if (!(dd >= 1 && dd <= max)) return null;
      return pad(mm) + "-" + pad(dd);
    };
    return wrap;
  }
  var s = mdPick("Starts", w.s),
    e = mdPick("Ends", w.e);
  box.appendChild(s);
  box.appendChild(e);
  var n = jobs.filter(function (j) {
    return j.status === "active" && j.frequency === "weekly";
  });
  box.appendChild(
    el(
      "p",
      "note",
      n.length +
        " active weekly job" +
        (n.length === 1 ? "" : "s") +
        ", " +
        n.filter(function (j) {
          return j.winter_break !== false;
        }).length +
        " with the winter break on."
    )
  );
  var sv = btn("Save winter dates", "btn alt sm", function () {
    var a = s.val(),
      b = e.val();
    if (!a || !b) {
      alert("Check the days (February has 28).");
      return;
    }
    sv.disabled = true;
    sb.from("business")
      .update({ winter_start: a, winter_end: b })
      .eq("id", biz.id || 1)
      .then(function (r) {
        if (r.error) {
          sv.disabled = false;
          alert("Could not save the winter dates.");
          return;
        }
        biz.winter_start = a;
        biz.winter_end = b;
        syncJobVisits(n).then(function () {
          sv.disabled = false;
          sv.textContent = "✓ Saved: " + winterText();
          render();
        });
      });
  });
  box.appendChild(sv);
  host.appendChild(box);
}
