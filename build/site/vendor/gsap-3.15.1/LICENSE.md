# GSAP 3.15.1

These files are GSAP's ES modules, copied unchanged from the npm package `gsap@3.15.1`
(<https://registry.npmjs.org/gsap/-/gsap-3.15.1.tgz>). Only the modules that ScrollTrigger needs
are included: `index.js`, `gsap-core.js`, `CSSPlugin.js`, `ScrollTrigger.js` and `Observer.js`.

Copyright 2008–2026, GreenSock. All rights reserved.

GSAP is used under GreenSock's standard "no charge" licence, owned by Webflow:
<https://gsap.com/standard-license>. The package includes no licence file of its own; each file
refers to that page. The terms forbid removing or altering the copyright notices in the files,
so they are kept exactly as published.

Only `build/site/scroll.js` imports these files. Lesson scripts use the `Page` interface and
never GSAP directly.
