const FIELDS = {
  "include-trunk": "includeTrunk",
  "show-pr-numbers": "showPrNumbers",
};

const defaults = Object.fromEntries(Object.values(FIELDS).map((key) => [key, true]));

chrome.storage.sync.get(defaults, (stored) => {
  for (const [id, key] of Object.entries(FIELDS)) {
    const box = document.getElementById(id);
    box.checked = stored[key];
    box.addEventListener("change", () => chrome.storage.sync.set({ [key]: box.checked }));
  }
});
