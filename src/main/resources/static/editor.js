let root = null;

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "value") e.value = v;
    else if (k === "onclick") e.onclick = v;
    else e.setAttribute(k, v);
  });
  children.forEach((c) => e.appendChild(c));
  return e;
}

function isListItem(node, parent) {
  return !!getRuleIfListItem(node, parent);
}

function isProtectedParentTag(tag) {
  // Add any other “container/parent” tags you want to protect
  const PROTECTED = new Set([
    "Model",
    "Textures",
    "LODs",
    "Lights",
    "Effects",
    "GroundSupportPoints",
    "ArticulatedParts",
    "Attachments",
    "Cameras",
    "ModelConfiguration" // root/container (optional but recommended)
  ]);
  return PROTECTED.has(tag);
}

function walkTree(node, path, fn) {
  if (!node) return;
  fn(node, path);
  if (node.children && node.children.length > 0) {
    node.children.forEach((ch, i) => walkTree(ch, path.concat(i), fn));
  }
}

function collapseAllNodes() {
  collapsedChildren.clear();
  collapsedDetails.clear();

  walkTree(root, [], (node, path) => {
    // collapse any node with children
    if (node.children && node.children.length > 0) {
      collapsedChildren.add(pathKey(path));
    }

    // collapse details for list items (Texture/LOD/Light/Effect/Point/Attach/ArticulatedPart/Camera)
    const parent = getParentByPath(path);
    const rule = getRuleIfListItem(node, parent);
    if (rule) {
      collapsedDetails.add(pathKey(path));
    }
  });
}



// ------------------------------------------------------------
// Domain rules: attribute-only list containers + fixed fields
// ------------------------------------------------------------
const LIST_RULES = {
  Textures: { itemTag: "Texture", allowedAttrs: ["id", "country_id", "name"], forceAttributesOnly: true },
  LODs: { itemTag: "LOD", allowedAttrs: ["id", "Name", "Value"], forceAttributesOnly: true },
  Lights: { itemTag: "Light", allowedAttrs: ["id", "RefNode", "vfx"], forceAttributesOnly: true },
  Effects: { itemTag: "Effect", allowedAttrs: ["type", "vfx", "RefNode", "event", "sound"], forceAttributesOnly: true },
  GroundSupportPoints: { itemTag: "Point", allowedAttrs: ["id", "RefNode"], forceAttributesOnly: true },
  Attachments: { itemTag: "Attach", allowedAttrs: ["id", "RefNode", "PartNo", "StationNo", "Orientation"], forceAttributesOnly: true },
  ArticulatedParts: {
    itemTag: "ArticulatedPart",
    allowedAttrs: ["id", "category", "state", "type", "RefNodes", "animationSeq", "sound"],
    forceAttributesOnly: false
  },

  // ✅ NEW
  Cameras: { itemTag: "Camera", allowedAttrs: ["id"], forceAttributesOnly: false }
};
const CAMERA_CHILD_TAGS = [
  "Title","Description","Origin","AllowZoom","InitialZoom","ZoomFactor",
  "InitialXyz","InitialOrientation","ShowLensFlare","Category","CameraType"
];




function createNewItem(rule) {
  const attrs = {};
  rule.allowedAttrs.forEach((k) => (attrs[k] = ""));

  // ✅ Special template for Camera
  if (rule.itemTag === "Camera") {
    return {
      tag: "Camera",
      attributes: attrs,     // only id
      text: null,
      children: CAMERA_CHILD_TAGS.map(t => ({
        tag: t,
        attributes: {},
        text: "",
        children: []
      }))
    };
  }

  // default behavior
  return { tag: rule.itemTag, attributes: attrs, text: null, children: [] };
}
function isListContainer(node) {
  return !!(node && LIST_RULES[node.tag]);
}

function getListRuleForContainerTag(containerTag) {
  return LIST_RULES[containerTag] || null;
}

function isUnderModel(path) {
  // true if this node OR any ancestor is <Model>
  let p = path.slice();
  while (p.length > 0) {
    const n = getNodeByPath(p);
    if (n && n.tag === "Model") return true;
    p = p.slice(0, -1);
  }
  // also handle root itself
  if (path.length === 0 && root && root.tag === "Model") return true;
  return false;
}


function isUnderAnyTag(path, tagNames) {
  // true if this node OR any ancestor has tag in tagNames
  let p = path.slice();
  while (p.length > 0) {
    const n = getNodeByPath(p);
    if (n && tagNames.includes(n.tag)) return true;
    p = p.slice(0, -1);
  }
  // include root node as well
  if (path.length === 0 && root && tagNames.includes(root.tag)) return true;
  return false;
}

// Adjust tag names here if your XML uses Camera / Cameras differently
function isUnderCamera(path) {
  return isUnderAnyTag(path, ["Camera", "Cameras"]);
}

function getRuleIfListItem(node, parent) {
  if (!node || !parent) return null;
  const rule = getListRuleForContainerTag(parent.tag);
  if (!rule) return null;
  if (node.tag !== rule.itemTag) return null;
  return rule;
}

function normalizeItemNode(node, rule) {
  if (!node.attributes) node.attributes = {};

  // Keep only allowed attrs and ensure they exist
  const attrs = node.attributes || {};
  const cleaned = {};
  rule.allowedAttrs.forEach((k) => {
    cleaned[k] = attrs[k] !== undefined ? attrs[k] : "";
  });
  node.attributes = cleaned;

  // Enforce attributes-only where required
  if (rule.forceAttributesOnly) {
    node.children = [];
    node.text = null;
  } else {
    // if it has children, it shouldn't use text
    if (node.children && node.children.length > 0) node.text = null;
  }
}


// ------------------------------------------------------------
// Collapse/Expand State
// - two kinds:
//   1) tree collapse (children visibility) for nodes with children
//   2) details collapse (attribute panel visibility) for list items
// ------------------------------------------------------------
const collapsedChildren = new Set(); // hide child nodes
const collapsedDetails = new Set();  // hide attribute inputs for list items

function pathKey(path) {
  return path.length === 0 ? "root" : path.join(".");
}

function isChildrenCollapsed(path) {
  return collapsedChildren.has(pathKey(path));
}

function toggleChildrenCollapsed(path) {
  const k = pathKey(path);
  if (collapsedChildren.has(k)) collapsedChildren.delete(k);
  else collapsedChildren.add(k);
}

function isDetailsCollapsed(path) {
  return collapsedDetails.has(pathKey(path));
}

function toggleDetailsCollapsed(path) {
  const k = pathKey(path);
  if (collapsedDetails.has(k)) collapsedDetails.delete(k);
  else collapsedDetails.add(k);
}

function resetCollapseState() {
  collapsedChildren.clear();
  collapsedDetails.clear();
}

// ------------------------------------------------------------
// tree helpers (path addressing)
// ------------------------------------------------------------
function getNodeByPath(path) {
  let n = root;
  for (const idx of path) n = n.children[idx];
  return n;
}

function getParentByPath(path) {
  if (path.length === 0) return null;
  return getNodeByPath(path.slice(0, -1));
}
function remapCollapseSetAfterDelete(set, parentPath, deletedIdx) {
  const parentKey = pathKey(parentPath);
  const prefix = parentKey === "root" ? "" : parentKey + ".";

  const newSet = new Set();

  for (const key of set) {
    if (key === "root") {
      newSet.add(key);
      continue;
    }

    const parts = key.split(".");
    const ints = parts.map(p => parseInt(p, 10));

    // Check if this key is under the same parent
    let underParent = true;
    for (let i = 0; i < parentPath.length; i++) {
      if (ints[i] !== parentPath[i]) {
        underParent = false;
        break;
      }
    }

    if (!underParent) {
      newSet.add(key);
      continue;
    }

    // Remove deleted subtree
    if (ints.length > parentPath.length && ints[parentPath.length] === deletedIdx) {
      continue;
    }

    // Shift siblings after deleted index
    if (ints.length > parentPath.length && ints[parentPath.length] > deletedIdx) {
      ints[parentPath.length] = ints[parentPath.length] - 1;
      newSet.add(ints.join("."));
      continue;
    }

    newSet.add(key);
  }

  set.clear();
  for (const k of newSet) set.add(k);
}
function deleteAtPath(path) {
  const parent = getParentByPath(path);
  const idx = path[path.length - 1];
  if (!parent) return; // can't delete root
  parent.children.splice(idx, 1);

  // easiest safe cleanup
  //resetCollapseState();
    const parentPath = path.slice(0, -1);
    remapCollapseSetAfterDelete(collapsedChildren, parentPath, idx);
    remapCollapseSetAfterDelete(collapsedDetails, parentPath, idx);
}

// If you want to add a sibling, add to parent
function addSiblingAtPath(path, tagName) {
  const parent = getParentByPath(path);
  if (!parent) return;
  parent.children.push({ tag: tagName, attributes: {}, text: "", children: [] });
}

// ------------------------------------------------------------
// rendering
// ------------------------------------------------------------
function render() {
  const container = $("editor");
  container.innerHTML = "";

  if (!root) {
    container.appendChild(el("div", { class: "muted", text: "Load an XML file to start editing." }));
    return;
  }

  // ✅ Top toolbar
  const toolbar = el("div", { class: "toolbar" }, [
    el("button", {
      class: "btn",
      type: "button",
      text: "Collapse All",
      onclick: () => {
        collapseAllNodes();
        render();
      }
    }),
    el("button", {
      class: "btn",
      type: "button",
      text: "Expand All",
      onclick: () => {
        resetCollapseState();
        render();
      }
    })
  ]);

  container.appendChild(toolbar);
  container.appendChild(renderNode(root, []));
}


function renderNode(node, path) {
  const parent = getParentByPath(path);
  const ruleIfItem = getRuleIfListItem(node, parent);

  const hasChildren = node.children && node.children.length > 0;

  // Tree collapse applies to nodes that have children
  const childrenCollapsed = hasChildren && isChildrenCollapsed(path);

  // Details collapse applies to list items (Texture/LOD/Light/Effect/Point/Attach/ArticulatedPart)
  const detailsCollapsed = !!ruleIfItem && isDetailsCollapsed(path);

  const header = el("div", { class: "node-header" }, [
    renderToggleButton(node, path, { ruleIfItem, hasChildren, childrenCollapsed, detailsCollapsed }),
    el("span", { class: "tag", text: `<${node.tag}>` }),
    ...renderHeaderButtons(node, path),
  ]);

  // Attribute panel
  let attrBox = el("div");
  if (!detailsCollapsed) {
    attrBox = renderAttributes(node, path);
  }

  // Body panel (children or leaf value)
  let body = el("div");

  if (hasChildren) {
    if (!childrenCollapsed) {
      body = el("div", { class: "children" }, node.children.map((ch, i) => renderNode(ch, path.concat(i))));
    } else {
      body = el("div", { class: "collapsed-hint", text: `(${node.children.length} child nodes)` });
    }
  } else {
    body = renderLeaf(node, path);
  }

  return el("div", { class: "node" }, [header, attrBox, body]);
}

/**
 * Toggle rules:
 * - If node has children -> toggle children collapse (▶/▼)
 * - Else if node is a list item -> toggle details collapse (▶/▼)
 * - Else show spacer
 */
function renderToggleButton(node, path, { ruleIfItem, hasChildren, childrenCollapsed, detailsCollapsed }) {
  // children toggle
  if (hasChildren) {
    const btn = el("button", { class: "btn toggle", type: "button", text: childrenCollapsed ? "▶" : "▼" });
    btn.onclick = () => { toggleChildrenCollapsed(path); render(); };
    return btn;
  }

  // details toggle for list items (even without children)
  if (ruleIfItem) {
    const btn = el("button", { class: "btn toggle", type: "button", text: detailsCollapsed ? "▶" : "▼" });
    btn.onclick = () => { toggleDetailsCollapsed(path); render(); };
    return btn;
  }

  // spacer
  return el("span", { class: "toggle-spacer", text: "" });
}

function renderHeaderButtons(node, path) {
  const buttons = [];

  const parent = getParentByPath(path);
  const isRoot = path.length === 0;

  const isModelNode = node.tag === "Model";
  const isInsideModel = parent && parent.tag === "Model";

  const listRuleIfItem = getRuleIfListItem(node, parent);

  const isCamerasNode = node.tag === "Cameras";
  const isCameraNode = node.tag === "Camera";
  const isInsideCameraSection = isUnderCamera(path) || isCamerasNode || isCameraNode;

  const PROTECTED = new Set([
    "Model",
    "Textures",
    "LODs",
    "Lights",
    "Effects",
    "GroundSupportPoints",
    "ArticulatedParts",
    "Attachments",
    "Cameras",
    "ModelConfiguration"
  ]);

  const allowDelete = !isRoot && !PROTECTED.has(node.tag);

  if (allowDelete) {
    const delBtn = el("button", { class: "btn danger", type: "button", text: "Delete" });
    delBtn.onclick = () => { deleteAtPath(path); render(); };
    buttons.push(delBtn);
  }

  if (isModelNode) {
    const addFieldBtn = el("button", { class: "btn", type: "button", text: "Add Field" });
    addFieldBtn.onclick = () => {
      const tag = prompt("New tag name under <Model>:");
      if (!tag) return;
      if (!node.children) node.children = [];
      node.children.push({ tag, attributes: {}, text: "", children: [] });
      render();
    };
    buttons.push(addFieldBtn);
    return buttons;
  }

  if (isInsideModel) {
    return buttons;
  }

  if (isCameraNode) {
    const addFieldBtn = el("button", { class: "btn", type: "button", text: "Add Field" });
    addFieldBtn.onclick = () => {
      const tag = prompt("New tag name under <Camera>:");
      if (!tag) return;
      if (!node.children) node.children = [];
      node.children.push({ tag, attributes: {}, text: "", children: [] });
      render();
    };
    buttons.push(addFieldBtn);
    return buttons;
  }

  if (isInsideCameraSection && !isListContainer(node)) {
    return buttons;
  }

  if (isListContainer(node)) {
    const rule = getListRuleForContainerTag(node.tag);
    const addBtn = el("button", { class: "btn", type: "button", text: `Add ${rule.itemTag}` });
    addBtn.onclick = () => {
      if (!node.children) node.children = [];
      node.children.push(createNewItem(rule));
      render();
    };
    buttons.push(addBtn);
    return buttons;
  }

  if (listRuleIfItem) {
    if (node.tag === "ArticulatedPart") {
      const addChildBtn = el("button", { class: "btn", type: "button", text: "Add Child" });
      addChildBtn.onclick = () => {
        const tag = prompt("Child tag name:");
        if (!tag) return;
        if (!node.children) node.children = [];
        node.children.push({ tag, attributes: {}, text: "", children: [] });
        node.text = null;
        render();
      };
      buttons.push(addChildBtn);
    }
    return buttons;
  }

  const addChildBtn = el("button", { class: "btn", type: "button", text: "Add Child" });
  addChildBtn.onclick = () => {
    const tag = prompt("Child tag name:");
    if (!tag) return;
    if (!node.children) node.children = [];
    node.children.push({ tag, attributes: {}, text: "", children: [] });
    node.text = null;
    render();
  };
  buttons.push(addChildBtn);

  if (!isRoot) {
    const addSiblingBtn = el("button", { class: "btn", type: "button", text: "Add Sibling" });
    addSiblingBtn.onclick = () => {
      const tag = prompt("Sibling tag name:");
      if (!tag) return;
      addSiblingAtPath(path, tag);
      render();
    };
    buttons.push(addSiblingBtn);
  }

  return buttons;
}

function renderLeaf(node, path) {
  const parent = getParentByPath(path);

  // If this node is part of a controlled list rule, do NOT show generic "Value"
  const rule = getRuleIfListItem(node, parent);
  if (rule) return el("div");

  if (node.children && node.children.length > 0) return el("div");

  const input = el("input", { class: "input", type: "text", value: node.text ?? "" });
  input.oninput = (e) => { node.text = e.target.value; };

  return el("div", { class: "leaf" }, [
    el("label", { class: "label", text: "Value" }),
    input
  ]);
}

function renderAttributes(node, path) {
  const parent = getParentByPath(path);

  if (path.length === 0 && node.tag === "ModelConfiguration") {
    return el("div");
  }
  // No attributes UI anywhere inside <Model>
  if (isUnderModel(path) || node.tag === "Model") {
    return el("div");
  }

  // No attributes UI for list containers
  if (isListContainer(node)) return el("div");

  // List item: fixed fields only
  const rule = getRuleIfListItem(node, parent);
  if (rule) {
    normalizeItemNode(node, rule);
    const box = el("div", { class: "attrs" });
    box.appendChild(el("div", { class: "attrs-title", text: node.tag }));
    const fieldRow = (label, key) => {
      const row = el("div", { class: "fixed-row" });
      const lab = el("label", { class: "label", text: label });
      const input = el("input", { class: "input", type: "text", value: node.attributes[key] ?? "" });
      input.oninput = (e) => { node.attributes[key] = e.target.value; };
      row.appendChild(lab);
      row.appendChild(input);
      return row;
    };
    rule.allowedAttrs.forEach((k) => box.appendChild(fieldRow(k, k)));
    return box;
  }

  // Normal attributes editor
  const attrs = node.attributes || {};
  const keys = Object.keys(attrs);

  // ✅ Camera subtree: hide "Attributes (none)" completely
  if (isUnderCamera(path) && keys.length === 0) {
    return el("div");
  }

  const box = el("div", { class: "attrs" });
  box.appendChild(el("div", { class: "attrs-title", text: "Attributes" }));

  if (keys.length === 0) {
    box.appendChild(el("div", { class: "muted", text: "(none)" }));
  } else {
    keys.forEach((k) => {
      const row = el("div", { class: "attr-row" });

      const kInput = el("input", { class: "input small", type: "text", value: k });
      const vInput = el("input", { class: "input", type: "text", value: attrs[k] });

      kInput.onchange = () => {
        const newKey = kInput.value.trim();
        if (!newKey) return;
        const val = attrs[k];
        delete attrs[k];
        attrs[newKey] = val;
        node.attributes = attrs;
        render();
      };

      vInput.oninput = (e) => { attrs[k] = e.target.value; node.attributes = attrs; };

      const del = el("button", { class: "btn danger", type: "button", text: "X" });
      del.onclick = () => { delete attrs[k]; node.attributes = attrs; render(); };

      row.appendChild(el("span", { class: "muted", text: "key" }));
      row.appendChild(kInput);
      row.appendChild(el("span", { class: "muted", text: "value" }));
      row.appendChild(vInput);
      row.appendChild(del);

      box.appendChild(row);
    });
  }

  // Remove Add Attribute button only in Camera sections (your existing requirement)
  if (!isUnderCamera(path) && node.tag !== "Camera" && node.tag !== "Cameras") {
    const addAttr = el("button", { class: "btn", type: "button", text: "Add Attribute" });
    addAttr.onclick = () => {
      const k = prompt("Attribute key:");
      if (!k) return;
      if (!node.attributes) node.attributes = {};
      node.attributes[k] = "";
      render();
    };
    box.appendChild(addAttr);
  }

  return box;
}
// ------------------------------------------------------------
// load/save
// ------------------------------------------------------------
async function loadXml(file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/xml/load", { method: "POST", body: fd });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to load XML");
  }

  root = await res.json();
  $("btnSave").disabled = false;

  resetCollapseState();
  render();
}

async function saveXml() {
  if (!root) return;

  const name = $("outName").value || "edited.xml";

  // Get XML bytes from backend as before
  const res = await fetch(`/api/xml/save?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(root)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to save XML");
  }

  const blob = await res.blob();

  // ✅ Preferred: show "Save As..." dialog (Chrome/Edge)
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: name,
      types: [
        {
          description: "XML Files",
          accept: { "application/xml": [".xml"] }
        }
      ]
    });

    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  // ✅ Fallback: download (goes to browser download behavior)
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

$("btnLoad").onclick = async () => {
  $("loadMsg").textContent = "";
  try {
    const f = $("file").files?.[0];
    if (!f) {
      $("loadMsg").textContent = "Please choose an XML file first.";
      return;
    }
    await loadXml(f);
    $("loadMsg").textContent = "Loaded successfully.";
  } catch (e) {
    $("loadMsg").textContent = e.message;
  }
};

$("btnSave").onclick = async () => {
  $("saveMsg").textContent = "";
  try {
    await saveXml();
    $("saveMsg").textContent = "Saved (download started).";
  } catch (e) {
    $("saveMsg").textContent = e.message;
  }
};

render();