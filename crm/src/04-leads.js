/* Leads tab: requests from the website, their status, and turning a lead into a client. */

function renderLeads() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var counts = { all: leads.length };
  STATUSES.forEach(function (s) {
    counts[s[0]] = 0;
  });
  leads.forEach(function (l) {
    counts[l.status] = (counts[l.status] || 0) + 1;
  });
  [["all", "All"]].concat(STATUSES).forEach(function (s) {
    var b = el("button", "tab" + (lfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + (counts[s[0]] || 0) + ")"));
    b.addEventListener("click", function () {
      lfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  var list = $("list");
  list.textContent = "";
  var shown = leads.filter(function (l) {
    if (lfilter !== "all" && l.status !== lfilter) return false;
    if (!query) return true;
    return (
      [l.name, l.email, l.phone, l.address, l.service, l.kind, l.notes]
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
        leads.length ? "Nothing matches that." : "No leads yet. New website submissions will show up here."
      )
    );
    return;
  }
  shown.forEach(function (l) {
    var b = el("button", "row " + l.status);
    b.type = "button";
    var left = el("div");
    left.appendChild(el("b", null, l.name || "(no name)"));
    left.appendChild(el("div", "sub", [l.kind, l.service].filter(Boolean).join(" · ")));
    if (l.address) left.appendChild(el("div", "sub", l.address));
    var right = el("div");
    right.style.textAlign = "right";
    right.appendChild(el("span", "chip " + l.status, label(l.status)));
    if (l.client_id) right.appendChild(el("div", "sub", "Client ✓"));
    right.appendChild(el("div", "sub", ago(l.created_at)));
    b.appendChild(left);
    b.appendChild(right);
    b.addEventListener("click", function () {
      openLead(l.id);
    });
    list.appendChild(b);
  });
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
  var st = el("div", "status");
  STATUSES.forEach(function (s) {
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

function convertLead(l, b) {
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
    b.disabled = true;
    linkLead(l, dup, addr);
    return;
  }
  b.disabled = true;
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
        b.disabled = false;
        alert("Could not create the client.");
        return;
      }
      clients.push(r.data);
      clients.sort(function (x, y) {
        return x.name.localeCompare(y.name);
      });
      linkLead(l, r.data, addr);
    });
}
function linkLead(l, c, addr) {
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
        openClient(c.id);
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
