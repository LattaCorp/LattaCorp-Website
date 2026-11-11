/* Settings and shared data: the database connection, drop-down lists, and the variables every screen reads (lists of clients, jobs, invoices, filters...). */

var cfg = window.CRM_CONFIG,
  sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
var STATUSES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["quoted", "Quoted"],
  ["won", "Won"],
  ["lost", "Lost"]
];
var TYPES = [
  ["residential", "Residential"],
  ["hoa", "HOA"],
  ["commercial", "Commercial"]
];
var leads = [],
  clients = [],
  props = [],
  clientsErr = false,
  services = [],
  jobs = [],
  visits = [],
  jobsErr = false;
var photos = [],
  photoErr = false,
  pf = { client: "all", kind: "all", when: "all" },
  psel = null,
  pshown = 60;
var expenses = [],
  expErr = false,
  rtab = "overview",
  rper = "month",
  rfrom = "",
  rto = "",
  exCat = "all",
  exYear = String(new Date().getFullYear()),
  exq = "",
  exShown = 300,
  exCol = 1,
  exDir = -1,
  exF = {},
  taxYear = String(new Date().getFullYear()),
  taxMaking = false;
var todos = [],
  todoErr = false,
  tfilter = "open",
  team = [];
var role = "owner",
  myEmail = "";
function isOwner() {
  return role === "owner";
}
var view = "leads",
  lfilter = "open",
  cfilter = "active",
  jfilter = "active",
  smode = (function () {
    try {
      return localStorage.getItem("lc_sched_view") || "day";
    } catch (e) {
      return "day";
    }
  })(),
  calEvents = [],
  calErr = false,
  selDate = today(),
  crewF = "all",
  query = "";
var estimates = [],
  estErr = false;
var ccontacts = [],
  ccErr = false;
var CROLES = [
  "Spouse",
  "Partner",
  "Board member",
  "HOA president",
  "Property manager",
  "Tenant",
  "Family member",
  "Office / billing"
];
var teamSyncAt = 0,
  teamSyncing = false,
  invPays = [],
  payErr = false;
var people = [],
  payRows = [],
  benRows = [],
  docRows = [],
  persErr = false,
  pfilter = "all";
var invCats = [],
  invItems = [],
  invErr = false,
  invCat = null,
  invq = "",
  invSort = null,
  invFocus = null;
var invoices = [],
  biz = null,
  billErr = false,
  unbilled = [],
  bfilter = "tobill",
  billThrough = lastMonthEnd();
var crew = [],
  s3 = false,
  histFrom = addDays(today(), -45),
  crewMe = null,
  cwDate = today();
