/* Photos: uploading, viewing, the photo tab and photos on a client page. */

/* ---- Photos: stored in a private Supabase bucket, shrunk on the phone/computer before upload ---- */
var KINDS = [
  ["before", "Before"],
  ["after", "After"],
  ["property", "Property"],
  ["issue", "Issue / damage"],
  ["receipt", "Receipt"],
  ["other", "Other"]
];
function kindLabel(k) {
  var x = KINDS.filter(function (a) {
    return a[0] === k;
  })[0];
  return x ? x[1] : "Other";
}
function uid() {
  return window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
function viaImg(file) {
  return new Promise(function (res, rej) {
    var u = URL.createObjectURL(file),
      i = new Image();
    i.onload = function () {
      URL.revokeObjectURL(u);
      res(i);
    };
    i.onerror = function () {
      URL.revokeObjectURL(u);
      rej(new Error("read"));
    };
    i.src = u;
  });
}
function loadImg(file) {
  if (window.createImageBitmap)
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () {
      return viaImg(file);
    });
  return viaImg(file);
}
function toJpeg(img, max, q) {
  var w = img.width || img.naturalWidth,
    h = img.height || img.naturalHeight,
    s = Math.min(1, max / Math.max(w, h)),
    cw = Math.max(1, Math.round(w * s)),
    ch = Math.max(1, Math.round(h * s)),
    c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  var x = c.getContext("2d");
  x.fillStyle = "#fff";
  x.fillRect(0, 0, cw, ch);
  x.drawImage(img, 0, 0, cw, ch);
  return new Promise(function (res, rej) {
    c.toBlob(
      function (b) {
        b ? res({ blob: b, w: cw, h: ch }) : rej(new Error("encode"));
      },
      "image/jpeg",
      q
    );
  });
}
function pickPhotos(capture, cb) {
  var i = document.createElement("input");
  i.type = "file";
  i.accept = "image/*";
  if (capture) i.setAttribute("capture", "environment");
  else i.multiple = true;
  i.style.display = "none";
  document.body.appendChild(i);
  i.addEventListener("change", function () {
    var fs = Array.prototype.slice.call(i.files || []);
    document.body.removeChild(i);
    if (fs.length) cb(fs);
  });
  i.click();
}
function uploadPhoto(file, meta) {
  return loadImg(file)
    .then(function (img) {
      return Promise.all([toJpeg(img, 1600, 0.82), toJpeg(img, 360, 0.7)]);
    })
    .then(function (rs) {
      var full = rs[0],
        th = rs[1],
        id = uid(),
        folder = meta.client_id || "general",
        path = folder + "/" + id + ".jpg",
        tpath = folder + "/" + id + "_t.jpg",
        st = sb.storage.from("photos");
      return st.upload(path, full.blob, { contentType: "image/jpeg" }).then(function (u) {
        if (u.error) throw new Error("upload");
        return st.upload(tpath, th.blob, { contentType: "image/jpeg" }).then(function (u2) {
          if (u2.error) {
            st.remove([path]);
            throw new Error("upload");
          }
          var row = {
            client_id: meta.client_id || null,
            property_id: meta.property_id || null,
            visit_id: meta.visit_id || null,
            expense_id: meta.expense_id || null,
            kind: meta.kind || "other",
            caption: meta.caption || "",
            path: path,
            thumb_path: tpath,
            size_bytes: full.blob.size + th.blob.size,
            width: full.w,
            height: full.h,
            created_by: myEmail || ""
          };
          return sb
            .from("photos")
            .insert(row)
            .select()
            .single()
            .then(function (r) {
              if (r.error || !r.data) {
                st.remove([path, tpath]);
                throw new Error("save");
              }
              photos.unshift(r.data);
              return r.data;
            });
        });
      });
    });
}
function uploadMany(files, meta, onProg) {
  var ok = 0,
    bad = [];
  return files
    .reduce(function (p, f, i) {
      return p.then(function () {
        if (onProg) onProg(i + 1, files.length);
        return uploadPhoto(f, meta).then(
          function () {
            ok++;
          },
          function () {
            bad.push(f.name || "photo");
          }
        );
      });
    }, Promise.resolve())
    .then(function () {
      return { ok: ok, bad: bad };
    });
}
function uploadMsg(res) {
  return res.bad.length
    ? "Added " +
        res.ok +
        ". Could not add: " +
        res.bad.join(", ") +
        ". (Photos must be JPEG, PNG or WebP images; if you picked an iPhone HEIC on a computer, choose the same photo from the phone instead.)"
    : "";
}
var pcache = {};
function signPaths(paths) {
  var need = paths.filter(function (p) {
    var c = pcache[p];
    return p && (!c || c.exp < Date.now() + 60000);
  });
  if (!need.length) return Promise.resolve();
  var ch = [];
  for (var i = 0; i < need.length; i += 100) ch.push(need.slice(i, i + 100));
  return Promise.all(
    ch.map(function (c) {
      return sb.storage
        .from("photos")
        .createSignedUrls(c, 3600)
        .then(
          function (r) {
            if (r.error || !r.data) return;
            r.data.forEach(function (d) {
              if (d.signedUrl && d.path) pcache[d.path] = { url: d.signedUrl, exp: Date.now() + 3500000 };
            });
          },
          function () {}
        );
    })
  );
}
function photoLabel(ph) {
  var c = ph.client_id ? byId(clients, ph.client_id) : null;
  return (
    (c ? c.name : "No client") +
    " · " +
    kindLabel(ph.kind) +
    " · " +
    dshort(String(ph.created_at).slice(0, 10))
  );
}
function photoGrid(host, rows, opts) {
  opts = opts || {};
  host.textContent = "";
  if (!rows.length) return;
  var grid = el("div", "pgrid"),
    imgs = [];
  rows.forEach(function (ph, i) {
    var t = el("button", "ptile" + (opts.sel && opts.sel[ph.id] ? " picked" : ""));
    t.type = "button";
    t.title = photoLabel(ph) + (ph.caption ? " · " + ph.caption : "");
    var im = document.createElement("img");
    im.alt = ph.caption || photoLabel(ph);
    im.loading = "lazy";
    t.appendChild(im);
    imgs.push([im, ph.thumb_path || ph.path]);
    if (opts.sel) {
      var ck = el("span", "pck", opts.sel[ph.id] ? "✓" : "");
      t.appendChild(ck);
    }
    if (!opts.sel && ph.caption) t.appendChild(el("span", "pcap", ph.caption));
    t.addEventListener("click", function () {
      if (opts.onTile) opts.onTile(ph, i);
      else openLightbox(rows, i);
    });
    grid.appendChild(t);
  });
  host.appendChild(grid);
  signPaths(
    imgs.map(function (x) {
      return x[1];
    })
  ).then(function () {
    imgs.forEach(function (x) {
      var c = pcache[x[1]];
      if (c) x[0].src = c.url;
    });
  });
}
function removePhotos(rows) {
  var paths = [];
  rows.forEach(function (p) {
    paths.push(p.path);
    if (p.thumb_path) paths.push(p.thumb_path);
  });
  return sb.storage
    .from("photos")
    .remove(paths)
    .then(function (r) {
      if (r.error) return false;
      return sb
        .from("photos")
        .delete()
        .in(
          "id",
          rows.map(function (p) {
            return p.id;
          })
        )
        .then(function (d) {
          if (d.error) return false;
          var ids = {};
          rows.forEach(function (p) {
            ids[p.id] = 1;
            delete pcache[p.path];
            delete pcache[p.thumb_path];
          });
          photos = photos.filter(function (p) {
            return !ids[p.id];
          });
          return true;
        });
    });
}
function deletePhotos(rows, done) {
  if (!rows.length) return;
  if (
    !confirm(
      "Delete " +
        rows.length +
        " photo" +
        (rows.length > 1 ? "s" : "") +
        "? This frees up the space and can't be undone."
    )
  )
    return;
  removePhotos(rows).then(function (ok) {
    if (!ok) {
      alert("Could not delete. Check your connection and try again.");
      return;
    }
    if (done) done();
    render();
  });
}

/* full-size viewer */
var lbx = null;
function openLightbox(rows, idx) {
  if (!lbx) {
    lbx = document.createElement("div");
    lbx.id = "lbx";
    lbx.hidden = true;
    document.body.appendChild(lbx);
  }
  var cur = idx;
  lbx.hidden = false;
  document.body.classList.add("lbopen");
  function close() {
    lbx.hidden = true;
    lbx.textContent = "";
    document.body.classList.remove("lbopen");
    document.removeEventListener("keydown", key);
  }
  function key(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
  }
  function go(d) {
    var n = cur + d;
    if (n < 0 || n >= rows.length) return;
    cur = n;
    draw();
  }
  function draw() {
    var ph = rows[cur];
    lbx.textContent = "";
    var bar = el("div", "lbbar");
    bar.appendChild(btn("‹ Close", "hb", close));
    bar.appendChild(el("span", "lbct", cur + 1 + " of " + rows.length));
    lbx.appendChild(bar);
    var stage = el("div", "lbstage"),
      im = document.createElement("img");
    im.alt = photoLabel(ph);
    stage.appendChild(im);
    var pv = btn("‹", "lbnav l", function () {
      go(-1);
    });
    pv.disabled = cur === 0;
    pv.setAttribute("aria-label", "Previous photo");
    var nx = btn("›", "lbnav r", function () {
      go(1);
    });
    nx.disabled = cur === rows.length - 1;
    nx.setAttribute("aria-label", "Next photo");
    stage.appendChild(pv);
    stage.appendChild(nx);
    lbx.appendChild(stage);
    signPaths([ph.path]).then(function () {
      var c = pcache[ph.path];
      if (c && rows[cur] === ph) im.src = c.url;
    });
    var info = el("div", "lbinfo"),
      pr = ph.property_id ? byId(props, ph.property_id) : null;
    info.appendChild(el("div", "lbt", photoLabel(ph) + (pr ? " · " + pr.address : "")));
    var cap = document.createElement("input");
    cap.type = "text";
    cap.placeholder = "Add a caption...";
    cap.value = ph.caption || "";
    cap.setAttribute("aria-label", "Caption");
    var kd = document.createElement("select");
    kd.setAttribute("aria-label", "Photo type");
    KINDS.forEach(function (k) {
      var o = document.createElement("option");
      o.value = k[0];
      o.textContent = k[1];
      kd.appendChild(o);
    });
    kd.value = ph.kind;
    var sv = btn("Save", "btn sm", function () {
      sb.from("photos")
        .update({ caption: cap.value.trim(), kind: kd.value })
        .eq("id", ph.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not save.");
            return;
          }
          ph.caption = cap.value.trim();
          ph.kind = kd.value;
          sv.textContent = "Saved ✓";
          setTimeout(function () {
            sv.textContent = "Save";
          }, 1200);
        });
    });
    var row = el("div", "lbrow");
    row.appendChild(cap);
    row.appendChild(kd);
    row.appendChild(sv);
    info.appendChild(row);
    var acts = el("div", "lbrow");
    var full = el("a", "btn alt sm", "Open full size");
    full.target = "_blank";
    full.rel = "noopener";
    signPaths([ph.path]).then(function () {
      var c = pcache[ph.path];
      if (c) full.href = c.url;
    });
    acts.appendChild(full);
    if (ph.client_id)
      acts.appendChild(
        btn("Open client", "btn alt sm", function () {
          close();
          openClient(ph.client_id);
        })
      );
    acts.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Delete this photo? This frees up the space and can't be undone.")) return;
        removePhotos([ph]).then(function (ok) {
          if (!ok) {
            alert("Could not delete. Check your connection and try again.");
            return;
          }
          rows.splice(cur, 1);
          if (!rows.length) {
            close();
            render();
            return;
          }
          if (cur >= rows.length) cur = rows.length - 1;
          draw();
          render();
        });
      })
    );
    info.appendChild(acts);
    lbx.appendChild(info);
  }
  document.addEventListener("keydown", key, true);
  draw();
}

/* photos on a client profile */
function addPhotoControls(host, meta, onDone, withKind) {
  var bar = el("div", "pbar2"),
    kd = document.createElement("select");
  kd.setAttribute("aria-label", "Photo type");
  KINDS.forEach(function (k) {
    var o = document.createElement("option");
    o.value = k[0];
    o.textContent = k[1];
    kd.appendChild(o);
  });
  kd.value = meta.kind || "other";
  kd.style.width = "auto";
  var st = el("span", "note");
  function run(files) {
    var m = Object.assign({}, meta, { kind: withKind === false ? meta.kind : kd.value });
    st.textContent = "Uploading...";
    uploadMany(files, m, function (i, n) {
      st.textContent = "Uploading " + i + " of " + n + "...";
    }).then(function (res) {
      st.textContent = res.ok ? "Added " + res.ok + " photo" + (res.ok > 1 ? "s" : "") + "." : "";
      var msg = uploadMsg(res);
      if (msg) alert(msg);
      onDone();
    });
  }
  bar.appendChild(
    btn("Take photo", "btn alt sm", function () {
      pickPhotos(true, run);
    })
  );
  bar.appendChild(
    btn("Add photos", "btn alt sm", function () {
      pickPhotos(false, run);
    })
  );
  if (withKind !== false) bar.appendChild(kd);
  bar.appendChild(st);
  host.appendChild(bar);
}
function clientPhotosSection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Photos");
  sec.appendChild(h);
  if (photoErr) {
    sec.appendChild(el("div", "note", "Run the Stage 10 SQL in Supabase to turn on photos."));
    return sec;
  }
  var holder = el("div"),
    more = false;
  function mine() {
    return photos
      .filter(function (p) {
        return p.client_id === c.id;
      })
      .sort(function (a, b) {
        return String(b.created_at) < String(a.created_at) ? -1 : 1;
      });
  }
  function draw() {
    var all = mine();
    h.textContent = "Photos" + (all.length ? " (" + all.length + ")" : "");
    var rows = more ? all : all.slice(0, 12);
    holder.textContent = "";
    var g = el("div");
    holder.appendChild(g);
    photoGrid(g, rows, {
      onTile: function (ph, i) {
        openLightbox(rows, i);
      }
    });
    if (!all.length)
      holder.appendChild(
        el("div", "note", "No photos yet. Take one or add some from your phone or computer.")
      );
    if (all.length > 12 && !more)
      holder.appendChild(
        btn("Show all " + all.length, "btn alt sm", function () {
          more = true;
          draw();
        })
      );
  }
  var ps = props.filter(function (p) {
    return p.client_id === c.id;
  });
  addPhotoControls(
    sec,
    { client_id: c.id, property_id: ps.length === 1 ? ps[0].id : null, kind: "other" },
    function () {
      draw();
      render();
    }
  );
  sec.appendChild(holder);
  draw();
  return sec;
}

/* the Photos tab: every photo, in bulk */
function renderPhotoLib() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  if (photoErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Photos aren't set up yet. Run the Stage 10 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  $("topbtns").appendChild(btn("+ Add photos", "btn", openAddPhotos));
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(
    btn(psel ? "Cancel selecting" : "Select", "btn alt", function () {
      psel = psel ? null : {};
      render();
    })
  );
  var used = photos.reduce(function (s, p) {
      return s + (p.size_bytes || 0);
    }, 0),
    cap = 1024 * 1024 * 1024,
    pct = Math.min(100, (used / cap) * 100),
    avg = Math.max(250000, photos.length ? used / photos.length : 350000);
  var mt = el("div", "meterbox");
  mt.appendChild(
    el(
      "div",
      "note",
      photos.length +
        " photo" +
        (photos.length === 1 ? "" : "s") +
        " · using " +
        (used >= 1048576 * 100
          ? (used / 1073741824).toFixed(2) + " GB"
          : (used / 1048576).toFixed(1) + " MB") +
        " of 1 GB on the free plan (room for about " +
        Math.max(0, Math.floor((cap - used) / avg)).toLocaleString() +
        " more)"
    )
  );
  var tr = el("div", "meter"),
    f = el("span");
  f.style.width = Math.max(1, pct) + "%";
  if (pct > 85) f.style.background = "var(--red)";
  tr.appendChild(f);
  mt.appendChild(tr);
  list.appendChild(mt);
  var cs = {};
  photos.forEach(function (p) {
    if (p.client_id) cs[p.client_id] = 1;
  });
  var fb = el("div", "pbar");
  var fc = fld(
    "Client",
    "select",
    pf.client,
    [
      ["all", "All clients"],
      ["none", "No client"]
    ].concat(
      Object.keys(cs)
        .map(function (k) {
          return [k, cname(k)];
        })
        .sort(function (a, b) {
          return a[1].localeCompare(b[1]);
        })
    )
  );
  var fk = fld("Type", "select", pf.kind, [["all", "All types"]].concat(KINDS));
  var fw = fld("When", "select", pf.when, [
    ["all", "All time"],
    ["month", "This month"],
    ["3m", "Last 3 months"],
    ["year", "This year"]
  ]);
  [
    [fc, "client"],
    [fk, "kind"],
    [fw, "when"]
  ].forEach(function (x) {
    x[0].style.cssText = "margin:0;min-width:150px";
    x[0].input.addEventListener("change", function () {
      pf[x[1]] = x[0].input.value;
      pshown = 60;
      render();
    });
    fb.appendChild(x[0]);
  });
  list.appendChild(fb);
  var t = today(),
    from =
      pf.when === "month"
        ? t.slice(0, 8) + "01"
        : pf.when === "3m"
          ? addDays(t, -92)
          : pf.when === "year"
            ? t.slice(0, 4) + "-01-01"
            : "";
  var set = photos
    .filter(function (p) {
      return (
        (pf.client === "all" || (pf.client === "none" ? !p.client_id : p.client_id === pf.client)) &&
        (pf.kind === "all" || p.kind === pf.kind) &&
        (!from || String(p.created_at).slice(0, 10) >= from) &&
        (!query ||
          [p.caption, p.client_id ? cname(p.client_id) : "", kindLabel(p.kind)]
            .join(" ")
            .toLowerCase()
            .indexOf(query) > -1)
      );
    })
    .sort(function (a, b) {
      return String(b.created_at) < String(a.created_at) ? -1 : 1;
    });
  if (psel) {
    var n = Object.keys(psel).length,
      bar = el("div", "selbar");
    bar.appendChild(el("b", null, n + " selected"));
    bar.appendChild(
      btn("Select all shown (" + set.length + ")", "btn alt sm", function () {
        set.forEach(function (p) {
          psel[p.id] = 1;
        });
        render();
      })
    );
    bar.appendChild(
      btn("Clear", "btn alt sm", function () {
        psel = {};
        render();
      })
    );
    var dl = btn("Delete selected", "btn danger sm", function () {
      var rows = photos.filter(function (p) {
        return psel[p.id];
      });
      deletePhotos(rows, function () {
        psel = {};
      });
    });
    dl.disabled = !n;
    bar.appendChild(dl);
    list.appendChild(bar);
  }
  if (!set.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        photos.length
          ? "No photos match those filters."
          : "No photos yet. Add some here, from a client's page, or from a visit."
      )
    );
    return;
  }
  var shown = set.slice(0, pshown),
    g = el("div");
  list.appendChild(g);
  photoGrid(g, shown, {
    sel: psel,
    onTile: psel
      ? function (ph) {
          if (psel[ph.id]) delete psel[ph.id];
          else psel[ph.id] = 1;
          render();
        }
      : null
  });
  if (set.length > pshown)
    list.appendChild(
      btn("Show more (" + (set.length - pshown) + " left)", "btn alt", function () {
        pshown += 60;
        render();
      })
    );
}
function openAddPhotos() {
  var p = panel();
  p.appendChild(el("h2", null, "Add photos"));
  var cl = fld(
    "Client (optional)",
    "select",
    "",
    [["", "No client"]].concat(
      clients
        .filter(function (c) {
          return !c.archived;
        })
        .map(function (c) {
          return [c.id, c.name];
        })
    )
  );
  p.appendChild(cl);
  var holder = el("div");
  p.appendChild(holder);
  function build() {
    holder.textContent = "";
    var ps = props.filter(function (x) {
      return x.client_id === cl.input.value;
    });
    addPhotoControls(
      holder,
      { client_id: cl.input.value || null, property_id: ps.length === 1 ? ps[0].id : null, kind: "other" },
      function () {
        render();
      }
    );
  }
  cl.input.addEventListener("change", build);
  build();
  var dn = btn("Done", "btn alt");
  dn.style.marginTop = "12px";
  dn.addEventListener("click", function () {
    closeDetail();
    render();
  });
  p.appendChild(dn);
}
