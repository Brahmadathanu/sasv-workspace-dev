/* eslint-env node */

function parseAttrs(raw) {
  const attrs = {};
  const source = String(raw || "");
  const re = /([:@A-Za-z_][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = re.exec(source))) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function createNode(tag, attrs) {
  const node = {
    tagName: String(tag || "").toUpperCase(),
    attrs: { ...attrs },
    children: [],
    parent: null,
    get id() {
      return this.attrs.id || "";
    },
    get className() {
      return this.attrs.class || "";
    },
    get type() {
      return this.attrs.type || "";
    },
    get hidden() {
      return Object.prototype.hasOwnProperty.call(this.attrs, "hidden");
    },
    get disabled() {
      return Object.prototype.hasOwnProperty.call(this.attrs, "disabled");
    },
    get multiple() {
      return Object.prototype.hasOwnProperty.call(this.attrs, "multiple");
    },
    get selected() {
      return Object.prototype.hasOwnProperty.call(this.attrs, "selected");
    },
    get checked() {
      return Object.prototype.hasOwnProperty.call(this.attrs, "checked");
    },
    get value() {
      if (this.tagName === "OPTION") return this.attrs.value == null ? this.textContent : this.attrs.value;
      return this.attrs.value || "";
    },
    set value(next) {
      throw new Error("extract must not assign input values");
    },
    get textContent() {
      if (this._text) return this._text;
      return this.children.map((child) => (typeof child === "string" ? child : child.textContent)).join("");
    },
    set textContent(next) {
      this._text = String(next || "");
      this.children = [];
    },
    get options() {
      return this.querySelectorAll("option");
    },
    get rows() {
      return this.querySelectorAll("tr");
    },
    get tBodies() {
      const bodies = this.querySelectorAll("tbody");
      if (bodies.length) return bodies;
      return [this];
    },
    get nextElementSibling() {
      if (!this.parent) return null;
      const els = this.parent.children.filter((child) => child && child.tagName);
      const index = els.indexOf(this);
      return index >= 0 ? els[index + 1] || null : null;
    },
    get form() {
      let current = this.parent;
      while (current) {
        if (current.tagName === "FORM") return current;
        current = current.parent;
      }
      return null;
    },
    getAttribute(name) {
      const key = Object.keys(this.attrs).find((item) => item.toLowerCase() === String(name).toLowerCase());
      return key ? this.attrs[key] : null;
    },
    closest(sel) {
      let current = this;
      while (current) {
        if (matches(current, sel)) return current;
        current = current.parent;
      }
      return null;
    },
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll(sel) {
      return collect(this, sel);
    },
    submit() {
      throw new Error("extract must not submit forms");
    },
  };
  return node;
}

function collect(root, selector) {
  const out = [];
  function inner(node) {
    if (!node || !node.tagName) return;
    if (node !== root && matches(node, selector)) out.push(node);
    for (const child of node.children || []) {
      if (child && child.tagName) inner(child);
    }
  }
  inner(root);
  return out;
}

function matches(node, selector) {
  const sel = String(selector || "").trim();
  if (!sel) return false;
  if (sel.includes(",")) return sel.split(",").some((part) => matches(node, part.trim()));
  const role = sel.match(/^\[role=['"]([^'"]+)['"]\]$/);
  if (role) return String(node.getAttribute("role") || "") === role[1];
  const typeSel = sel.match(/^([a-z0-9]+)\[type=['"]([^'"]+)['"]\]$/i);
  if (typeSel) {
    return node.tagName === typeSel[1].toUpperCase() && String(node.getAttribute("type") || "") === typeSel[2];
  }
  const forSel = sel.match(/^label\[for=['"]([^'"]+)['"]\]$/i);
  if (forSel) return node.tagName === "LABEL" && String(node.getAttribute("for") || "") === forSel[1];
  const nameSel = sel.match(/^\[name=['"]([^'"]+)['"]\]$/);
  if (nameSel) return String(node.getAttribute("name") || "") === nameSel[1];
  const nameTag = sel.match(/^([a-z0-9]+)\[name=['"]([^'"]+)['"]\]$/i);
  if (nameTag) {
    return node.tagName === nameTag[1].toUpperCase() && String(node.getAttribute("name") || "") === nameTag[2];
  }
  if (sel.startsWith("#")) return node.id === sel.slice(1).replace(/\\/g, "");
  if (/^[a-z0-9]+$/i.test(sel)) return node.tagName === sel.toUpperCase();
  return false;
}

function parseHtml(html) {
  const root = createNode("document", {});
  root.documentElement = root;
  const stack = [root];
  const voidTags = new Set(["INPUT", "BR", "HR", "IMG", "META", "LINK"]);
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z0-9:-]+)([^>]*)\/?>|([^<]+)/g;
  let match;
  while ((match = re.exec(String(html || "")))) {
    if (match[0].startsWith("<!--")) continue;
    if (match[3] != null) {
      const text = match[3];
      const parent = stack[stack.length - 1];
      parent.children.push(text);
      continue;
    }
    const tag = match[1];
    const closing = match[0].startsWith("</");
    const attrs = parseAttrs(match[2]);
    if (closing) {
      while (stack.length > 1 && stack[stack.length - 1].tagName !== tag.toUpperCase()) stack.pop();
      if (stack.length > 1) stack.pop();
      continue;
    }
    const node = createNode(tag, attrs);
    const parent = stack[stack.length - 1];
    node.parent = parent;
    parent.children.push(node);
    if (!voidTags.has(node.tagName) && !match[0].endsWith("/>")) stack.push(node);
  }
  const titleNode = collect(root, "title")[0];
  root.title = titleNode ? titleNode.textContent.trim() : "";
  root.querySelector = (sel) => collect(root, sel)[0] || null;
  root.querySelectorAll = (sel) => collect(root, sel);
  return root;
}

module.exports = {
  parseHtml,
};
