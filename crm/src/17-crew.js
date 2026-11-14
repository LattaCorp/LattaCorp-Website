/* Crew: texting routes to crew members and the crew member's own limited screen. */

/* ---- crew: temps get a texted route, full-timers get their own limited login ---- */
function callApi(path, action, payload) {
  return sb.auth.getSession().then(function (r) {
    var t = r.data && r.data.session && r.data.session.access_token;
    return fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + t },
      body: JSON.stringify(Object.assign({ action: action }, payload))
    }).then(
      function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (j) {
            return { ok: res.ok, error: j.error || "Error " + res.status, data: j };
          });
      },
      function () {
        return { ok: false, error: "Could not reach the server." };
      }
    );
  });
}
function callCrewApi(action, payload) {
  return callApi("/api/crew-login", action, payload);
}
function refreshCrew() {
  return sb
    .from("crew")
    .select("*")
    .order("name", { ascending: true })
    .limit(200)
    .then(function (r) {
      if (!r.error) crew = r.data || [];
    });
}
function openCrew() {
  var p = panel();
  p.appendChild(el("h2", null, "Crew"));
  var intro = el(
    "p",
    "note",
    "Temp: no login, you text them the day's route. Full-time: they sign in and see only their own stops (address, notes, Done). They never see prices or client details."
  );
  p.appendChild(intro);
  var holder = el("div");
  p.appendChild(holder);
  function row(m) {
    var box = el("div", "pcard"),
      g = el("div", "grid2");
    var n = fld("Name", "text", m ? m.name : ""),
      ph = fld("Phone", "tel", m ? m.phone : "");
    g.appendChild(n);
    g.appendChild(ph);
    box.appendChild(g);
    var hasLogin = m && m.kind === "login" && m.user_id,
      extra = el("div");
    box.appendChild(extra);
    var ty = null,
      em = null,
      pw = null;
    if (hasLogin) {
      var lg = el("div", "note", "Has a login: " + (m.email || ""));
      lg.style.margin = "8px 0 0";
      extra.appendChild(lg);
    } else {
      ty = fld("Type", "select", "temp", [
        ["temp", "Temp (text only)"],
        ["login", "Full-time (own login)"]
      ]);
      extra.appendChild(ty);
      var lw = el("div");
      lw.hidden = true;
      em = fld("Login email", "email", "");
      pw = fld("Password", "text", "");
      pw.input.autocomplete = "off";
      lw.appendChild(em);
      lw.appendChild(pw);
      extra.appendChild(lw);
      ty.input.addEventListener("change", function () {
        lw.hidden = ty.input.value !== "login";
      });
    }
    var a = el("div", "acts");
    a.appendChild(
      btn(m ? "Save" : "Add crew member", "btn sm", function () {
        var name = n.input.value.trim();
        if (!name) {
          alert("Enter a name.");
          return;
        }
        var wantLogin = !!ty && ty.input.value === "login";
        if (wantLogin) {
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.input.value.trim())) {
            alert("Enter the login email.");
            return;
          }
          if (pw.input.value.length < 8) {
            alert("The password needs at least 8 characters.");
            return;
          }
        }
        var q = m
          ? sb
              .from("crew")
              .update({ name: name, phone: ph.input.value.trim() })
              .eq("id", m.id)
              .select()
              .single()
          : sb.from("crew").insert({ name: name, phone: ph.input.value.trim() }).select().single();
        q.then(function (r) {
          if (r.error || !r.data) {
            alert("Could not save.");
            return;
          }
          if (!wantLogin) {
            return refreshCrew().then(function () {
              draw();
              render();
            });
          }
          callCrewApi("create", {
            crew_id: r.data.id,
            email: em.input.value.trim(),
            password: pw.input.value
          }).then(function (res) {
            refreshCrew().then(function () {
              draw();
              render();
              if (!res.ok) alert("Saved as a temp, but the login was not created: " + res.error);
              else
                alert(
                  "Login created. Give " +
                    name +
                    " the email and password; they sign in at this same address."
                );
            });
          });
        });
      })
    );
    if (hasLogin) {
      var rp = btn("Reset password", "btn alt sm", function () {
        a.textContent = "";
        var np = document.createElement("input");
        np.type = "text";
        np.placeholder = "New password (8+ characters)";
        np.autocomplete = "off";
        np.style.width = "auto";
        a.appendChild(np);
        a.appendChild(
          btn("Set password", "btn sm", function () {
            callCrewApi("reset", { crew_id: m.id, password: np.value }).then(function (res) {
              if (!res.ok) {
                alert(res.error);
                return;
              }
              alert("Password changed.");
              draw();
            });
          })
        );
        a.appendChild(btn("Cancel", "btn alt sm", draw));
      });
      a.appendChild(rp);
      a.appendChild(
        btn("Remove login", "btn alt sm", function () {
          if (!confirm("Remove " + m.name + "'s login? They keep their name here as a temp.")) return;
          callCrewApi("remove", { crew_id: m.id }).then(function (res) {
            if (!res.ok) {
              alert(res.error);
              return;
            }
            refreshCrew().then(function () {
              draw();
              render();
            });
          });
        })
      );
    }
    if (m)
      a.appendChild(
        btn("Delete", "btn danger sm", function () {
          if (
            !confirm(
              "Delete " + m.name + "? Their login (if any) is removed and their visits become unassigned."
            )
          )
            return;
          var go = function () {
            sb.from("crew")
              .delete()
              .eq("id", m.id)
              .then(function (r) {
                if (r.error) {
                  alert("Could not delete.");
                  return;
                }
                crew = crew.filter(function (z) {
                  return z.id !== m.id;
                });
                visits.forEach(function (v) {
                  if (v.crew_id === m.id) v.crew_id = null;
                });
                jobs.forEach(function (j) {
                  if (j.crew_id === m.id) j.crew_id = null;
                });
                if (crewF === m.id) crewF = "all";
                draw();
                render();
              });
          };
          if (m.user_id)
            callCrewApi("remove", { crew_id: m.id }).then(function (res) {
              if (!res.ok) {
                alert(res.error);
                return;
              }
              go();
            });
          else go();
        })
      );
    box.appendChild(a);
    return box;
  }
  function draw() {
    holder.textContent = "";
    crew.forEach(function (m) {
      holder.appendChild(row(m));
    });
    var h = el("div", "note", crew.length ? "Add another" : "Add your first crew member");
    h.style.margin = "14px 0 6px";
    holder.appendChild(h);
    holder.appendChild(row(null));
  }
  draw();
}

/* ---- send a route to a crew member (text message) ---- */
function smsHref(phone, body) {
  var ios = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && "ontouchend" in document;
  return "sms:" + digits(phone) + (ios ? "&" : "?") + "body=" + encodeURIComponent(body);
}
function routeMessage(d, sel) {
  var lines = ["Latta Corp route for " + dshort(d) + ":", ""];
  sel.forEach(function (v, i) {
    var j = byId(jobs, v.job_id),
      pp = byId(props, v.property_id),
      notes = [pp && pp.notes, j && j.instructions].filter(Boolean).join(" / ");
    lines.push(i + 1 + ". " + paddr(v.property_id) + (j ? " - " + j.title : ""));
    if (notes) lines.push("   Note: " + notes);
  });
  var u = routeUrl(sel);
  if (u) lines.push("", "Map route: " + u);
  return lines.join("\n");
}
function openSendRoute(d) {
  var p = panel();
  p.appendChild(el("h2", null, "Send route · " + dlabel(d)));
  var members = crew.filter(function (c) {
    return c.active !== false;
  });
  if (!members.length) {
    p.appendChild(el("p", null, "Add a crew member first."));
    p.appendChild(btn("Open Crew", "btn", openCrew));
    return;
  }
  var stops = onDay(d)
    .filter(function (v) {
      return v.status === "scheduled";
    })
    .sort(dayOrder);
  if (!stops.length) {
    p.appendChild(el("p", null, "No scheduled stops on this day."));
    return;
  }
  var who = fld(
    "Send to",
    "select",
    members[0].id,
    members.map(function (m) {
      return [
        m.id,
        m.name + (m.kind === "login" ? " (has login)" : "") + (m.phone ? "" : " (no phone saved)")
      ];
    })
  );
  p.appendChild(who);
  p.appendChild(el("div", "note", "Pick the stops for this person, in your route order:"));
  var checks = el("div");
  p.appendChild(checks);
  var boxes = [];
  function defaults() {
    var mine = stops.filter(function (v) {
      return v.crew_id === who.input.value;
    });
    return mine.length
      ? mine
      : stops.filter(function (v) {
          return !v.crew_id;
        });
  }
  function build() {
    checks.textContent = "";
    boxes = [];
    var def = defaults();
    stops.forEach(function (v, i) {
      var j = byId(jobs, v.job_id),
        lab = el("label", "pcard");
      lab.style.cssText = "display:flex;gap:10px;align-items:flex-start;cursor:pointer";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.style.cssText = "width:22px;height:22px;flex:none;margin-top:2px";
      cb.checked = def.indexOf(v) > -1;
      cb.addEventListener("change", msg);
      var t = el("div");
      t.appendChild(el("b", null, i + 1 + ". " + paddr(v.property_id)));
      t.appendChild(
        el(
          "div",
          "note",
          (j ? j.title : "") +
            (v.crew_id && crewName(v.crew_id) ? " · now assigned to " + crewName(v.crew_id) : "")
        )
      );
      lab.appendChild(cb);
      lab.appendChild(t);
      checks.appendChild(lab);
      boxes.push([cb, v]);
    });
    msg();
  }
  var ta = document.createElement("textarea");
  ta.style.minHeight = "170px";
  ta.setAttribute("aria-label", "Message");
  var dirty = false;
  ta.addEventListener("input", function () {
    dirty = true;
  });
  function picked() {
    return boxes
      .filter(function (b) {
        return b[0].checked;
      })
      .map(function (b) {
        return b[1];
      });
  }
  function msg() {
    if (!dirty) ta.value = routeMessage(d, picked());
  }
  who.input.addEventListener("change", function () {
    dirty = false;
    build();
  });
  var asg = el("label");
  asg.style.cssText = "display:flex;gap:10px;align-items:center;margin:10px 0;font-weight:600";
  var ac = document.createElement("input");
  ac.type = "checkbox";
  ac.checked = true;
  ac.style.cssText = "width:20px;height:20px";
  asg.appendChild(ac);
  asg.appendChild(document.createTextNode("Also assign these stops to them"));
  p.appendChild(asg);
  p.appendChild(el("div", "note", "The message has addresses and notes only: no prices or client names."));
  p.appendChild(ta);
  var acts = el("div", "actions");
  function assign() {
    var sel = picked(),
      m = byId(crew, who.input.value);
    if (!sel.length) {
      alert("Pick at least one stop.");
      return Promise.resolve(false);
    }
    if (!ac.checked || !s3) return Promise.resolve(true);
    return Promise.all(
      sel.map(function (v, i) {
        return sb
          .from("visits")
          .update({ crew_id: m.id, sort_order: i * 10 })
          .eq("id", v.id)
          .then(function (r) {
            if (!r.error) {
              v.crew_id = m.id;
              v.sort_order = i * 10;
            }
            return r;
          });
      })
    ).then(function (rs) {
      render();
      return !rs.some(function (r) {
        return r.error;
      });
    });
  }
  var send = btn("Open text message", "btn", function () {
    var m = byId(crew, who.input.value);
    if (!m.phone && !confirm("No phone number saved for " + m.name + ". Open a blank text anyway?")) return;
    assign().then(function (ok) {
      if (!ok) return;
      window.location.href = smsHref(m.phone, ta.value);
    });
  });
  var cp = btn("Copy message", "btn alt", function () {
    function done() {
      cp.textContent = "Copied";
      setTimeout(function () {
        cp.textContent = "Copy message";
      }, 1500);
    }
    assign().then(function (ok) {
      if (!ok) return;
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(ta.value).then(done, function () {
          ta.select();
          document.execCommand("copy");
          done();
        });
      else {
        ta.select();
        document.execCommand("copy");
        done();
      }
    });
  });
  acts.appendChild(send);
  acts.appendChild(cp);
  p.appendChild(acts);
  build();
}

/* ---- the crew member's own limited screen ---- */
function startCrewApp(me) {
  crewMe = me;
  $("loginwrap").hidden = true;
  $("layout").hidden = true;
  $("gsearch").hidden = true;
  $("crewapp").hidden = false;
  $("signout").hidden = false;
  $("acct").hidden = false;
  $("refresh").hidden = false;
  crewHeaderText();
  renderCrewApp();
  chatRefresh().then(function () {
    if (msgUnread() && crewTab === "route") renderCrewApp();
  });
}
/* ---- crew screen in English or Spanish (each phone remembers its choice) ---- */
var CREW_ES = {
  "Hi, ": "Hola, ",
  "Upload receipt": "Subir recibo",
  "What was it for? (optional)": "¿Para qué fue? (opcional)",
  "Loading...": "Cargando...",
  "Could not load your route. Pull to refresh or sign in again.": "No se pudo cargar tu ruta. Actualiza o vuelve a iniciar sesión.",
  "No stops for this day.": "No hay paradas este día.",
  stop: "parada",
  stops: "paradas",
  done: "listas",
  "Start route": "Iniciar ruta",
  Map: "Mapa",
  Done: "Listo",
  Undo: "Deshacer",
  "Save": "Guardar",
  "Cancel": "Cancelar",
  "Edit": "Editar",
  "Could not save that. Try again.": "No se pudo guardar. Inténtalo de nuevo.",
  "Hedge trimming": "Recorte de arbustos",
  "Weed killing": "Control de maleza",
  "Note for the client (shows on the invoice)": "Nota para el cliente (aparece en la factura)",
  "(no charge)": "(sin cargo)",
  Today: "Hoy",
  Route: "Ruta",
  Messages: "Mensajes",
  "Uploading...": "Subiendo...",
  "Please sign in again.": "Vuelve a iniciar sesión.",
  "✓ Receipt sent to the office.": "✓ Recibo enviado a la oficina.",
  "Could not upload. Try again.": "No se pudo subir. Inténtalo de nuevo.",
  "Phone notifications": "Notificaciones",
  "Log out": "Cerrar sesión",
  "Signed in": "Sesión iniciada",
  "On an invoice": "Ya facturado",
  Everyone: "Todos",
  Office: "Oficina",
  Chats: "Chats",
  Back: "Atr\u00e1s",
  Send: "Enviar",
  Photo: "Foto",
  "Type a message...": "Escribe un mensaje...",
  "Message someone...": "Escribirle a alguien...",
  "No messages yet. Say hi!": "A\u00fan no hay mensajes. \u00a1Saluda!",
  "Could not send. Try again.": "No se pudo enviar. Int\u00e9ntalo de nuevo.",
  "This phone can't get notifications. Open Foreman in Chrome and install it, then open it from the home screen.":
    "Este tel\u00e9fono no puede recibir notificaciones. Abre Foreman en Chrome, inst\u00e1lalo y \u00e1brelo desde la pantalla de inicio.",
  "\u2713 Notifications are on for this phone.": "\u2713 Las notificaciones est\u00e1n activadas en este tel\u00e9fono.",
  "Send a test": "Enviar prueba",
  "Sent.": "Enviada.",
  "Turn off": "Desactivar",
  "Turn on notifications": "Activar notificaciones",
  "Notifications weren't allowed.": "No se permitieron las notificaciones.",
  "\u2713 Turned on.": "\u2713 Activadas.",
  Appearance: "Apariencia",
  Light: "Claro",
  Dark: "Oscuro",
  Auto: "Auto"
};
var crewLang = (function () {
  try {
    return localStorage.getItem("crewLang") === "es" ? "es" : "en";
  } catch (e) {
    return "en";
  }
})();
function crewT(s) {
  return crewMe && crewLang === "es" && CREW_ES[s] ? CREW_ES[s] : s;
}
function crewLangBar(host) {
  var w = el("div", "langsw");
  [
    ["en", "English"],
    ["es", "Español"]
  ].forEach(function (x) {
    var b = btn(x[1], "langbtn" + (crewLang === x[0] ? " on" : ""), function () {
      crewLang = x[0];
      try {
        localStorage.setItem("crewLang", x[0]);
      } catch (e) {}
      crewHeaderText();
      renderCrewApp();
    });
    b.setAttribute("aria-pressed", crewLang === x[0] ? "true" : "false");
    w.appendChild(b);
  });
  host.appendChild(w);
}
function crewHeaderText() {
  var so = $("signout"),
    mn = $("menuNotify");
  if (so && so.lastChild) so.lastChild.textContent = crewT("Log out");
  if (mn && mn.lastChild) mn.lastChild.textContent = crewT("Phone notifications");
  var tl = $("amthemelbl");
  if (tl) tl.textContent = crewT("Appearance");
  [].forEach.call(document.querySelectorAll("[data-theme-set]"), function (b) {
    b.textContent = crewT({ light: "Light", dark: "Dark", auto: "Auto" }[b.getAttribute("data-theme-set")]);
  });
}
var crewTab = "route";
function renderCrewApp() {
  var box = $("crewapp"),
    d = cwDate,
    t = today();
  box.textContent = "";
  document.documentElement.lang = crewLang;
  var top = el("div", "cwtop");
  top.appendChild(el("h2", null, crewT("Hi, ") + String(crewMe.name || "").split(" ")[0]));
  crewLangBar(top);
  box.appendChild(top);
  var tb = el("div", "tabs cwtabs");
  [
    ["route", crewT("Route")],
    ["messages", crewT("Messages")]
  ].forEach(function (x) {
    var b = el("button", "tab" + (crewTab === x[0] ? " on" : ""), x[1]);
    b.type = "button";
    if (x[0] === "messages" && typeof msgUnread === "function" && msgUnread()) b.appendChild(el("i", "tnew", String(msgUnread())));
    b.addEventListener("click", function () {
      crewTab = x[0];
      renderCrewApp();
    });
    tb.appendChild(b);
  });
  box.appendChild(tb);
  if (crewTab === "messages") {
    var mh = el("div");
    box.appendChild(mh);
    renderChat(mh);
    return;
  }
  // snap a receipt: it goes to the office's Receipts to enter
  var rb = el("div", "qacts cwrcpt");
  var rst = el("span", "note");
  rb.appendChild(
    btn(crewT("Upload receipt"), "btn alt sm", function () {
      var note = prompt(crewT("What was it for? (optional)"), "") || "";
      pickPhotos(true, function (fs) {
        crewReceipts(fs, note, rst);
      });
    })
  );
  rb.appendChild(rst);
  box.appendChild(rb);
  var nav = calNav(
    pd(d).toLocaleDateString(crewLang === "es" ? "es-US" : undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    function () {
      cwDate = addDays(d, -1);
      renderCrewApp();
    },
    function () {
      cwDate = addDays(d, 1);
      renderCrewApp();
    },
    function () {
      cwDate = t;
      renderCrewApp();
    },
    d !== t
  );
  [].forEach.call(nav.querySelectorAll("button"), function (b) {
    if (b.textContent === "Today") b.textContent = crewT("Today");
  });
  box.appendChild(nav);
  var body = el("div");
  body.appendChild(el("div", "note", crewT("Loading...")));
  box.appendChild(body);
  sb.rpc("crew_route", { p_from: d, p_to: d }).then(function (r) {
    if (cwDate !== d || crewTab !== "route") return;
    body.textContent = "";
    if (r.error) {
      body.appendChild(el("div", "note", crewT("Could not load your route. Pull to refresh or sign in again.")));
      return;
    }
    var rows = r.data || [];
    if (!rows.length) {
      body.appendChild(el("div", "empty", crewT("No stops for this day.")));
      return;
    }
    var todo = rows.filter(function (x) {
        return x.status === "scheduled";
      }),
      done = rows.length - todo.length;
    var sum = el("div", "daysum");
    sum.appendChild(
      el(
        "b",
        null,
        rows.length + " " + crewT(rows.length > 1 ? "stops" : "stop") + (done ? " · " + done + " " + crewT("done") : "")
      )
    );
    var addrs = todo
      .map(function (x) {
        return x.address;
      })
      .filter(Boolean)
      .slice(0, 10);
    if (addrs.length) {
      var a = el("a", "btn sm", crewT("Start route"));
      a.href =
        "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" +
        encodeURIComponent(addrs[addrs.length - 1]) +
        (addrs.length > 1 ? "&waypoints=" + encodeURIComponent(addrs.slice(0, -1).join("|")) : "");
      a.target = "_blank";
      a.rel = "noopener";
      sum.appendChild(a);
    }
    body.appendChild(sum);
    rows.forEach(function (x, i) {
      var isDone = x.status === "done";
      var card = el("div", "pcard cwstop" + (isDone ? " isdone" : ""));
      card.appendChild(el("div", "cwtitle", i + 1 + ". " + x.job_title));
      card.appendChild(el("div", "cwaddr", x.address));
      var tips = [x.property_notes, x.instructions].filter(Boolean).join("\n");
      if (tips) {
        var n = el("div", "note", "⚠ " + tips);
        n.style.cssText = "color:#7a5b00;white-space:pre-wrap;margin-top:4px";
        card.appendChild(n);
      }
      function save(doneNow, pick) {
        sb.rpc("crew_set_done", {
          p_visit: x.visit_id,
          p_done: doneNow,
          p_extras: pick ? pick.extras : null,
          p_note: pick ? pick.note : null
        }).then(function (r2) {
          if (r2.error) alert(crewT("Could not save that. Try again."));
          else if (doneNow && !isDone) callApi("/api/push", "client-visit", { id: x.visit_id });
          renderCrewApp();
        });
      }
      var acts = el("div", "acts"),
        m = el("a", "btn alt", crewT("Map"));
      m.href = mapsUrl(x.address);
      m.target = "_blank";
      m.rel = "noopener";
      acts.appendChild(m);
      if (isDone) {
        var ex = (x.done_extras || []).map(function (k) {
          return crewT(extraLabel(k));
        });
        if (ex.length) card.appendChild(el("div", "donex", "✓ " + ex.join(" · ") + " " + crewT("(no charge)")));
        if (x.done_note) card.appendChild(el("div", "donenote", "“" + x.done_note + "”"));
        acts.appendChild(
          btn(crewT("Edit"), "btn alt", function () {
            acts.textContent = "";
            var get = extrasPicker(card, x.done_extras, x.done_note, true);
            card.appendChild(acts);
            acts.appendChild(
              btn(crewT("Save"), "btn", function () {
                save(true, get());
              })
            );
            acts.appendChild(btn(crewT("Cancel"), "btn alt", renderCrewApp));
          })
        );
        acts.appendChild(
          btn(crewT("Undo"), "btn alt", function () {
            save(false, null);
          })
        );
      } else {
        var getP = extrasPicker(card, x.done_extras, x.done_note, true);
        card.appendChild(acts);
        acts.appendChild(
          btn(crewT("Done"), "btn rdone", function () {
            save(true, getP());
          })
        );
      }
      card.appendChild(acts);
      body.appendChild(card);
    });
  });
}

function crewReceipts(files, note, st) {
  files = Array.prototype.slice.call(files || []);
  if (!files.length) return;
  st.textContent = crewT("Uploading...");
  sb.auth.getSession().then(function (ss) {
    var uidv = ss && ss.data && ss.data.session && ss.data.session.user && ss.data.session.user.id;
    if (!uidv) {
      st.textContent = crewT("Please sign in again.");
      return;
    }
    var ok = 0;
    files
      .reduce(function (pr, f) {
        return pr.then(function () {
          return loadImg(f)
            .then(function (img) {
              return Promise.all([toJpeg(img, 1600, 0.82), toJpeg(img, 360, 0.7)]);
            })
            .then(function (rs) {
              var id = uid(),
                path = "crew-receipts/" + uidv + "/" + id + ".jpg",
                tpath = "crew-receipts/" + uidv + "/" + id + "_t.jpg",
                bk = sb.storage.from("photos");
              return bk.upload(path, rs[0].blob, { contentType: "image/jpeg" }).then(function (u) {
                if (u.error) throw new Error("up");
                return bk.upload(tpath, rs[1].blob, { contentType: "image/jpeg" }).then(function (u2) {
                  if (u2.error) throw new Error("up");
                  return sb
                    .rpc("crew_add_receipt", { p_path: path, p_thumb: tpath, p_size: rs[0].blob.size + rs[1].blob.size, p_w: rs[0].w, p_h: rs[0].h, p_caption: note })
                    .then(function (r) {
                      if (r.error) throw new Error("rpc");
                      ok++;
                    });
                });
              });
            })
            .catch(function () {});
        });
      }, Promise.resolve())
      .then(function () {
        st.textContent = ok ? crewT("\u2713 Receipt sent to the office.") : crewT("Could not upload. Try again.");
        if (ok) callApi("/api/push", "receipt", {}); // pings the office phones
      });
  });
}
