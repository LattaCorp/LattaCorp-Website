/* Forms tab: every "start something" form in one place. The same forms stay on their own tabs too. */
function formGroups() {
  var own = isOwner();
  return [
    [
      "Customers",
      [
        ["New client", "Add a client and their property", function () { openClientForm(null); }],
        ["New job", "Set up recurring or one-time work", function () { openJobForm(null, null); }],
        ["New quote", "Write a quote for a client or lead", function () { openEstimateForm(null); }],
        ["Price calculator", "Work out a price before you quote", openCalc],
        ["Import clients", "Bring clients in from a CSV file", openImport]
      ]
    ],
    [
      "Field",
      [
        ["Add event", "Put something on the schedule", function () { openEventForm(null, today()); }],
        ["Add photos", "Upload job or property photos", openAddPhotos],
        own ? ["Crew & route texting", "Crew logins and texting a route", openCrew] : null,
        ["Schedule settings", "How the schedule works for you", openSchedSettings]
      ]
    ],
    [
      "Finances",
      [
        ["New invoice", "Bill a client", function () { openInvoiceForm(null); }],
        ["Bill the month", "Make this month's invoices from visits", openBillMonth],
        ["Email invoices", "Send invoices in batches", function () { openBatchDeliver(null); }],
        ["Record payment", "A check, cash, Zelle or card payment", function () { openPayment(null); }],
        ["Add expense", "Type in a purchase", function () { openExpense(null); }],
        ["Upload receipt", "Snap or upload a receipt", openReceiptUpload],
        ["Paste expenses from Excel", "Bring in many expenses at once", openExpPaste]
      ]
    ],
    [
      "Office",
      [
        ["New task", "A to-do with a due date", function () { openTodo(null); }],
        ["Send news to clients", "Shows in their portal and on their phones", openNewsForm],
        ["New inventory category", "Track equipment or supplies", openInvCatForm],
        ["Phone notifications", "What pings your phone", openNotifySettings]
      ]
    ],
    own
      ? [
          "Personnel",
          [
            ["Add person", "A new employee or contractor record", function () { openPerson(null); }],
            ["Billing settings", "Business info printed on invoices", openBizSettings]
          ]
        ]
      : null
  ].filter(Boolean);
}
function renderForms() {
  $("tabs").textContent = "";
  var list = $("list");
  list.textContent = "";
  var wrap = el("div", "formsgrid");
  formGroups().forEach(function (g) {
    var card = el("section", "card formsec");
    card.appendChild(el("h3", null, g[0]));
    g[1].filter(Boolean).forEach(function (f) {
      var b = el("button", "formbtn");
      b.type = "button";
      b.appendChild(el("b", null, f[0]));
      b.appendChild(el("span", null, f[1]));
      b.addEventListener("click", function () {
        f[2]();
      });
      card.appendChild(b);
    });
    wrap.appendChild(card);
  });
  list.appendChild(wrap);
}
