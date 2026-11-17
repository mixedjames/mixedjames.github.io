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
// Actions that follow scrolling take a range. Each end of the range pairs an edge of the
// element (e) with a line across the viewport (v), in either order:
//
//   Page.Element("Key Point").Log({ start: "etop vbottom", end: "ebottom vtop" });
//
// That range starts when the element's top reaches the bottom of the viewport, and ends when
// its bottom reaches the top. Edges and lines are top, center, bottom or a percentage, such as
// e25% or v80%. The default is { start: "etop vcenter", end: "ebottom vcenter" }: the range
// in which the middle of the viewport is over the element.
//
// Add ?scrolldebug to the address to mark every range on the page.
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

// ?scrolldebug in the address shows ScrollTrigger's markers for every range.
const DEBUG = new URLSearchParams(location.search).has("scrolldebug");

// Fonts change the height of the text, so every range is measured again once they load.
// ScrollTrigger itself measures again when the page loads and when it is resized.
document.fonts.ready.then(() => ScrollTrigger.refresh());

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

// Ranges

const DEFAULT_RANGE = Object.freeze({ start: "etop vcenter", end: "ebottom vcenter" });
const POINT_WORD = /^([ev])(top|center|bottom|\d+(?:\.\d+)?%)$/;

// Turns one end of a range, such as "etop vbottom", into ScrollTrigger's form, "top bottom":
// the element's edge, then the viewport's. Returns null if it isn't one e word and one v word.
function parsePoint(text) {
  if (typeof text !== "string") {
    return null;
  }
  const point = {};
  for (const word of text.trim().split(/\s+/)) {
    const match = POINT_WORD.exec(word);
    if (!match || point[match[1]]) {
      return null;
    }
    point[match[1]] = match[2];
  }
  return point.e && point.v ? `${point.e} ${point.v}` : null;
}

// Reads the range from an action's options. Mistakes are reported, and the default is used
// for that end, so the rest of the page script still runs.
function parseRange(action, options) {
  if (options === null || typeof options !== "object") {
    console_.error(`${action}() takes options such as { start: "etop vbottom" }; using the defaults`);
    options = {};
  }
  for (const key of Object.keys(options)) {
    if (!(key in DEFAULT_RANGE)) {
      console_.warn(`${action}(): unknown option ${JSON.stringify(key)}, ignored`);
    }
  }
  // start and end are in ScrollTrigger's form; text keeps the page's own words, for messages.
  const range = { text: {} };
  for (const end of ["start", "end"]) {
    let text = options[end] ?? DEFAULT_RANGE[end];
    range[end] = parsePoint(text);
    if (!range[end]) {
      console_.error(
        `${action}(): ${end} ${JSON.stringify(text)} needs one element edge and one viewport ` +
          `line, such as "etop vbottom"; using the default ${JSON.stringify(DEFAULT_RANGE[end])}`
      );
      text = DEFAULT_RANGE[end];
      range[end] = parsePoint(text);
    }
    range.text[end] = text;
  }
  return range;
}

// Watching

const BEFORE = 0;
const ACTIVE = 1;
const AFTER = 2;

// Follows one member through a range and calls the handlers:
//
//   enter(direction), leave(direction)   direction is "down" or "up"
//   progress(value)                      from 0 at the start of the range to 1 at the end
//
// The member is before, in or after its range. Events are worked out from the change in
// state, so a jump straight past the range, by a link or a fast flick, still reports enter,
// progress and leave, in that order. A range that ends where it starts, or before, is a
// single point: crossing it reports all three at once.
//
// Near the end of a page, a range may start or end beyond the furthest the page can scroll.
// It then never starts, or never finishes, and the console says so.
function watch(member, range, handlers) {
  let state = BEFORE;
  const warned = new Set();
  const warnOnce = (message) => {
    if (!warned.has(message)) {
      warned.add(message);
      console_.warn(`${member.label}: ${message}`);
    }
  };

  const update = (value) => {
    const next = value <= 0 ? BEFORE : value >= 1 ? AFTER : ACTIVE;
    if (next === state && next !== ACTIVE) {
      return;
    }
    const direction = next > state ? "down" : "up";
    if (state !== ACTIVE && next !== state) {
      handlers.enter(direction);
    }
    handlers.progress(value);
    if (next !== ACTIVE && next !== state) {
      handlers.leave(direction);
    }
    state = next;
  };

  ScrollTrigger.create({
    trigger: member.node,
    start: range.start,
    end: range.end,
    markers: DEBUG,
    id: DEBUG ? member.label : undefined,
    onUpdate: (trigger) => update(trigger.progress),
    onRefresh: (trigger) => {
      const furthest = ScrollTrigger.maxScroll(window);
      // ScrollTrigger moves the end of a backwards range to a hundredth of a pixel past its start.
      if (trigger.end - trigger.start < 1) {
        warnOnce("the range ends where it starts, so it is a single point");
      }
      if (trigger.start > furthest) {
        warnOnce("the page ends before the range starts, so it never starts at this size");
      } else if (trigger.end > furthest) {
        warnOnce("the page ends before the range ends, so it never finishes at this size");
      }
      update(trigger.progress);
    },
  });
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

  // Writes each member's progress through a range to the console: when it enters and
  // leaves, which way the reader was scrolling, and its progress in tenths.
  Log(options = {}) {
    const range = parseRange("Log", options);
    if (this.#members.length === 0) {
      console_.log("Log: nothing to log");
    }
    for (const member of this.#members) {
      console_.log(
        `Log: ${member.label}, from "${range.text.start}" to "${range.text.end}"`,
        member.node
      );
      let tenths = null;
      watch(member, range, {
        enter: (direction) => console_.log(`${member.label}: enter, scrolling ${direction}`),
        leave: (direction) => console_.log(`${member.label}: leave, scrolling ${direction}`),
        progress: (value) => {
          const now = Math.floor(value * 10);
          if (now !== tenths) {
            tenths = now;
            console_.log(`${member.label}: progress ${(now / 10).toFixed(1)}`);
          }
        },
      });
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
