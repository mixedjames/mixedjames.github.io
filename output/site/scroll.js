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
// Actions that follow scrolling use a trigger: a stretch of scrolling with a start and an end.
// Each end pairs an edge of an anchor element (e) with a line across the viewport (v), in
// either order:
//
//   const scene = Page.Trigger({
//     start: { anchor: Page.Element("Kidney Diagram"), edges: "etop vtop" },
//     end: { anchor: Page.Section("Kidney Scene"), edges: "ebottom vbottom" },
//   });
//   scene.Log();
//
// That trigger starts when the diagram's top reaches the top of the viewport, and ends when
// the scene's bottom reaches the bottom. Edges and lines are top, center, bottom or a
// percentage, such as e25% or v80%. An anchor must be a lookup that found exactly one element.
// Anything else is an error, and the trigger never fires, so the rest of the script still runs.
//
// Actions on a collection take the same shape, but the anchor is optional and defaults to each
// member in turn. A string is short for { edges: ... }:
//
//   Page.Element("Key Point").Log({ start: "etop vbottom", end: "ebottom vtop" });
//
// Pin() holds an element still on screen for a trigger's range, over the page, which scrolls
// beneath it. It never pushes later content down:
//
//   Page.Element("Kidney Diagram").Pin(scene);
//
// The default edges are "etop vcenter" to "ebottom vcenter": while the middle of the viewport
// is over the anchor.
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

// Marks an element this runtime pins. site.css styles it.
const PINNED = "data-page-pin";

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

// Trigger ends

const DEFAULT_EDGES = Object.freeze({ start: "etop vcenter", end: "ebottom vcenter" });
const POINT_WORD = /^([ev])(top|center|bottom|\d+(?:\.\d+)?%)$/;
const END_KEYS = ["anchor", "edges"];

// Turns edges such as "etop vbottom" into ScrollTrigger's form, "top bottom": the element's
// edge, then the viewport's. Returns null if they aren't one e word and one v word.
function parseEdges(text) {
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

// Reads one end of a trigger: a string of edges, or { anchor, edges }. Returns
//
//   { member, edges, text }   member: the anchor, or null to use the collection's member
//                             edges: in ScrollTrigger's form; text: the page's own words
//
// or null if the end can't be used, which makes the trigger inert. who names the trigger or
// action in messages. anchored says whether an anchor is required, as it is in Page.Trigger().
function parseEnd(who, which, value, anchored) {
  if (value === undefined || typeof value === "string") {
    value = { edges: value };
  } else if (value instanceof Collection) {
    console_.error(
      `${who}: ${which} takes { anchor, edges }, not a lookup on its own, such as ` +
        `{ anchor: Page.Element("Key Point"), edges: "etop vbottom" }, so it never fires`
    );
    return null;
  } else if (value === null || typeof value !== "object") {
    console_.error(
      `${who}: ${which} takes edges such as "etop vbottom", or { anchor, edges }, so it never fires`
    );
    return null;
  }
  for (const key of Object.keys(value)) {
    if (!END_KEYS.includes(key)) {
      console_.warn(`${who}: unknown option ${JSON.stringify(key)} in ${which}, ignored`);
    }
  }

  let member = null;
  if (value.anchor === undefined) {
    if (anchored) {
      console_.error(
        `${who}: ${which} needs an anchor, such as { anchor: Page.Element("Key Point") }, ` +
          `so it never fires`
      );
      return null;
    }
  } else if (!(value.anchor instanceof Collection)) {
    console_.error(
      `${who}: the ${which} anchor must be a lookup, such as Page.Element("Key Point"), ` +
        `so it never fires`
    );
    return null;
  } else {
    const members = membersOf(value.anchor);
    if (members.length !== 1) {
      const found =
        members.length === 0
          ? "found nothing"
          : `found ${members.length} elements (${members.map((m) => m.label).join(", ")}); ` +
            `narrow it with Section()`;
      console_.error(
        `${who}: the ${which} anchor must be one element, but ${found}, so it never fires`
      );
      return null;
    }
    member = members[0];
  }

  let text = value.edges ?? DEFAULT_EDGES[which];
  let edges = parseEdges(text);
  if (!edges) {
    console_.error(
      `${who}: ${which} edges ${JSON.stringify(text)} need one element edge and one viewport ` +
        `line, such as "etop vbottom"; using the default ${JSON.stringify(DEFAULT_EDGES[which])}`
    );
    text = DEFAULT_EDGES[which];
    edges = parseEdges(text);
  }
  return { member, edges, text };
}

// Reads both ends of a trigger from an action's options. Returns { start, end }, or null if
// either end can't be used. Both ends are read first, so every mistake is reported at once.
function parseEnds(who, options, anchored) {
  if (options === null || typeof options !== "object" || options instanceof Collection) {
    console_.error(`${who}: takes options such as { start: ..., end: ... }`);
    options = {};
  }
  for (const key of Object.keys(options)) {
    if (!(key in DEFAULT_EDGES)) {
      console_.warn(`${who}: unknown option ${JSON.stringify(key)}, ignored`);
    }
  }
  const start = parseEnd(who, "start", options.start, anchored);
  const end = parseEnd(who, "end", options.end, anchored);
  return start && end ? { start, end } : null;
}

// Watching

const BEFORE = 0;
const ACTIVE = 1;
const AFTER = 2;

// Follows the reader through a trigger's range and calls the handlers:
//
//   enter(direction), leave(direction)   direction is "down" or "up"
//   progress(value)                      from 0 at the start of the range to 1 at the end
//
// The reader is before, in or after the range. Events are worked out from the change in
// state, so a jump straight past the range, by a link or a fast flick, still reports enter,
// progress and leave, in that order. A range that ends where it starts, or before, is a
// single point: crossing it reports all three at once.
//
// Near the end of a page, a range may start or end beyond the furthest the page can scroll.
// It then never starts, or never finishes, and warn() says so.
//
// extra holds further ScrollTrigger options, such as the element to pin.
function watch(label, ends, handlers, warn, extra = {}) {
  let state = BEFORE;

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
    trigger: ends.start.member.node,
    start: ends.start.edges,
    endTrigger: ends.end.member.node,
    end: ends.end.edges,
    markers: DEBUG,
    id: DEBUG ? label : undefined,
    ...extra,
    onUpdate: (trigger) => update(trigger.progress),
    onRefresh: (trigger) => {
      const furthest = ScrollTrigger.maxScroll(window);
      // ScrollTrigger moves the end of a backwards range to a hundredth of a pixel past its start.
      if (trigger.end - trigger.start < 1) {
        warn("the range ends where it starts, or before, so it is a single point");
      }
      if (trigger.start > furthest) {
        warn("the page ends before the range starts, so it never starts at this size");
      } else if (trigger.end > furthest) {
        warn("the page ends before the range ends, so it never finishes at this size");
      }
      update(trigger.progress);
    },
  });
}

// Triggers

let triggerCount = 0;

// Read a trigger's ends and give its warnings, which are private to it. Set by Trigger's
// static block, so they stay inside this module.
let endsOf;
let warnerOf;

// A stretch of scrolling, from one anchor's edge crossing a viewport line to another's. An
// inert trigger, whose ends couldn't be used, accepts every action and never fires; the
// mistake was reported when it was made.
class Trigger {
  #label;
  #ends;
  #own;
  #warned = new Set();

  static {
    endsOf = (trigger) => trigger.#ends;
    warnerOf = (trigger) => (message) => trigger.#warn(message);
  }

  // label names the trigger in messages. ends is from parseEnds(), or null for an inert
  // trigger. own is the collection member the trigger belongs to, if any: an end anchored on
  // it isn't named again in messages.
  constructor(label, ends, own = null) {
    this.#label = label;
    this.#ends = ends;
    this.#own = own;
    Object.freeze(this);
  }

  // Warns once about each problem, however many actions use the trigger.
  #warn(message) {
    if (!this.#warned.has(message)) {
      this.#warned.add(message);
      console_.warn(`${this.#label}: ${message}`);
    }
  }

  // Describes one end for messages, as in "etop vtop" of Kidney Diagram #1.
  #describe(end) {
    const text = JSON.stringify(end.text);
    return end.member === this.#own ? text : `${text} of ${end.member.label}`;
  }

  // Writes the reader's progress through the range to the console: when it enters and
  // leaves, which way the reader was scrolling, and its progress in tenths.
  Log() {
    if (!this.#ends) {
      return this;
    }
    const { start, end } = this.#ends;
    const nodes = [start.member.node];
    if (end.member !== start.member) {
      nodes.push(end.member.node);
    }
    console_.log(
      `Log: ${this.#label}, from ${this.#describe(start)} to ${this.#describe(end)}`,
      ...nodes
    );
    let tenths = null;
    watch(
      this.#label,
      this.#ends,
      {
        enter: (direction) => console_.log(`${this.#label}: enter, scrolling ${direction}`),
        leave: (direction) => console_.log(`${this.#label}: leave, scrolling ${direction}`),
        progress: (value) => {
          const now = Math.floor(value * 10);
          if (now !== tenths) {
            tenths = now;
            console_.log(`${this.#label}: progress ${(now / 10).toFixed(1)}`);
          }
        },
      },
      (message) => this.#warn(message)
    );
    return this;
  }
}

// Collections

// Reads a collection's members, which are private to it. Set by Collection's static block,
// so it stays inside this module.
let membersOf;

class Collection {
  #members;

  static {
    membersOf = (collection) => collection.#members;
  }

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

  // Gives each member its own trigger, anchored on the member unless an end names another
  // anchor, and returns the triggers. Returns none if the options can't be used.
  #triggers(action, options) {
    const ends = parseEnds(`${action}()`, options, false);
    if (!ends) {
      return [];
    }
    if (this.#members.length === 0) {
      console_.log(`${action}: nothing to ${action.toLowerCase()}`);
    }
    const anchor = (end, member) => ({ ...end, member: end.member ?? member });
    return this.#members.map((member) => {
      const own = { start: anchor(ends.start, member), end: anchor(ends.end, member) };
      return new Trigger(member.label, own, member);
    });
  }

  // Holds each member still on screen for its trigger's range: it stays where it was when the
  // range started, over the page, which scrolls beneath it, and scrolls on with the page when
  // the range ends. It never pushes later content down. Takes a trigger made by
  // Page.Trigger(), or { start, end } as for Log().
  //
  // Only elements in a paragraph or table style can be pinned. A section is usually taller
  // than the screen, and pinning one breaks the text column; a character style is part of a
  // line of text. A trigger from Page.Trigger() can pin one element only, since several would
  // be held on top of each other.
  Pin(options = {}) {
    let triggers;
    if (options instanceof Trigger) {
      if (this.#members.length > 1) {
        const labels = this.#members.map((m) => m.label).join(", ");
        console_.error(
          `Pin(): one trigger can pin one element, but this collection has ` +
            `${this.#members.length} (${labels}), so nothing is pinned. Narrow it with ` +
            `Section(), or pass { start, end } to give each its own trigger`
        );
        return this;
      }
      triggers = this.#members.map(() => options);
    } else {
      triggers = this.#triggers("Pin", options);
    }
    triggers.forEach((trigger, i) => {
      const member = this.#members[i];
      const ends = endsOf(trigger);
      if (!ends) {
        return;
      }
      if (member.node.localName === "section" || member.node.localName === "span") {
        const kind = member.node.localName === "section" ? "a section" : "a character style";
        console_.error(
          `Pin(): ${member.label} is ${kind}, which can't be pinned, so it isn't. ` +
            `Pin an element in a paragraph style instead`
        );
        return;
      }
      // site.css makes a pinned element contain its children's margins. GSAP fixes its height,
      // so margins that collapsed through it would otherwise be lost, moving what follows.
      // Set before GSAP measures it.
      member.node.setAttribute(PINNED, "");
      const quiet = { enter() {}, leave() {}, progress() {} };
      watch(`Pin ${member.label}`, ends, quiet, warnerOf(trigger), {
        pin: member.node,
        pinSpacing: false,
      });
    });
    return this;
  }

  // Writes each member's progress through its trigger to the console. See Trigger.Log().
  Log(options = {}) {
    for (const trigger of this.#triggers("Log", options)) {
      trigger.Log();
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

// A trigger with an anchor on each end. Triggers are numbered in the order the script makes
// them, as in "Trigger #1", to name them in messages.
function makeTrigger(options) {
  const label = `Trigger #${++triggerCount}`;
  return new Trigger(label, parseEnds(label, options, true));
}

window.Page = Object.freeze({
  Element: (name) => lookup("Element", name, false),
  Section: (name) => lookup("Section", name, true),
  Trigger: makeTrigger,
});
