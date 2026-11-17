// The scripting interface for lesson pages. A page's own script finds parts of the lesson by
// their Word style names and attaches behaviour to them:
//
//   Page.Element("Key Point").Log();
//   Page.Section("Kidney Scene").Element("Key Point").Log();
//
// Element() finds elements in a paragraph, character, table or heading style. Section() finds
// the sections that begin with a heading in a heading style: the heading and everything up to
// the next heading of the same or a higher level.
//
// Every lookup returns a collection, which may be empty but is never null, so a chain always
// runs to the end. Actions apply to each member of a collection separately, and return the
// same collection so they can be chained.
//
// Everything below is private. Lesson scripts use only Page and the methods of the
// collections it returns. They never see the page's markup, which Pandoc generates, or the
// libraries this file uses.
//
// This is a module, so GSAP stays private to it: nothing it imports becomes a global. The
// page's own script is a module too, which runs after this one, once Page exists.

import { gsap } from "./vendor/gsap-3.15.1/index.js";
import { ScrollTrigger } from "./vendor/gsap-3.15.1/ScrollTrigger.js";

gsap.registerPlugin(ScrollTrigger);

// word.lua writes each element's exact Word style name to this attribute.
const STYLE = "data-word-style";

// Writes to the console with a prefix, so messages from the runtime are easy to spot.
const console_ = {
  log: (...args) => console.log("[Page]", ...args),
  warn: (...args) => console.warn("[Page]", ...args),
  error: (...args) => console.error("[Page]", ...args),
};

// Every element on the page in a Word style, in document order. Sections are listed
// separately from the elements inside them.
function styledNodes(sections) {
  return [...document.querySelectorAll(`[${STYLE}]`)].filter(
    (node) => (node.localName === "section") === sections
  );
}

function styleNames(sections) {
  return [...new Set(styledNodes(sections).map((node) => node.getAttribute(STYLE)))];
}

// One member of a collection: a part of the lesson in a named style. Its node stays private.
class Member {
  #node;

  // number: this member's position among everything on the page in the same style,
  // counting from 1. It names the member in messages, as in "Key Point #2".
  constructor(node, number) {
    this.#node = node;
    this.name = node.getAttribute(STYLE);
    this.number = number;
    Object.freeze(this);
  }

  get label() {
    return `${this.name} #${this.number}`;
  }

  contains(node) {
    return this.#node !== node && this.#node.contains(node);
  }

  // For messages only, so the browser's console can highlight the element.
  get node() {
    return this.#node;
  }
}

// Everything on the page in the named style, as members, in document order.
function membersNamed(name, sections) {
  return styledNodes(sections)
    .filter((node) => node.getAttribute(STYLE) === name)
    .map((node, index) => new Member(node, index + 1));
}

class Collection {
  #members;

  constructor(members) {
    this.#members = Object.freeze(members);
    Object.freeze(this);
  }

  // The number of members. Zero means the lookup found nothing.
  get length() {
    return this.#members.length;
  }

  // Elements in the named style inside any member of this collection.
  Element(name) {
    return find("Element", name, false, this.#members);
  }

  // Sections whose heading is in the named style, inside any member of this collection.
  Section(name) {
    return find("Section", name, true, this.#members);
  }

  // Writes each member to the console. For now this confirms what a lookup found; the
  // options will describe a scroll range.
  Log(options = {}) {
    if (this.#members.length === 0) {
      console_.log("Log: nothing to log");
    }
    for (const member of this.#members) {
      console_.log(`Log: ${member.label}`, options, member.node);
    }
    return this;
  }
}

// Finds everything in the named style. With a scope, keeps only what lies inside one of
// the scope's members; without one, searches the whole lesson.
function find(method, name, sections, scope) {
  if (typeof name !== "string") {
    console_.error(`${method}() needs a Word style name, such as ${method}("Key Point")`);
    return new Collection([]);
  }
  let members = membersNamed(name, sections);
  if (scope) {
    members = members.filter((candidate) =>
      scope.some((member) => member.contains(candidate.node))
    );
  }
  return new Collection(members);
}

// Lookups from Page search the whole lesson. If they find nothing, the style name is
// probably mistyped, so they warn and list the names that do exist. Lookups chained from a
// collection stay quiet, because finding nothing inside a section can be intended.
function lookup(method, name, sections) {
  const found = find(method, name, sections, null);
  if (found.length === 0 && typeof name === "string") {
    const names = styleNames(sections);
    console_.warn(
      `Page.${method}(${JSON.stringify(name)}) found nothing. ` +
        (names.length
          ? `Styles on this page: ${names.map((n) => JSON.stringify(n)).join(", ")}`
          : `This page has no ${sections ? "heading styles" : "styles"} to find.`)
    );
  }
  return found;
}

window.Page = Object.freeze({
  Element: (name) => lookup("Element", name, false),
  Section: (name) => lookup("Section", name, true),
});
