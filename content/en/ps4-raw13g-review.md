---
title: "[PS4] Reading the raw13g Code"
description: "Following raw13g from its file structure through the main functions, Worker communication, and logging."
date: "2026-10-05"
translation_key: "ps4-raw13g-review"
tags: ["PS4", "WebKit", "Code Review", "Firmware", "Supply Chain"]
category: "STUDY/FirmWare 분석(시도)"
private: false
---

This time, I will work through the `raw13g` code used on PS4.

The execution notes reported that GoldHEN appeared, but the screen alone did not explain what each file was doing. There were several JavaScript files, along with separate binaries loaded by the page. I started by looking at how those files fit together, then followed the values passed between the main functions.

The version parsing and logging code also caught my attention. These are easy to overlook when checking only the final result, so I will go through them as well.

## 1. The analysis target

The code comes from `raw13g/raw13g.github.io`. Since the repository can change, this is the commit used for the analysis. [1]

```text
Repository: raw13g/raw13g.github.io
Revision: 9ba2f0719591d6900d91aba6cc5291f8fff97e6d
```

I first compared the source with the deployment files collected alongside it. The point was to check whether the code being read and the collected deployment files contained the same bytes.

| Check | Result | What it tells us |
|---|---|---|
| `MANIFEST.sha256` | **All 48 listed files match** | Files agree with the accompanying hash list |
| `source/` and `deployed/` | **All 15 corresponding files match** | Collected source and deployment copies are identical |
| JavaScript syntax | Existing record has **6 PASS results** | A syntax check, separate from checking runtime behavior |

The count of 48 includes documents and inspection records, while the 15 pairs cover web deployment files. The manifest itself and Git internals are excluded from the 48.

This establishes agreement between the files. It does not identify their publisher: someone able to replace the files could also replace the accompanying hash list. That distinction comes up again when looking at the binaries.

![What file comparisons, execution observations, and publisher checks establish](/assets/research/ps4-raw13g-review/01-evidence-en.svg)

*Figure 1. Whether files match, whether they ran, and who produced them are separate questions.*

## 2. Structure and main functions

Let us start with the role of each file. `index.html` is the entry screen, and `jb.html` displays progress. The JavaScript module connecting the rest is `jb.js`. It imports the other modules, communicates with Workers, and receives the external files it needs. [2]

![Connections between the entry pages and JavaScript modules](/assets/research/ps4-raw13g-review/04-modules-en.svg)

*Figure 2. How the files connect, starting from the interface.*

| File | Input or state | Role |
|---|---|---|
| `index.html` | User-Agent, cache state | Firmware display and navigation |
| `jb.html` | DOM elements, module script | Progress UI and the context for `jb.js` |
| `ps4_offsets.js` | User-Agent string | Look up a version key and configuration object |
| `int64.js` | Low and high 32-bit words | Represent, calculate, and format 64-bit values |
| `core.js` | Browser environment, options, event callback | Construct a carrier of browser memory functionality |
| `mem.js` | Carrier, installation options | Provide a common memory interface to other code |
| `rpc_worker.js` | Message containing an ID, function name, and arguments | Return a result or error with the same ID |
| `jb.js` | Configuration, module results, Worker replies, file responses | Coordinate the flow and record diagnostics |
| `cache.appcache` | Resource paths, cache rules | Define offline resources and network handling |

The following sections go through the main functions with source excerpts. Where an excerpt is only part of a function, I describe that block's role. For `core.js` and `mem.js`, the focus is on the objects and interfaces passed between the modules.

### 2.1 `index.html` and `jb.html`: what the entry page does

The version parser in `index.html` was an early point of interest. It finds two groups of digits in the User-Agent and produces `key` and `fwnum`.

*`index.html` · L49–L56*

```javascript
var key = null, fwnum = null;
var m = /PlayStation\s+4[\/ ](\d+)\.(\d+)/.exec(navigator.userAgent);
if (m) {
    var ms = parseInt(m[2], 16).toString(16);
    if (ms.length < 2) ms = "0" + ms;
    key = m[1] + "." + ms;
    fwnum = parseInt(m[1], 10) * 100 + parseInt(ms, 10);
}
```

Take `13.52` as an example. The second group is `"52"`. Parsing it as hexadecimal and converting it back to a hexadecimal string leaves `ms` as `"52"`. The later decimal calculation produces `fwnum = 1352`.

Why make two values from one version? `key` is the string used for configuration lookup and display, while `fwnum` is the number compared with the entry screen's support list. Each represents the same input in the form its caller needs.

The input is still the User-Agent. This code does not inspect firmware files or read the console's kernel version. Its job here is **normalizing a version string**.

Next is the module entry point in `jb.html`.

*`jb.html` · L156–L158*

```html
<script type="module">
  import "./jb.js?v=19";
</script>
```

The HTML contains plenty of styling and interface elements, but this declaration shows where the behavior begins. `jb.html` prepares the status DOM and loads `jb.js` as a module. The `?v=19` suffix distinguishes the resource URL; it does not verify the file's contents or publisher.

### 2.2 `offsetsFor()`: finding configuration for a version

Once there is a version string, the code needs the corresponding configuration. Here is the lookup function from `ps4_offsets.js`.

*`ps4_offsets.js` · L647–L653*

```javascript
export function offsetsFor(uaString) {
  const m = (uaString || "").match(/PlayStation\s+4[\/ ](\d+)\.(\d+)/);
  if (!m) return { key: null, off: null };

  const key = m[1] + "." + parseInt(m[2], 16).toString(16).padStart(2, "0");
  return { key, off: PS4[key] || null };
}
```

It returns `{ key, off }`. If the string has the wrong shape, both fields are `null`. If the shape matches but the `PS4` table has no entry, `key` remains available and only `off` becomes `null`.

The caller can therefore distinguish a version it could not parse from a version with no configuration. That explains why this short function returns two fields.

Its job ends at lookup. An entry in the table does not establish that the values are correct on hardware. The support list is in `index.html`, while the configuration is in `ps4_offsets.js`, so their descriptions also need to be read together. I return to this in Section 4.

### 2.3 `core.js` and `mem.js`: building functionality and wrapping it

These imports appear at the start of `jb.js`.

*`jb.js` · L1–L4*

```javascript
import { establishPrimitive } from "./core.js?v=10";
import { installWindowP, pairStatus } from "./mem.js";
import { int64 } from "./int64.js";
import { offsetsFor } from "./ps4_offsets.js";
```

`establishPrimitive()` returns a carrier through an asynchronous operation. Here, a carrier is an object grouping the browser-side memory functionality used by later code. `installWindowP()` takes that object, builds a common interface, and exposes it through the global `p`. `pairStatus` describes state in the same module.

The names become easier to follow when their roles are separated.

| Aspect | `core.js` | `mem.js` |
|---|---|---|
| Job | Build the browser-dependent foundation | Wrap it in an API for other code |
| What it exposes | Preparation result and events | Consistently shaped functions and state |
| Reason for the split | Keep the underlying implementation together | Avoid making every caller handle its internal representation |

This arrangement lets callers use the functionality without repeatedly dealing with its implementation. An API wrapper does not, however, add a sandbox restricting the addresses a caller can access. Other scripts in the page can also access `globalThis.p`, so the trust placed in those scripts matters.

I read this split as a way to organize the code that constructs functionality and the code that uses it. The presence of an interface does not by itself establish that everything underneath behaves correctly.

### 2.4 `int64.js`: why the value is stored in two parts

JavaScript's ordinary `Number` cannot represent every 64-bit integer exactly. This file therefore stores the low 32 bits in `low` and the high 32 bits in `hi`. This excerpt initializes the constructor's fields.

*`int64.js` · L12–L16*

```javascript
this.low = low >>> 0;

this.hi = hi >>> 0;

this.backing = null;
```

`>>> 0` converts each input to an unsigned 32-bit value. Together, the fields represent `hi × 2³² + low`. `backing` is a separate field for an associated byte view rather than part of that number.

The arithmetic method names also distinguish behavior. Methods containing `inplace` change the current object, while methods such as `add32()` return a new result. When reading callers, it matters whether the original value changes.

There is another detail worth examining in the string conversion. Here is the complete `toString()` method.

*`int64.js` · L100–L112*

```javascript
this.toString = function (radix = 16) {
  let lo_str = (this.low >>> 0).toString(radix);
  let hi_str = (this.hi >>> 0).toString(radix);

  if (this.hi == 0) {
    return lo_str;
  } else {
    const width = radix === 16 ? 8 : Math.ceil(32 / Math.log2(radix));
    lo_str = zeroFill(lo_str, width);
  }

  return hi_str + lo_str;
};
```

For its default hexadecimal format, it pads the low word to eight digits and appends it to the high word. Each hexadecimal digit represents four bits, so the low 32 bits occupy exactly eight digits. Concatenation works in this case.

Does the same rule work in other bases? Consider `hi=1`, `low=0`. The represented value is `4294967296`. In decimal mode, this method pads the low string to ten digits and prefixes `1`, producing `10000000000`.

| Fields | Base | String produced by the code | Correct string |
|---|---|---|---|
| `hi=1`, `low=0` | 16 | `100000000` | `100000000` |
| `hi=1`, `low=0` | 10 | `10000000000` | `4294967296` |

This is a **formatting issue** visible by following the calculation. It does not establish that the chain failed in practice. It does show that accepting a radix argument is not enough to make conversion correct for every supported argument.

### 2.5 `makeRpc()`: waiting for a Worker reply

`jb.js` exchanges messages with Workers. `makeRpc()` takes a Worker and returns a function for making calls. RPC here refers to calls between the page's main thread and a Worker, rather than a server on another computer.

*`jb.js` · L662–L693*

```javascript
function makeRpc(wk, name) {
  let seq = 0;
  const pending = new Map();
  wk.onmessage = function (e) {
    const d = e.data || {};
    const slot = pending.get(d.id);
    if (!slot) return;
    pending.delete(d.id);
    if (slot.timer) clearTimeout(slot.timer);
    if (d.type === "err") slot.reject(new Error(String(d.value)));
    else slot.resolve(d.value);
  };
  wk.onerror = (e) =>
    mark(
      "WORKER-ONERROR",
      name + " " + (e && e.message ? e.message : String(e)),
    );
  return function call(fname, timeoutMs, ...args) {
    return new Promise(function (resolve, reject) {
      const id = seq++;
      const timer =
        timeoutMs > 0
          ? setTimeout(function () {
              pending.delete(id);
              reject(new Error(name + ": timeout waiting for " + fname));
            }, timeoutMs)
          : null;
      pending.set(id, { resolve, reject, timer });
      wk.postMessage({ id: id, name: fname, args: args });
    });
  };
}
```

The central data structure is the `pending` Map. Each request receives an increasing `id`, which is associated with the Promise's `resolve`, `reject`, and timer. The Worker receives `{ id, name, args }`. When a reply carries the same ID, the code can find the Promise waiting for it.

The reply handler first removes the pending entry and clears its timer. It then calls `reject` if `type` is `"err"`, or `resolve` otherwise. A reply for an already finished request has no matching entry and is ignored. This handles late or duplicate responses.

![A request ID connects a Worker reply to its waiting Promise](/assets/research/ps4-raw13g-review/05-rpc-en.svg)

*Figure 3. The `id` identifies which request a reply belongs to.*

On the other side, `rpc_worker.js` reads the function name and arguments, finds the function in `api`, invokes it, and responds with `{ id, type, value }`. Both ends need to agree on the ID and response format for this connection to work.

Two details stood out. A request ID distinguishes calls; it is not an authorization credential. This code trusts the Worker created by the same page, and there is no separate layer here checking the meaning of arguments or the detailed reply structure.

Also, `wk.onerror` records an error without immediately settling all waiting Promises. If a call has no timeout, this function alone cannot guarantee that it finishes. These are observations about message handling and completion conditions, not a demonstrated externally exploitable vulnerability.

### 2.6 File loading: turning a response into bytes

This block receives the selected file.

*`jb.js` · L3023–L3028*

```javascript
try {
  const r = await fetch(PAYLOAD_FILE);
  if (r.ok) payloadBlob = new Uint8Array(await r.arrayBuffer());
} catch (e) {
  mark("PAYLOAD-FETCH-THREW", (e && e.message) || String(e));
}
```

If the response's `r.ok` is true, the code reads its body with `arrayBuffer()` and wraps it in a `Uint8Array`. That view provides byte-by-byte access to the received file, preparing it in a form later code can use.

This is the reception step. Neither `arrayBuffer()` nor `Uint8Array` interprets the file's meaning or verifies who produced it. A successful HTTP response and a file with the expected contents are separate checks. Section 5 follows that distinction into the binaries.

Taken together, `jb.js` **selects configuration, connects modules, and coordinates asynchronous replies and external files**. Establishing that structure first makes it easier to locate each responsibility in the rest of the code.

## 3. Vulnerability names and causes

The accompanying material calls the chain a “1-day.” That label alone was not enough to map each stage to a specific CVE, so the focus here is on reading the published chain's code. [1, 2]

The kernel-side code includes asynchronous I/O and object-lifetime races. With asynchronous work, another execution context may still be using an object after the requesting code has finished. When considering a UAF, the useful question is therefore whether **the last operation using that object has finished**, as well as whether cancellation or completion was reported.

That perspective helps explain the code's structure. Establishing the precise cause would also require the vulnerable kernel function, its fix, and execution traces. The supplied material did not provide enough evidence for that conclusion.

The `bug=663` status string is an internal label, not a CVE identifier. I did not assign a CVE number merely because the code resembled a known class of issue.

## 4. Firmware support

The entry screen lists `13.02`, `13.04`, `13.50`, and `13.52`. This is the list shown by the interface, rather than evidence that all four versions were tested on hardware for this article. [2]

`ps4_offsets.js` contains entries for more versions. Their descriptions mix hardware checks, offline checks, and unverified states. Looking only for the presence of an entry would miss those differences.

| Description | What it establishes | What else is needed |
|---|---|---|
| UI support list | The entry screen classifies the version as supported | Hardware results for each component |
| Configuration entry exists | Values exist for the version key | Whether they are correct on the console |
| Offline verification | The author reports checking static material | Runtime results |
| Hardware verification | The author reports checking a console | Raw logs, trial counts, and conditions |

One concrete detail appears under `13.52`. Its payload field selects `goldhen.bin`, but its status description names `payload2.bin`. Comparing the two files showed that both were 293,120 bytes and had identical contents. In the files reviewed, the name discrepancy therefore did not select different bytes. [1, 2]

The description and actual field still disagree. If one file changes later, someone reading only the log could misunderstand which file was used. Resource names and their status descriptions need to stay in step.

## 5. What the binary checks cover

The separate binaries mark a change in what can be learned from the JavaScript. The loader's file handling is visible, but that does not explain the binaries' internal behavior. [1, 2]

`goldhen.bin` and `payload2.bin` had the same size and hash:

```text
Size: 293120 bytes
SHA-256: df3f27c1b35bc7c40e3a08caab948930914dc7d0301a73b68945cf6ffe40ea12
```

The three patch binaries were 632 bytes each. Sizes and hashes help identify the files being examined. A hash or a format name reported by a file-identification tool does not explain what those files do internally.

The loader checks response status, some format conditions, and copy results. In the JavaScript examined, I did not find a path that approved files against a trusted expected hash or publisher signature. **Checking that received bytes were copied correctly does not establish who made them.**

![The difference between matching files and checking their publisher or behavior](/assets/research/ps4-raw13g-review/02-trust-en.svg)

*Figure 4. What each check can establish.*

The material did not include complete build inputs for reproducing the binaries, publisher signatures, or a component inventory. Their internals and provenance therefore remain unresolved here. That is not a finding that the files are malicious.

I also checked `LICENSE`. It applies MIT to raw13g-authored code while identifying payloads, patches, and some primitive files as third-party components. A license at the repository root does not necessarily put every file under the same terms.

## 6. What the hashes in the cache file mean

In `cache.appcache`, resource paths are followed by `#` and hash strings. They can look like file-verification fields at first. However, AppCache does not compare those strings against the downloaded file contents as expected hashes. Reading the parsing rules alongside the file-handling code makes the distinction between recording a hash and enforcing it clear. [2, 6]

A cache can also continue using previously received files. Opening the same URL does not necessarily mean using the same bytes. In that situation, the file hash and active resource version matter alongside the URL.

The network section is:

*`cache.appcache` · L21–L22*

```text
NETWORK:
*
```

With `NETWORK: *`, using an offline cache does not mean all network requests are blocked. That is what the configuration says; it is not a new measurement of cache updates or requests on the console.

## 7. Reading the logging code

Logging does more than put a string on the screen. Following `terse()`, `mark()`, `post()`, and `trace()` reveals a split between displayed values and transmitted values. I will go through them in turn. [2]

### 7.1 `terse()`: shortening the displayed string

Here is the complete `terse()` function. `VERBOSE` and `PROSE` are a display option and a list of regular expressions defined outside it.

*`jb.js` · L39–L49*

```javascript
function terse(s) {
  if (VERBOSE || s == null) return s;
  s = String(s);
  for (const re of PROSE) {
    const m = re.exec(s);
    if (m && m.index > 0) s = s.slice(0, m.index);
  }
  s = s.replace(/\s+$/, "");
  if (s.length > 140) s = s.slice(0, 140) + "...";
  return s;
}
```

If `VERBOSE` is enabled or the input is `null`, the function returns the input unchanged. Otherwise, it converts the value to a string and checks the first match for each expression in `PROSE`. A match starting after position zero causes the following text to be removed. Finally, it removes trailing whitespace and truncates strings longer than 140 characters, appending an ellipsis.

The rules operate on the string's shape and length. There is no rule here for identifying and removing IP addresses, tokens, or user identifiers. Shorter text on the screen does not establish that sensitive information has been removed.

### 7.2 `mark()`: keeping the original and display values apart

Next is `mark()`.

*`jb.js` · L64–L89*

```javascript
function mark(tag, detail) {
  const raw = detail;
  detail = terse(detail);
  lines.push(tag + (detail == null || detail === "" ? "" : "  " + detail));
  if (SHOW_LOG && outEl) {
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    outEl.innerHTML = lines
      .map(function (l) {
        l = esc(l);
        const c =
          /FAIL|ERROR|THREW|REBOOT|MISS|LOST|POISON|TIMEOUT|MISMATCH|ABORTED|GIVEUP|NO-STORAGE|UNSEEN/i.test(
            l,
          )
            ? "bad"
            : /WARN|SKIP|REFUS|COMMITTED|DIRTY/i.test(l)
              ? "warn"
              : /\bOK\b|\bPASS\b|PASS=|ACHIEVED|RUNNING|ARMED/i.test(l)
                ? "ok"
                : "";
        return c ? '<span class="' + c + '">' + l + "</span>" : l;
      })
      .join("\n");
    outEl.scrollTop = outEl.scrollHeight;
  }
  post(tag, raw);
}
```

The first line saves the original `detail` as `raw`. It then shortens only the display value with `terse()` and adds it to `lines`. When screen logging is enabled, it escapes each line, selects a CSS class by keyword, and renders the result.

The use of `innerHTML` is visible, but it is not enough by itself to conclude that the input is interpreted directly as HTML. `esc()` replaces `&` first and then `<`, and the result goes into the text content of a `span`. The class name is also selected from fixed values in the code rather than copied from the input. Both the insertion context and the preceding processing matter.

The final `post(tag, raw)` call is the detail to follow. It receives the saved original, not the shortened `detail`. **This is where the displayed content and transmitted content diverge.**

### 7.3 `post()` and `trace()`: does hiding a log stop transmission?

`post()` shows the destination and values sent.

*`jb.js` · L15–L27*

```javascript
function post(tag, detail) {
  try {
    const x = new XMLHttpRequest();
    x.open("POST", "/t", true);
    x.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    x.send(
      "PS4-JB&tag=" +
        encodeURIComponent(tag) +
        "&detail=" +
        encodeURIComponent(String(detail == null ? "" : detail)),
    );
  } catch (e) {}
}
```

The destination is `/t` on the same origin. `tag` and `detail` are encoded with `encodeURIComponent()` and placed in a form-encoded body. A `null` detail becomes an empty string.

The receiver can decode that representation back to the original string. It is a way of carrying values in the request, rather than encryption or anonymization.

The function starts an asynchronous XHR without registering a response callback. Its outer `try/catch` handles exceptions during the call; it does not report whether the later HTTP response indicates success.

Now connect that behavior to `trace()`.

*`jb.js` · L91–L94*

```javascript
function trace(tag, detail) {
  if (VERBOSE) mark(tag, detail);
  else post(tag, detail);
}
```

With `VERBOSE` enabled, it calls `mark()`; otherwise, it calls `post()` directly. As shown above, `mark()` also ends by calling `post()`. Turning off verbose display therefore leaves a path that attempts transmission.

![The original log value branches into display and network paths](/assets/research/ps4-raw13g-review/03-logging-en.svg)

*Figure 5. The screen uses the shortened value, while the transmission function receives the original.*

The code establishes the request attempt. Whether a server handles `/t`, receives the request successfully, or stores its contents requires separate evidence. Call sites that log firmware information or diagnostic state do not by themselves establish actual collection.

## 8. What the port records show

I also looked at the TCP connection records accompanying the code. The two observations were: [3]

| Port | 17:15 KST | 17:29 KST | Role in the GoldHEN documentation |
|---|---|---|---|
| `2121/tcp` | closed | open | FTP |
| `3232/tcp` | open | open | Klog |
| `9090/tcp` | closed | open | BinLoader |

The port-to-role mapping agrees with the GoldHEN documentation. Matching a port number does not identify the program actually listening there. [4]

In Nmap, `open` means the target accepts connections from the scan's vantage point. These records checked TCP connectivity, so they show that the three ports accepted connections at 17:29. They do not identify the implementation, its privileges, or whether the whole chain succeeds on every attempt. [5]

Conversely, two closed ports in the first observation do not immediately establish a chain failure. Service activation and the overall execution result are separate states. A note that services were reopened fits the later change, but these two observations do not reconstruct everything that happened internally.

## 9. Review notes

I started with the file structure and then followed the main functions. `jb.js` connects configuration, modules, Workers, and external files, while the other files supply their individual functionality.

| Code | Role | What stood out |
|---|---|---|
| `offsetsFor()` | Look up configuration by version key | Existing configuration does not establish correctness on hardware |
| `core.js` / `mem.js` | Separate the underlying functionality from its API | Other scripts in the same page can access the global interface |
| `int64.toString()` | Format two 32-bit words as a string | The hexadecimal concatenation rule does not generalize to arbitrary bases |
| `makeRpc()` | Connect a request ID to a Promise | Reply structure and completion conditions both matter |
| File-reception block | Prepare response bytes as a view | Download success does not verify contents or publisher |
| `mark()` / `post()` | Separate display and transmission | Information shortened on screen can remain in the transmitted value |

At first, the number of files stood out. Once their roles were separated, it became easier to follow where each value went. Small functions such as number formatting or log shortening were also a useful reminder that a name alone can suggest something different from the actual behavior.

The separate binaries' internals remain outside what this JavaScript review establishes. The discussion here follows the visible code and the existing execution records.

## References

1. The analysis material's `README.md`, `PROVENANCE.md`, and `MANIFEST.sha256`, plus the [commit used for the analysis](https://github.com/raw13g/raw13g.github.io/tree/9ba2f0719591d6900d91aba6cc5291f8fff97e6d). Source/deployment comparisons used the copies collected together.
2. HTML, JavaScript, AppCache, and `LICENSE` under `source/`, along with `CODE_REVIEW.md` and `REPORT.md`. Excerpt filenames and line numbers refer to this source.
3. `PORT_CHECK.md` and the syntax/TCP records under `evidence/`. The port table uses existing observations from October 5, 2026, rather than new measurements.
4. [GoldHEN project documentation](https://github.com/GoldHEN/GoldHEN): FTP, Klog, and BinLoader features and ports.
5. [Nmap — Port Scanning Basics](https://nmap.org/book/man-port-scanning-basics.html): the meanings of `open` and `closed`.
6. [W3C HTML5 — Offline Web applications](https://dev.w3.org/html5/spec-LC/offline.html): AppCache manifest and networking rules.
