/* Messages: an "Everyone" group (crew too), an "Office" group (owners + office), and one-on-one chats.
   Photos go in a private bucket. New messages ping the other people's phones (if they turned notifications on). */
var chatMeta = { rooms: [], people: [], me: null, at: 0 },
  chatRoom = null,
  chatTimer = null;
function msgUnread() {
  var n = 0;
  chatMeta.rooms.forEach(function (r) {
    n += r.unread || 0;
  });
  return n;
}
function chatMyId() {
  if (chatMeta.me) return Promise.resolve(chatMeta.me);
  return sb.auth.getSession().then(function (ss) {
    var u = ss && ss.data && ss.data.session && ss.data.session.user;
    chatMeta.me = u ? u.id : null;
    return chatMeta.me;
  });
}
function chatMyName() {
  if (crewMe) return crewMe.name || "Crew";
  var t = (teamRoles || team || []).filter(function (m) {
    return String(m.email || "").toLowerCase() === String(myEmail || "").toLowerCase();
  })[0];
  return (t && t.name) || String(myEmail || "").split("@")[0] || "Office";
}
function chatRefresh() {
  return Promise.all([chatMyId(), sb.rpc("chat_rooms"), chatMeta.people.length ? null : sb.rpc("chat_people")]).then(
    function (rs) {
      if (rs[1] && !rs[1].error) chatMeta.rooms = rs[1].data || [];
      if (rs[2] && !rs[2].error) chatMeta.people = rs[2].data || [];
      chatMeta.at = Date.now();
      chatBadges();
    },
    function () {}
  );
}
/* keep the Messages badge current without redrawing the screen */
function chatBadges() {
  var n = msgUnread();
  var b = document.querySelector('#side [data-v="messages"]');
  if (b) {
    var bd = b.querySelector(".badge");
    if (n && !bd) b.appendChild(el("span", "badge", String(n)));
    else if (bd && n) bd.textContent = String(n);
    else if (bd) bd.remove();
  }
}
setInterval(function () {
  if (document.hidden || !sb) return;
  if (!crewMe && $("layout").hidden) return;
  chatRefresh();
}, 60000);
function chatT(s) {
  return crewMe ? crewT(s) : s;
}
function dmRoom(a, b) {
  return a < b ? "dm:" + a + ":" + b : "dm:" + b + ":" + a;
}
function roomTitle(room) {
  if (room === "all") return chatT("Everyone");
  if (room === "office") return chatT("Office");
  var ids = room.split(":").slice(1),
    other = ids[0] === chatMeta.me ? ids[1] : ids[0],
    p = chatMeta.people.filter(function (x) {
      return x.user_id === other;
    })[0];
  return p ? p.name : "Chat";
}
function renderMessages() {
  $("tabs").textContent = "";
  var list = $("list");
  list.textContent = "";
  var h = el("div");
  list.appendChild(h);
  renderChat(h);
}
function renderChat(host) {
  host.textContent = "";
  host.className = "chatwrap" + (chatRoom ? " inroom" : "");
  var side = el("div", "chatside"),
    main = el("div", "chatmain");
  host.appendChild(side);
  host.appendChild(main);
  side.appendChild(el("div", "note", chatT("Loading...")));
  chatRefresh().then(function () {
    if (!document.body.contains(host)) return;
    drawRooms(side, host);
    if (chatRoom) openRoom(main, host, side);
    else if (window.innerWidth > 700) {
      chatRoom = "all";
      host.classList.add("inroom");
      drawRooms(side, host);
      openRoom(main, host, side);
    }
  });
}
function drawRooms(side, host) {
  side.textContent = "";
  side.appendChild(el("h3", null, chatT("Chats")));
  var byRoom = {};
  chatMeta.rooms.forEach(function (r) {
    byRoom[r.room] = r;
  });
  var rows = [["all", chatT("Everyone")]];
  if (!crewMe) rows.push(["office", chatT("Office")]);
  chatMeta.rooms.forEach(function (r) {
    if (/^dm:/.test(r.room)) rows.push([r.room, roomTitle(r.room)]);
  });
  function row(room, name) {
    var r = byRoom[room],
      b = el("button", "chatroom" + (room === chatRoom ? " on" : ""));
    b.type = "button";
    var t = el("div");
    t.appendChild(el("b", null, name));
    if (r) t.appendChild(el("div", "note", (r.last_name ? r.last_name + ": " : "") + r.last_body));
    b.appendChild(t);
    if (r && r.unread) b.appendChild(el("span", "badge", String(r.unread)));
    b.addEventListener("click", function () {
      chatRoom = room;
      renderChat(host);
    });
    side.appendChild(b);
  }
  rows.forEach(function (x) {
    row(x[0], x[1]);
  });
  // start a one-on-one chat
  var others = chatMeta.people.filter(function (p) {
    return p.user_id !== chatMeta.me;
  });
  if (others.length) {
    var s = document.createElement("select");
    s.className = "chatnew";
    s.appendChild(new Option(chatT("Message someone..."), ""));
    others.forEach(function (p) {
      s.appendChild(new Option(p.name + (p.kind === "crew" ? " (crew)" : ""), p.user_id));
    });
    s.addEventListener("change", function () {
      if (!s.value || !chatMeta.me) return;
      chatRoom = dmRoom(chatMeta.me, s.value);
      renderChat(host);
    });
    side.appendChild(s);
  }
  if (!crewMe || pushSupported()) {
    var nb = btn(chatT("Phone notifications"), "btn alt sm chatnotif", function () {
      if (crewMe) crewNotify();
      else openNotifySettings();
    });
    side.appendChild(nb);
  }
}
function openRoom(main, host, side) {
  var room = chatRoom;
  clearInterval(chatTimer);
  main.textContent = "";
  var hd = el("div", "chathd");
  hd.appendChild(
    btn("‹ " + chatT("Back"), "btn alt sm chatback", function () {
      chatRoom = null;
      clearInterval(chatTimer);
      renderChat(host);
    })
  );
  hd.appendChild(el("b", null, roomTitle(room)));
  main.appendChild(hd);
  var feed = el("div", "chatfeed");
  main.appendChild(feed);
  var last = null,
    seen = {};
  function bubble(m) {
    if (seen[m.id]) return;
    seen[m.id] = 1;
    var mine = m.sender_id === chatMeta.me,
      b = el("div", "bub" + (mine ? " mine" : ""));
    if (!mine) b.appendChild(el("div", "bname", m.sender_name || ""));
    if (m.photo_path) {
      var im = document.createElement("img");
      im.alt = "Photo";
      im.className = "bimg";
      sb.storage
        .from("chat")
        .createSignedUrl(m.photo_path, 3600)
        .then(function (r) {
          if (r && r.data) {
            im.src = r.data.signedUrl;
            im.addEventListener("click", function () {
              window.open(r.data.signedUrl, "_blank", "noopener");
            });
          }
        });
      b.appendChild(im);
    }
    if (m.body) b.appendChild(el("div", "btxt", m.body));
    if (m.ref_kind && m.ref_id && !crewMe) {
      var nm = m.ref_kind === "client" ? cname(m.ref_id) : jobTitle(m.ref_id);
      if (nm)
        b.appendChild(
          btn((m.ref_kind === "client" ? "Client: " : "Job: ") + nm, "bref", function () {
            if (m.ref_kind === "client") openClient(m.ref_id);
            else openJob(m.ref_id);
          })
        );
    }
    var when = new Date(m.created_at);
    b.appendChild(
      el(
        "div",
        "btime",
        (when.toDateString() === new Date().toDateString() ? "" : when.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " ") +
          when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      )
    );
    feed.appendChild(b);
    last = m.created_at;
  }
  function markRead() {
    sb.from("chat_reads")
      .upsert({ room: room, read_at: new Date().toISOString() }, { onConflict: "user_id,room" })
      .then(function () {
        chatMeta.rooms.forEach(function (r) {
          if (r.room === room) r.unread = 0;
        });
        chatBadges();
        if (side && document.body.contains(side)) drawRooms(side, host);
      });
  }
  function pull(first) {
    var q = sb.from("messages").select("*").eq("room", room);
    if (last) q = q.gt("created_at", last);
    q.order("created_at", { ascending: false })
      .limit(first ? 80 : 50)
      .then(function (r) {
        if (chatRoom !== room || !document.body.contains(feed)) {
          clearInterval(chatTimer);
          return;
        }
        if (r.error) {
          if (first) feed.appendChild(el("div", "empty", "Messages aren't set up yet. Run the Stage 46 SQL in Supabase."));
          return;
        }
        var rows = (r.data || []).reverse(),
          atEnd = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
        if (first && !rows.length) feed.appendChild(el("div", "empty chatempty", chatT("No messages yet. Say hi!")));
        if (rows.length) {
          var e0 = feed.querySelector(".chatempty");
          if (e0) e0.remove();
        }
        rows.forEach(bubble);
        if (first || atEnd) feed.scrollTop = feed.scrollHeight;
        if (rows.length) markRead();
      });
  }
  pull(true);
  chatTimer = setInterval(function () {
    if (!document.hidden) pull(false);
  }, 8000);
  // composer
  var form = el("form", "chatbox"),
    ta = document.createElement("textarea"),
    ref = null,
    refTag = el("div", "chatref");
  ta.rows = 1;
  ta.maxLength = 4000;
  ta.placeholder = chatT("Type a message...");
  ta.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 700) {
      e.preventDefault();
      send();
    }
  });
  var ph = btn("📷", "btn alt chatph", function () {
    pickPhotos(false, function (fs) {
      sendPhotos(fs);
    });
  });
  ph.title = chatT("Photo");
  ph.setAttribute("aria-label", chatT("Photo"));
  var go = el("button", "btn", chatT("Send"));
  go.type = "submit";
  form.appendChild(ph);
  if (!crewMe) {
    var lk = btn("🔗", "btn alt chatph", function () {
      var q = prompt("Link a client or job: type part of the name", "");
      if (!q) return;
      q = q.toLowerCase();
      var c = clients.filter(function (x) {
          return String(x.name || "").toLowerCase().indexOf(q) > -1;
        })[0],
        j = c
          ? null
          : jobs.filter(function (x) {
              return String(x.title || "").toLowerCase().indexOf(q) > -1;
            })[0];
      if (!c && !j) return alert("Nothing matches that.");
      ref = c ? { kind: "client", id: c.id, name: c.name } : { kind: "job", id: j.id, name: j.title };
      refTag.textContent = "";
      refTag.appendChild(document.createTextNode((ref.kind === "client" ? "Client: " : "Job: ") + ref.name + " "));
      refTag.appendChild(
        btn("×", "chatrefx", function () {
          ref = null;
          refTag.textContent = "";
        })
      );
    });
    lk.title = "Link a client or job";
    lk.setAttribute("aria-label", "Link a client or job");
    form.appendChild(lk);
  }
  form.appendChild(ta);
  form.appendChild(go);
  main.appendChild(refTag);
  main.appendChild(form);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    send();
  });
  function post(row) {
    row.room = room;
    row.sender_name = chatMyName();
    if (ref) {
      row.ref_kind = ref.kind;
      row.ref_id = ref.id;
    }
    return sb
      .from("messages")
      .insert(row)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          alert(chatT("Could not send. Try again."));
          return false;
        }
        bubble(r.data);
        feed.scrollTop = feed.scrollHeight;
        ref = null;
        refTag.textContent = "";
        callApi("/api/push", "chat", { id: r.data.id });
        return true;
      });
  }
  function send() {
    var t = ta.value.trim();
    if (!t) return;
    go.disabled = true;
    post({ body: t }).then(function (ok) {
      go.disabled = false;
      if (ok) ta.value = "";
      ta.focus();
    });
  }
  function sendPhotos(fs) {
    go.disabled = true;
    fs.slice(0, 6)
      .reduce(function (pr, f) {
        return pr.then(function () {
          return loadImg(f)
            .then(function (img) {
              return toJpeg(img, 1600, 0.82);
            })
            .then(function (j) {
              var path = room + "/" + uid() + ".jpg";
              return sb.storage
                .from("chat")
                .upload(path, j.blob, { contentType: "image/jpeg" })
                .then(function (u) {
                  if (u.error) throw new Error("up");
                  return post({ body: "", photo_path: path });
                });
            })
            .catch(function () {
              alert(chatT("Could not send. Try again."));
            });
        });
      }, Promise.resolve())
      .then(function () {
        go.disabled = false;
      });
  }
}
/* crew phones: turn message notifications on or off */
function crewNotify() {
  var p = panel();
  p.appendChild(el("h2", null, crewT("Phone notifications")));
  var msg = el("div", "note"),
    here = el("div", "pcard");
  p.appendChild(here);
  p.appendChild(msg);
  function say(t, bad) {
    msg.textContent = t;
    msg.style.color = bad ? "var(--red)" : "var(--forest)";
  }
  function draw() {
    here.textContent = "";
    if (!pushSupported()) {
      here.appendChild(el("div", "note", crewT("This phone can't get notifications. Open Foreman in Chrome and install it, then open it from the home screen.")));
      return;
    }
    pushMySub().then(function (sub) {
      if (sub) {
        here.appendChild(el("div", "note", crewT("✓ Notifications are on for this phone.")));
        here.appendChild(
          btn(crewT("Send a test"), "btn alt sm", function () {
            callApi("/api/push", "test", {}).then(function (r) {
              say(r.ok ? crewT("Sent.") : r.error, !r.ok);
            });
          })
        );
        here.appendChild(document.createTextNode(" "));
        here.appendChild(
          btn(crewT("Turn off"), "btn alt sm", function () {
            var ep = sub.endpoint;
            sub.unsubscribe().then(function () {
              callApi("/api/push", "unsubscribe", { endpoint: ep }).then(draw);
            });
          })
        );
      } else {
        var on = btn(crewT("Turn on notifications"), "btn", function () {
          on.disabled = true;
          Notification.requestPermission().then(function (perm) {
            if (perm !== "granted") {
              on.disabled = false;
              return say(crewT("Notifications weren't allowed."), true);
            }
            callApi("/api/push", "key", {}).then(function (k) {
              if (!k.ok) {
                on.disabled = false;
                return say(k.error, true);
              }
              navigator.serviceWorker.ready
                .then(function (reg) {
                  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKeyBytes(k.data.key) });
                })
                .then(function (s) {
                  return callApi("/api/push", "subscribe", { sub: s.toJSON(), label: deviceLabel() });
                })
                .then(function (r) {
                  if (!r.ok) throw new Error(r.error);
                  say(crewT("✓ Turned on."));
                  draw();
                })
                .catch(function (e) {
                  on.disabled = false;
                  say(String((e && e.message) || "Error"), true);
                });
            });
          });
        });
        here.appendChild(on);
      }
    });
  }
  draw();
}
