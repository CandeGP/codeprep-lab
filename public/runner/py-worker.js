/* Ejecuta Python con Pyodide (WebAssembly) dentro de un Web Worker.
   La primera carga descarga ~10 MB desde el CDN; después queda en caché del navegador. */

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/";
importScripts(PYODIDE_URL + "pyodide.js");

let pyodideReady = null;
function getPyodide() {
  if (!pyodideReady) pyodideReady = loadPyodide({ indexURL: PYODIDE_URL });
  return pyodideReady;
}

const HARNESS = `
import json, sys, io, time, traceback
from typing import *

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def _to_list(arr):
    dummy = cur = ListNode()
    for v in arr:
        cur.next = ListNode(v)
        cur = cur.next
    return dummy.next

def _from_list(node):
    out, guard = [], 0
    while node and guard < 10000:
        out.append(node.val); node = node.next; guard += 1
    return out

def _to_tree(arr):
    if not arr or arr[0] is None:
        return None
    root = TreeNode(arr[0]); q = [root]; i = 1
    while q and i < len(arr):
        node = q.pop(0)
        if i < len(arr) and arr[i] is not None:
            node.left = TreeNode(arr[i]); q.append(node.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            node.right = TreeNode(arr[i]); q.append(node.right)
        i += 1
    return root

def _from_tree(root):
    out, q = [], [root]
    while q:
        n = q.pop(0)
        if n:
            out.append(n.val); q.append(n.left); q.append(n.right)
        else:
            out.append(None)
    while out and out[-1] is None:
        out.pop()
    return out

def _adapt_in(a, v):
    return _to_list(v) if a == "list" else _to_tree(v) if a == "tree" else json.loads(json.dumps(v))

def _adapt_out(a, v):
    if a == "list": return _from_list(v)
    if a == "tree": return _from_tree(v)
    if isinstance(v, tuple): return list(v)
    if isinstance(v, set): return sorted(v)
    return v

def _norm(v, unordered):
    s = json.loads(json.dumps(v, default=list))
    if unordered and isinstance(s, list):
        s = sorted(s, key=lambda x: json.dumps(x))
    return s

def _run(code, fn_name, tests, arg_adapters, ret_adapter, unordered):
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    env = {"ListNode": ListNode, "TreeNode": TreeNode, "List": List, "Optional": Optional, "Dict": Dict}
    try:
        exec(code, env)
    except Exception:
        sys.stdout = old
        return json.dumps({"type": "error", "error": traceback.format_exc(limit=0), "logs": buf.getvalue().splitlines()})
    fn = env.get(fn_name)
    if not callable(fn):
        sys.stdout = old
        return json.dumps({"type": "error", "error": f'No se encontró la función "{fn_name}".', "logs": buf.getvalue().splitlines()})
    results = []
    for i, t in enumerate(tests):
        start = time.perf_counter()
        try:
            args = [_adapt_in(arg_adapters[j] if j < len(arg_adapters) else None, a) for j, a in enumerate(t["args"])]
            actual = _adapt_out(ret_adapter, fn(*args))
            ok = _norm(actual, unordered) == _norm(t["expected"], unordered)
            results.append({"index": i, "passed": ok, "input": t["args"], "expected": t["expected"],
                            "actual": json.loads(json.dumps(actual, default=str)),
                            "ms": round((time.perf_counter() - start) * 1000, 2)})
        except Exception as e:
            results.append({"index": i, "passed": False, "input": t["args"], "expected": t["expected"],
                            "error": f"{type(e).__name__}: {e}"})
    sys.stdout = old
    return json.dumps({"type": "done", "results": results, "logs": buf.getvalue().splitlines()})
`;

let harnessLoaded = false;

self.onmessage = async (e) => {
  const { code, functionName, tests, argAdapters = [], returnAdapter = null, unordered = false } = e.data;
  try {
    self.postMessage({ type: "status", status: "Cargando Python…" });
    const py = await getPyodide();
    if (!harnessLoaded) {
      py.runPython(HARNESS);
      harnessLoaded = true;
    }
    self.postMessage({ type: "status", status: "Ejecutando…" });
    const run = py.globals.get("_run");
    const out = run(code, functionName, py.toPy(tests), py.toPy(argAdapters), returnAdapter, unordered);
    run.destroy();
    self.postMessage(JSON.parse(out));
  } catch (err) {
    self.postMessage({ type: "error", error: String(err && err.message ? err.message : err), logs: [] });
  }
};
