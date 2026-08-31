// Adds a share button to GitHub's stacked-PR modal. Clicking copies a
// Slack-ready summary of the stack (rich HTML + plain-text fallback).

const STATUS_EMOJI = {
  merged: "\u{1F7E3}",
  closed: "\u{1F534}",
  draft: "\u{1F4DD}",
  open: "\u{1F7E2}",
  none: "⚪",
};

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
//
// The modal is Primer React with CSS-module class names like
// `StackState-module__overlayHeader__vrXgX` — the hash changes between
// deploys, so every selector matches on the readable part only.

const PR_META = /^#(\d+)\s*·\s*(\S+)$/; // "#3423 · fix/some-branch"
const HEADING = /^\s*Stack\s+#\d+\s*$/;

function findOverlay() {
  const title = document.querySelector('[class*="overlayHeaderTitle"]');
  if (!title || !HEADING.test(title.textContent || "")) return null;
  return title.closest('[class*="Overlay-Overlay"]');
}

function headingText(overlay) {
  const title = overlay.querySelector('[class*="overlayHeaderTitle"]');
  return title ? title.textContent.trim() : "Stack";
}

// State comes from the icon: its aria-label when GitHub sets one, else the class.
function statusFromIconClass(hint) {
  if (!hint || !hint.trim()) return "none";
  if (/\bMerged\b|fgColor-done|octicon-git-merge/.test(hint)) return "merged";
  if (/\bClosed\b|fgColor-closed|octicon-git-pull-request-closed/.test(hint)) return "closed";
  if (/\bDraft\b|octicon-git-pull-request-draft/.test(hint)) return "draft";
  if (/\bOpen\b|octicon-git-pull-request/.test(hint)) return "open";
  return "none";
}

const svgClass = (el) => (el ? String(el.className.baseVal || el.className || "") : "");

/** Reads the modal top-down (top of stack first) and returns rows trunk-first. */
function scrapeRows(overlay) {
  const rows = [];

  for (const li of overlay.querySelectorAll("li")) {
    if (/addToStackItem/.test(String(li.className))) continue;

    const iconEl = li.querySelector('[class*="octicon"]');
    // GitHub labels the state icon ("Open", "Merged", "Draft", "Closed");
    // the class name is the fallback when it doesn't.
    const iconHint = `${iconEl ? iconEl.getAttribute("aria-label") || "" : ""} ${svgClass(iconEl)}`;

    const branchChip = li.querySelector('[data-component="BranchName"], [class*="BranchName"]');
    if (branchChip && !li.querySelector('a[href*="/pull/"]')) {
      rows.push({
        number: "",
        branch: branchChip.textContent.trim(),
        title: "",
        url: "",
        status: "none",
        isTrunk: true,
      });
      continue;
    }

    const link = li.querySelector('a[href*="/pull/"]');
    const meta = PR_META.exec((li.querySelector('[data-component="ActionList.Description"]')?.textContent || "").trim());
    if (!link || !meta) continue;

    rows.push({
      number: meta[1],
      branch: meta[2],
      title: (li.querySelector('[data-component="ActionList.Item.Label"]')?.textContent || "").trim(),
      url: link.href,
      status: statusFromIconClass(iconHint),
      isTrunk: false,
    });
  }

  return rows.reverse();
}

// --- Button -----------------------------------------------------------------

const BUTTON_ID = "gh-stack-share-button";
const TOOLTIP_ID = "gh-stack-share-tooltip";
const LABEL_IDLE = "Copy stack summary";

const ICON_SHARE =
  '<path d="M3.75 6.75a.75.75 0 0 0-.75.75v6.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-6.5a.75.75 0 0 0-.75-.75h-1a.75.75 0 0 1 0-1.5h1A2.25 2.25 0 0 1 14.5 7.5v6.5a2.25 2.25 0 0 1-2.25 2.25h-8.5A2.25 2.25 0 0 1 1.5 14V7.5a2.25 2.25 0 0 1 2.25-2.25h1a.75.75 0 0 1 0 1.5h-1Z"></path><path d="M7.25 10.25a.75.75 0 0 0 1.5 0V2.66l1.97 1.97a.75.75 0 1 0 1.06-1.06L8.53.53a.75.75 0 0 0-1.06 0L4.22 3.57a.75.75 0 0 0 1.06 1.06l1.97-1.97Z"></path>';
const ICON_CHECK =
  '<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>';

const icon = (paths) =>
  `<svg aria-hidden="true" focusable="false" class="octicon" height="16" viewBox="0 0 16 16" width="16" fill="currentColor">${paths}</svg>`;

/**
 * Clones the existing header icon button (and its Primer tooltip) so ours
 * inherits the hashed classes and data-attributes verbatim — no style
 * guesswork, and it keeps matching when GitHub reskins the modal.
 */
function makeButton(sibling, tooltipSibling) {
  const btn = document.createElement("button");
  btn.type = "button";
  if (sibling) {
    for (const attr of sibling.attributes) {
      if (["id", "aria-label", "aria-labelledby", "type"].includes(attr.name)) continue;
      btn.setAttribute(attr.name, attr.value);
    }
  }
  btn.id = BUTTON_ID;
  btn.innerHTML = icon(ICON_SHARE);
  btn.addEventListener("click", onShareClick);

  const tooltip = tooltipSibling ? tooltipSibling.cloneNode(false) : null;
  if (tooltip) {
    tooltip.id = TOOLTIP_ID;
    tooltip.textContent = LABEL_IDLE;
    btn.setAttribute("aria-labelledby", TOOLTIP_ID);
  } else {
    btn.setAttribute("aria-label", LABEL_IDLE);
  }
  return { btn, tooltip };
}

async function onShareClick(event) {
  event.preventDefault();
  event.stopPropagation();

  const btn = event.currentTarget;
  const overlay = findOverlay();
  if (!overlay) return;

  const rows = scrapeRows(overlay);
  if (!rows.length) {
    flash(btn, "Nothing to copy");
    return;
  }

  const { text, html } = buildSummary(rows, `${headingText(overlay)} summary`);
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
  const tooltip = document.getElementById(TOOLTIP_ID);
  const setLabel = (text) => {
    if (tooltip) tooltip.textContent = text;
    else btn.setAttribute("aria-label", text);
  };
  setLabel(message);
  btn.innerHTML = icon(ICON_CHECK);
  setTimeout(() => {
    setLabel(LABEL_IDLE);
    btn.innerHTML = icon(ICON_SHARE);
  }, 1500);
}

function inject(overlay) {
  const actions = overlay.querySelector('[class*="overlayHeaderActions"]');
  if (!actions || actions.querySelector(`#${BUTTON_ID}`)) return;

  const { btn, tooltip } = makeButton(
    actions.querySelector("button"),
    actions.querySelector('[class*="Tooltip"]'),
  );
  actions.insertBefore(btn, actions.firstChild);
  if (tooltip) btn.after(tooltip);
}

function init() {
  const observer = new MutationObserver(() => {
    const overlay = findOverlay();
    if (overlay) inject(overlay);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof document !== "undefined" && document.body) init();

if (typeof module !== "undefined") {
  module.exports = { buildSummary, statusFromIconClass, indentFor, STATUS_EMOJI };
}
