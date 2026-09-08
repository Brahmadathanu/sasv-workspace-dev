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
    get required() {
      return Object.prototype.hasOwnProperty.call(this.attrs, "required");
    },
    get readOnly() {
      return Object.prototype.hasOwnProperty.call(this.attrs, "readonly");
    },
    get willValidate() {
      const tag = this.tagName;
      if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") {
        return this.disabled !== true;
      }
      return false;
    },
    get validity() {
      const missing =
        this.required === true &&
        (this.tagName === "SELECT"
          ? String(this.value || "") === ""
          : String(this.value || "") === "");
      return {
        valid: !missing,
        valueMissing: missing,
        customError: false,
        badInput: false,
        patternMismatch: false,
        rangeOverflow: false,
        rangeUnderflow: false,
        stepMismatch: false,
        tooLong: false,
        tooShort: false,
        typeMismatch: false,
      };
    },
    get selectedIndex() {
      if (this.tagName !== "SELECT") return -1;
      const opts = this.options;
      const selected = opts.findIndex((opt) => opt.selected === true);
      if (selected >= 0) return selected;
      return opts.length ? 0 : -1;
    },
    set selectedIndex(_next) {
      throw new Error("extract must not assign selectedIndex");
    },
    get dataset() {
      const out = {};
      for (const [key, value] of Object.entries(this.attrs)) {
        if (!/^data-/i.test(key)) continue;
        const name = key
          .slice(5)
          .replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        out[name] = value;
      }
      return out;
    },
    get attributes() {
      return Object.entries(this.attrs).map(([name, value]) => ({ name, value }));
    },
    get parentElement() {
      return this.parent && this.parent.tagName ? this.parent : null;
    },
    get offsetParent() {
      return this.parentElement;
    },
    getClientRects() {
      return [{ width: 1, height: 1 }];
    },
    get value() {
      if (this.tagName === "OPTION") return this.attrs.value == null ? this.textContent : this.attrs.value;
      if (this.tagName === "SELECT") {
        const opts = this.options;
        const index = this.selectedIndex;
        if (index < 0 || !opts[index]) return "";
        return opts[index].value;
      }
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
    checkValidity() {
      throw new Error("extract must not call checkValidity");
    },
    reportValidity() {
      throw new Error("extract must not call reportValidity");
    },
  };

  if (Object.prototype.hasOwnProperty.call(attrs, "onclick")) {
    const onclickSrc = String(attrs.onclick || "");
    if (/\bSaveData\s*\(\s*\)/.test(onclickSrc) && !/\.\s*SaveData\s*\(/.test(onclickSrc)) {
      // Mirror the live portal wrapper shape so Function#toString exposes SaveData().
      node.onclick = function () {
        globalThis.__EA_CAPTURE_HANDLER_FIRED = true;
        if (typeof globalThis.SaveData === "function") {
          return globalThis.SaveData();
        }
        return undefined;
      };
    } else {
      node.onclick = function fixtureOnClickHandler() {
        globalThis.__EA_CAPTURE_HANDLER_FIRED = true;
      };
    }
  }

  return node;
}

/**
 * Install a read-only-inspectable SaveData fixture for legacy Add Product smokes.
 * Calling SaveData sets __EA_SAVEDATA_INVOKED — capture must leave that false.
 */
function installSaveDataFixture() {
  globalThis.__EA_SAVEDATA_INVOKED = false;
  globalThis.SaveData = function SaveData() {
    globalThis.__EA_SAVEDATA_INVOKED = true;
    // Direct subtype-to--1 + rejection messaging (explicit candidate).
    if (document.getElementById("subTypeId").value === "-1") {
      return "Please Select Sub Type";
    }
    // jQuery form.
    if ($("#subTypeId").val() == "-1") {
      return false;
    }
    // Reversed operand order.
    if ("-1" === document.getElementById("subTypeId").value) {
      return "blank";
    }
    // Negative: subtype ref present + unrelated field compared to "-1".
    var subtype = document.getElementById("subTypeId");
    if (otherField == "-1") {
      return subtype;
    }
    // Generic Sub Type* / required wording without a subtype-to--1 comparison.
    var labelHint = "Sub Type* is required when category is selected";
    // Planted secret in an unrelated region — must not survive sanitized snippets.
    var deadCodeMarker = "bearer PLANTED_SAVEDATA_SECRET_SHOULD_NOT_PERSIST unused";
    return labelHint || deadCodeMarker || true;
  };
}

function uninstallSaveDataFixture() {
  try {
    delete globalThis.SaveData;
  } catch {
    globalThis.SaveData = undefined;
  }
  globalThis.__EA_SAVEDATA_INVOKED = false;
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
  if (sel.startsWith(".")) {
    const cls = sel.slice(1);
    return String(node.className || "")
      .split(/\s+/)
      .includes(cls);
  }
  if (/^[a-z0-9]+$/i.test(sel)) return node.tagName === sel.toUpperCase();
  // Simple descendant-friendly tag lists like "span, div, p"
  if (sel.includes("[") && sel.includes("]")) {
    // unsupported complex selectors fall through
  }
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
  root.getElementById = (id) => collect(root, `#${String(id || "")}`)[0] || null;
  Object.defineProperty(root, "scripts", {
    get() {
      return collect(root, "script");
    },
  });
  return root;
}

module.exports = {
  parseHtml,
  installSaveDataFixture,
  uninstallSaveDataFixture,
};
