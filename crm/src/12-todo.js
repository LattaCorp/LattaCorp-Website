/* To-Do tab: shared tasks. */

/* ---- To-Do list (shared by the whole team) ---- */
function memberName(e) {
  if (!e) return "";
  var m = team.filter(function (x) {
    return String(x.email).toLowerCase() === String(e).toLowerCase();
  })[0];
  return m && m.name ? m.name : String(e).split("@")[0];
}
function todoDueState(t) {
  return t.done || !t.due_date ? "" : t.due_date < today() ? "od" : t.due_date === today() ? "today" : "";
}
function toggleTodo(t, done) {
  var now = done ? new Date().toISOString() : null,
    by = done ? myEmail : "";
  sb.from("todos")
    .update({ done: done, done_at: now, done_by: by })
    .eq("id", t.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not save that.");
        return;
      }
      t.done = done;
      t.done_at = now;
      t.done_by = by;
      render();
    });
}
function renderTodo() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  if (todoErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "To-Do isn't set up yet. Run the Stage 8 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var me = (myEmail || "").toLowerCase(),
    open = todos.filter(function (t) {
      return !t.done;
    }),
    mine = open.filter(function (t) {
      return String(t.assigned_to).toLowerCase() === me && me;
    }),
    dn = todos.filter(function (t) {
      return t.done;
    });
  [
    ["open", "Open", open.length],
    ["mine", "Mine", mine.length],
    ["done", "Done", dn.length]
  ].forEach(function (s) {
    var b = el("button", "tab" + (tfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + s[2] + ")"));
    b.addEventListener("click", function () {
      tfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  $("topbtns").appendChild(
    btn("+ New task", "btn", function () {
      openTodo(null);
    })
  );
  var qa = el("div", "qadd"),
    ti = document.createElement("input");
  ti.type = "text";
  ti.placeholder = "Add a task and press Enter...";
  ti.setAttribute("aria-label", "New task");
  var di = document.createElement("input");
  di.type = "date";
  di.setAttribute("aria-label", "Due date (optional)");
  di.title = "Due date (optional)";
  function add() {
    var v = ti.value.trim();
    if (!v) return;
    ab.disabled = true;
    sb.from("todos")
      .insert({
        title: v,
        due_date: di.value || null,
        created_by: myEmail || "",
        assigned_to: tfilter === "mine" ? myEmail || "" : ""
      })
      .select()
      .single()
      .then(function (r) {
        ab.disabled = false;
        if (r.error || !r.data) {
          alert("Could not add the task.");
          return;
        }
        todos.unshift(r.data);
        render();
      });
  }
  var ab = btn("Add", "btn", add);
  ti.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  });
  qa.appendChild(ti);
  qa.appendChild(di);
  qa.appendChild(ab);
  list.appendChild(qa);
  var set =
    tfilter === "done"
      ? dn.slice().sort(function (a, b) {
          return String(b.done_at || "") < String(a.done_at || "") ? -1 : 1;
        })
      : tfilter === "mine"
        ? mine
        : open;
  if (query)
    set = set.filter(function (t) {
      return (
        [t.title, t.notes, cname(t.client_id), memberName(t.assigned_to)]
          .join(" ")
          .toLowerCase()
          .indexOf(query) > -1
      );
    });
  if (!set.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        tfilter === "done"
          ? "Nothing completed yet."
          : tfilter === "mine"
            ? "Nothing assigned to you."
            : "Nothing to do. Add a task above."
      )
    );
    return;
  }
  var groups = [];
  if (tfilter === "done") groups = [["Completed", set]];
  else {
    var t0 = today(),
      by = function (f) {
        return set.filter(f).sort(function (a, b) {
          return (a.due_date || "") < (b.due_date || "") ? -1 : 1;
        });
      };
    groups = [
      [
        "Overdue",
        by(function (t) {
          return t.due_date && t.due_date < t0;
        })
      ],
      [
        "Today",
        by(function (t) {
          return t.due_date === t0;
        })
      ],
      [
        "Upcoming",
        by(function (t) {
          return t.due_date && t.due_date > t0;
        })
      ],
      [
        "No date",
        set.filter(function (t) {
          return !t.due_date;
        })
      ]
    ];
  }
  groups.forEach(function (g) {
    if (!g[1].length) return;
    var h = el("h3", null, g[0] + " (" + g[1].length + ")");
    h.style.cssText =
      "margin:14px 0 6px;font-size:.95rem;color:" + (g[0] === "Overdue" ? "var(--red)" : "var(--muted)");
    list.appendChild(h);
    g[1].forEach(function (t) {
      var row = el("div", "todo" + (t.done ? " done" : "")),
        ck = el("button", "ck", t.done ? "✓" : "");
      ck.type = "button";
      ck.setAttribute("aria-label", t.done ? "Mark not done" : "Mark done");
      ck.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleTodo(t, !t.done);
      });
      var body = el("div", "tb");
      body.appendChild(el("div", "tt", t.title));
      var sub = [];
      if (t.due_date) sub.push(dshort(t.due_date));
      if (t.assigned_to) sub.push(memberName(t.assigned_to));
      if (t.client_id) sub.push(cname(t.client_id));
      if (t.done && t.done_at)
        sub.push(
          "done " + dshort(String(t.done_at).slice(0, 10)) + (t.done_by ? " by " + memberName(t.done_by) : "")
        );
      if (sub.length) {
        var sd = el("div", "note", sub.join(" · "));
        if (todoDueState(t) === "od") sd.style.color = "var(--red)";
        body.appendChild(sd);
      }
      if (t.notes)
        body.appendChild(el("div", "note", t.notes.length > 110 ? t.notes.slice(0, 110) + "…" : t.notes));
      row.appendChild(ck);
      row.appendChild(body);
      row.addEventListener("click", function () {
        openTodo(t);
      });
      list.appendChild(row);
    });
  });
}
function openTodo(t) {
  var p = panel();
  p.appendChild(el("h2", null, t ? "Task" : "New task"));
  var ti = fld("Task", "text", t ? t.title : ""),
    no = fld("Notes", "textarea", t ? t.notes : ""),
    du = fld("Due date", "date", t && t.due_date ? t.due_date : "");
  var tm = [["", "Anyone"]].concat(
    team.map(function (m) {
      return [m.email, m.name || m.email];
    })
  );
  if (
    t &&
    t.assigned_to &&
    !tm.some(function (x) {
      return String(x[0]).toLowerCase() === String(t.assigned_to).toLowerCase();
    })
  )
    tm.push([t.assigned_to, memberName(t.assigned_to)]);
  var as = fld("Assigned to", "select", t ? t.assigned_to : "", tm);
  var cl = fld(
    "Client",
    "select",
    t && t.client_id ? t.client_id : "",
    [["", "None"]].concat(
      clients
        .filter(function (c) {
          return !c.archived || (t && t.client_id === c.id);
        })
        .map(function (c) {
          return [c.id, c.name];
        })
    )
  );
  [ti, no, du, as, cl].forEach(function (f) {
    p.appendChild(f);
  });
  var acts = el("div", "acts");
  acts.style.marginTop = "12px";
  var sv = btn("Save", "btn", function () {
    var title = ti.input.value.trim();
    if (!title) {
      alert("Enter a task.");
      return;
    }
    var row = {
      title: title,
      notes: no.input.value.trim(),
      due_date: du.input.value || null,
      assigned_to: as.input.value,
      client_id: cl.input.value || null
    };
    sv.disabled = true;
    var q = t
      ? sb.from("todos").update(row).eq("id", t.id).select().single()
      : sb
          .from("todos")
          .insert(Object.assign({ created_by: myEmail || "" }, row))
          .select()
          .single();
    q.then(function (r) {
      sv.disabled = false;
      if (r.error || !r.data) {
        alert("Could not save.");
        return;
      }
      if (t) Object.assign(t, r.data);
      else todos.unshift(r.data);
      closeDetail();
      render();
    });
  });
  acts.appendChild(sv);
  if (t) {
    acts.appendChild(
      btn(t.done ? "Mark not done" : "Mark done", "btn alt", function () {
        toggleTodo(t, !t.done);
        closeDetail();
      })
    );
    acts.appendChild(
      btn("Delete", "btn danger", function () {
        if (!confirm("Delete this task?")) return;
        sb.from("todos")
          .delete()
          .eq("id", t.id)
          .then(function (r) {
            if (r.error) {
              alert("Could not delete.");
              return;
            }
            todos = todos.filter(function (z) {
              return z.id !== t.id;
            });
            closeDetail();
            render();
          });
      })
    );
  }
  p.appendChild(acts);
}
