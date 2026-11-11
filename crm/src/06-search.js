/* The search box at the top: finds clients, jobs, invoices, estimates, tasks, inventory and screens. */

/* ---- global search (header) ---- */
(function () {
  var gs = $("gs"),
    res = $("gres"),
    lastQ = "";
  function toks(q) {
    return q.toLowerCase().split(/\s+/).filter(Boolean);
  }
  function all(hay, t) {
    hay = hay.toLowerCase();
    var dig = hay.replace(/\D/g, "");
    return t.every(function (x) {
      return hay.indexOf(x) > -1 || (/^\d{3,}$/.test(x) && dig.indexOf(x) > -1);
    });
  }
  function sec(title, items, make, go) {
    if (!items.length) return;
    res.appendChild(el("h4", null, title));
    items.slice(0, 6).forEach(function (it) {
      var m = make(it),
        b = document.createElement("button");
      b.type = "button";
      b.appendChild(el("b", null, m[0]));
      if (m[1]) b.appendChild(el("span", null, m[1]));
      b.addEventListener("click", function () {
        close();
        gs.value = "";
        m[2]();
      });
      res.appendChild(b);
    });
    if (go && items.length > 6) {
      var more = document.createElement("button");
      more.type = "button";
      more.appendChild(el("b", null, "See all " + items.length + " " + title.toLowerCase() + " →"));
      more.firstChild.style.color = "var(--forest)";
      more.addEventListener("click", function () {
        close();
        gs.value = "";
        go();
      });
      res.appendChild(more);
    }
  }
  var TOPICS = [
    [
      "Leads",
      "leads lead quote request inquiry website new",
      function () {
        view = "leads";
        lfilter = "all";
      }
    ],
    [
      "Clients",
      "clients client customer customers contact phone email",
      function () {
        view = "clients";
      }
    ],
    [
      "Jobs",
      "jobs job service services recurring price weekly",
      function () {
        view = "jobs";
      }
    ],
    [
      "Schedule",
      "schedule calendar route today tomorrow visit visits crew day week",
      function () {
        view = "schedule";
      }
    ],
    [
      "Weather delay",
      "weather rain delay storm reschedule",
      function () {
        view = "schedule";
        openWeather(today());
      }
    ],
    [
      "To-Do",
      "todo to-do task tasks reminder",
      function () {
        view = "todo";
      }
    ],
    [
      "Invoices (Billing)",
      "invoices invoice bill billing payment paid unpaid overdue owed zelle",
      function () {
        view = "billing";
        bfilter = "open";
      }
    ],
    [
      "Ready to bill",
      "bill billing unbilled ready to-bill create invoices",
      function () {
        view = "billing";
        bfilter = "tobill";
      }
    ],
    [
      "Quotes (Leads)",
      "estimates estimate quote proposal",
      function () {
        view = "leads";
        lfilter = "open";
      }
    ],
    [
      "Reports",
      "reports report revenue profit earnings income money",
      function () {
        view = "reports";
        rtab = "overview";
      }
    ],
    [
      "Tax report",
      "tax taxes report year-end equipment",
      function () {
        view = "reports";
        rtab = "tax";
      }
    ],
    [
      "Expenses",
      "expenses expense receipt spending cost costs vendor scan",
      function () {
        view = "expenses";
      }
    ],
    [
      "Photos",
      "photos photo pictures picture images gallery before after receipt",
      function () {
        view = "photos";
      }
    ],
    [
      "Price calculator",
      "price prices pricing calculator estimate quote rate rates mow mowing lawn sqft square feet",
      function () {
        view = "leads";
        lfilter = "open";
        setTimeout(openCalc, 0);
      }
    ],
    [
      "Inventory",
      "inventory stock supplies equipment parts tools chemicals fuel",
      function () {
        view = "inventory";
        invq = "";
      }
    ],
    [
      "Team",
      "team staff users user login access owner office permissions",
      function () {
        if (isOwner()) view = "team";
        else view = "leads";
      }
    ],
    [
      "Billing settings",
      "settings business zelle terms footer",
      function () {
        view = "billing";
        openBizSettings();
      }
    ]
  ];
  function topicHit(tp, t) {
    var w = (tp[0] + " " + tp[1]).toLowerCase().split(/\s+/);
    return t.every(function (x) {
      return w.some(function (y) {
        return y.indexOf(x) === 0;
      });
    });
  }
  function close() {
    res.classList.remove("on");
    res.textContent = "";
  }
  function run() {
    var t = toks(gs.value);
    lastQ = gs.value.trim();
    res.textContent = "";
    if (!t.length) {
      close();
      return;
    }
    var cl = clients.filter(function (c) {
      return all(
        [
          "client",
          c.name,
          c.account_no ? "account " + c.account_no : "",
          c.company,
          c.phone,
          c.phone2,
          c.email,
          ccText(c.id),
          clientProps(c.id)
            .map(function (p) {
              return p.address;
            })
            .join(" ")
        ].join(" "),
        t
      );
    });
    var jb = jobs.filter(function (j) {
      var sv = byId(services, j.service_id);
      return all(
        [
          "job",
          j.title,
          sv ? sv.name : "",
          cname(j.client_id),
          paddr(j.property_id),
          flabel(j.frequency)
        ].join(" "),
        t
      );
    });
    var ld = leads.filter(function (l) {
      return all(["lead", l.name, l.email, l.phone, l.address, l.service, l.kind].join(" "), t);
    });
    var tp = TOPICS.filter(function (x) {
      return topicHit(x, t) && !(x[0] === "Team" && !isOwner());
    });
    if (tp.length) {
      res.appendChild(el("h4", null, "Go to"));
      tp.slice(0, 4).forEach(function (x) {
        var b = document.createElement("button");
        b.type = "button";
        b.appendChild(el("b", null, x[0]));
        b.addEventListener("click", function () {
          close();
          gs.value = "";
          x[2]();
          render();
        });
        res.appendChild(b);
      });
    }
    sec("Clients", cl, function (c) {
      var ps = clientProps(c.id);
      return [
        c.name + (c.company ? " · " + c.company : ""),
        [ps[0] && ps[0].address, c.phone].filter(Boolean).join(" · "),
        function () {
          openClient(c.id);
        }
      ];
    });
    sec("Jobs", jb, function (j) {
      return [
        cname(j.client_id) + " · " + j.title,
        [paddr(j.property_id), flabel(j.frequency), money(j.price), j.status !== "active" ? j.status : ""]
          .filter(Boolean)
          .join(" · "),
        function () {
          openJob(j.id);
        }
      ];
    });
    var iv = billErr
      ? []
      : invoices.filter(function (i) {
          return all(
            [
              "invoice",
              i.status === "open" && isOverdue(i) ? "overdue" : i.status,
              i.status === "open" ? "unpaid" : "",
              String(i.total),
              invNum(i.number),
              String(i.number),
              cname(i.client_id),
              i.reference || ""
            ].join(" "),
            t
          );
        });
    sec(
      "Invoices",
      iv,
      function (i) {
        return [
          invNum(i.number) + " · " + cname(i.client_id),
          [
            money(i.total),
            i.status === "paid" ? "Paid" : i.status === "void" ? "Void" : "Due " + dshort(i.due_date),
            i.reference
          ]
            .filter(Boolean)
            .join(" · "),
          function () {
            openInvoice(i.id);
          }
        ];
      },
      function () {
        view = "billing";
        bfilter = "open";
        render();
      }
    );
    sec("Leads", ld, function (l) {
      return [
        l.name || "(no name)",
        [l.kind, l.service, l.address].filter(Boolean).join(" · "),
        function () {
          openLead(l.id);
        }
      ];
    });
    var es = estErr
      ? []
      : estimates.filter(function (e) {
          return all(
            [
              "estimate quote",
              e.status,
              estNum(e.number, e.doc_type),
              String(e.total),
              cname(e.client_id),
              e.title || "",
              e.scope || ""
            ].join(" "),
            t
          );
        });
    sec(
      "Estimates",
      es,
      function (e) {
        return [
          estNum(e.number, e.doc_type) + " · " + cname(e.client_id),
          [
            e.title,
            money(e.total),
            e.status === "accepted"
              ? "Accepted"
              : e.status === "declined"
                ? "Declined"
                : estExpired(e)
                  ? "Expired"
                  : e.status === "sent"
                    ? "Sent"
                    : "Draft"
          ]
            .filter(Boolean)
            .join(" · "),
          function () {
            openEstimate(e.id);
          }
        ];
      },
      function () {
        view = "leads";
        lfilter = "open";
        render();
      }
    );
    var td = todoErr
      ? []
      : todos.filter(function (x) {
          return all(
            [
              "task todo",
              x.done ? "done" : "open",
              x.title,
              x.notes || "",
              cname(x.client_id),
              memberName(x.assigned_to)
            ].join(" "),
            t
          );
        });
    sec(
      "To-Do",
      td,
      function (x) {
        return [
          x.title,
          [
            x.done ? "Done" : "Open",
            x.due_date ? "due " + dshort(x.due_date) : "",
            x.client_id ? cname(x.client_id) : ""
          ]
            .filter(Boolean)
            .join(" · "),
          function () {
            openTodo(x);
          }
        ];
      },
      function () {
        view = "todo";
        tfilter = t.indexOf("done") > -1 ? "done" : "open";
        render();
      }
    );
    var ex = expErr
      ? []
      : expenses.filter(function (x) {
          return all(
            [
              "expense",
              x.category,
              x.vendor,
              x.note || "",
              String(x.amount),
              x.client_id ? cname(x.client_id) : ""
            ].join(" "),
            t
          );
        });
    sec(
      "Expenses",
      ex,
      function (x) {
        return [
          money(x.amount) + " · " + (x.vendor || x.category),
          [x.category, dshort(x.spent_on), x.note].filter(Boolean).join(" · "),
          function () {
            openExpense(x);
          }
        ];
      },
      function () {
        view = "expenses";
        render();
      }
    );
    var ph = photoErr
      ? []
      : photos.filter(function (x) {
          return all(["photo", x.kind, x.caption || "", x.client_id ? cname(x.client_id) : ""].join(" "), t);
        });
    sec(
      "Photos",
      ph,
      function (x) {
        return [
          (x.client_id ? cname(x.client_id) : "No client") + " · " + x.kind,
          [x.caption, dshort(String(x.created_at).slice(0, 10))].filter(Boolean).join(" · "),
          function () {
            view = "photos";
            pf.client = x.client_id || "none";
            pf.kind = "all";
            render();
          }
        ];
      },
      function () {
        view = "photos";
        render();
      }
    );
    var ii = [];
    if (!invErr)
      invVisible().forEach(function (c) {
        invRows(c).forEach(function (r) {
          if (invHas(c, r, t)) ii.push([c, r]);
        });
      });
    sec(
      "Inventory",
      ii,
      function (x) {
        var c = x[0],
          r = x[1],
          cols = invCols(c);
        return [
          invTitle(c, r),
          c.name +
            " · " +
            cols
              .slice(1)
              .map(function (col) {
                var v = invVal(r, col.k);
                return v ? col.n + ": " + v : "";
              })
              .filter(Boolean)
              .join(" · "),
          function () {
            view = "inventory";
            invCat = c.id;
            invq = lastQ;
            render();
          }
        ];
      },
      function () {
        view = "inventory";
        invq = lastQ;
        render();
      }
    );
    if (!res.firstChild)
      res.appendChild(
        el(
          "div",
          "none",
          "No matches. Try a name, address, phone, invoice number, or a topic like invoices, photos or inventory."
        )
      );
    res.classList.add("on");
  }
  gs.addEventListener("input", run);
  gs.addEventListener("focus", function () {
    if (gs.value.trim()) run();
  });
  gs.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      close();
      gs.blur();
    } else if (e.key === "Enter") {
      var f = res.querySelector("button");
      if (f) f.click();
    }
  });
  document.addEventListener("click", function (e) {
    if (!$("gsearch").contains(e.target)) close();
  });
})();
