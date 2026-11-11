/* Leads tab: requests from the website, their status, and turning a lead into a client. */

/* Leads page: website requests AND the quotes / estimates you send, as one list of the same cards.
   Each card is at one stage: New request -> Quote sent (waiting on the client) -> Approved (make the job) -> Won (job made),
   or Lost (declined, expired or marked lost). A quote made from a website request is one card, not two.
   Three filters: Open (everything still in play, grouped by stage), Won and Lost. */
var PIPE_GROUPS = [
  ["new", "New requests"],
  ["approved", "Approved: ready to make the job"],
  ["quoted", "Quotes waiting on the client"]
];
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
var STAGE_CHIP = { new: ["New", "new"], quoted: ["Quote sent", "quoted"], approved: ["Approved", "won"], won: ["Job made", "won"], lost: ["Lost", "lost"] };
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
function renderLeads() {
  var tabs = $("tabs");
  tabs.textContent = "";
  if (["open", "won", "lost"].indexOf(lfilter) < 0) lfilter = "open";
  var items = pipeItems();
  items.forEach(function (it) {
    it.stage = pipeStage(it);
  });
  var counts = { open: 0, won: 0, lost: 0 };
  items.forEach(function (it) {
    counts[it.stage === "won" || it.stage === "lost" ? it.stage : "open"]++;
  });
  [
    ["open", "Open"],
    ["won", "Won"],
    ["lost", "Lost"]
  ].forEach(function (f) {
    var b = el("button", "tab" + (lfilter === f[0] ? " on" : ""), f[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + counts[f[0]] + ")"));
    b.addEventListener("click", function () {
      lfilter = f[0];
      render();
    });
    tabs.appendChild(b);
  });
  $("topbtns").appendChild(
    btn("+ New quote", "btn", function () {
      openEstimateForm(null);
    })
  );
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(btn("Price calculator", "btn alt", openCalc));
  var list = $("list");
  list.textContent = "";
  var shown = items
    .filter(function (it) {
      var st = it.stage === "won" || it.stage === "lost" ? it.stage : "open";
      if (st !== lfilter) return false;
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
  if (!shown.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        query
          ? "Nothing matches that."
          : lfilter === "open"
            ? "Nothing open. New website requests and the quotes you send show up here."
            : lfilter === "won"
              ? "Nothing won yet. Use Make job on an approved quote or request."
              : "Nothing lost."
      )
    );
    return;
  }
  if (lfilter === "open") {
    PIPE_GROUPS.forEach(function (g) {
      var set = shown.filter(function (it) {
        return it.stage === g[0];
      });
      if (!set.length) return;
      list.appendChild(el("div", "pghead", g[1] + " (" + set.length + ")"));
      set.forEach(function (it) {
        list.appendChild(pipeCard(it));
      });
    });
  } else
    shown.forEach(function (it) {
      list.appendChild(pipeCard(it));
    });
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
