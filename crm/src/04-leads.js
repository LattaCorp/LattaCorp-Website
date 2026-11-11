/* Leads tab: requests from the website, their status, and turning a lead into a client. */

/* Leads page: website requests AND the quotes / estimates you send, as one board of the same cards, in columns:
   New Requests | Pending Quotes | Approved by Client. A quote made from a website request is one card, not two.
   Filter pills (tap to turn on, tap again to turn off): New, Pending, Approved, Declined. No pills on = the three
   working columns. Making the job from an approved card keeps it under Approved for two weeks with a "View job"
   link (all of them show when the Approved pill is on). Declined holds declined, expired and lost ones. */
var PIPE_COLS = [
  ["new", "New Requests", "New"],
  ["quoted", "Pending Quotes", "Pending"],
  ["approved", "Approved by Client", "Approved"],
  ["lost", "Declined", "Declined"]
];
var LF = [];
function pipeItems() {
  var byLead = {},
    items = [];
  estimates.forEach(function (e) {
    if (e.lead_id && (!byLead[e.lead_id] || e.number > byLead[e.lead_id].number)) byLead[e.lead_id] = e;
  });
  leads.forEach(function (l) {
    items.push({ lead: l, est: byLead[l.id] || null });
  });
  estimates.forEach(function (e) {
    if (e.lead_id && byId(leads, e.lead_id) && byLead[e.lead_id] === e) return;
    if (e.lead_id && byId(leads, e.lead_id)) return; // an older quote for the same request
    items.push({ lead: null, est: e });
  });
  return items;
}
function pipeJob(it) {
  var id = (it.est && it.est.job_id) || (it.lead && it.lead.job_id);
  return id ? byId(jobs, id) || { id: id } : null;
}
function pipeStage(it) {
  var e = it.est,
    l = it.lead;
  if (pipeJob(it)) return "won";
  if (e) {
    if (e.status === "accepted") return "approved";
    if (e.status === "declined" || estExpired(e)) return "lost";
    return "quoted";
  }
  if (l.status === "won") return "approved";
  if (l.status === "lost") return "lost";
  if (l.status === "quoted") return "quoted";
  return "new";
}
var STAGE_CHIP = { new: ["New", "new"], quoted: ["Pending", "quoted"], approved: ["Approved", "won"], won: ["Job made", "won"], lost: ["Declined", "lost"] };
function pipeWhen(it) {
  var e = it.est,
    l = it.lead;
  return String((e && (e.responded_at || e.sent_at || e.created_at || e.issue_date)) || (l && l.created_at) || "");
}
function pipeName(it) {
  if (it.est) return cname(it.est.client_id);
  var c = it.lead.client_id && byId(clients, it.lead.client_id);
  return c ? c.name : it.lead.name || "(no name)";
}
function pipeAddr(it) {
  if (it.est && it.est.property_id) return paddr(it.est.property_id);
  if (it.lead && it.lead.address) return it.lead.address;
  var cid = (it.est && it.est.client_id) || (it.lead && it.lead.client_id);
  var ps = cid ? clientProps(cid) : [];
  return ps[0] ? ps[0].address : "";
}
function pipeCol(it) {
  return it.stage === "won" ? "approved" : it.stage;
}
function recentJob(it) {
  var j = pipeJob(it);
  return j && j.created_at && String(j.created_at).slice(0, 10) >= addDays(today(), -14);
}
function renderLeads() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var items = pipeItems();
  items.forEach(function (it) {
    it.stage = pipeStage(it);
  });
  var counts = { new: 0, quoted: 0, approved: 0, lost: 0 };
  items.forEach(function (it) {
    counts[pipeCol(it)]++;
  });
  var bar = el("div", "fbar lbar"),
    grp = el("div", "fgrp");
  PIPE_COLS.slice()
    .sort(function (x, y) {
      return ["approved", "lost", "new", "quoted"].indexOf(x[0]) - ["approved", "lost", "new", "quoted"].indexOf(y[0]);
    })
    .forEach(function (c) {
      var on = LF.indexOf(c[0]) > -1,
        b = el("button", "tab fpill" + (on ? " on" : ""), c[2]);
      b.type = "button";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.appendChild(el("span", null, "(" + counts[c[0]] + ")"));
      b.addEventListener("click", function () {
        var k = LF.indexOf(c[0]);
        if (k > -1) LF.splice(k, 1);
        else LF.push(c[0]);
        render();
      });
      grp.appendChild(b);
    });
  if (LF.length) {
    var clr = el("button", "tab fpill fclear", "Clear");
    clr.type = "button";
    clr.addEventListener("click", function () {
      LF = [];
      render();
    });
    grp.appendChild(clr);
  }
  bar.appendChild(grp);
  tabs.appendChild(bar);
  $("topbtns").appendChild(
    btn("+ New quote", "btn", function () {
      openEstimateForm(null);
    })
  );
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(btn("Price calculator", "btn alt", openCalc));
  var list = $("list");
  list.textContent = "";
  var cols = PIPE_COLS.filter(function (c) {
    return LF.length ? LF.indexOf(c[0]) > -1 : c[0] !== "lost";
  });
  var shown = items
    .filter(function (it) {
      if (!query) return true;
      var l = it.lead || {},
        e = it.est || {};
      return [pipeName(it), l.email, l.phone, l.address, l.service, l.kind, l.notes, e.title, e.number ? estNum(e.number, e.doc_type) : "", pipeAddr(it)]
        .join(" ")
        .toLowerCase()
        .indexOf(query) > -1;
    })
    .sort(function (a, b) {
      return pipeWhen(b).localeCompare(pipeWhen(a));
    });
  var board = el("div", "board n" + cols.length);
  cols.forEach(function (c) {
    var set = shown.filter(function (it) {
      if (pipeCol(it) !== c[0]) return false;
      // with no pills on, a job made more than two weeks ago drops off the Approved column
      if (it.stage === "won" && !LF.length && !recentJob(it)) return false;
      return true;
    });
    if (c[0] === "approved")
      set.sort(function (a, b) {
        return (a.stage === "won") - (b.stage === "won");
      });
    var col = el("div", "pcol c-" + c[0]),
      hd = el("div", "pchead");
    hd.appendChild(el("b", null, c[1]));
    hd.appendChild(el("span", null, String(set.length)));
    col.appendChild(hd);
    if (!set.length)
      col.appendChild(
        el(
          "div",
          "pempty",
          query
            ? "Nothing matches."
            : { new: "No new requests.", quoted: "No quotes waiting.", approved: "Nothing approved right now.", lost: "Nothing declined." }[c[0]]
        )
      );
    set.forEach(function (it) {
      col.appendChild(pipeCard(it));
    });
    board.appendChild(col);
  });
  list.appendChild(board);
}

// one card, the same for a website request and a quote
function pipeCard(it) {
  var e = it.est,
    l = it.lead,
    st = it.stage,
    fresh = e && e.response_seen === false;
  var b = el("div", "row pipe st-" + st + (fresh ? " fresh" : ""));
  b.tabIndex = 0;
  b.setAttribute("role", "button");
  if (e) b.dataset.eid = e.id;
  var left = el("div");
  left.appendChild(el("b", null, pipeName(it)));
  var what = (e && e.title) || (l && l.service) || (e ? "" : l.kind) || "";
  var src = [l ? "Website " + (l.kind || "request").toLowerCase() : "", e ? estNum(e.number, e.doc_type) : ""].filter(Boolean).join(" · ");
  left.appendChild(el("div", "sub", [what, src].filter(Boolean).join(" · ")));
  var ad = pipeAddr(it);
  if (ad) left.appendChild(el("div", "sub", ad));
  var right = el("div");
  right.style.textAlign = "right";
  if (e) right.appendChild(el("b", null, money(e.total)));
  var chip = STAGE_CHIP[st];
  right.appendChild(el("div")).appendChild(el("span", "chip " + chip[1], chip[0]));
  if (fresh) right.lastChild.appendChild(el("span", "chip newresp", "New"));
  // a quote that hasn't been sent to the client yet
  if (e && e.status === "draft" && st === "quoted") {
    right.lastChild.appendChild(el("span", "chip draft", "DRAFT"));
    b.classList.add("isdraft");
  }
  var w = pipeWhen(it);
  if (w) right.appendChild(el("div", "sub", ago(w)));
  b.appendChild(left);
  b.appendChild(right);
  if (st !== "lost") b.appendChild(makeJobBar(it, true));
  function open() {
    if (e) openEstimate(e.id);
    else openLead(l.id);
  }
  b.addEventListener("click", function (ev) {
    if (ev.target.closest(".mkjob")) return;
    open();
  });
  b.addEventListener("keydown", function (ev) {
    if ((ev.key === "Enter" || ev.key === " ") && ev.target === b) {
      ev.preventDefault();
      open();
    }
  });
  return b;
}
// the Make job (and Make quote, for a new request) buttons; once a job exists, a link to it instead
function makeJobBar(it, small) {
  var bar = el("div", "mkjob"),
    jb = pipeJob(it);
  if (jb) {
    bar.appendChild(
      btn("View job →", "btn alt sm", function () {
        if (byId(jobs, jb.id)) openJob(jb.id);
        else alert("That job was deleted.");
      })
    );
    return bar;
  }
  bar.appendChild(
    btn("Make job", "btn sm", function () {
      makeJobFrom(it);
    })
  );
  if (it.lead && !it.est && pipeStage(it) === "new")
    bar.appendChild(
      btn("Make quote", "btn alt sm", function () {
        makeQuoteFrom(it.lead);
      })
    );
  if (!small) bar.classList.add("big");
  return bar;
}
// a website request needs to be a client first; this makes (or links) the client, then carries on
function leadClient(l, then) {
  var c = l.client_id && byId(clients, l.client_id);
  if (c) return then(c);
  convertLead(l, null, then);
}
function makeQuoteFrom(l) {
  leadClient(l, function (c) {
    openEstimateForm(c.id, l.id);
  });
}
function makeJobFrom(it) {
  var e = it.est,
    l = it.lead;
  function go(c) {
    var title = (e && e.title) || (l && l.service) || "",
      lawn = /lawn maintenance/i.test(title),
      ins = (l && l.notes) || "";
    openJobForm(c, null, {
      from: "From " + (e ? estNum(e.number, e.doc_type) : "the website request") + ". Check the details, then Save job.",
      title: title,
      price: e ? Number(e.total) : undefined,
      frequency: lawn ? undefined : "once",
      property_id: (e && e.property_id) || undefined,
      instructions: ins,
      onSaved: function (j) {
        if (e) {
          e.job_id = j.id;
          sb.from("estimates").update({ job_id: j.id }).eq("id", e.id).then(function () {});
        }
        if (l) {
          l.job_id = j.id;
          l.status = "won";
          sb.from("leads").update({ job_id: j.id, status: "won" }).eq("id", l.id).then(function () {});
        }
      }
    });
  }
  if (e) {
    var c = byId(clients, e.client_id);
    if (!c) return alert("This quote's client is missing.");
    return go(c);
  }
  leadClient(l, go);
}

/* ---- lead detail ---- */
function openLead(id) {
  var l = byId(leads, id);
  if (!l) return;
  var p = panel();
  p.appendChild(el("h2", null, l.name || "(no name)"));
  p.appendChild(
    el(
      "div",
      "note",
      l.kind +
        " · " +
        new Date(l.created_at).toLocaleString() +
        (l.lang === "es" ? " · Spanish page" : "") +
        (l.photo_count ? " · " + l.photo_count + " photo(s) were sent by email" : "")
    )
  );
  p.appendChild(contactRow(l.phone, l.email));
  // Quoted and Won are set for you (making a quote / making the job); these are the ones you set by hand
  var st = el("div", "status");
  STATUSES.filter(function (s) {
    return s[0] === "new" || s[0] === "contacted" || s[0] === "lost" || s[0] === l.status;
  }).forEach(function (s) {
    st.appendChild(
      btn(s[1], l.status === s[0] ? "on" : "", function () {
        setStatus(l, s[0]);
      })
    );
  });
  p.appendChild(st);
  var cl = l.client_id && byId(clients, l.client_id);
  var cbox = el("div", "contact");
  if (cl) {
    cbox.appendChild(
      btn("View client: " + cl.name, "btn", function () {
        openClient(cl.id);
      })
    );
  } else {
    var cb = btn("Convert to client", "btn", function () {
      convertLead(l, cb);
    });
    cbox.appendChild(cb);
  }
  p.appendChild(cbox);
  p.appendChild(makeJobBar({ lead: l, est: null }));
  var t = document.createElement("table");
  (Array.isArray(l.fields) ? l.fields : []).forEach(function (f) {
    if (!f || !f.value) return;
    var tr = document.createElement("tr");
    tr.appendChild(el("td", null, f.label));
    tr.appendChild(el("td", null, f.value));
    t.appendChild(tr);
  });
  p.appendChild(t);
  p.appendChild(el("label", null, "Notes"));
  var ta = document.createElement("textarea");
  ta.value = l.notes || "";
  ta.setAttribute("aria-label", "Notes");
  p.appendChild(ta);
  var a = el("div", "actions");
  var save = btn("Save notes", "btn", function () {
    save.disabled = true;
    sb.from("leads")
      .update({ notes: ta.value })
      .eq("id", l.id)
      .then(function (r) {
        save.disabled = false;
        if (r.error) {
          alert("Could not save notes.");
          return;
        }
        l.notes = ta.value;
        save.textContent = "Saved";
        setTimeout(function () {
          save.textContent = "Save notes";
        }, 1500);
      });
  });
  var del = btn("Delete lead", "btn danger", function () {
    if (!confirm("Delete this lead for good?")) return;
    sb.from("leads")
      .delete()
      .eq("id", l.id)
      .then(function (r) {
        if (r.error) {
          alert("Could not delete.");
          return;
        }
        leads = leads.filter(function (z) {
          return z.id !== l.id;
        });
        closeDetail();
        render();
      });
  });
  a.appendChild(save);
  a.appendChild(del);
  p.appendChild(a);
}
function setStatus(l, s) {
  sb.from("leads")
    .update({ status: s })
    .eq("id", l.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not change status.");
        return;
      }
      l.status = s;
      render();
      openLead(l.id);
    });
}

function convertLead(l, b, cb) {
  if (clientsErr) {
    alert("Run the Stage 1 SQL in Supabase first (see the setup steps), then press Refresh.");
    return;
  }
  var addr = (l.address || "").trim();
  if (!addr) {
    addr = (prompt("This lead has no address. Enter the service address:") || "").trim();
    if (!addr) {
      alert("A service address is required to make a client.");
      return;
    }
  }
  var dup = clients.filter(function (c) {
    return (
      (l.email && c.email && c.email.toLowerCase() === l.email.toLowerCase()) ||
      (d10(l.phone).length >= 7 && (d10(c.phone) === d10(l.phone) || d10(c.phone2) === d10(l.phone)))
    );
  })[0];
  if (dup) {
    if (
      !confirm('"' + dup.name + '" already has this phone or email. Link this lead to that existing client?')
    )
      return;
    if (b) b.disabled = true;
    linkLead(l, dup, addr, cb);
    return;
  }
  if (b) b.disabled = true;
  var type = /proposal|hoa/i.test(l.kind || "") ? "hoa" : "residential";
  sb.from("clients")
    .insert({
      name: l.name || "(no name)",
      email: l.email || "",
      phone: l.phone || "",
      type: type,
      source: l.kind || "",
      notes: ""
    })
    .select()
    .single()
    .then(function (r) {
      if (r.error || !r.data) {
        if (b) b.disabled = false;
        alert("Could not create the client.");
        return;
      }
      clients.push(r.data);
      clients.sort(function (x, y) {
        return x.name.localeCompare(y.name);
      });
      linkLead(l, r.data, addr, cb);
    });
}
function linkLead(l, c, addr, cb) {
  function done() {
    sb.from("leads")
      .update({ client_id: c.id })
      .eq("id", l.id)
      .then(function (r) {
        if (r.error) {
          alert("Client saved, but linking the lead failed.");
        } else {
          l.client_id = c.id;
        }
        render();
        if (cb) cb(c);
        else openClient(c.id);
      });
  }
  var has = clientProps(c.id).some(function (p) {
    return p.address.toLowerCase() === addr.toLowerCase();
  });
  if (!has) {
    sb.from("properties")
      .insert({ client_id: c.id, label: clientProps(c.id).length ? "" : "Main", address: addr })
      .select()
      .single()
      .then(function (r) {
        if (r.data) props.push(r.data);
        done();
      });
  } else done();
}
