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

Status: 🟣 merged · 🔴 closed · 📝 draft · 🟢 open · ⚪ no PR.

Format follows [`us share`](https://github.com/UiPath/stacked-prs/pull/101).

## Install

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → pick this folder
3. Open a PR that belongs to a stack, open the stack modal, click the share
   icon in the modal header

## Test

```
node test.js
```

## Notes

- Approval state and per-branch diffstats aren't in the modal DOM, so they're
  omitted. `us share` shows them because it has API access.
- Selectors use Primer's `data-component` attributes and partial class matches
  (`[class*="overlayHeader"]`) — GitHub's CSS-module class names are
  content-hashed and change between deploys.
- The button clones the neighbouring "Unstack pull requests" icon button, so it
  inherits GitHub's own styling and tooltip rather than approximating them.
