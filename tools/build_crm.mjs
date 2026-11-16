// Builds crm/app.js from the section files in crm/src/.
//
// The CRM code is organized into one file per section (clients, billing, schedule...) in crm/src/.
// The browser still loads a single file, crm/app.js, so after editing anything in crm/src/ run:
//
//     node tools/build_crm.mjs
//
// It joins the sections in file-name order (00-, 01-, ...) inside one private wrapper, exactly like
// the original single file, so every section can use everything defined in the others.
// It also bumps the version numbers in crm/index.html and crm/sw.js so phones load the new code.
// Pass --no-bump to rebuild without changing the version.
import fs from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { buildAllDark } from "./build_dark.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "crm", "src");
const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".js")).sort();

let out =
  "/* Foreman CRM. GENERATED FILE: do not edit here. Edit the section files in crm/src/,\n" +
  "   then run: node tools/build_crm.mjs */\n" +
  '(function () {\n"use strict";\n\n';
for (const f of files) {
  out += "/* ======================= crm/src/" + f + " ======================= */\n";
  out += fs.readFileSync(path.join(srcDir, f), "utf8").trimEnd() + "\n\n";
}
out += "})();\n";
// The readable bundle is kept in .build/ (not published) for testing and debugging. What phones download,
// crm/app.js, is the same code minified by esbuild (about 25% smaller to download). No esbuild here? Then the
// readable bundle is published as-is, which works exactly the same, just a little bigger.
fs.mkdirSync(path.join(root, ".build"), { recursive: true });
fs.writeFileSync(path.join(root, ".build", "app.debug.js"), out);
let min = null;
for (const bin of [path.join(root, "node_modules", ".bin", "esbuild"), "/opt/npm-tools/node_modules/.bin/esbuild", "esbuild"]) {
  try {
    min = execFileSync(bin, ["--minify", "--target=es2017", "--loader=js", "--log-level=error"], { input: out, maxBuffer: 64 << 20 }).toString();
    break;
  } catch (e) {}
}
fs.writeFileSync(path.join(root, "crm", "app.js"), min ? "/* Foreman CRM (minified). Source: crm/src/, built by tools/build_crm.mjs */\n" + min : out);
if (!min) console.log("(esbuild not found: published the readable bundle)");

if (!process.argv.includes("--no-bump")) {
  const html = path.join(root, "crm", "index.html");
  const sw = path.join(root, "crm", "sw.js");
  const h = fs.readFileSync(html, "utf8");
  const v = Number((h.match(/app\.js\?v=(\d+)/) || [])[1] || 0) + 1;
  fs.writeFileSync(html, h.replace(/app\.js\?v=\d+/, "app.js?v=" + v));
  fs.writeFileSync(sw, fs.readFileSync(sw, "utf8").replace(/lc-crm-v\d+/, "lc-crm-v" + v));
  console.log("Built crm/app.js from " + files.length + " files, version " + v);
} else {
  console.log("Built crm/app.js from " + files.length + " files (version unchanged)");
}

// dark mode colors follow whatever the light design is now
buildAllDark();
