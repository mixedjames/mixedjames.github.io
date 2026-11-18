// Temporary demo of Pin(): the diagram is held at the top of the screen from when it reaches
// the top until the end of the scene reaches the bottom.

const diagram = Page.Element("Diagram");

const scene = Page.Trigger({
  start: { anchor: diagram, edges: "etop vtop" },
  end: { anchor: Page.Section("Kidney Scene"), edges: "ebottom vbottom" },
});

diagram.Pin(scene);
scene.Log();
