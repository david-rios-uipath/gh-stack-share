// Adds a share button to GitHub's stacked-PR modal. Clicking copies a
// Slack-ready summary of the stack (rich HTML + plain-text fallback).

const STATUS_EMOJI = {
  merged: "\u{1F7E3}",
  closed: "\u{1F534}",
  draft: "\u{1F4DD}",
  open: "\u{1F7E2}",
  none: "⚪",
};

// GitHub's octicon name is the only stable state signal in the modal DOM.
function statusFromIconClass(className) {
  if (!className) return "none";
  if (/octicon-git-merge/.test(className)) return "merged";
  if (/octicon-git-pull-request-draft/.test(className)) return "draft";
  if (/octicon-git-pull-request-closed/.test(className)) return "closed";
  if (/octicon-git-pull-request/.test(className)) return "open";
  return "none";
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s) => escapeHtml(s).replace(/"/g, "&quot;");
const nbsp = (s) => s.replace(/ /g, "&nbsp;");

const label = (row) => row.title || row.branch || `#${row.number}`;

// Rows arrive trunk-first. A stack is linear, so each row is the sole child of
// the one before it: indentation grows by one level per row.
function indentFor(i) {
  return i === 0 ? "" : "    ".repeat(i - 1) + "└── ";
}

function renderText(rows, heading) {
  const lines = [heading];
  rows.forEach((row, i) => {
    let line = `${indentFor(i)}${STATUS_EMOJI[row.status] || STATUS_EMOJI.none} ${label(row)}`;
    if (row.isTrunk) line += " (trunk)";
    if (row.number) line += ` #${row.number}`;
    if (row.url) line += `  ·  ${row.url}`;
    lines.push(line);
  });
  return lines.join("\n");
}

function renderHtml(rows, heading) {
  const lines = [`<b>${escapeHtml(heading)}</b>`];
  rows.forEach((row, i) => {
    const name = escapeHtml(label(row));
    let line = nbsp(indentFor(i)) + `${STATUS_EMOJI[row.status] || STATUS_EMOJI.none} `;
    if (row.isTrunk) {
      line += `<i>${name} (trunk)</i>`;
    } else if (row.url) {
      line += `<a href="${escapeAttr(row.url)}">${name}</a> <i>#${row.number}</i>`;
    } else {
      line += row.number ? `${name} <i>#${row.number}</i>` : name;
    }
    lines.push(line);
  });
  return lines.join("<br>\n");
}

function buildSummary(rows, heading) {
  return { text: renderText(rows, heading), html: renderHtml(rows, heading) };
}

// --- DOM scraping -----------------------------------------------------------

const STACK_HEADING = /^\s*Stack\s+#\d+\s*$/;
const PR_META = /^#(\d+)\s*·\s*(\S+)$/; // "#3423 · fix/some-branch"

function findStackDialog(root = document) {
  const candidates = root.querySelectorAll('[role="dialog"], dialog');
  for (const el of candidates) {
    if ([...el.querySelectorAll("*")].some((n) => STACK_HEADING.test(n.textContent || ""))) {
      return el;
    }
  }
  return null;
}

function headingText(dialog) {
  const node = [...dialog.querySelectorAll("*")].find((n) => STACK_HEADING.test(n.textContent || ""));
  return node ? node.textContent.trim() : "Stack";
}

/**
 * Reads the modal top-down (top of stack first) and returns rows trunk-first.
 * Anchored on the "#123 · branch" meta line rather than class names, which are
 * content-hashed and change between GitHub deploys.
 */
function scrapeRows(dialog) {
  const rows = [];
  const seen = new Set();

  for (const node of dialog.querySelectorAll("*")) {
    if (node.children.length) continue;
    const m = PR_META.exec((node.textContent || "").trim());
    if (!m) continue;

    const [, number, branch] = m;
    if (seen.has(number)) continue;
    seen.add(number);

    const item = node.closest("li, [role='listitem'], a, div");
    const link = item && item.querySelector("a[href*='/pull/']");
    const icon = item && item.querySelector("[class*='octicon-']");

    rows.push({
      number,
      branch,
      title: titleFor(item, node),
      url: link ? link.href : `${location.origin}${location.pathname.replace(/\/pull\/\d+.*$/, `/pull/${number}`)}`,
      status: statusFromIconClass(icon ? icon.getAttribute("class") : ""),
      isTrunk: false,
    });
  }

  const trunk = scrapeTrunk(dialog);
  rows.reverse();
  if (trunk) rows.unshift(trunk);
  return rows;
}

// The title is the text in the row that isn't the "#123 · branch" meta line.
function titleFor(item, metaNode) {
  if (!item) return "";
  const text = [...item.querySelectorAll("*")]
    .filter((n) => !n.children.length && n !== metaNode)
    .map((n) => (n.textContent || "").trim())
    .filter(Boolean)
    .find((t) => !PR_META.test(t) && t.length > 1);
  return text || "";
}

// Trunk sits at the bottom of the modal as a bare branch chip with no PR meta.
function scrapeTrunk(dialog) {
  const chips = [...dialog.querySelectorAll("code, [class*='branch'], [class*='Label']")];
  const last = chips.reverse().find((c) => {
    const t = (c.textContent || "").trim();
    return t && !t.includes(" ") && !PR_META.test(t) && !/^#\d+$/.test(t);
  });
  if (!last) return null;
  return { number: "", branch: last.textContent.trim(), title: "", url: "", status: "none", isTrunk: true };
}

// --- Button -----------------------------------------------------------------

const BUTTON_ID = "gh-stack-share-button";

const ICON_SHARE =
  '<path d="M3.75 6.75a.75.75 0 0 0-.75.75v6.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-6.5a.75.75 0 0 0-.75-.75h-1a.75.75 0 0 1 0-1.5h1A2.25 2.25 0 0 1 14.5 7.5v6.5a2.25 2.25 0 0 1-2.25 2.25h-8.5A2.25 2.25 0 0 1 1.5 14V7.5a2.25 2.25 0 0 1 2.25-2.25h1a.75.75 0 0 1 0 1.5h-1Z"></path><path d="M7.25 10.25a.75.75 0 0 0 1.5 0V2.66l1.97 1.97a.75.75 0 1 0 1.06-1.06L8.53.53a.75.75 0 0 0-1.06 0L4.22 3.57a.75.75 0 0 0 1.06 1.06l1.97-1.97Z"></path>';
const ICON_CHECK =
  '<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>';

function icon(paths) {
  return `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16" fill="currentColor">${paths}</svg>`;
}

function makeButton() {
  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.type = "button";
  btn.className = "btn-octicon";
  btn.setAttribute("aria-label", "Copy stack summary");
  btn.title = "Copy stack summary";
  // Inline fallback: the modal is Primer React with hashed classes, so
  // btn-octicon alone may not be styled there.
  btn.style.cssText =
    "display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;" +
    "border:0;border-radius:6px;background:transparent;color:var(--fgColor-muted,#59636e);cursor:pointer;";
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "var(--bgColor-neutral-muted,#818b981f)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "transparent";
  });
  btn.innerHTML = icon(ICON_SHARE);
  btn.addEventListener("click", onShareClick);
  return btn;
}

async function onShareClick(event) {
  const btn = event.currentTarget;
  const dialog = findStackDialog();
  if (!dialog) return;

  const rows = scrapeRows(dialog);
  if (!rows.length) {
    flash(btn, "Nothing to copy");
    return;
  }

  const { text, html } = buildSummary(rows, headingText(dialog) + " summary");
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
  } catch {
    await navigator.clipboard.writeText(text); // rich copy blocked; plain still works
  }
  flash(btn, "Copied");
}

function flash(btn, message) {
  btn.title = message;
  btn.innerHTML = icon(ICON_CHECK);
  setTimeout(() => {
    btn.title = "Copy stack summary";
    btn.innerHTML = icon(ICON_SHARE);
  }, 1500);
}

function inject(dialog) {
  if (dialog.querySelector(`#${BUTTON_ID}`)) return;
  const close = dialog.querySelector('button[aria-label*="lose"], button[aria-label*="ismiss"]');
  const host = close ? close.parentElement : null;
  if (!host) return;
  host.insertBefore(makeButton(), host.firstChild);
}

function init() {
  const observer = new MutationObserver(() => {
    const dialog = findStackDialog();
    if (dialog) inject(dialog);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof document !== "undefined" && document.body) init();

if (typeof module !== "undefined") {
  module.exports = { buildSummary, statusFromIconClass, indentFor, STATUS_EMOJI };
}
