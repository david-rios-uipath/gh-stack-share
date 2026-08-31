// Adds a share button to GitHub's stacked-PR modal. Clicking copies a
// Slack-ready summary of the stack (rich HTML + plain-text fallback).

const STATUS_EMOJI = {
  merged: "\u{1F7E3}",
  approved: "\u2705",
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

// --- Approval state ---------------------------------------------------------
//
// The modal carries no review state, so each open PR's hovercard partial
// (~5 KB) is fetched on click. Its review badge is a success-colored check
// octicon when the PR is approved, and a dot or comment octicon otherwise.

async function withApprovals(rows) {
  await Promise.all(
    rows
      .filter((row) => row.status === "open" && row.url)
      .map(async (row) => {
        try {
          const res = await fetch(`${new URL(row.url).pathname}/hovercard`, {
            headers: { "x-requested-with": "XMLHttpRequest" },
          });
          if (!res.ok) return;
          const doc = new DOMParser().parseFromString(await res.text(), "text/html");
          if (doc.querySelector(".octicon-check.color-fg-success")) row.status = "approved";
        } catch {
          // An unreachable hovercard leaves the PR as plain open rather than
          // blocking the copy.
        }
      }),
  );
  return rows;
}

// --- Button -----------------------------------------------------------------

const BUTTON_ID = "gh-stack-share-button";
const TOOLTIP_ID = "gh-stack-share-tooltip";
const LABEL_IDLE = "Copy stack summary";

// octicon-copy-16
const ICON_SHARE =
  '<path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>';
// octicon-check-16
const ICON_CHECK =
  '<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>';

const icon = (paths, name) =>
  `<svg data-component="Octicon" aria-hidden="true" focusable="false" class="octicon octicon-${name}" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align: text-bottom;">${paths}</svg>`;

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
  btn.innerHTML = icon(ICON_SHARE, "copy");
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

function onShareClick(event) {
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

  const heading = `${headingText(overlay)} summary`;
  const summary = withApprovals(rows).then((enriched) => buildSummary(enriched, heading));
  const blob = (type, pick) =>
    summary.then((s) => new Blob([pick(s)], { type }));

  // ClipboardItem takes promises, so the write call itself stays synchronous
  // and keeps the click's user activation while the hovercards are fetched.
  navigator.clipboard
    .write([
      new ClipboardItem({
        "text/plain": blob("text/plain", (s) => s.text),
        "text/html": blob("text/html", (s) => s.html),
      }),
    ])
    .catch(async () => navigator.clipboard.writeText((await summary).text))
    .then(
      () => flash(btn, "Copied"),
      () => flash(btn, "Copy failed"),
    );
}

function flash(btn, message) {
  const tooltip = document.getElementById(TOOLTIP_ID);
  const setLabel = (text) => {
    if (tooltip) tooltip.textContent = text;
    else btn.setAttribute("aria-label", text);
  };
  setLabel(message);
  btn.innerHTML = icon(ICON_CHECK, "check");
  setTimeout(() => {
    setLabel(LABEL_IDLE);
    btn.innerHTML = icon(ICON_SHARE, "copy");
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
