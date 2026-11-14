/* Team tab (owners only): who can sign in and their role. */

/* ---- Team: owners add office staff and co-owners ---- */
function renderTeam(inPersonnel) {
  var tabs = $("tabs");
  if (!inPersonnel) tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  var intro = el(
    "div",
    "note",
    "Office staff and owners who can sign in to Foreman. Crew logins are under Crew logins & texting. Everyone signs in at this same address with their own email and password. Owners and co-owners can do everything. Office staff can use clients, jobs, schedule, billing and invoices, and email clients, but they can't add people, manage crew logins, or text from the CRM."
  );
  intro.style.marginBottom = "12px";
  list.appendChild(intro);
  var holder = el("div");
  list.appendChild(holder);
  holder.appendChild(el("div", "empty", "Loading the team..."));
  var ROLES = [
    ["office", "Office (clients, jobs, schedule, billing)"],
    ["owner", "Owner / co-owner (everything)"]
  ];
  function draw(members) {
    teamSyncAt = 0;
    holder.textContent = "";
    members.forEach(function (m) {
      var card = el("div", "pcard"),
        top = el("div");
      top.style.cssText =
        "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
      var l = el("div");
      l.appendChild(el("b", null, (m.name || m.email) + (m.email === myEmail ? " (you)" : "")));
      l.appendChild(el("div", "note", m.email));
      top.appendChild(l);
      top.appendChild(
        el("span", "chip " + (m.role === "owner" ? "won" : ""), m.role === "owner" ? "Owner" : "Office")
      );
      card.appendChild(top);
      var a = el("div", "acts");
      a.style.marginTop = "8px";
      if (m.email !== myEmail) {
        a.appendChild(
          btn(m.role === "owner" ? "Make office" : "Make owner", "btn alt sm", function () {
            if (
              !confirm(
                m.role === "owner"
                  ? "Change " + (m.name || m.email) + " to office staff?"
                  : "Make " +
                      (m.name || m.email) +
                      " an owner? Owners can see and do everything, including adding and removing people."
              )
            )
              return;
            callApi("/api/team", "role", {
              email: m.email,
              role: m.role === "owner" ? "office" : "owner"
            }).then(function (res) {
              if (!res.ok) {
                alert(res.error);
                return;
              }
              load2();
            });
          })
        );
        if (m.hasLogin)
          a.appendChild(
            btn("Reset password", "btn alt sm", function () {
              a.textContent = "";
              var np = document.createElement("input");
              np.type = "text";
              np.placeholder = "New password (8+ characters)";
              np.autocomplete = "off";
              np.style.width = "auto";
              a.appendChild(np);
              a.appendChild(
                btn("Set password", "btn sm", function () {
                  callApi("/api/team", "reset", { email: m.email, password: np.value }).then(function (res) {
                    if (!res.ok) {
                      alert(res.error);
                      return;
                    }
                    alert("Password changed. Tell them the new password.");
                    load2();
                  });
                })
              );
              a.appendChild(btn("Cancel", "btn alt sm", load2));
            })
          );
        a.appendChild(
          btn("Remove", "btn danger sm", function () {
            if (!confirm("Remove " + (m.name || m.email) + "? They won't be able to sign in any more."))
              return;
            callApi("/api/team", "remove", { email: m.email }).then(function (res) {
              if (!res.ok) {
                alert(res.error);
                return;
              }
              load2();
            });
          })
        );
      }
      card.appendChild(a);
      holder.appendChild(card);
    });
    var h = el("h3", null, "Add a team member");
    h.style.margin = "18px 0 6px";
    holder.appendChild(h);
    var box = el("div", "pcard"),
      g = el("div", "grid2"),
      nm = fld("Name", "text", ""),
      em = fld("Login email", "email", ""),
      rl = fld("Role", "select", "office", ROLES),
      pw = fld("Password", "text", "");
    pw.input.autocomplete = "off";
    g.appendChild(nm);
    g.appendChild(em);
    box.appendChild(g);
    box.appendChild(rl);
    box.appendChild(pw);
    var add = btn("Add to team", "btn", function () {
      if (!nm.input.value.trim()) {
        alert("Enter a name.");
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.input.value.trim())) {
        alert("Enter their login email.");
        return;
      }
      if (pw.input.value.length < 8) {
        alert("The password needs at least 8 characters.");
        return;
      }
      add.disabled = true;
      callApi("/api/team", "create", {
        name: nm.input.value.trim(),
        email: em.input.value.trim(),
        role: rl.input.value,
        password: pw.input.value
      }).then(function (res) {
        add.disabled = false;
        if (!res.ok) {
          alert(res.error);
          return;
        }
        alert("Added. Give them the email and password; they sign in at this same address.");
        load2();
      });
    });
    add.style.marginTop = "10px";
    box.appendChild(add);
    holder.appendChild(box);
  }
  function load2() {
    callApi("/api/team", "list", {}).then(function (res) {
      if (!res.ok) {
        holder.textContent = "";
        holder.appendChild(el("div", "empty", res.error));
        return;
      }
      myEmail = res.data.me || myEmail;
      draw(res.data.members || []);
    });
  }
  load2();
}
