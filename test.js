// Run: node test.js
const assert = require("assert");
const { buildSummary, statusFromIconClass, indentFor, htmlIndentFor } = require("./content.js");

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
// HTML indents with one repeated character so every step is the same width
assert.ok(html.includes("&nbsp;&nbsp;&nbsp;&nbsp;🟣 <a"));
assert.equal(htmlIndentFor(0), "");
assert.equal(htmlIndentFor(2).length, htmlIndentFor(1).length * 2);

console.log("ok");

// aria-label wins over the class name when GitHub provides it
assert.equal(statusFromIconClass("Merged octicon octicon-git-merge"), "merged");
assert.equal(statusFromIconClass("Open octicon octicon-git-pull-request fgColor-open"), "open");
assert.equal(statusFromIconClass(" "), "none");
console.log("ok (icon labels)");

// approved renders with a check and still links the PR
const approved = buildSummary(
  [{ number: "3455", branch: "feat/x", title: "feat: thing", url: "https://x/pull/3455", status: "approved" }],
  "Stack #1 summary",
);
assert.ok(approved.text.includes("✅ feat: thing #3455"));
assert.ok(approved.html.includes('✅ <a href="https://x/pull/3455">feat: thing</a>'));
console.log("ok (approved)");

// dropping the trunk row shifts the first PR back to zero indent
const noTrunk = buildSummary(
  [
    { number: "3419", branch: "a", title: "first", url: "https://x/pull/3419", status: "open" },
    { number: "3422", branch: "b", title: "second", url: "https://x/pull/3422", status: "open" },
  ],
  "Stack #1 summary",
);
assert.equal(
  noTrunk.text,
  ["Stack #1 summary", "🟢 first #3419  ·  https://x/pull/3419", "└── 🟢 second #3422  ·  https://x/pull/3422"].join("\n"),
);
console.log("ok (no trunk)");
