// Prints a few simple results from the Page runtime to the browser's console.

console.log("Page:", Page);

const section = Page.Section("heading1-marker-1");
console.log('Page.Section("heading1-marker-1"):', section, "length", section.length);

const para = Page.Element("My fancy para style");
console.log('Page.Element("My fancy para style"):', para, "length", para.length);

section.Log();
