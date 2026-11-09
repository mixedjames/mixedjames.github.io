// Search on the home page, using Fuse.js (https://www.fusejs.io).
//
// Typing in the search box, not just focusing it, switches the page to its search view: the
// "searching" class on <main> hides the description and the list of lessons, and the results
// appear instead. Clearing the box, or pressing Escape, switches back.
//
// The index, search.json, is written by the build and fetched when someone first types. It
// covers each page's title, subtitle and keywords.

import Fuse from "./vendor/fuse-7.5.0/fuse.min.mjs";

const fuseOptions = {
  // Titles count most, then keywords, then subtitles.
  keys: [
    { name: "titleText", weight: 2 },
    { name: "keywords", weight: 1.5 },
    { name: "subtitleText", weight: 1 },
  ],
  ignoreLocation: true, // A word can match anywhere in a field.
  ignoreFieldNorm: true, // Matches in long fields count as much as in short ones.
  ignoreDiacritics: true, // "cafe" finds "café".
  threshold: 0.4, // How loose a match may be, from 0 (exact) to 1 (anything).
  minMatchCharLength: 2,
  includeScore: true,
};

// Fuse scores run from 0 (perfect) to 1. Weaker matches than this are dropped.
const cutoff = 0.5;

const main = document.querySelector("main.home");
const form = document.querySelector(".search");
const input = document.querySelector("#search-input");
const results = document.querySelector(".search-results");
const status = results.querySelector(".search-status");
const list = results.querySelector(".page-list");
const resultTemplate = document.querySelector("#search-result");

// Page addresses in the index are relative to the index itself.
const indexUrl = new URL(form.dataset.index, document.baseURI);

// The loaded index, as a promise of { pages, fuse }. Loaded once, when first needed.
let index = null;

function loadIndex() {
  index ??= fetch(indexUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`${indexUrl} returned ${response.status}`);
      return response.json();
    })
    .then((pages) => ({ pages, fuse: new Fuse(pages, fuseOptions) }));
  return index;
}

// Every word must match somewhere in a page, though different words can match different
// fields. Pages are ranked by their average score; equal scores keep the index's order, which
// is newest first.
function search(fuse, pages, query) {
  const words = query.split(/\s+/);
  let scores = null; // Page number to total score, for pages that every word so far matched.

  for (const word of words) {
    const matches = new Map();
    for (const result of fuse.search(word)) {
      if (result.score <= cutoff) matches.set(result.refIndex, result.score);
    }
    if (scores === null) {
      scores = matches;
    } else {
      for (const [page, score] of scores) {
        if (matches.has(page)) scores.set(page, score + matches.get(page));
        else scores.delete(page);
      }
    }
  }

  return [...scores]
    .map(([page, total]) => ({ page, score: total / words.length }))
    .sort((a, b) => a.score - b.score || a.page - b.page)
    .map((result) => pages[result.page]);
}

// Fills in a copy of the search result template. Titles and subtitles are HTML written by the
// build from the Word documents, so that styled text appears as it does on the page.
function resultItem(page) {
  const item = resultTemplate.content.firstElementChild.cloneNode(true);
  item.querySelector("a").href = new URL(page.url, indexUrl);
  item.querySelector(".page-list-title").innerHTML = page.title;

  const subtitle = item.querySelector(".page-list-subtitle");
  if (page.subtitle) subtitle.innerHTML = page.subtitle;
  else subtitle.remove();

  const time = item.querySelector("time");
  if (page.dateText) {
    time.dateTime = page.date;
    time.textContent = page.dateText;
  } else {
    time.remove();
  }
  return item;
}

function describe(count, query) {
  if (count === 0) return `No lessons match “${query}”.`;
  return count === 1 ? "1 lesson" : `${count} lessons`;
}

// Each update is numbered, so that a slow first load can't overwrite a later query's results.
let latest = 0;

async function update() {
  const run = ++latest;
  const query = input.value.trim();
  const searching = query !== "";
  main.classList.toggle("searching", searching);
  results.hidden = !searching;
  if (!searching) return;

  try {
    const { pages, fuse } = await loadIndex();
    if (run !== latest) return;
    const found = search(fuse, pages, query);
    status.textContent = describe(found.length, query);
    list.replaceChildren(...found.map(resultItem));
  } catch (error) {
    if (run !== latest) return;
    index = null; // Try again on the next keystroke.
    status.textContent = "Search isn’t available at the moment.";
    list.replaceChildren();
    console.error(error);
  }
}

input.addEventListener("input", update);

input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    input.value = "";
    update();
  }
});

// Pressing Enter or Search closes the phone keyboard, so that the results can be seen.
form.addEventListener("submit", (event) => {
  event.preventDefault();
  input.blur();
});

// Coming back to the page, the browser may restore the text in the search box.
window.addEventListener("pageshow", update);

form.hidden = false;
