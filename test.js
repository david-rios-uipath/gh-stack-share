// Run: node test.js
const assert = require("assert");
const { buildSummary, statusFromIconClass, indentFor } = require("./content.js");

assert.equal(statusFromIconClass("octicon octicon-git-merge"), "merged");
assert.equal(statusFromIconClass("octicon-git-pull-request-draft"), "draft");
assert.equal(statusFromIconClass("octicon-git-pull-request-closed"), "closed");
assert.equal(statusFromIconClass("octicon-git-pull-request"), "open");
assert.equal(statusFromIconClass(""), "none");

assert.equal(indentFor(0), "");
assert.equal(indentFor(1), "└── ");
assert.equal(indentFor(2), "    └── ");

const rows = [
  { number: "", branch: "develop", title: "", url: "", status: "none", isTrunk: true },
  { number: "3419", branch: "fix/a", title: "fix(canvas): unify <output>", url: "https://x/pull/3419", status: "merged" },
  { number: "3423", branch: "fix/b", title: "", url: "https://x/pull/3423", status: "draft" },
];
const { text, html } = buildSummary(rows, "Stack #3456 summary");

assert.equal(
  text,
  [
    "Stack #3456 summary",
    "⚪ develop (trunk)",
    "└── 🟣 fix(canvas): unify <output> #3419  ·  https://x/pull/3419",
    "    └── 📝 fix/b #3423  ·  https://x/pull/3423",
  ].join("\n"),
);

assert.ok(html.includes("<b>Stack #3456 summary</b>"));
assert.ok(html.includes("<i>develop (trunk)</i>"));
assert.ok(html.includes('<a href="https://x/pull/3419">fix(canvas): unify &lt;output&gt;</a> <i>#3419</i>'));
assert.ok(html.includes("&nbsp;&nbsp;&nbsp;&nbsp;└──&nbsp;")); // indentation survives rich paste

console.log("ok");
