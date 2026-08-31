# GitHub Stack Share

Chrome extension that adds a share button to GitHub's stacked-PR modal. One
click copies a Slack-ready summary of the stack to the clipboard.

Copies two flavors at once — rich HTML (clickable PR titles, indentation
preserved) and a plain-text fallback:

```
Stack #3456 summary
⚪ develop (trunk)
└── 🟣 fix(canvas): unify output-name resolution #3419  ·  https://github.com/...
    └── 🟢 fix(canvas): map engine iterator inputs #3422  ·  https://github.com/...
        └── 📝 fix(canvas): hide unreferenced runtime inputs #3423  ·  https://github.com/...
```

Status: 🟣 merged · ✅ approved · 🔴 closed · 📝 draft · 🟢 open · ⚪ no PR.

## Install

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → pick this folder
3. Open a PR that belongs to a stack, open the stack modal, click the share
   icon in the modal header

## Options

Right-click the extension → **Options** (or the Details page in
`chrome://extensions`):

<img width="428" height="264" alt="image" src="https://github.com/user-attachments/assets/679a81e4-d1f7-4593-96ca-5a2fda8ca547" />

- **Include the trunk branch** — off by default. Check it to prefix the summary
  with the trunk row.
- **Show pull request numbers** — off by default. Check it to append each pull
  request number to its line.

## Test

```
node test.js
```

## Notes

- Approval state isn't in the modal DOM. Each open PR's hovercard partial
  (~5 KB, same-origin, uses your existing session) is fetched and checked for
  the approved review badge. No token, works on private repos.
- Those fetches take ~480 ms in parallel, so they start when the modal opens
  rather than on click; the copy is then instant. A spinner covers the case
  where you click before the prefetch lands.
- Per-branch diffstats are still omitted — they aren't reachable that cheaply.
- Selectors use Primer's `data-component` attributes and partial class matches
  (`[class*="overlayHeader"]`) — GitHub's CSS-module class names are
  content-hashed and change between deploys.
- The button clones the neighbouring "Unstack pull requests" icon button, so it
  inherits GitHub's own styling rather than approximating it. The tooltip uses
  Primer CSS's `tooltipped` classes — Primer's React TooltipV2 is positioned in
  JS, so a cloned one opens at the viewport corner.
