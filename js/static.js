// Small script for the standalone search-engine pages (built by tools/build_seo_pages.py).
// Services drop-down menu, and remembering the chosen language for the main site.
(function () {
  var dd = document.querySelector(".dd"), btn = document.getElementById("ddb");
  if (dd && btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !dd.classList.contains("open");
      dd.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".dd")) { dd.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { dd.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); } });
  }
  try {
    if (document.documentElement.lang === "es") localStorage.setItem("lang", "es");
    [].forEach.call(document.querySelectorAll(".lang a[data-l]"), function (a) {
      a.addEventListener("click", function () { localStorage.setItem("lang", a.getAttribute("data-l")); });
    });
  } catch (e) {}
})();
