/* Route check-off: tap Done on each home, tick the free extras (hedge trimming, weed killing) and leave a note.
   The extras never change the price; they and the note print on that visit's invoice line. */
var ROUTE_EXTRAS = [
  ["hedge", "Hedge trimming"],
  ["weeds", "Weed killing"]
];
function extraLabel(k) {
  var x = ROUTE_EXTRAS.filter(function (e) {
    return e[0] === k;
  })[0];
  return x ? x[1] : k;
}
/* the invoice line for a visit: its name, then what else was done at no charge and the crew's note */
function invLineDesc(v) {
  var parts = [vTitle(v)],
    ex = (v && v.done_extras) || [];
  if (ex.length)
    parts.push(
      "Also done at no charge: " +
        ex
          .map(function (k) {
            return extraLabel(k).toLowerCase();
          })
          .join(", ")
    );
  if (v && v.done_note) parts.push("Note: " + v.done_note);
  return parts.join(" · ");
}
/* the small "also done / note" lines under a finished visit */
function doneInfo(v, host) {
  var ex = (v.done_extras || []).map(extraLabel);
  if (ex.length) host.appendChild(el("div", "donex", "✓ " + ex.join(" · ") + " (no charge)"));
  if (v.done_note) host.appendChild(el("div", "donenote", "“" + v.done_note + "”"));
}
/* the extras checkboxes + note box; returns a getter for what's picked */
function extrasPicker(host, cur, note, es) {
  var t = es
    ? function (s) {
        return crewT(s);
      }
    : function (s) {
        return s;
      };
  var w = el("div", "rxtra"),
    boxes = {};
  ROUTE_EXTRAS.forEach(function (e) {
    var lb = el("label", "chk rxchk"),
      cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = (cur || []).indexOf(e[0]) > -1;
    boxes[e[0]] = cb;
    lb.appendChild(cb);
    lb.appendChild(document.createTextNode(" " + t(e[1])));
    w.appendChild(lb);
  });
  host.appendChild(w);
  var ta = document.createElement("textarea");
  ta.rows = 2;
  ta.maxLength = 500;
  ta.className = "rnote";
  ta.placeholder = t("Note for the client (shows on the invoice)");
  ta.value = note || "";
  host.appendChild(ta);
  return function () {
    return {
      extras: ROUTE_EXTRAS.map(function (e) {
        return e[0];
      }).filter(function (k) {
        return boxes[k].checked;
      }),
      note: ta.value.trim()
    };
  };
}
/* staff marking a visit done (or undoing it) from Route check-off */
function finishVisit(v, done, pick, cb) {
  var p = done
    ? { status: "done", completed_at: new Date().toISOString(), done_extras: pick.extras, done_note: pick.note || null }
    : { status: "scheduled", completed_at: null };
  sb.from("visits")
    .update(p)
    .eq("id", v.id)
    .then(function (r) {
      if (r.error) {
        alert(
          /done_extras|done_note/.test(r.error.message || "")
            ? "Run the Stage 46 SQL in Supabase first."
            : "Could not save that."
        );
        return;
      }
      Object.assign(v, p);
      if (done) callApi("/api/push", "client-visit", { id: v.id });
      var j = byId(jobs, v.job_id),
        jobStep = Promise.resolve();
      if (j && j.frequency === "once") {
        var ns = done ? "ended" : "active";
        if (j.status !== ns && (j.status === "active" || j.status === "ended"))
          jobStep = sb
            .from("jobs")
            .update({ status: ns })
            .eq("id", j.id)
            .then(function () {
              j.status = ns;
            });
      }
      jobStep.then(function () {
        return billErr ? null : loadUnbilled();
      }).then(cb, cb);
    });
}
var routeDate = null,
  routeCrew = "";
function renderRoute() {
  var tabs = $("tabs"),
    list = $("list");
  tabs.textContent = "";
  list.textContent = "";
  var d = routeDate || today();
  list.appendChild(
    calNav(
      longDate(d),
      function () {
        routeDate = addDays(d, -1);
        render();
      },
      function () {
        routeDate = addDays(d, 1);
        render();
      },
      function () {
        routeDate = null;
        render();
      },
      d !== today()
    )
  );
  if (s3 && crew.length) {
    var sel = fld("Crew", "select", routeCrew, [["", "Everyone"], ["none", "Not assigned"]].concat(
      crew.filter(function (c) {
        return c.active !== false;
      }).map(function (c) {
        return [c.id, c.name];
      })
    ));
    sel.classList.add("rcrew");
    sel.input.addEventListener("change", function () {
      routeCrew = sel.input.value;
      render();
    });
    list.appendChild(sel);
  }
  var day = visits
    .filter(function (v) {
      if (v.scheduled_date !== d || v.status === "skipped") return false;
      if (routeCrew === "none") return !v.crew_id;
      if (routeCrew) return v.crew_id === routeCrew;
      return true;
    })
    .sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0) || String(a.created_at).localeCompare(String(b.created_at));
    });
  if (!day.length) {
    list.appendChild(el("div", "empty", "No stops for this day."));
    return;
  }
  var done = day.filter(function (v) {
    return v.status === "done";
  }).length;
  var sum = el("div", "daysum");
  sum.appendChild(el("b", null, day.length + " stop" + (day.length > 1 ? "s" : "") + " · " + done + " done"));
  var bar = el("div", "rbar"),
    fill = el("i");
  fill.style.width = Math.round((done / day.length) * 100) + "%";
  bar.appendChild(fill);
  sum.appendChild(bar);
  list.appendChild(sum);
  day.forEach(function (v, i) {
    var j = byId(jobs, v.job_id),
      look = jobLook(j, v.client_id),
      isDone = v.status === "done",
      card = el("div", "pcard rstop " + look.cls + (isDone ? " isdone" : ""));
    var hd = el("div", "rhd");
    hd.appendChild(el("span", "vnum", String(i + 1)));
    var nm = el("div");
    nm.appendChild(el("b", null, cname(v.client_id)));
    nm.appendChild(el("div", "note", vTitle(v) + (s3 && v.crew_id && crewName(v.crew_id) ? " · " + crewName(v.crew_id) : "")));
    hd.appendChild(nm);
    if (isDone) hd.appendChild(el("span", "chip won", "Done"));
    card.appendChild(hd);
    var ad = el("a", "raddr", paddr(v.property_id));
    ad.href = mapsUrl(paddr(v.property_id));
    ad.target = "_blank";
    ad.rel = "noopener";
    card.appendChild(ad);
    var pp = byId(props, v.property_id),
      tips = [pp && pp.notes, j && j.instructions].filter(Boolean).join("  |  ");
    if (tips) {
      var tn = el("div", "note", "⚠ " + tips);
      tn.style.cssText = "color:#7a5b00;white-space:pre-wrap;margin-top:4px";
      card.appendChild(tn);
    }
    var acts = el("div", "acts");
    if (isDone) {
      doneInfo(v, card);
      if (!v.invoice_id && !v.paid_at) {
        acts.appendChild(
          btn("Edit extras / note", "btn alt sm", function () {
            acts.textContent = "";
            var get = extrasPicker(card, v.done_extras, v.done_note);
            card.appendChild(acts);
            acts.appendChild(
              btn("Save", "btn sm", function () {
                finishVisit(v, true, get(), render);
              })
            );
            acts.appendChild(btn("Cancel", "btn alt sm", render));
          })
        );
        acts.appendChild(
          btn("Undo", "btn alt sm", function () {
            finishVisit(v, false, null, render);
          })
        );
      } else acts.appendChild(el("span", "note", "On an invoice"));
    } else {
      var getP = extrasPicker(card, v.done_extras, v.done_note);
      acts.appendChild(
        btn("✓ Done", "btn rdone", function () {
          finishVisit(v, true, getP(), render);
        })
      );
    }
    card.appendChild(acts);
    list.appendChild(card);
  });
}
