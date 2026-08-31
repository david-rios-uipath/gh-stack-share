const checkbox = document.getElementById("include-trunk");

chrome.storage.sync.get({ includeTrunk: true }, ({ includeTrunk }) => {
  checkbox.checked = includeTrunk;
});

checkbox.addEventListener("change", () => {
  chrome.storage.sync.set({ includeTrunk: checkbox.checked });
});
