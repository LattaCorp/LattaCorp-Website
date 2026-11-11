/* Personnel tab (owners only): employee records, payroll, benefits and documents. */

/* ---- Personnel: owners only (people, payroll, benefits, documents) ---- */
var PSTAT = [
    ["active", "Active"],
    ["inactive", "Inactive"],
    ["team", "Team"]
  ],
  PMETH = [
    ["zelle", "Zelle"],
    ["venmo", "Venmo"],
    ["cashapp", "Cash App"],
    ["cash", "Cash"],
    ["check", "Check"]
  ];
var GENDERS = [
  ["", "Select..."],
  ["Male", "Male"],
  ["Female", "Female"],
  ["Non-binary", "Non-binary"],
  ["Prefer not to say", "Prefer not to say"]
];
var DKINDS = [
  ["W-9", "W-9"],
  ["ID", "ID copy"],
  ["Agreement", "Agreement"],
  ["Insurance", "Insurance"],
  ["Other", "Other"]
];
var pstCache = {};
function empId(p) {
  return "EMP-" + ("000" + p.emp_no).slice(-4);
}
function pstatLabel(s) {
  var x = PSTAT.filter(function (a) {
    return a[0] === s;
  })[0];
  return x ? x[1] : s;
}
function methLabel(m) {
  var x = PMETH.filter(function (a) {
    return a[0] === m;
  })[0];
  return x ? x[1] : m;
}
function fmtSsn(s) {
  var d = String(s || "")
    .replace(/\D/g, "")
    .slice(0, 9);
  if (d.length > 5) return d.slice(0, 3) + "-" + d.slice(3, 5) + "-" + d.slice(5);
  if (d.length > 3) return d.slice(0, 3) + "-" + d.slice(3);
  return d;
}
function sumAmt(rows) {
  var t = 0;
  rows.forEach(function (r) {
    t += Number(r.amount) || 0;
  });
  return Math.round(t * 100) / 100;
}
function paidBy(id, year) {
  return payRows.filter(function (r) {
    return r.person_id === id && (!year || String(r.paid_on).slice(0, 4) === year);
  });
}
function signP(path) {
  if (!path) return Promise.resolve("");
  var c = pstCache[path];
  if (c && c.exp > Date.now() + 60000) return Promise.resolve(c.url);
  return sb.storage
    .from("personnel")
    .createSignedUrl(path, 3600)
    .then(
      function (r) {
        if (r.error || !r.data) return "";
        pstCache[path] = { url: r.data.signedUrl, exp: Date.now() + 3500000 };
        return r.data.signedUrl;
      },
      function () {
        return "";
      }
    );
}
function avatar(p, size) {
  var d = el("div");
  d.style.cssText =
    "flex:none;width:" +
    size +
    "px;height:" +
    size +
    "px;border-radius:50%;background:var(--mint);color:var(--forest);display:flex;align-items:center;justify-content:center;font-weight:800;overflow:hidden";
  d.textContent = String(p.full_name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  if (p.photo_path)
    signP(p.photo_path).then(function (u) {
      if (u) {
        d.textContent = "";
        var i = document.createElement("img");
        i.alt = "";
        i.src = u;
        i.style.cssText = "width:100%;height:100%;object-fit:cover";
        d.appendChild(i);
      }
    });
  return d;
}
/* Everyone on the Team tab gets a Personnel record automatically (linked by their login email; an existing record with the same name is linked instead of duplicated). */
function syncTeam() {
  if (teamSyncing || persErr || !isOwner() || Date.now() - teamSyncAt < 60000) return;
  teamSyncing = true;
  callApi("/api/team", "list", {}).then(
    function (res) {
      teamSyncAt = Date.now();
      if (!res.ok || !res.data || !res.data.members) {
        teamSyncing = false;
        return;
      }
      var jobs = [];
      res.data.members.forEach(function (m) {
        var em = String(m.email || "")
          .trim()
          .toLowerCase();
        if (!em) return;
        if (
          people.some(function (x) {
            return String(x.login_email || "").toLowerCase() === em;
          })
        )
          return;
        var nm = String(m.name || "").trim(),
          match = nm
            ? people.filter(function (x) {
                return !x.login_email && String(x.full_name).trim().toLowerCase() === nm.toLowerCase();
              })[0]
            : null;
        if (match)
          jobs.push(
            sb
              .from("personnel")
              .update({ login_email: em, status: "team" })
              .eq("id", match.id)
              .select()
              .single()
          );
        else
          jobs.push(
            sb
              .from("personnel")
              .insert({ full_name: nm || em.split("@")[0], email: em, status: "team", login_email: em })
              .select()
              .single()
          );
      });
      if (!jobs.length) {
        teamSyncing = false;
        return;
      }
      Promise.all(jobs).then(
        function (rs) {
          var ch = false;
          rs.forEach(function (r) {
            if (r && !r.error && r.data) {
              pRow(r.data);
              ch = true;
            }
          });
          teamSyncing = false;
          if (ch && view === "personnel") render();
        },
        function () {
          teamSyncing = false;
        }
      );
    },
    function () {
      teamSyncing = false;
    }
  );
}
function renderPersonnel() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  $("topbtns").appendChild(
    btn("+ Add person", "btn", function () {
      openPerson(null);
    })
  );
  syncTeam();
  if (persErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Personnel isn't set up yet. Run the Stage 17 SQL in Supabase (it's in the supabase folder of the website files)."
      )
    );
    return;
  }
  var counts = { all: 0, active: 0, team: 0, inactive: 0 };
  people.forEach(function (p) {
    counts[p.status] = (counts[p.status] || 0) + 1;
    if (p.status !== "inactive") counts.all++;
  });
  [["all", "All"]].concat(PSTAT).forEach(function (s) {
    var b = el("button", "tab" + (pfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + (counts[s[0]] || 0) + ")"));
    b.addEventListener("click", function () {
      pfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  var shown = people.filter(function (p) {
    if (pfilter === "all" ? p.status === "inactive" : p.status !== pfilter) return false;
    if (!query) return true;
    return [p.full_name, empId(p), p.job_title, p.phone, p.email].join(" ").toLowerCase().indexOf(query) > -1;
  });
  if (!shown.length) {
    list.appendChild(
      el("div", "empty", people.length ? "Nobody matches that." : "No one added yet. Press + Add person.")
    );
    return;
  }
  shown.forEach(function (p) {
    var b = el("button", "row");
    b.type = "button";
    b.style.alignItems = "center";
    var left = el("div");
    left.style.cssText = "display:flex;gap:10px;align-items:center";
    left.appendChild(avatar(p, 40));
    var t = el("div");
    t.appendChild(el("b", null, p.full_name));
    t.appendChild(el("div", "sub", [empId(p), p.job_title].filter(Boolean).join(" · ")));
    left.appendChild(t);
    var right = el("div");
    right.style.textAlign = "right";
    right.appendChild(
      el(
        "span",
        "chip " + (p.status === "inactive" ? "lost" : p.status === "team" ? "won" : ""),
        pstatLabel(p.status)
      )
    );
    var yr = String(new Date().getFullYear());
    right.appendChild(el("div", "sub", "Paid " + yr + ": " + money(sumAmt(paidBy(p.id, yr)))));
    b.appendChild(left);
    b.appendChild(right);
    b.addEventListener("click", function () {
      openPerson(p);
    });
    list.appendChild(b);
  });
}
function pRow(p) {
  for (var i = 0; i < people.length; i++)
    if (people[i].id === p.id) {
      people[i] = p;
      return;
    }
  people.push(p);
  people.sort(function (a, b) {
    return a.emp_no - b.emp_no;
  });
}
function openPerson(p, tab) {
  var pn = panel();
  tab = tab || "bio";
  pn.appendChild(el("h2", null, p ? p.full_name : "Add person"));
  if (p) pn.appendChild(el("div", "note", empId(p) + " · " + pstatLabel(p.status)));
  var bar = el("div", "ctabs");
  bar.style.margin = "8px 0 12px";
  pn.appendChild(bar);
  var body = el("div");
  pn.appendChild(body);
  [
    ["bio", "Bio"],
    ["pay", "Payroll"],
    ["ben", "Benefits"],
    ["docs", "Documents"]
  ].forEach(function (t) {
    var b = el("button", tab === t[0] ? "on" : "", t[1]);
    b.type = "button";
    if (!p && t[0] !== "bio") {
      b.disabled = true;
      b.title = "Save the bio first";
    }
    b.addEventListener("click", function () {
      openPerson(p, t[0]);
    });
    bar.appendChild(b);
  });
  if (tab === "bio") personBio(body, p);
  else if (tab === "pay") personPay(body, p);
  else if (tab === "ben") personBen(body, p);
  else personDocs(body, p);
}
function dv(s) {
  return s ? String(s).slice(0, 10) : "";
}
function personBio(host, p) {
  var src = p || {},
    pend = null;
  /* ID photo */
  var ph = el("div", "pcard");
  ph.style.cssText += ";display:flex;gap:12px;align-items:center;flex-wrap:wrap";
  var pic = el("div");
  ph.appendChild(pic);
  function drawPic() {
    pic.textContent = "";
    if (!pend && !(p && p.photo_path)) {
      var a = avatar(p || { full_name: "?" }, 96);
      a.style.borderRadius = "10px";
      a.style.width = "80px";
      a.style.height = "100px";
      pic.appendChild(a);
      return;
    }
    var im = document.createElement("img");
    im.alt = "ID photo";
    im.style.cssText =
      "display:block;max-width:100%;width:auto;height:auto;max-height:340px;border:1px solid var(--line);border-radius:8px;background:#f1f5f0;cursor:zoom-in";
    pic.style.cssText = "flex:1 1 260px;max-width:100%";
    if (pend) im.src = URL.createObjectURL(pend);
    else
      signP(p.photo_path).then(function (u) {
        if (u) im.src = u;
      });
    im.addEventListener("click", function () {
      if (im.src) window.open(im.src, "_blank");
    });
    pic.appendChild(im);
  }
  drawPic();
  var pa = el("div", "acts");
  pa.style.marginTop = "0";
  pa.appendChild(
    btn(p && p.photo_path ? "Replace ID photo" : "Add ID photo", "btn alt sm", function () {
      pickPhotos(false, function (fs) {
        var f = fs[0];
        if (!p) {
          pend = f;
          drawPic();
          return;
        }
        uploadPersonPhoto(f, p).then(
          function (np) {
            p = np;
            src = np;
            pend = null;
            drawPic();
            render();
          },
          function () {
            alert("Could not save the photo. It must be a JPEG, PNG or WebP picture.");
          }
        );
      });
    })
  );
  ph.appendChild(pa);
  host.appendChild(ph);
  var g = el("div", "grid2");
  var idf = fld("Employee ID", "text", p ? empId(p) : "Assigned when you save");
  idf.input.readOnly = true;
  idf.input.style.background = "#f1f5f0";
  var nm = fld("Full name", "text", src.full_name || ""),
    gen = fld("Gender", "select", src.gender || "", GENDERS),
    bd = fld("Birthdate", "date", dv(src.birthdate));
  var ad = fld("Address", "text", src.address || ""),
    ci = fld("City", "text", src.city || ""),
    st = fld("State", "text", src.state || "FL"),
    zp = fld("Zip", "text", src.zip || "");
  zp.input.inputMode = "numeric";
  var ph1 = fld("Phone", "tel", src.phone || ""),
    em = fld("Email", "email", src.email || "");
  var ss = fld("Social Security number", "password", fmtSsn(src.ssn || ""));
  ss.input.autocomplete = "off";
  ss.input.inputMode = "numeric";
  ss.input.placeholder = "###-##-####";
  eyeToggle(ss.input, "Social Security number"); /* hidden as dots until the eye "Show" is pressed */
  ss.input.addEventListener("blur", function () {
    ss.input.value = fmtSsn(ss.input.value);
  });
  var en = fld("Emergency contact", "text", src.emergency_name || ""),
    ep = fld("Emergency phone", "tel", src.emergency_phone || "");
  var jt = fld("Job title", "text", src.job_title || ""),
    sts = fld("Status", "select", src.status || "active", PSTAT),
    sd = fld("Start date", "date", dv(src.start_date)),
    ed = fld("End date", "date", dv(src.end_date));
  var nt = fld("Notes", "textarea", src.notes || "");
  [idf, nm, gen, bd, ad, ci, st, zp, ph1, em].forEach(function (x) {
    g.appendChild(x);
  });
  host.appendChild(g);
  host.appendChild(ss);
  var g2 = el("div", "grid2");
  [en, ep, jt, sts, sd, ed].forEach(function (x) {
    g2.appendChild(x);
  });
  host.appendChild(g2);
  host.appendChild(nt);
  /* Team access */
  var tbox = el("div", "pcard");
  tbox.style.background = "#eef6ec";
  host.appendChild(tbox);
  var tlEmail, tlRole, tlPass;
  function drawTeam() {
    tbox.textContent = "";
    if (sts.input.value !== "team") {
      tbox.style.display = "none";
      return;
    }
    tbox.style.display = "";
    tbox.appendChild(el("b", null, "Team access"));
    if (p && p.login_email) {
      tbox.appendChild(
        el("div", "note", "Has a login: " + p.login_email + ". Manage roles and passwords on the Team tab.")
      );
      var a = el("div", "acts");
      a.appendChild(
        btn("Remove team access", "btn danger sm", function () {
          if (!confirm("Remove " + p.login_email + " from the team? They won't be able to sign in any more."))
            return;
          callApi("/api/team", "remove", { email: p.login_email }).then(function (res) {
            if (!res.ok) {
              alert(res.error);
              return;
            }
            sb.from("personnel")
              .update({ login_email: "" })
              .eq("id", p.id)
              .select()
              .single()
              .then(function (r) {
                if (r.error || !r.data) {
                  alert("Removed the login, but could not update this record.");
                  return;
                }
                p = r.data;
                pRow(p);
                drawTeam();
              });
          });
        })
      );
      tbox.appendChild(a);
      return;
    }
    tbox.appendChild(
      el(
        "div",
        "note",
        "Saving creates a sign-in for this person. Office can use clients, jobs, schedule and billing; Owner can do everything. Leave the password empty to save without creating a login yet."
      )
    );
    var gg = el("div", "grid2");
    tlEmail = fld("Login email", "email", em.input.value);
    tlRole = fld("Access level", "select", "office", [
      ["office", "Office (clients, jobs, schedule, billing)"],
      ["owner", "Owner / co-owner (everything)"]
    ]);
    tlPass = fld("Password", "text", "");
    tlPass.input.autocomplete = "off";
    gg.appendChild(tlEmail);
    gg.appendChild(tlRole);
    tbox.appendChild(gg);
    tbox.appendChild(tlPass);
  }
  sts.input.addEventListener("change", drawTeam);
  drawTeam();
  var acts = el("div", "acts");
  acts.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:16px";
  var save = btn(p ? "Save changes" : "Save person", "btn", function () {
    if (!nm.input.value.trim()) {
      alert("Enter the person's full name.");
      return;
    }
    var sd9 = ss.input.value.replace(/\D/g, "");
    if (
      sd9 &&
      sd9.length !== 9 &&
      !confirm("That Social Security number has " + sd9.length + " digits instead of 9. Save it anyway?")
    )
      return;
    var wantLogin = sts.input.value === "team" && !(p && p.login_email) && tlPass && tlPass.input.value;
    if (wantLogin) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tlEmail.input.value.trim())) {
        alert("Enter an email for their login.");
        return;
      }
      if (tlPass.input.value.length < 8) {
        alert("The password needs at least 8 characters.");
        return;
      }
    }
    var row = {
      full_name: nm.input.value.trim(),
      gender: gen.input.value,
      birthdate: bd.input.value || null,
      address: ad.input.value.trim(),
      city: ci.input.value.trim(),
      state: st.input.value.trim().toUpperCase().slice(0, 2),
      zip: zp.input.value.trim(),
      phone: ph1.input.value.trim(),
      email: em.input.value.trim(),
      ssn: fmtSsn(ss.input.value),
      emergency_name: en.input.value.trim(),
      emergency_phone: ep.input.value.trim(),
      job_title: jt.input.value.trim(),
      status: sts.input.value,
      start_date: sd.input.value || null,
      end_date: ed.input.value || null,
      notes: nt.input.value
    };
    save.disabled = true;
    var q = p
      ? sb.from("personnel").update(row).eq("id", p.id).select().single()
      : sb.from("personnel").insert(row).select().single();
    q.then(function (r) {
      if (r.error || !r.data) {
        save.disabled = false;
        alert("Could not save. If this is new, make sure the Stage 17 SQL was run in Supabase.");
        return;
      }
      var saved = r.data,
        wasNew = !p;
      p = saved;
      pRow(saved);
      var steps = Promise.resolve();
      if (pend)
        steps = steps.then(function () {
          return uploadPersonPhoto(pend, saved).then(
            function (np) {
              p = np;
              pRow(np);
            },
            function () {
              alert("The person was saved, but the photo could not be uploaded. Try Replace ID photo.");
            }
          );
        });
      if (wantLogin)
        steps = steps.then(function () {
          return callApi("/api/team", "create", {
            name: row.full_name,
            email: tlEmail.input.value.trim(),
            role: tlRole.input.value,
            password: tlPass.input.value
          }).then(function (res) {
            if (!res.ok) {
              alert("Saved, but the team login was not created: " + res.error);
              return;
            }
            return sb
              .from("personnel")
              .update({ login_email: tlEmail.input.value.trim().toLowerCase() })
              .eq("id", saved.id)
              .select()
              .single()
              .then(function (r2) {
                if (!r2.error && r2.data) {
                  p = r2.data;
                  pRow(p);
                }
                alert(
                  "Team login created. Give them " +
                    tlEmail.input.value.trim() +
                    " and the password you set; they sign in at this same address."
                );
              });
          });
        });
      steps.then(function () {
        render();
        openPerson(p, wasNew ? "pay" : "bio");
      });
    });
  });
  acts.appendChild(save);
  if (p) {
    var delP = btn("Delete person", "btn danger sm", function () {
      if (paidBy(p.id).length) {
        alert(
          "This person has payments on record, which feed your Tax Report, so they can't be deleted. Set the status to Inactive instead."
        );
        return;
      }
      if (!confirm("Delete " + p.full_name + " and everything saved for them? This can't be undone.")) return;
      var paths = docRows
        .filter(function (d) {
          return d.person_id === p.id;
        })
        .map(function (d) {
          return d.path;
        });
      if (p.photo_path) paths.push(p.photo_path);
      (paths.length ? sb.storage.from("personnel").remove(paths) : Promise.resolve({}))
        .then(function () {
          return sb.from("personnel").delete().eq("id", p.id);
        })
        .then(function (r) {
          if (r.error) {
            alert("Could not delete.");
            return;
          }
          people = people.filter(function (x) {
            return x.id !== p.id;
          });
          docRows = docRows.filter(function (d) {
            return d.person_id !== p.id;
          });
          benRows = benRows.filter(function (d) {
            return d.person_id !== p.id;
          });
          closeDetail();
          render();
        });
    });
    delP.style.marginLeft = "auto";
    acts.appendChild(delP);
  }
  host.appendChild(acts);
}
function uploadPersonPhoto(file, p) {
  return loadImg(file)
    .then(function (img) {
      return toJpeg(img, 700, 0.85);
    })
    .then(function (j) {
      var path = p.id + "/photo-" + Date.now() + ".jpg",
        st = sb.storage.from("personnel");
      return st.upload(path, j.blob, { contentType: "image/jpeg" }).then(function (u) {
        if (u.error) throw new Error("upload");
        return sb
          .from("personnel")
          .update({ photo_path: path })
          .eq("id", p.id)
          .select()
          .single()
          .then(function (r) {
            if (r.error || !r.data) {
              st.remove([path]);
              throw new Error("save");
            }
            if (p.photo_path) {
              st.remove([p.photo_path]);
              delete pstCache[p.photo_path];
            }
            pRow(r.data);
            return r.data;
          });
      });
    });
}
function personPay(host, p) {
  var yr = String(new Date().getFullYear());
  var rate = fld("Hourly rate ($)", "number", p.hourly_rate == null ? "" : p.hourly_rate);
  rate.input.step = "0.25";
  rate.input.min = "0";
  rate.input.inputMode = "decimal";
  var rr = el("div");
  rr.style.cssText = "display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap";
  rate.style.cssText = "margin:0;flex:1;min-width:150px";
  rr.appendChild(rate);
  rr.appendChild(
    btn("Save rate", "btn alt sm", function () {
      var v = rate.input.value === "" ? null : Math.max(0, Number(rate.input.value) || 0);
      sb.from("personnel")
        .update({ hourly_rate: v })
        .eq("id", p.id)
        .select()
        .single()
        .then(function (r) {
          if (r.error || !r.data) {
            alert("Could not save the rate.");
            return;
          }
          p = r.data;
          pRow(p);
          openPerson(p, "pay");
        });
    })
  );
  host.appendChild(rr);
  var sum = el("div", "pcard");
  sum.style.margin = "12px 0";
  sum.appendChild(el("div", null, yr + " paid: " + money(sumAmt(paidBy(p.id, yr)))));
  sum.appendChild(
    el(
      "div",
      "note",
      "All time: " +
        money(sumAmt(paidBy(p.id))) +
        " · These totals feed the Employee pay box on the Tax Report."
    )
  );
  host.appendChild(sum);
  host.appendChild(el("h3", null, "Record a payment"));
  var g = el("div", "grid2"),
    pd = fld("Date paid", "date", today()),
    hr = fld("Hours", "number", ""),
    am = fld("Amount paid ($)", "number", ""),
    me = fld("Paid by", "select", "zelle", PMETH);
  hr.input.step = "0.25";
  hr.input.min = "0";
  hr.input.inputMode = "decimal";
  am.input.step = "0.01";
  am.input.min = "0";
  am.input.inputMode = "decimal";
  var typed = false;
  am.input.addEventListener("input", function () {
    typed = true;
  });
  hr.input.addEventListener("input", function () {
    if (!typed && p.hourly_rate && hr.input.value)
      am.input.value = (Number(hr.input.value) * Number(p.hourly_rate)).toFixed(2);
  });
  [pd, hr, am, me].forEach(function (x) {
    g.appendChild(x);
  });
  host.appendChild(g);
  var no = fld("Note", "text", "");
  host.appendChild(no);
  var add = btn("Record payment", "btn", function () {
    var a = Number(am.input.value);
    if (!(a > 0)) {
      alert("Enter the amount paid.");
      return;
    }
    if (!pd.input.value) {
      alert("Pick the date paid.");
      return;
    }
    add.disabled = true;
    sb.from("personnel_pay")
      .insert({
        person_id: p.id,
        paid_on: pd.input.value,
        amount: a,
        hours: hr.input.value === "" ? null : Number(hr.input.value),
        rate: p.hourly_rate || null,
        method: me.input.value,
        note: no.input.value.trim()
      })
      .select()
      .single()
      .then(function (r) {
        add.disabled = false;
        if (r.error || !r.data) {
          alert("Could not save the payment.");
          return;
        }
        payRows.unshift(r.data);
        render();
        openPerson(p, "pay");
      });
  });
  add.style.marginTop = "6px";
  host.appendChild(add);
  var rows = paidBy(p.id).sort(function (a, b) {
    return String(b.paid_on).localeCompare(String(a.paid_on));
  });
  var h = el("h3", null, "Payments");
  h.style.margin = "16px 0 6px";
  host.appendChild(h);
  if (!rows.length) host.appendChild(el("div", "empty", "No payments recorded yet."));
  rows.forEach(function (r) {
    var c = el("div", "pcard"),
      top = el("div");
    top.style.cssText = "display:flex;justify-content:space-between;gap:8px;align-items:center";
    var l = el("div");
    l.appendChild(el("b", null, money(r.amount) + " · " + mdy(r.paid_on)));
    l.appendChild(
      el(
        "div",
        "note",
        [methLabel(r.method), r.hours ? r.hours + " hrs" : "", r.note].filter(Boolean).join(" · ")
      )
    );
    top.appendChild(l);
    var pa = el("div", "acts");
    pa.style.cssText = "display:flex;gap:6px;margin:0";
    pa.appendChild(
      btn("Edit", "btn alt sm", function () {
        c.textContent = "";
        var eg = el("div", "grid2"),
          epd = fld("Date paid", "date", String(r.paid_on).slice(0, 10)),
          ehr = fld("Hours", "number", r.hours == null ? "" : r.hours),
          eam = fld("Amount paid ($)", "number", r.amount),
          eme = fld("Paid by", "select", r.method, PMETH);
        ehr.input.step = "0.25";
        ehr.input.inputMode = "decimal";
        eam.input.step = "0.01";
        eam.input.inputMode = "decimal";
        [epd, ehr, eam, eme].forEach(function (x) {
          eg.appendChild(x);
        });
        c.appendChild(eg);
        var eno = fld("Note", "text", r.note || "");
        c.appendChild(eno);
        var ea = el("div");
        ea.style.cssText = "display:flex;gap:8px;margin-top:8px";
        var sv = btn("Save", "btn sm", function () {
          var a = Number(eam.input.value);
          if (!(a > 0)) {
            alert("Enter the amount paid.");
            return;
          }
          if (!epd.input.value) {
            alert("Pick the date paid.");
            return;
          }
          sv.disabled = true;
          var up = {
            paid_on: epd.input.value,
            amount: a,
            hours: ehr.input.value === "" ? null : Number(ehr.input.value),
            method: eme.input.value,
            note: eno.input.value.trim()
          };
          sb.from("personnel_pay")
            .update(up)
            .eq("id", r.id)
            .select()
            .single()
            .then(function (u) {
              sv.disabled = false;
              if (u.error || !u.data) {
                alert("Could not save the changes.");
                return;
              }
              Object.assign(r, u.data);
              repData = null;
              render();
              openPerson(p, "pay");
            });
        });
        ea.appendChild(sv);
        ea.appendChild(
          btn("Cancel", "btn alt sm", function () {
            openPerson(p, "pay");
          })
        );
        c.appendChild(ea);
      })
    );
    pa.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Delete this " + money(r.amount) + " payment?")) return;
        sb.from("personnel_pay")
          .delete()
          .eq("id", r.id)
          .then(function (d) {
            if (d.error) {
              alert("Could not delete.");
              return;
            }
            payRows = payRows.filter(function (x) {
              return x.id !== r.id;
            });
            render();
            openPerson(p, "pay");
          });
      })
    );
    top.appendChild(pa);
    c.appendChild(top);
    host.appendChild(c);
  });
}
function personBen(host, p) {
  host.appendChild(
    el(
      "p",
      "note",
      "Anything you provide besides pay: bonus, paid time off, phone stipend, uniform or tool allowance, etc."
    )
  );
  var g = el("div", "grid2"),
    ti = fld("Benefit", "text", ""),
    va = fld("Value ($)", "number", ""),
    sd = fld("Starts", "date", today()),
    de = fld("Details", "text", "");
  va.input.step = "0.01";
  va.input.inputMode = "decimal";
  [ti, va, sd, de].forEach(function (x) {
    g.appendChild(x);
  });
  host.appendChild(g);
  var add = btn("Add benefit", "btn", function () {
    if (!ti.input.value.trim()) {
      alert("Enter the benefit name.");
      return;
    }
    add.disabled = true;
    sb.from("personnel_benefits")
      .insert({
        person_id: p.id,
        title: ti.input.value.trim(),
        details: de.input.value.trim(),
        value: va.input.value === "" ? null : Number(va.input.value),
        starts_on: sd.input.value || null
      })
      .select()
      .single()
      .then(function (r) {
        add.disabled = false;
        if (r.error || !r.data) {
          alert("Could not save.");
          return;
        }
        benRows.unshift(r.data);
        openPerson(p, "ben");
      });
  });
  host.appendChild(add);
  var rows = benRows.filter(function (b) {
    return b.person_id === p.id;
  });
  var h = el("h3", null, "Benefits");
  h.style.margin = "16px 0 6px";
  host.appendChild(h);
  if (!rows.length) host.appendChild(el("div", "empty", "No benefits recorded."));
  rows.forEach(function (b) {
    var c = el("div", "pcard"),
      top = el("div");
    top.style.cssText = "display:flex;justify-content:space-between;gap:8px;align-items:center";
    var l = el("div");
    l.appendChild(el("b", null, b.title + (b.value != null ? " · " + money(b.value) : "")));
    l.appendChild(
      el(
        "div",
        "note",
        [b.starts_on ? "Since " + mdy(b.starts_on) : "", b.details].filter(Boolean).join(" · ")
      )
    );
    top.appendChild(l);
    var ba = el("div", "acts");
    ba.style.cssText = "display:flex;gap:6px;margin:0";
    ba.appendChild(
      btn("Edit", "btn alt sm", function () {
        c.textContent = "";
        var eg = el("div", "grid2"),
          eti = fld("Benefit", "text", b.title),
          eva = fld("Value ($)", "number", b.value == null ? "" : b.value),
          esd = fld("Starts", "date", b.starts_on ? String(b.starts_on).slice(0, 10) : ""),
          ede = fld("Details", "text", b.details || "");
        eva.input.step = "0.01";
        eva.input.inputMode = "decimal";
        [eti, eva, esd, ede].forEach(function (x) {
          eg.appendChild(x);
        });
        c.appendChild(eg);
        var ea = el("div");
        ea.style.cssText = "display:flex;gap:8px;margin-top:8px";
        var sv = btn("Save", "btn sm", function () {
          if (!eti.input.value.trim()) {
            alert("Enter the benefit name.");
            return;
          }
          sv.disabled = true;
          sb.from("personnel_benefits")
            .update({
              title: eti.input.value.trim(),
              details: ede.input.value.trim(),
              value: eva.input.value === "" ? null : Number(eva.input.value),
              starts_on: esd.input.value || null
            })
            .eq("id", b.id)
            .select()
            .single()
            .then(function (u) {
              sv.disabled = false;
              if (u.error || !u.data) {
                alert("Could not save the changes.");
                return;
              }
              Object.assign(b, u.data);
              openPerson(p, "ben");
            });
        });
        ea.appendChild(sv);
        ea.appendChild(
          btn("Cancel", "btn alt sm", function () {
            openPerson(p, "ben");
          })
        );
        c.appendChild(ea);
      })
    );
    ba.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Delete this benefit?")) return;
        sb.from("personnel_benefits")
          .delete()
          .eq("id", b.id)
          .then(function (d) {
            if (d.error) {
              alert("Could not delete.");
              return;
            }
            benRows = benRows.filter(function (x) {
              return x.id !== b.id;
            });
            openPerson(p, "ben");
          });
      })
    );
    top.appendChild(ba);
    c.appendChild(top);
    host.appendChild(c);
  });
}
function personDocs(host, p) {
  host.appendChild(
    el(
      "p",
      "note",
      "W-9, ID copy, signed agreement, insurance papers. PDFs and pictures up to 10 MB. Only owners can open these."
    )
  );
  var g = el("div", "grid2"),
    ti = fld("Title", "text", ""),
    ki = fld("Type", "select", "W-9", DKINDS);
  g.appendChild(ti);
  g.appendChild(ki);
  host.appendChild(g);
  var msg = el("div", "note");
  var add = btn("Choose file to upload", "btn", function () {
    var i = document.createElement("input");
    i.type = "file";
    i.accept = "application/pdf,image/*";
    i.style.display = "none";
    document.body.appendChild(i);
    i.addEventListener("change", function () {
      var f = i.files && i.files[0];
      document.body.removeChild(i);
      if (!f) return;
      var isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (isPdf && f.size > 10485760) {
        alert("That PDF is over 10 MB.");
        return;
      }
      msg.textContent = "Uploading...";
      var prep = isPdf
        ? Promise.resolve({ blob: f, ext: "pdf", type: "application/pdf" })
        : loadImg(f)
            .then(function (img) {
              return toJpeg(img, 2000, 0.85);
            })
            .then(function (j) {
              return { blob: j.blob, ext: "jpg", type: "image/jpeg" };
            });
      prep
        .then(function (x) {
          var path = p.id + "/" + uid() + "." + x.ext;
          return sb.storage
            .from("personnel")
            .upload(path, x.blob, { contentType: x.type })
            .then(function (u) {
              if (u.error) throw new Error("upload");
              return sb
                .from("personnel_docs")
                .insert({
                  person_id: p.id,
                  title: ti.input.value.trim() || f.name,
                  kind: ki.input.value,
                  path: path,
                  size_bytes: x.blob.size || 0
                })
                .select()
                .single()
                .then(function (r) {
                  if (r.error || !r.data) {
                    sb.storage.from("personnel").remove([path]);
                    throw new Error("save");
                  }
                  docRows.unshift(r.data);
                  openPerson(p, "docs");
                });
            });
        })
        .then(null, function () {
          msg.textContent = "";
          alert("Could not upload that file. Use a PDF, JPEG, PNG or WebP under 10 MB.");
        });
    });
    i.click();
  });
  host.appendChild(add);
  host.appendChild(msg);
  var rows = docRows.filter(function (d) {
    return d.person_id === p.id;
  });
  var h = el("h3", null, "Documents");
  h.style.margin = "16px 0 6px";
  host.appendChild(h);
  if (!rows.length) host.appendChild(el("div", "empty", "No documents yet."));
  rows.forEach(function (d) {
    var c = el("div", "pcard"),
      top = el("div");
    top.style.cssText =
      "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
    var l = el("div");
    l.appendChild(el("b", null, d.title || "Document"));
    l.appendChild(el("div", "note", d.kind + " · added " + mdy(String(d.created_at).slice(0, 10))));
    top.appendChild(l);
    var a = el("div", "acts");
    a.style.marginTop = "0";
    a.appendChild(
      btn("Open", "btn alt sm", function () {
        var w = window.open("", "_blank");
        signP(d.path).then(function (u) {
          if (!u) {
            if (w) w.close();
            alert("Could not open it.");
            return;
          }
          if (w) w.location.href = u;
          else location.href = u;
        });
      })
    );
    a.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Delete this document?")) return;
        sb.storage
          .from("personnel")
          .remove([d.path])
          .then(function () {
            return sb.from("personnel_docs").delete().eq("id", d.id);
          })
          .then(function (r) {
            if (r.error) {
              alert("Could not delete.");
              return;
            }
            docRows = docRows.filter(function (x) {
              return x.id !== d.id;
            });
            openPerson(p, "docs");
          });
      })
    );
    top.appendChild(a);
    c.appendChild(top);
    host.appendChild(c);
  });
}
