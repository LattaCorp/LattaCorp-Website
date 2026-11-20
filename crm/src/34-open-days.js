/* Open days: how busy each coming work day is, so while talking to a client you can see the lightest days at a glance.
   Workload: each stop counts by its size. A regular yard counts 1 (or its price / $45 when bigger), and an HOA or
   commercial stop counts at least 4, even when its per-visit price is $0 because it's billed by contract. Time off on the calendar marks the day Off. Which weekdays count as work days is saved
   on this device (default Monday to Saturday). Opens from Schedule, Jobs and Leads, and the job form. */
var OD_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function odWorkdays() {
  var w = "123456";
  try {
    w = localStorage.getItem("lc_workdays") || w;
  } catch (e) {}
  return w;
}
function odLoad(d) {
  var vs = visits.filter(function (v) {
      return v.scheduled_date === d && v.status !== "skipped";
    }),
    off = (typeof calEvents !== "undefined" ? calEvents : []).some(function (ev) {
      return ev.event_date === d && ev.kind === "timeoff";
    });
  var big = 0,
    amt = vs.reduce(function (s, v) {
      return s + odWeight(v, function () {
        big++;
      });
    }, 0);
  return { d: d, stops: vs.length, big: big, amt: Math.round(amt * 10) / 10, off: off };
}
function odWeight(v, onBig) {
  var c = byId(clients, v.client_id),
    w = Math.max(1, Number(v.price || 0) / 45);
  if (c && (c.type === "hoa" || c.type === "commercial")) {
    if (onBig) onBig();
    w = Math.max(w, 4);
  }
  return w;
}
/* the next `n` work days starting tomorrow (or today), each with its load; `light` marks the lightest few */
function odDays(n, fromToday) {
  var wd = odWorkdays(),
    out = [],
    d = fromToday ? today() : addDays(today(), 1),
    guard = 0;
  while (out.length < n && guard++ < 200) {
    if (wd.indexOf(String(pd(d).getDay())) > -1) out.push(odLoad(d));
    d = addDays(d, 1);
  }
  var open = out
    .filter(function (x) {
      return !x.off;
    })
    .slice()
    .sort(function (a, b) {
      return a.amt - b.amt || a.stops - b.stops || (a.d < b.d ? -1 : 1);
    });
  open.slice(0, 3).forEach(function (x) {
    x.light = true;
  });
  return out;
}
function odColor(x, max) {
  if (x.off) return "#b9b2a6";
  var r = max ? x.amt / max : 0;
  return r < 0.34 ? "#2e7d4f" : r < 0.67 ? "#c99a2e" : "#b3261e";
}
/* the chart: one row per day, bar length = workload. Tapping a day opens it on the Schedule (or calls onPick). */
function odChart(host, days, onPick) {
  var max = Math.max.apply(
      null,
      days.map(function (x) {
        return x.amt;
      }).concat([1])
    ),
    wrap = el("div", "odchart"),
    lastWk = null;
  days.forEach(function (x) {
    var wk = mondayOf(x.d);
    if (lastWk && wk !== lastWk) wrap.appendChild(el("div", "odsep"));
    lastWk = wk;
    var row = el("button", "odrow" + (x.light ? " light" : "") + (x.off ? " off" : ""));
    row.type = "button";
    row.title = x.off ? "Time off" : x.stops + " stops";
    var lab = el("span", "odday", dshort(x.d));
    var track = el("span", "odtrack"),
      bar = el("span", "odbar");
    bar.style.width = x.off ? "100%" : Math.max(x.amt ? 4 : 0, Math.round((x.amt / max) * 100)) + "%";
    bar.style.background = odColor(x, max);
    track.appendChild(bar);
    var info = el(
      "span",
      "odinfo",
      x.off
        ? "Off"
        : x.stops
          ? x.stops + " stop" + (x.stops > 1 ? "s" : "") + (x.big ? " · " + x.big + " HOA/comm." : "")
          : "Open"
    );
    row.appendChild(lab);
    row.appendChild(track);
    row.appendChild(info);
    if (x.light) row.appendChild(el("span", "odtag", "Lightest"));
    row.addEventListener("click", function () {
      if (onPick) return onPick(x.d);
      closeDetail();
      view = "schedule";
      smode = "day";
      selDate = x.d;
      render();
      window.scrollTo(0, 0);
    });
    wrap.appendChild(row);
  });
  host.appendChild(wrap);
}
function openOpenDays() {
  var p = panel(),
    span = 14;
  try {
    span = +localStorage.getItem("lc_od_span") || 14;
  } catch (e) {}
  p.appendChild(el("h2", null, "Open days"));
  p.appendChild(
    el(
      "p",
      "note",
      "How full each coming work day is. Longer bar = more work: bigger yards count more, and HOA and commercial stops count as big jobs. Green is light, red is busy. The 3 lightest days are marked. Tap a day to open it on the Schedule."
    )
  );
  var tabs = el("div", "tabs subtabs");
  [
    [14, "2 weeks"],
    [24, "4 weeks"],
    [48, "8 weeks"]
  ].forEach(function (o) {
    var b = el("button", "tab" + (span === o[0] ? " on" : ""), o[1]);
    b.type = "button";
    b.addEventListener("click", function () {
      try {
        localStorage.setItem("lc_od_span", String(o[0]));
      } catch (e) {}
      openOpenDays();
    });
    tabs.appendChild(b);
  });
  p.appendChild(tabs);
  var days = odDays(span, true),
    light = days.filter(function (x) {
      return x.light;
    });
  if (light.length) {
    var best = el(
      "p",
      null,
      "Lightest: " +
        light
          .slice()
          .sort(function (a, b) {
            return a.d < b.d ? -1 : 1;
          })
          .map(function (x) {
            return dshort(x.d);
          })
          .join(",  ")
    );
    best.style.cssText = "font-weight:700;color:var(--forest);margin:10px 0 4px";
    p.appendChild(best);
  }
  odChart(p, days);
  // which weekdays count as work days (this device)
  var ws = el("div", "sec");
  ws.appendChild(el("h3", null, "Work days"));
  var chips = el("div", "acts"),
    wd = odWorkdays();
  OD_DAYS.forEach(function (nm, i) {
    var on = wd.indexOf(String(i)) > -1,
      b = btn(nm, "btn sm" + (on ? "" : " alt"), function () {
        var cur = odWorkdays();
        cur = on ? cur.replace(String(i), "") : (cur + i).split("").sort().join("");
        if (!cur) return;
        try {
          localStorage.setItem("lc_workdays", cur);
        } catch (e) {}
        openOpenDays();
      });
    chips.appendChild(b);
  });
  ws.appendChild(chips);
  ws.appendChild(el("p", "note", "Saved on this device. Add “Time off” on the Schedule (+ Add event) to block a day."));
  p.appendChild(ws);
}
/* a short strip of the lightest coming days, for forms: tap one to use it */
function odPicker(onPick) {
  var w = el("div", "odpick"),
    days = odDays(14, false)
      .filter(function (x) {
        return x.light;
      })
      .sort(function (a, b) {
        return a.d < b.d ? -1 : 1;
      });
  if (!days.length) return w;
  w.appendChild(el("span", "note", "Lightest days coming up:"));
  days.forEach(function (x) {
    var b = btn(
      dshort(x.d) + (x.stops ? " · " + x.stops + " stop" + (x.stops > 1 ? "s" : "") : " · open"),
      "btn alt sm",
      function () {
        onPick(x.d);
      }
    );
    w.appendChild(b);
  });
  return w;
}
