/* Clients tab: the client list, name sorting, the client page, other contacts, properties, the client form, and CSV import. */

/* Names: each client has a formal Name (as on the account), an optional Last name for sorting, and an optional Preferred name / nickname.
   If Last name is blank it is guessed: the last word of the name, ignoring Jr/Sr/II/III/Family and anything in quotes or parentheses
   ("Mr & Mrs Smith" -> Smith, "Alejandro Torres Jr" -> Torres). HOAs and businesses sort by their full name. */
var NAME_SKIP = /^(jr|sr|ii|iii|iv|v|family|household|residence|esq|md|dds)\.?$/i;
function nameTokens(n) {
  return String(n || "")
    .replace(/["\u201c\u201d][^"\u201c\u201d]*["\u201c\u201d]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}
function guessLast(n) {
  var w = nameTokens(n);
  while (w.length > 1 && NAME_SKIP.test(w[w.length - 1])) w.pop();
  return w.length ? w[w.length - 1] : "";
}
function lastOf(c) {
  return (
    String(c.last_name || "").trim() ||
    (String(c.name || "").indexOf(",") > -1 ? String(c.name).split(",")[0].trim() : guessLast(c.name))
  );
}
function lastKey(c) {
  var n = String(c.name || "")
    .trim()
    .toLowerCase();
  if (!n) return "";
  if (c.type === "hoa" || c.type === "commercial") return n + "|";
  return lastOf(c).toLowerCase() + "|" + n;
}
/* "Torres, Alejandro Jr "AL"" : last name first, formal rest of the name, then the nickname in quotes */
function dispName(c) {
  var n = String(c.name || "").trim();
  if (!n) return "";
  var nick = String(c.nickname || "").trim(),
    tail = nick ? ' "' + nick + '"' : "";
  if (c.type === "hoa" || c.type === "commercial") return n + tail;
  if (n.indexOf(",") > -1) return n + tail;
  var last = lastOf(c),
    w = nameTokens(n),
    lw = nameTokens(last),
    i = -1;
  for (var k = w.length - lw.length; k >= 0; k--) {
    var ok = true;
    for (var j = 0; j < lw.length; j++)
      if (w[k + j].toLowerCase() !== lw[j].toLowerCase()) {
        ok = false;
        break;
      }
    if (ok) {
      i = k;
      break;
    }
  }
  if (i < 0) return last + ", " + w.join(" ") + tail;
  var rest = w
    .slice(0, i)
    .concat(w.slice(i + lw.length))
    .join(" ");
  return last + (rest ? ", " + rest : "") + tail;
}
function sortClients() {
  clients.sort(function (a, b) {
    var x = lastKey(a),
      y = lastKey(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}
function isMainProp(p) {
  return /\bmain\b/i.test(String(p.label || ""));
}
/* A client's properties, with the one labeled "Main" always first; the rest stay in the order they were added. */
function clientProps(id) {
  var l = props.filter(function (p) {
      return p.client_id === id;
    }),
    m = l.filter(isMainProp),
    o = l.filter(function (p) {
      return !isMainProp(p);
    });
  return m.concat(o);
}
var CF = { type: [], show: [] };
function clientFacet(c, g, k) {
  if (g === "type") return !c.archived && (c.type || "residential") === k;
  if (k === "archived") return !!c.archived;
  if (c.archived) return false;
  if (k === "pastdue") return acctStatus(c).key === "past_due";
  if (k === "nojobs")
    return !jobs.some(function (j) {
      return j.client_id === c.id && j.status === "active";
    });
  return false;
}
function renderClients() {
  sortClients();
  var tabs = $("tabs");
  tabs.textContent = "";
  // filter pills like Jobs and Leads: tap to turn on, tap again to turn off. Nothing on = every active client.
  var CF_GROUPS = [
    ["type", "Type", [["hoa", "HOA"], ["commercial", "Commercial"], ["residential", "Residential"]]],
    ["show", "Show", [["pastdue", "Past due"], ["nojobs", "No active jobs"], ["archived", "Archived"]]]
  ];
  var bar = el("div", "fbar lbar"),
    any = CF.type.length || CF.show.length;
  CF_GROUPS.forEach(function (g) {
    var grp = el("div", "fgrp");
    grp.appendChild(el("span", "flbl", g[1]));
    g[2].forEach(function (o) {
      var on = CF[g[0]].indexOf(o[0]) > -1,
        n = clients.filter(function (c) {
          return clientFacet(c, g[0], o[0]);
        }).length,
        b = el("button", "tab fpill" + (on ? " on" : ""), o[1]);
      b.type = "button";
      b.appendChild(el("span", null, "(" + n + ")"));
      b.addEventListener("click", function () {
        var arr = CF[g[0]],
          k = arr.indexOf(o[0]);
        if (k > -1) arr.splice(k, 1);
        else arr.push(o[0]);
        render();
      });
      grp.appendChild(b);
    });
    bar.appendChild(grp);
  });
  if (any) {
    var clr = el("button", "tab fpill fclear", "Clear");
    clr.type = "button";
    clr.addEventListener("click", function () {
      CF.type = [];
      CF.show = [];
      render();
    });
    bar.lastChild.appendChild(clr);
  }
  tabs.appendChild(bar);
  var tb = $("topbtns");
  tb.appendChild(
    btn("+ New client", "btn", function () {
      openClientForm(null);
    })
  );
  tb.appendChild(document.createTextNode(" "));
  tb.appendChild(btn("Import CSV", "btn alt", openImport));
  var list = $("list");
  list.textContent = "";
  if (clientsErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Clients aren't set up yet. Run the Stage 1 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var shown = clients.filter(function (c) {
    var wantArch = CF.show.indexOf("archived") > -1;
    if (!!c.archived !== wantArch) return false;
    if (CF.type.length && CF.type.indexOf(c.type || "residential") < 0) return false;
    if (CF.show.indexOf("pastdue") > -1 && !clientFacet(c, "show", "pastdue")) return false;
    if (CF.show.indexOf("nojobs") > -1 && !clientFacet(c, "show", "nojobs")) return false;
    if (!query) return true;
    var addr = clientProps(c.id)
      .map(function (p) {
        return p.address;
      })
      .join(" ");
    return (
      [c.name, c.nickname, c.last_name, c.account_no ? String(c.account_no) : "", c.company, c.email, c.phone, c.phone2, c.notes, addr, ccText(c.id)]
        .join(" ")
        .toLowerCase()
        .indexOf(query) > -1
    );
  });
  if (!shown.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        clients.length ? "No clients match these filters." : "No clients yet. Add one, import a CSV, or convert a lead."
      )
    );
    return;
  }
  // HOA accounts first, then Commercial, then Residential (alphabetical within each)
  var TYPE_ORDER = { hoa: 0, commercial: 1, residential: 2 };
  shown = shown
    .map(function (c, i) {
      return { c: c, i: i };
    })
    .sort(function (x, y) {
      var a = TYPE_ORDER[x.c.type] != null ? TYPE_ORDER[x.c.type] : 3,
        b = TYPE_ORDER[y.c.type] != null ? TYPE_ORDER[y.c.type] : 3;
      return a - b || x.i - y.i;
    })
    .map(function (x) {
      return x.c;
    });
  shown.forEach(function (c) {
    var b = el("button", "row client ty-" + (c.type || "residential") + (c.archived ? " archived" : "") + (!c.archived && acctStatus(c).key === "past_due" ? " pastdue" : ""));
    b.type = "button";
    var ps = clientProps(c.id),
      left = el("div");
    left.appendChild(el("b", null, dispName(c) + (c.company ? " · " + c.company : "")));
    b.title = dispName(c) + (c.company ? " · " + c.company : "");
    left.appendChild(el("div", "sub", [c.phone, c.email].filter(Boolean).join(" · ")));
    if (ps[0])
      left.appendChild(
        el("div", "sub", ps[0].address + (ps.length > 1 ? "  (+" + (ps.length - 1) + " more)" : ""))
      );
    var right = el("div");
    right.style.textAlign = "right";
    right.appendChild(el("span", "chip " + c.type, tlabel(c.type)));
    if (!c.archived) {
      var ast = acctStatus(c);
      if (ast.key === "past_due" || ast.key === "due") {
        right.appendChild(el("br"));
        right.appendChild(acctChip(c)).style.marginTop = "4px";
      }
    }
    b.appendChild(left);
    b.appendChild(right);
    b.addEventListener("click", function () {
      openClient(c.id);
    });
    list.appendChild(b);
  });
}

/* ---- client detail ---- */
/* ---- Client page: who they are and three numbers up top (balance, next visit, active jobs), quick contact buttons,
   then tabs: Overview (properties, jobs, quotes, contacts, details), Billing, History and Photos.
   Portal, Archive and Delete are under More. The tab you were on is kept while you work on the client. ---- */
var clientTab = {};
function openClient(id) {
  var c = byId(clients, id);
  if (!c) return;
  var pp = popPanel(),
    p = pp.p,
    L = pp.L;
  p.classList.add("qpanel");
  L.appendChild(el("h2", null, c.name));
  if (c.company) L.appendChild(el("div", "popsub", c.company));
  var hd = el("div", "qhead");
  if (c.account_no) hd.appendChild(el("span", "qnum", "Account " + c.account_no));
  hd.appendChild(el("span", "qst ty-" + (c.type || "residential"), tlabel(c.type)));
  if (c.archived) hd.appendChild(el("span", "qst no", "Archived"));
  L.appendChild(hd);
  if (c.nickname) L.appendChild(el("div", "note", 'Goes by "' + c.nickname + '"'));
  var mp = clientProps(c.id)[0],
    cb = el("div", "popbox");
  cb.appendChild(el("h4", null, "Contact"));
  popLine(cb, "Phone", c.phone, c.phone ? "tel:" + digits(c.phone) : "");
  popLine(cb, "Phone 2", c.phone2, c.phone2 ? "tel:" + digits(c.phone2) : "");
  popLine(cb, "Email", c.email, c.email ? "mailto:" + c.email : "");
  popLine(cb, "Address", mp && mp.address, mp && mp.address ? mapsUrl(mp.address) : "");
  if (!c.phone && !c.phone2 && !c.email && !(mp && mp.address)) cb.appendChild(el("div", "note", "No contact details yet."));
  var cr = contactRow(c.phone || c.phone2, c.email);
  cr.classList.add("qacts");
  if (cr.firstChild) cb.appendChild(cr);
  L.appendChild(cb);
  L.appendChild(
    btn("Edit details", "btn alt sm", function () {
      openClientForm(c);
    })
  );
  // three numbers
  var bal = billErr ? 0 : clientBal(c.id) - (typeof creditOf === "function" ? creditOf(c.id) : 0),
    nv = visits
      .filter(function (v) {
        return v.client_id === c.id && v.status === "scheduled" && v.scheduled_date >= today();
      })
      .sort(function (x, y) {
        return x.scheduled_date < y.scheduled_date ? -1 : 1;
      })[0],
    aj = jobs.filter(function (j) {
      return j.client_id === c.id && j.status === "active";
    }).length;
  var stats = el("div", "cstats");
  [
    ["Balance", bal > 0 ? money(bal) : bal < 0 ? money(-bal) + " credit" : "$0.00", bal > 0 && acctStatus(c).key === "past_due" ? "red" : ""],
    ["Next visit", nv ? dshort(nv.scheduled_date) : "None", ""],
    ["Active jobs", String(aj), ""]
  ].forEach(function (x) {
    var d = el("div");
    d.appendChild(el("span", null, x[0]));
    d.appendChild(el("b", x[2], x[1]));
    stats.appendChild(d);
  });
  var panes = popTabs(
    pp.R,
    [
      ["overview", "Overview"],
      ["jobs", "Jobs & quotes"],
      ["billing", "Billing"],
      ["history", "History"],
      ["photos", "Photos"],
      ["account", "Account"]
    ],
    clientTab[c.id] || "overview",
    function (k) {
      clientTab[c.id] = k;
    }
  );
  // Overview
  var ov = panes.overview;
  ov.appendChild(stats);
  var sec = el("div", "sec"),
    h = el("h3", null, "Properties"),
    addp = btn("+ Add property", "btn alt sm", function () {
      propForm(c, null, sec, h);
    });
  h.appendChild(addp);
  sec.appendChild(h);
  ov.appendChild(sec);
  var holder = el("div");
  sec.appendChild(holder);
  drawProps(c, holder);
  panes.jobs.appendChild(clientJobsSection(c));
  if (!estErr) panes.jobs.appendChild(clientEstimatesSection(c));
  ov.appendChild(clientContactsSection(c));
  var ls = leads.filter(function (l) {
    return l.client_id === c.id;
  });
  if (ls.length) {
    var s2 = el("div", "sec");
    s2.appendChild(el("h3", null, "Requests from the website"));
    ls.forEach(function (l) {
      var r = el("div", "pcard");
      r.appendChild(el("b", null, l.kind + " · " + label(l.status)));
      r.appendChild(el("div", "note", new Date(l.created_at).toLocaleDateString() + (l.service ? " · " + l.service : "")));
      r.appendChild(
        btn("Open", "btn alt sm", function () {
          openLead(l.id);
        })
      ).style.marginTop = "6px";
      s2.appendChild(r);
    });
    ov.appendChild(s2);
  }
  var det = el("div", "sec");
  var dh = el("h3", null, "Details");
  dh.appendChild(
    btn("Edit details", "btn alt sm", function () {
      openClientForm(c);
    })
  );
  det.appendChild(dh);
  var t = document.createElement("table");
  [
    ["Phone", c.phone],
    ["Phone 2", c.phone2],
    ["Email", c.email],
    ["Billing", c.bill_by_property ? "Separate invoice per property" : "One invoice for all properties"],
    ["Added", c.created_at ? new Date(c.created_at).toLocaleDateString() + (c.source ? " (" + c.source + ")" : "") : ""],
    ["Notes", c.notes]
  ].forEach(function (r) {
    if (!r[1]) return;
    var tr = document.createElement("tr");
    tr.appendChild(el("td", null, r[0]));
    tr.appendChild(el("td", null, r[1]));
    t.appendChild(tr);
  });
  det.appendChild(t);
  panes.account.appendChild(det);
  if (c.notes) {
    var ns = el("div", "sec");
    ns.appendChild(el("h3", null, "Notes"));
    var nb = el("div", "pcard", c.notes);
    nb.style.whiteSpace = "pre-wrap";
    ns.appendChild(nb);
    ov.appendChild(ns);
  }
  // Billing, History, Photos
  panes.billing.appendChild(clientBillingSection(c));
  panes.history.appendChild(historySection(c));
  panes.photos.appendChild(clientPhotosSection(c));
  // More: portal, archive, delete
  var more = panes.account;
  more.appendChild(clientPortalSection(c));
  var mr = el("div", "qacts");
  mr.style.marginTop = "10px";
  mr.appendChild(
    btn(c.archived ? "Unarchive" : "Archive", "btn alt", function () {
      sb.from("clients")
        .update({ archived: !c.archived })
        .eq("id", c.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not update.");
            return;
          }
          c.archived = !c.archived;
          render();
          openClient(c.id);
        });
    })
  );
  mr.appendChild(
    btn("Delete client", "btn danger", function () {
      if (!confirm("Delete this client and all their properties for good? (Archive keeps the history.)")) return;
      sb.from("clients")
        .delete()
        .eq("id", c.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not delete. A client with invoices can't be deleted, so Archive them instead.");
            return;
          }
          clients = clients.filter(function (z) {
            return z.id !== c.id;
          });
          props = props.filter(function (z) {
            return z.client_id !== c.id;
          });
          leads.forEach(function (l) {
            if (l.client_id === c.id) l.client_id = null;
          });
          closeDetail();
          render();
        });
    })
  );
  more.appendChild(mr);
}
/* ---- other contacts on a client (spouse, board members...) ---- */
function clientCC(id) {
  return ccontacts.filter(function (x) {
    return x.client_id === id;
  });
}
function ccText(id) {
  return clientCC(id)
    .map(function (x) {
      return [x.name, x.role, x.phone, x.email].join(" ");
    })
    .join(" ");
}
function clientContactsSection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Other contacts"),
    holder = el("div");
  if (!ccErr)
    h.appendChild(
      btn("+ Add contact", "btn alt sm", function () {
        ccForm(c, null, holder);
      })
    );
  sec.appendChild(h);
  sec.appendChild(holder);
  drawCC(c, holder);
  return sec;
}
function drawCC(c, holder) {
  holder.textContent = "";
  if (ccErr) {
    holder.appendChild(
      el(
        "div",
        "note",
        "To add spouses, board members and other contacts, run the Stage 21 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var cs = clientCC(c.id);
  if (!cs.length) {
    holder.appendChild(
      el(
        "div",
        "note",
        "None yet. Add a spouse, board member, property manager or anyone else you may need to reach."
      )
    );
    return;
  }
  cs.forEach(function (x) {
    var card = el("div", "pcard");
    card.appendChild(el("b", null, (x.name || "(no name)") + (x.role ? " · " + x.role : "")));
    if (x.portal_access) card.appendChild(el("span", "chip won", "Portal access")).style.marginLeft = "8px";
    var info = [x.phone, x.email].filter(Boolean).join(" · ");
    if (info) card.appendChild(el("div", "note", info));
    if (x.notes) card.appendChild(el("div", "note", x.notes));
    var a = el("div", "acts"),
      dg = digits(x.phone);
    if (dg) {
      (isOwner() ? ["Call", "Text"] : ["Call"]).forEach(function (t) {
        var l = el("a", "btn alt sm", t);
        l.href = (t === "Call" ? "tel:" : "sms:") + dg;
        a.appendChild(l);
      });
    }
    if (x.email) {
      var m = el("a", "btn alt sm", "Email");
      m.href = "mailto:" + x.email;
      a.appendChild(m);
    }
    a.appendChild(
      btn("Edit", "btn alt sm", function () {
        ccForm(c, x, holder);
      })
    );
    a.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Remove " + (x.name || "this contact") + " from this client?")) return;
        sb.from("client_contacts")
          .delete()
          .eq("id", x.id)
          .then(function (r) {
            if (r.error) {
              alert("Could not delete.");
              return;
            }
            ccontacts = ccontacts.filter(function (z) {
              return z.id !== x.id;
            });
            drawCC(c, holder);
            if (portalBoxRedraw) portalBoxRedraw();
          });
      })
    );
    card.appendChild(a);
    holder.appendChild(card);
  });
}
function ccForm(c, x, holder) {
  var box = el("div", "pcard"),
    g = el("div", "grid2");
  var nm = fld("Name", "text", x ? x.name : ""),
    rl = fld("Role", "text", x ? x.role : "");
  var dl = document.createElement("datalist");
  dl.id = "ccroles";
  CROLES.forEach(function (r) {
    var o = document.createElement("option");
    o.value = r;
    dl.appendChild(o);
  });
  rl.appendChild(dl);
  rl.input.setAttribute("list", "ccroles");
  var ph = fld("Phone", "tel", x ? x.phone : ""),
    em = fld("Email", "email", x ? x.email : "");
  g.appendChild(nm);
  g.appendChild(rl);
  g.appendChild(ph);
  g.appendChild(em);
  box.appendChild(g);
  var nt = fld("Notes", "text", x ? x.notes : "");
  box.appendChild(nt);
  /* client portal: this person may sign in to see this account (needs an email) */
  var pa = null;
  if (c.portal_access !== undefined) {
    var pl = el("label");
    pl.style.cssText = "display:flex;gap:8px;align-items:center;margin:0 0 10px;font-weight:600";
    pa = document.createElement("input");
    pa.type = "checkbox";
    pa.style.width = "auto";
    pa.checked = !!(x && x.portal_access);
    pl.appendChild(pa);
    pl.appendChild(
      document.createTextNode("Portal access (can sign in to see this account, including billing)")
    );
    box.appendChild(pl);
  }
  var a = el("div", "acts");
  var save = btn("Save contact", "btn sm", function () {
    if (!nm.input.value.trim() && !ph.input.value.trim() && !em.input.value.trim()) {
      alert("Enter a name, phone or email.");
      return;
    }
    var row = {
      name: nm.input.value.trim(),
      role: rl.input.value.trim(),
      phone: ph.input.value.trim(),
      email: em.input.value.trim(),
      notes: nt.input.value.trim()
    };
    if (pa) {
      if (pa.checked && !row.email) {
        alert("Portal access needs an email for this contact.");
        return;
      }
      row.portal_access = pa.checked;
    }
    save.disabled = true;
    var q = x
      ? sb.from("client_contacts").update(row).eq("id", x.id).select().single()
      : sb
          .from("client_contacts")
          .insert(Object.assign({ client_id: c.id }, row))
          .select()
          .single();
    q.then(function (r) {
      save.disabled = false;
      if (r.error || !r.data) {
        alert("Could not save.");
        return;
      }
      if (x) Object.assign(x, r.data);
      else ccontacts.push(r.data);
      drawCC(c, holder);
      if (portalBoxRedraw) portalBoxRedraw();
    });
  });
  a.appendChild(save);
  a.appendChild(
    btn("Cancel", "btn alt sm", function () {
      drawCC(c, holder);
    })
  );
  box.appendChild(a);
  if (x) {
    holder.textContent = "";
    holder.appendChild(box);
  } else {
    var e = holder.querySelector(".note");
    if (e) e.remove();
    holder.insertBefore(box, holder.firstChild);
  }
  nm.input.focus();
}
function drawProps(c, holder) {
  holder.textContent = "";
  var ps = clientProps(c.id);
  if (!ps.length) {
    holder.appendChild(el("div", "note", "No properties yet. Add the service address."));
    return;
  }
  ps.forEach(function (pr) {
    var card = el("div", "pcard");
    card.appendChild(el("b", null, (pr.label ? pr.label + ": " : "") + pr.address));
    if (pr.notes) card.appendChild(el("div", "note", pr.notes));
    var a = el("div", "acts"),
      m = el("a", "btn alt sm", "Map");
    m.href = mapsUrl(pr.address);
    m.target = "_blank";
    m.rel = "noopener";
    a.appendChild(m);
    if (ps.length > 1 && !isMainProp(pr))
      a.appendChild(
        btn("Make main", "btn alt sm", function () {
          var old = ps.filter(isMainProp);
          Promise.all(
            old
              .map(function (o) {
                return sb.from("properties").update({ label: "" }).eq("id", o.id);
              })
              .concat([sb.from("properties").update({ label: "Main" }).eq("id", pr.id)])
          ).then(function (rs) {
            if (
              rs.some(function (r) {
                return r.error;
              })
            ) {
              alert("Could not change the main property.");
              return;
            }
            old.forEach(function (o) {
              o.label = "";
            });
            pr.label = "Main";
            drawProps(c, holder);
            render();
          });
        })
      );
    a.appendChild(
      btn("Edit", "btn alt sm", function () {
        propForm(c, pr, holder);
      })
    );
    a.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Delete this property?")) return;
        sb.from("properties")
          .delete()
          .eq("id", pr.id)
          .then(function (r) {
            if (r.error) {
              alert("Could not delete.");
              return;
            }
            props = props.filter(function (z) {
              return z.id !== pr.id;
            });
            drawProps(c, holder);
            render();
          });
      })
    );
    card.appendChild(a);
    holder.appendChild(card);
  });
}
function propForm(c, pr, holder) {
  var box = el("div", "pcard");
  var lab = fld("Label", "text", pr ? pr.label : "");
  var adr = fld("Address", "text", pr ? pr.address : "");
  adr.input.placeholder = "123 Example Ln, Kissimmee, FL 34758";
  var nts = fld("Access notes", "textarea", pr ? pr.notes : "");
  box.appendChild(lab);
  box.appendChild(adr);
  box.appendChild(nts);
  var a = el("div", "acts");
  var save = btn("Save property", "btn sm", function () {
    if (!adr.input.value.trim()) {
      alert("Enter an address.");
      return;
    }
    var row = {
      label: lab.input.value.trim(),
      address: adr.input.value.trim(),
      notes: nts.input.value.trim()
    };
    save.disabled = true;
    var q = pr
      ? sb.from("properties").update(row).eq("id", pr.id).select().single()
      : sb
          .from("properties")
          .insert(Object.assign({ client_id: c.id }, row))
          .select()
          .single();
    q.then(function (r) {
      save.disabled = false;
      if (r.error || !r.data) {
        alert("Could not save.");
        return;
      }
      if (pr) {
        Object.assign(pr, r.data);
      } else props.push(r.data);
      drawProps(c, holder);
      render();
    });
  });
  a.appendChild(save);
  a.appendChild(
    btn("Cancel", "btn alt sm", function () {
      drawProps(c, holder);
    })
  );
  box.appendChild(a);
  if (pr) {
    holder.textContent = "";
    holder.appendChild(box);
  } else {
    holder.insertBefore(box, holder.firstChild);
  }
}
function openClientForm(c) {
  var p = panel();
  p.appendChild(el("h2", null, c ? "Edit client" : "New client"));
  var n = fld("Name", "text", c && c.name),
    ln = fld("Last name", "text", c && c.last_name),
    nk = fld("Nickname", "text", c && c.nickname),
    co = fld("Company / HOA", "text", c && c.company);
  var ph = fld("Phone", "tel", c && c.phone),
    ph2 = fld("Phone 2", "tel", c && c.phone2);
  var em = fld("Email", "email", c && c.email),
    ty = fld("Type", "select", c ? c.type : "residential", TYPES);
  var nt = fld("Notes", "textarea", c && c.notes);
  var bp = fld("Billing", "select", c && c.bill_by_property ? "1" : "0", [
    ["0", "One invoice for all properties"],
    ["1", "Separate invoice per property"]
  ]);
  var g = el("div", "grid2");
  g.appendChild(n);
  g.appendChild(ln);
  g.appendChild(nk);
  g.appendChild(co);
  g.appendChild(ph);
  g.appendChild(ph2);
  g.appendChild(em);
  g.appendChild(ty);
  p.appendChild(g);
  // account numbers are given out automatically (the next number) when a client is added; clients moved over from
  // GroundsKeeper Pro keep their old numbers. Shown here, not editable.
  if (c && c.account_no) p.appendChild(el("p", "note", "Account #" + c.account_no));
  p.appendChild(bp);
  p.appendChild(nt);
  function hint() {
    ln.input.placeholder = guessLast(n.input.value) || "Auto from name";
  }
  n.input.addEventListener("input", hint);
  hint();
  var addr = null;
  if (!c) {
    addr = fld("Service address", "text", "");
    addr.input.placeholder = "123 Example Ln, Kissimmee, FL 34758";
    p.appendChild(addr);
  }
  var a = el("div", "actions");
  var save = btn("Save", "btn", function () {
    if (!n.input.value.trim()) {
      alert("Enter a name.");
      return;
    }
    if (!c && !addr.input.value.trim()) {
      alert("Enter the service address.");
      addr.input.focus();
      return;
    }
    var row = {
      name: n.input.value.trim(),
      company: co.input.value.trim(),
      phone: ph.input.value.trim(),
      phone2: ph2.input.value.trim(),
      email: em.input.value.trim(),
      type: ty.input.value,
      notes: nt.input.value.trim()
    };
    var colsOk = clients.some(function (x) {
        return "last_name" in x;
      }),
      wantNames = ln.input.value.trim() || nk.input.value.trim();
    if (colsOk || wantNames) {
      row.last_name = ln.input.value.trim();
      row.nickname = nk.input.value.trim();
    }
    var bpOk = clients.some(function (x) {
        return "bill_by_property" in x;
      }),
      wantBp = bp.input.value === "1";
    if (bpOk || wantBp) row.bill_by_property = wantBp;
    save.disabled = true;
    if (c) {
      sb.from("clients")
        .update(row)
        .eq("id", c.id)
        .select()
        .single()
        .then(function (r) {
          save.disabled = false;
          if (r.error || !r.data) {
            alert(
              wantBp && !bpOk
                ? "Could not save. Separate invoices per property need the Stage 20 SQL: run it in Supabase (SQL Editor), then press Refresh."
                : wantNames && !colsOk
                  ? "Could not save. Last name and nickname need the Stage 19 SQL: run it in Supabase (SQL Editor), then press Refresh."
                  : "Could not save."
            );
            return;
          }
          Object.assign(c, r.data);
          render();
          openClient(c.id);
        });
    } else {
      row.source = "Added by hand";
      sb.from("clients")
        .insert(row)
        .select()
        .single()
        .then(function (r) {
          if (r.error || !r.data) {
            save.disabled = false;
            alert(
              wantNames && !colsOk
                ? "Could not save. Last name and nickname need the Stage 19 SQL: run it in Supabase (SQL Editor), then press Refresh."
                : "Could not save. Did you run the Stage 1 SQL?"
            );
            return;
          }
          clients.push(r.data);
          clients.sort(function (x, y) {
            return x.name.localeCompare(y.name);
          });
          var ad = addr.input.value.trim();
          sb.from("properties")
            .insert({ client_id: r.data.id, label: "Main", address: ad })
            .select()
            .single()
            .then(function (q) {
              if (q.data) props.push(q.data);
              else alert("Client saved, but the address did not save. Add it from the client page.");
              render();
              openClient(r.data.id);
            });
        });
    }
  });
  a.appendChild(save);
  a.appendChild(
    btn("Cancel", "btn alt", function () {
      if (c) openClient(c.id);
      else closeDetail();
    })
  );
  p.appendChild(a);
}

/* ---- CSV import (Jobber export or any spreadsheet saved as CSV) ---- */
function parseCSV(text) {
  var rows = [],
    row = [],
    f = "",
    q = false,
    i,
    ch;
  text = text.replace(/^﻿/, "");
  for (i = 0; i < text.length; i++) {
    ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(f);
      f = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(f);
      f = "";
      if (
        row.some(function (x) {
          return x.trim();
        })
      )
        rows.push(row);
      row = [];
    } else f += ch;
  }
  row.push(f);
  if (
    row.some(function (x) {
      return x.trim();
    })
  )
    rows.push(row);
  return rows;
}
function openImport() {
  if (clientsErr) {
    alert("Run the Stage 1 SQL in Supabase first, then press Refresh.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Import clients from CSV"));
  p.appendChild(
    el(
      "p",
      "note",
      "In Jobber: Clients, then the ⋯ menu, then Export (CSV). Or save any spreadsheet as CSV. Columns it understands: Name (or First name + Last name), Company, Email, Phone, Street/Address, City, State, Zip. Clients that match an existing phone or email are skipped."
    )
  );
  var file = document.createElement("input");
  file.type = "file";
  file.accept = ".csv,text/csv";
  p.appendChild(file);
  var out = el("div");
  out.style.marginTop = "12px";
  p.appendChild(out);
  file.addEventListener("change", function () {
    var f = file.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var rows = parseCSV(String(rd.result));
      out.textContent = "";
      if (rows.length < 2) {
        out.textContent = "That file looks empty.";
        return;
      }
      var hd = rows[0].map(function (h) {
        return h.trim().toLowerCase();
      });
      function col() {
        var a = arguments,
          i,
          j;
        for (j = 0; j < a.length; j++) for (i = 0; i < hd.length; i++) if (hd[i] === a[j]) return i;
        for (j = 0; j < a.length; j++) for (i = 0; i < hd.length; i++) if (hd[i].indexOf(a[j]) > -1) return i;
        return -1;
      }
      var cName = col("name", "client name", "display name"),
        cF = col("first name"),
        cL = col("last name"),
        cCo = col("company"),
        cEm = col("email", "e-mail"),
        cPh = col("phone", "mobile", "main phone"),
        cSt = col("street 1", "street", "address"),
        cCi = col("city"),
        cS = col("state", "province"),
        cZ = col("zip", "postal");
      function g(r, i) {
        return i > -1 && r[i] ? String(r[i]).trim() : "";
      }
      var map = {},
        order = [];
      rows.slice(1).forEach(function (r) {
        var name = g(r, cName) || [g(r, cF), g(r, cL)].filter(Boolean).join(" ") || g(r, cCo);
        if (!name) return;
        var key = name.toLowerCase() + "|" + d10(g(r, cPh)) + "|" + g(r, cEm).toLowerCase();
        var addr = [g(r, cSt), [g(r, cCi), g(r, cS)].filter(Boolean).join(", "), g(r, cZ)]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (!map[key]) {
          map[key] = { name: name, company: g(r, cCo), email: g(r, cEm), phone: g(r, cPh), addrs: [] };
          order.push(key);
        }
        if (addr && map[key].addrs.indexOf(addr) < 0) map[key].addrs.push(addr);
      });
      var fresh = order
        .map(function (k) {
          return map[k];
        })
        .filter(function (x) {
          return !clients.some(function (c) {
            return (
              (x.email && c.email && c.email.toLowerCase() === x.email.toLowerCase()) ||
              (d10(x.phone).length >= 7 && d10(c.phone) === d10(x.phone))
            );
          });
        });
      var noAddr = fresh.filter(function (x) {
        return !x.addrs.length;
      }).length;
      fresh = fresh.filter(function (x) {
        return x.addrs.length;
      });
      if (!fresh.length) {
        out.textContent = noAddr
          ? "Nothing imported: " +
            noAddr +
            " client(s) have no address, and an address is required. Add an address column to those rows."
          : "Nothing new to import (everything already matches a client).";
        return;
      }
      if (noAddr) out.appendChild(el("p", "note", noAddr + " row(s) skipped because they have no address."));
      out.appendChild(
        el(
          "p",
          null,
          "Ready to import " +
            fresh.length +
            " client(s) with " +
            fresh.reduce(function (n, x) {
              return n + x.addrs.length;
            }, 0) +
            " propert" +
            "ies."
        )
      );
      var go = btn("Import now", "btn", function () {
        go.disabled = true;
        go.textContent = "Importing...";
        sb.from("clients")
          .insert(
            fresh.map(function (x) {
              return {
                name: x.name,
                company: x.company,
                email: x.email,
                phone: x.phone,
                type: "residential",
                source: "CSV import"
              };
            })
          )
          .select()
          .then(function (r) {
            if (r.error || !r.data) {
              go.disabled = false;
              go.textContent = "Import now";
              alert("Import failed. Nothing was added.");
              return;
            }
            var pr = [];
            r.data.forEach(function (c) {
              var m = fresh.filter(function (x) {
                return x.name === c.name && x.phone === c.phone && x.email === c.email;
              })[0];
              if (m)
                m.addrs.forEach(function (a, i) {
                  pr.push({ client_id: c.id, label: i ? "" : "Main", address: a });
                });
            });
            r.data.forEach(function (c) {
              clients.push(c);
            });
            clients.sort(function (x, y) {
              return x.name.localeCompare(y.name);
            });
            var fin = function () {
              render();
              closeDetail();
              alert("Imported " + r.data.length + " client(s).");
            };
            if (pr.length)
              sb.from("properties")
                .insert(pr)
                .select()
                .then(function (q) {
                  if (q.data)
                    q.data.forEach(function (x) {
                      props.push(x);
                    });
                  fin();
                });
            else fin();
          });
      });
      out.appendChild(go);
    };
    rd.readAsText(f);
  });
}
