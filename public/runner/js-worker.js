/* Ejecuta el código del usuario en un Web Worker aislado del DOM.
   El hilo principal termina el worker si excede el tiempo límite. */

class ListNode {
  constructor(val = 0, next = null) {
    this.val = val;
    this.next = next;
  }
}
class TreeNode {
  constructor(val = 0, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

function toList(arr) {
  const dummy = new ListNode();
  let cur = dummy;
  for (const v of arr) {
    cur.next = new ListNode(v);
    cur = cur.next;
  }
  return dummy.next;
}
function fromList(node) {
  const out = [];
  let guard = 0;
  while (node && guard++ < 10000) {
    out.push(node.val);
    node = node.next;
  }
  return out;
}
/* Árbol en orden por niveles, con null para huecos: [1,2,3,null,4] */
function toTree(arr) {
  if (!arr.length || arr[0] === null) return null;
  const root = new TreeNode(arr[0]);
  const queue = [root];
  let i = 1;
  while (queue.length && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length && arr[i] !== null) queue.push((node.left = new TreeNode(arr[i])));
    i++;
    if (i < arr.length && arr[i] !== null) queue.push((node.right = new TreeNode(arr[i])));
    i++;
  }
  return root;
}
function fromTree(root) {
  const out = [];
  const queue = [root];
  while (queue.length) {
    const node = queue.shift();
    if (node) {
      out.push(node.val);
      queue.push(node.left, node.right);
    } else out.push(null);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

const adaptIn = (a, v) => (a === "list" ? toList(v) : a === "tree" ? toTree(v) : structuredClone(v));
const adaptOut = (a, v) => (a === "list" ? fromList(v) : a === "tree" ? fromTree(v) : v);

function normalize(v, unordered) {
  if (v === undefined) return null;
  if (unordered && Array.isArray(v)) {
    return v.map((x) => normalize(x, false)).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
  }
  return v;
}
const equal = (a, b, unordered) => JSON.stringify(normalize(a, unordered)) === JSON.stringify(normalize(b, unordered));

function fmt(v) {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

self.onmessage = (e) => {
  const { code, functionName, tests, argAdapters = [], returnAdapter = null, unordered = false } = e.data;
  const logs = [];
  const log = (...args) => logs.push(args.map(fmt).join(" "));
  const sandboxConsole = { log, info: log, warn: log, error: log, debug: log };

  let fn;
  try {
    fn = new Function(
      "console",
      "ListNode",
      "TreeNode",
      `"use strict";\n${code}\nreturn typeof ${functionName} === "function" ? ${functionName} : undefined;`,
    )(sandboxConsole, ListNode, TreeNode);
  } catch (err) {
    self.postMessage({ type: "error", error: `Error de sintaxis: ${err.message}`, logs });
    return;
  }
  if (!fn) {
    self.postMessage({ type: "error", error: `No se encontró la función "${functionName}".`, logs });
    return;
  }

  const results = tests.map((t, i) => {
    const start = performance.now();
    try {
      const args = t.args.map((a, j) => adaptIn(argAdapters[j] ?? null, a));
      const raw = fn(...args);
      const actual = adaptOut(returnAdapter, raw);
      return {
        index: i,
        passed: equal(actual, t.expected, unordered),
        input: t.args,
        expected: t.expected,
        actual: actual === undefined ? null : actual,
        ms: Math.round((performance.now() - start) * 100) / 100,
      };
    } catch (err) {
      return { index: i, passed: false, input: t.args, expected: t.expected, error: String(err && err.message ? err.message : err) };
    }
  });
  self.postMessage({ type: "done", results, logs });
};
