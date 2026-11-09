/* Signing in and out, and loading all the data from Supabase when the CRM opens or Refresh is pressed. */

/* ---- sign in / out ---- */
eyeToggle($("pw"), "password");
$("login").addEventListener("submit", function (e) {
  e.preventDefault();
  $("loginmsg").textContent = "";
  sb.auth.signInWithPassword({ email: $("em").value.trim(), password: $("pw").value }).then(function (r) {
    if (r.error) {
      $("loginmsg").textContent = "That email or password didn't work.";
      return;
    }
    afterSignIn();
  });
});
$("signout").addEventListener("click", function () {
  sb.auth.signOut().then(function () {
    location.reload();
  });
});
$("refresh").addEventListener("click", function () {
  if (crewMe) renderCrewApp();
  else load();
});
function start() {
  $("gsearch").hidden = false;
  $("loginwrap").hidden = true;
  $("layout").hidden = false;
  $("signout").hidden = false;
  $("refresh").hidden = false;
  load();
}
sb.auth.getSession().then(function (r) {
  if (r.data && r.data.session) afterSignIn();
});
/* Crew logins see only their own route; the owner sees everything. */
function afterSignIn() {
  var done = false;
  function go(me) {
    if (done) return;
    done = true;
    if (me) {
      startCrewApp(me);
      return;
    }
    sb.auth
      .getSession()
      .then(function (s) {
        myEmail = (
          (s.data && s.data.session && s.data.session.user && s.data.session.user.email) ||
          ""
        ).toLowerCase();
      })
      .catch(function () {})
      .then(function () {
        return sb.rpc("staff_role");
      })
      .then(
        function (r) {
          role = r && !r.error ? r.data || "office" : "owner";
          start();
        },
        function () {
          role = "owner";
          start();
        }
      );
  }
  try {
    sb.rpc("crew_me").then(
      function (r) {
        go(r && !r.error && r.data && r.data.length ? r.data[0] : null);
      },
      function () {
        go(null);
      }
    );
  } catch (e) {
    go(null);
  }
}

/* ---- data ---- */
function fetchAll(table, col) {
  var out = [],
    from = 0;
  function page() {
    return sb
      .from(table)
      .select("*")
      .order(col, { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999)
      .then(function (r) {
        if (r.error) return { data: null, error: r.error };
        out = out.concat(r.data || []);
        if ((r.data || []).length < 1000) return { data: out, error: null };
        from += 1000;
        return page();
      });
  }
  return page();
}
function load() {
  $("msg").textContent = "";
  Promise.all([
    sb.from("leads").select("*").order("created_at", { ascending: false }).limit(1000),
    sb.from("clients").select("*").order("name", { ascending: true }).limit(5000),
    sb.from("properties").select("*").order("created_at", { ascending: true }).limit(10000),
    sb.from("services").select("*").order("name", { ascending: true }).limit(500),
    sb.from("jobs").select("*").order("created_at", { ascending: true }).limit(5000),
    sb
      .from("visits")
      .select("*")
      .gte("scheduled_date", addDays(today(), -45))
      .order("scheduled_date", { ascending: true })
      .limit(5000),
    sb.from("crew").select("*").order("name", { ascending: true }).limit(200),
    sb.from("invoices").select("*").order("number", { ascending: false }).limit(3000),
    sb.from("business").select("*").eq("id", 1),
    sb.from("visits").select("*").eq("status", "done").is("invoice_id", null).is("paid_at", null).limit(5000),
    sb.from("todos").select("*").order("created_at", { ascending: false }).limit(3000),
    fetchAll("expenses", "spent_on"),
    sb.from("photos").select("*").order("created_at", { ascending: false }).limit(5000),
    sb.from("estimates").select("*").order("number", { ascending: false }).limit(3000),
    sb.from("inventory_cats").select("*").order("sort", { ascending: true }).limit(500),
    sb.from("inventory_items").select("*").order("sort", { ascending: true }).limit(20000),
    sb.from("personnel").select("*").order("emp_no", { ascending: true }).limit(2000),
    sb.from("personnel_pay").select("*").order("paid_on", { ascending: false }).limit(20000),
    sb.from("personnel_benefits").select("*").order("created_at", { ascending: false }).limit(5000),
    sb.from("personnel_docs").select("*").order("created_at", { ascending: false }).limit(5000),
    sb.from("invoice_payments").select("*").order("paid_on", { ascending: false }).limit(20000),
    sb.from("client_contacts").select("*").order("created_at", { ascending: true }).limit(20000)
  ]).then(function (rs) {
    ccErr = !!rs[21].error;
    ccontacts = rs[21].error ? [] : rs[21].data || [];
    payErr = !!rs[20].error;
    invPays = rs[20].error ? [] : rs[20].data || [];
    persErr = !!(rs[16].error || rs[17].error || rs[18].error || rs[19].error);
    people = rs[16].error ? [] : rs[16].data || [];
    payRows = rs[17].error ? [] : rs[17].data || [];
    benRows = rs[18].error ? [] : rs[18].data || [];
    docRows = rs[19].error ? [] : rs[19].data || [];
    if (rs[0].error) {
      $("msg").textContent =
        "Could not load leads. If you just signed in, make sure this email is on the staff list.";
      return;
    }
    leads = rs[0].data || [];
    clientsErr = !!(rs[1].error || rs[2].error);
    clients = rs[1].error ? [] : rs[1].data || [];
    sortClients();
    props = rs[2].error ? [] : rs[2].data || [];
    jobsErr = !!(rs[3].error || rs[4].error || rs[5].error || clientsErr);
    services = rs[3].error ? [] : rs[3].data || [];
    jobs = rs[4].error ? [] : rs[4].data || [];
    visits = rs[5].error ? [] : rs[5].data || [];
    histFrom = addDays(today(), -45);
    s3 = !rs[6].error;
    crew = rs[6].error ? [] : rs[6].data || [];
    billErr = !!(rs[7].error || rs[9].error || jobsErr);
    invoices = rs[7].error ? [] : rs[7].data || [];
    biz = rs[8].error ? null : (rs[8].data || [])[0] || null;
    unbilled = rs[9].error ? [] : rs[9].data || [];
    photoErr = !!rs[12].error;
    photos = rs[12].error ? [] : rs[12].data || [];
    expErr = !!rs[11].error;
    expenses = rs[11].error ? [] : rs[11].data || [];
    repData = null;
    todoErr = !!rs[10].error;
    todos = rs[10].error ? [] : rs[10].data || [];
    estErr = !!rs[13].error;
    estimates = rs[13].error ? [] : rs[13].data || [];
    invErr = !!(rs[14].error || rs[15].error);
    invCats = rs[14].error ? [] : rs[14].data || [];
    invItems = rs[15].error ? [] : rs[15].data || [];
    try {
      sb.rpc("team_names").then(
        function (r) {
          if (r && !r.error && r.data) team = r.data;
        },
        function () {}
      );
    } catch (e) {}
    render();
    topUp().then(function (n) {
      if (n) render();
    });
  });
}
