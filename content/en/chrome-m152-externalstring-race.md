---
title: "[V8] Chrome M152 ExternalString race and sandbox boundary research"
description: "The cause of Chrome M152's ExternalString double-fetch race, browser reproduction, reliability work, and the fix invariant."
date: "2026-10-01"
translation_key: "chrome-m152-externalstring-race"
tags: ["V8", "Chrome", "Sandbox", "Race condition"]
category: "V8"
concept_demo: "m152-lifetime"
private: false
published: true
---

This post revisits the `ExternalString` double-fetch race I investigated in Chrome M152.

The public account omits build-specific addresses and the complete PoC, while retaining the cause, object-lifetime transitions, and the work used to stabilize repeated experiments. Final impact was validated by reading `/etc/hosts` in an authorized local environment. [5]

The initial question was fairly simple. Could memory corruption inside the V8 sandbox affect the lifetime of an external native object? If external pointers are managed through a table, what happens when a retained reference and the object it represents no longer agree?

A race observation and completion of subsequent browser behavior were different outcomes. The early d8 record contains `11/150` UAF observations; later review compared ownership, allocator reuse, and observation interventions. This account follows public local outcomes alongside their experimental units. [18]

This post connects the cleanup cause and the invariant maintained by the fix with experiments, failures, and completion records in the preserved report. The main text follows research questions and outcomes; Appendix A retains all six exchange helpers and their code flows. A [public evidence summary](/assets/research/chrome-m152-externalstring-race/evidence-summary.en.md) and the conceptual lifetime demonstration accompany the analysis. [18]

## 1. The starting assumption

The recorded target is Chrome 152.0.7977.64 / V8 M152. The subject is cleanup and lifetime management of ExternalString resources, and how changes to sandboxed state affect external native objects in the same renderer. Target identifiers and execution assumptions follow below; section 9.1 records the evidence available for each claim.

### 1.1 Pinning the target build and its provenance

The technical revision identifies the target by source revisions and a binary fingerprint as well as its version name. This account separates relationships checked in the public repositories from values reported by the research material. [15, 16]

The `chrome/VERSION` file at Chromium revision `506c834eccea` identifies Chrome `152.0.7977.64`. DEPS at the same revision pins `v8_revision` to `6aacaf6256a0`, whose `include/v8-version.h` defines V8 `15.2.124.18`.

The full identifiers follow. The Chrome SHA-256 is **reported by the research material**.

```text
Chromium revision: 506c834ecceaa943c5f41e6cfe7f68acb5c45346
V8 revision:       6aacaf6256a069ee455142333b7d38cad1c8d6e0
Chrome SHA-256:    3ed7df7904694145caf8da676d053f68300e8d2778a507e27b15f142c4efd0af
```

The checked public-source relationship is `Chrome VERSION → Chromium DEPS → V8 VERSION`, supporting consistency of the version identifiers. Section 9.1 records the extent of the binary and build-record checks.

The patch functions reproduced here come from fix revision `7d1fb25`. The target revision identifies the investigated version; the fix revision identifies the cleanup change.

### 1.2 Execution conditions and what the result means

The starting capability is **that memory inside the V8 Sandbox can already be corrupted**. On the M152 target in section 1.1, the investigation asks whether external-string resource lifetimes and native memory outside that boundary remain protected under this assumption. How the preceding work obtained in-sandbox access is a separate research subject.

V8's memory boundary separates sandboxed state from external memory. Chrome's OS process boundary restricts accessible files and OS resources. These responsibilities frame the lifetime analysis in section 3 and the file-read result in section 11. [1, 2]

The reported **local tests used Linux x86-64 with the process sandbox disabled**. Elevated privileges in the local checkpoint were granted before execution. The file read therefore validates completion within existing OS privileges; it does not mean that the chain acquired new OS privileges. Section 11.1 interprets the outcome. [3, 16]

## 2. ExternalString and external resources

It is easy to picture a JavaScript string as an object whose character data all lives inside the JavaScript heap. `ExternalString` instead connects a string representation to external resources. That means the state visible to V8 and the state maintained by native resource owners must be considered together.

The character contents are only part of the problem. Ownership, cleanup, and the lifetime of the final user must also agree. A plausible pointer value does not establish that the object expected at that location is still alive.

The V8 Sandbox limits the spread of corruption from its heap to other memory in the process. External references can use indirection through an External Pointer Table, or EPT, instead of treating a field in a sandboxed object as a raw native address. [1]

This led to two separate questions: whether the **reference path is permitted**, and whether the **referenced object is still alive**. Both conditions must hold.

![Diagram separating V8 memory isolation from the renderer's OS resource boundary](/assets/research/chrome-m152-externalstring-race/01-boundaries.svg)

*Figure 1. Memory isolation inside a renderer and OS resource restrictions are separate boundaries. This diagram shows protection scope, not addresses or a bypass route.*

### 2.1 Lifetime contracts in the public API

The public header separates character access through `data()` and `length()` from resource cleanup. Its default cleanup includes the following excerpt from the resource base class. [6]

```cpp
virtual void Dispose() { delete this; }
```

Subclasses may override disposal. Immutable character data and a live resource object are different conditions: surviving bytes do not make a call through a destroyed resource valid. [6]

### 2.2 Separate the string, resource, and character buffer

I will use the following symbols to describe the relationship. They are analytical labels, not actual fields or a byte-level layout.

**H** denotes the string object in the V8 heap, **h** its external-reference handle, and **E** the external pointer table entry. The engine tracks H's liveness; h and E concern which target is referenced and whether that reference resolves to a valid target.

**R** denotes the native resource object and **B** the character buffer it supplies. Resource ownership and lifetime must be distinguished from the validity of data access to B.

Observing `H` does not automatically prove that `R` is alive. Retained contents in `B` do not prove that `R` survives either. These observations concern different states. Without that distinction, apparently normal character data can hide a resource-lifetime problem.

![Conceptual relationship between a string object, handle, EPT entry, native resource, and character buffer](/assets/research/chrome-m152-externalstring-race/06-external-reference.svg)

*Figure 2. The H, h, E, R, and B relationship. Table state must remain consistent with resource lifetime. This is not a reproduction of the target build's memory layout.*

## 3. The lifetime inconsistency under investigation

The investigation began with the `ExternalString::DisposeResource` cleanup path. The retained analysis identifies a double-fetch in that path as the central cause. [3] The public fix names issue `532204454` and describes inconsistent EPT state during resource disposal. [8]

A double-fetch reads shared state at different times. Reading twice is not inherently a vulnerability. The important question is whether the state can change between those reads while the code continues to assume that the earlier and later operations concern the same target.

Resource cleanup has at least two meanings: ending the actual object's lifetime, and ensuring that references to that object are no longer treated as valid. If those responsibilities become inconsistent, an object may be gone while a path to it remains.

That inconsistency was the focus here. The key question was whether **the object being cleaned up and the reference regarded as cleaned up still represented the same target**.

A later use of a retained reference can lead to a use-after-free, or UAF. Section 9.1 sets out the evidence for retaining a reference, using it, and observing an external-memory effect.

![Object and reference states after normal cleanup and after a lifetime inconsistency](/assets/research/chrome-m152-externalstring-race/02-lifetime.svg)

*Figure 3. Normal cleanup keeps object lifetime and reference validity consistent. A lifetime error can leave a reference to an object whose lifetime has ended.*

### 3.1 Express the conditions for safe use

The relationship can be represented by an analytical predicate. This is a model of conditions that must hold together, not V8 implementation code.

```text
SafeUse(h, R, t) =
    ResolvesTo(h, R, t)
    AND ExpectedKind(R)
    AND Alive(R, t)
    AND HeldForThisUse(R, t)
```

Resolution to `R`, the expected kind, liveness, and ownership covering the current use are distinct conditions. Satisfying some does not establish the others.

Checking only at the beginning of a use is insufficient. A safe ownership model requires the **whole use interval to fall within the resource's lifetime**. A reference may still resolve as an address while temporal memory safety has already failed.

### 3.2 Atomic reads and consistent operations

Atomicity of one shared-state read and target agreement throughout cleanup are different guarantees. An atomic read prevents a partially mixed value, but does not establish that later work processes the same target.

The developer's intended result is **agreement between the disposed resource and the previous target of the reference being cleaned up**. The defect in the earlier path was that its reference-resolution operations could fail to maintain this agreement as one contract. Disposal and reference cleanup concerning different targets can leave an apparently valid path to an ended object, violating temporal safety. [8, 18]

The fix retains the selected entry's exchange result as a local cleanup value. Connecting `value` in the fixed function in section 3.3 with Appendix A's return path shows that the central change is the **data dependency between target selection and disposal**, rather than merely the number of reads. The null check and accounting predicates govern the subsequent callbacks.

#### 3.2.1 The pre-fix code and the `h1/h2` interleaving

The following excerpt reduces the target M152 revision to the semantics relevant to the defect. The implementation has additional branches and types; the essential point is that the first `load()` and final `store()` interpret `resource_` at different times.

```cpp
// Vulnerable shape — target M152 revision, simplified
Address value = resource_.load(isolate);
auto* resource =
    reinterpret_cast<ExternalStringResourceBase*>(value);

if (resource != nullptr) {
  resource->Unaccount(reinterpret_cast<v8::Isolate*>(isolate));
  resource->Dispose();
  resource_.store(isolate, kNullAddress);
}
```

Let `h1` and `h2` be two valid handles. If the first read selects resource `R2` through `h2`, and another execution flow changes the heap field to `h1`, cleanup callbacks still run on `R2` while the final store can clear the EPT entry currently selected by `h1`.

```text
Cleanup flow                                 Concurrent flow
────────────────────────────────────────────────────────
read h2 from resource_ and select R2
R2.Unaccount()/Dispose()
                                             resource_ = h1
resource_.store(null) reads current h1
EPT[h1] is cleared while EPT[h2] retains disposed R2
```

| Point | `resource_` | `EPT[h1]` | `EPT[h2]` | Result |
|---|---|---|---|---|
| Start | `h2` | live R1 | live R2 | both resources alive |
| After first read | `h2` | live R1 | live R2 | local value denotes R2 |
| After `Dispose(R2)` | `h2` | live R1 | R2's former address | R2 lifetime ended |
| After field change | `h1` | live R1 | R2's former address | the `h2` path remains |
| After final store | `h1` | `null` | **R2's former address** | `h2` is dangling |

The defect is therefore not merely the syntax of reading twice. It is the possibility that **the resource being disposed and the EPT entry being invalidated no longer have the same identity**. On the research build, the released resource occupied a 48-byte size class, and later experiments separately measured whether a like-sized allocation reused that exact address. This size is build-specific and is not a portable property of other versions.

The fixed form uses `exchange()` to clear the selected entry and return that entry's previous address, then disposes only the returned object.

```cpp
Address value = resource_.exchange(isolate, kNullAddress);
auto* resource =
    reinterpret_cast<ExternalStringResourceBase*>(value);

if (resource != nullptr) {
  resource->Unaccount(reinterpret_cast<v8::Isolate*>(isolate));
  resource->Dispose();
}
```

The complete function below and Appendix A's exchange helpers retain the shared-space branch and GC-mark handling omitted from the simplified comparison.

### 3.3 Read the complete cleanup function

This is the complete `DisposeResource` function from [`src/objects/string-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/objects/string-inl.h#L1525) at fix revision `7d1fb25`, including its branches, accounting callback, disposal call, and GC-related scopes. [9]

```cpp
void ExternalString::DisposeResource(Isolate* isolate) {
  DisallowGarbageCollection no_gc;

  Address value = resource_.exchange(isolate, kNullAddress);
  v8::String::ExternalStringResourceBase* resource =
      reinterpret_cast<v8::String::ExternalStringResourceBase*>(value);

  // Dispose of the C++ object if it has not already been disposed.
  if (resource != nullptr) {
    if (!IsShared() && !HeapLayout::InWritableSharedSpace(this)) {
      resource->Unaccount(reinterpret_cast<v8::Isolate*>(isolate));
    }
    DisableGCMole no_gc_mole;
    resource->Dispose();
  }
}
```

![Null, accounting, and disposal branches in the fixed DisposeResource](/assets/research/chrome-m152-externalstring-race/07-dispose-flow.en.svg)

*Code flow A. Cleanup at the fix revision. A null result skips callbacks; shared-state predicates govern the accounting callback.*

[View at full size](/assets/research/chrome-m152-externalstring-race/07-dispose-flow.en.svg)


`DisallowGarbageCollection` is a debug assertion scope marking where GC must not occur, rather than a synchronization lock. `DisableGCMole` skips GCMole verification around raw resource work; it also does not synchronize shared references. [11]

`resource_.exchange` obtains the selected EPT entry's previous value while clearing its pointer value. [10] `reinterpret_cast` expresses that address as a resource pointer without checking liveness. The null check skips callbacks when no resource is present; a non-null pointer does not establish that its target is alive.

`Unaccount` is an external-memory accounting callback with an empty default implementation. Subclass behavior remains distinct from disposal. [12] `Dispose()` calls the resource's cleanup implementation; its default behavior and subclass contract are described in section 2.1.

`value` contains the pre-exchange value. The disposal block runs only if the resource represented by it is non-null. `Unaccount` is called only when both shared-state predicates are false. The resource callback contract and the EPT exchange implementation must be read together.

The function must keep reference cleanup consistent with disposal of the same resource. Casting and null checks do not themselves establish that lifetime contract.

### 3.4 Source facts and the cause interpretation

The first invariant used to connect the fix with observations is that **the disposed resource must be the previous target of the EPT entry whose pointer was cleared**. If the lifetime of `R` ends, the entry `E` updated by that cleanup must have referred to that same `R`. Reference updates and disposal concerning different targets can leave an access path treating an ended object as valid. [8]

**The contract failure on the cause side** is that separate reference operations could fail to preserve this target agreement. Atomic individual reads still require a guarantee that the beginning and end of the operation concern the same target. Stronger memory ordering alone does not establish target identity. This is why the cause is not attributed to casting syntax, a missing null check, or the mere presence of `Unaccount`.

**The fix's response** is to use the exchange result from the selected entry as the disposal target. The fixed sandbox path selects an entry by handle and exchanges its payload. A successful CAS binds replacement with the new payload and determination of the immediately preceding payload in **one atomic operation**. Treating them as an independent determination of an old value followed by a separate write loses this relationship. [10]

The previous address returned by the entry function propagates through the delegation layers into `DisposeResource`'s local `value`. Casting and callbacks use the resource represented by that local value. Read together, code flows A–C show **the selected entry's exchange result leading to disposal of that same resource**. The heap member's handle, the existence of an EPT slot, and the payload's pointer value are distinct states; the sandbox exchange updates the selected payload. [9, 10]

**The question for execution review** is which object ended its lifetime and whether a reference treating that object as valid was used. This leads into the research progression in section 5 and the final result in section 11. Section 9.1 collects the source and execution evidence boundaries.

### 3.5 Inputs, branches, and effects of cleanup

The top-level function returns `void`. Its internal exchange returns a previous address, but `DisposeResource` does not return that address to its own caller. It performs cleanup using its member and the `isolate` context. [9]

A null exchange result means there is no previous resource address to process, so the callback block is skipped. When a resource exists and both shared-state predicates are false, `Unaccount` runs before `Dispose`; accounting and disposal remain distinct callbacks.

If either shared-state predicate is true, only `Unaccount` is skipped. `Dispose` is still called.

After exchange, `value` remains in a local variable. The cast expresses it as the pointer type needed by the callback; it neither creates an object nor checks liveness. `Unaccount` is virtual, so its empty base implementation must be distinguished from subclass behavior. [9, 12]

Table reference state and resource disposal must be read together. The former changes EPT state; the latter executes the resource contract. Reading only one side is insufficient to explain the complete lifetime operation.

### 3.6 Target consistency and lifetime during use are separate contracts

I read the fix against two questions: does the selected entry remain bound to the previous resource returned by the operation, and who preserves the lifetime of other users already accessing that resource? [8–10]

Consistent target selection is visible in cleanup's use of the selected EPT entry's exchange result. Ownership held by other users of the resource requires separate review.

The sandbox path clears that payload's pointer value before disposal callbacks. Other references' and caches' validity periods are separate contracts. Exchange itself does not acquire a lease or wait for outstanding users, so surrounding code's coordination of use and disposal must also be reviewed.

A successful CAS establishes replacement of one payload. It does not make the later virtual callbacks part of the same atomic operation. Expressing the previous address as a C++ pointer is also not ownership acquisition. Target consistency and the whole object's lifetime contract therefore remain distinct claims.

The review therefore separates target consistency maintained by this function from use lifetimes coordinated by callers and resource implementations. Section 3.7 distinguishes the root cause from subsequent review questions.

### 3.7 Separate the root cause from later review questions

**Cleanup-target consistency** is the cause addressed directly by this public fix. The review criterion is whether disposal concerns the previous pointer from the exchanged entry. Clearing an entry and disposing a resource must refer to matching targets.

**Lifetime and ownership** explain why that consistency matters for memory safety. An interpretable EPT handle does not establish resource liveness or ownership held by the current user. The same memory address also does not establish continuity of the same object's lifetime. This separates treating an ended object as valid from a generic pointer-value error.

**Data caching and consumers** are conditions for interpreting browser observations. `resource_` concerns the resource object, while `resource_data_` concerns string data. A resource's disposal state alone does not establish the validity periods of every data reference. Section 7.3 uses types and API contracts to distinguish owning references from stored data addresses.

**Control-flow checks** constrain permitted call relationships. Liveness of the object used by a call is a separate condition, as discussed in section 8.

The six exchange helpers in Appendix A are not six separate vulnerabilities. They divide tag selection, field interpretation, entry selection, and payload exchange across one cleanup path. Complete source, contract tables, and flow graphs remain together for reviewing each layer. [9, 10, 17]

## 4. The protection assumption behind the bypass research

This raises the obvious question: how can a boundary problem exist when an EPT is present?

The direction investigated was whether **a mismatch between an indirect reference and its target's lifetime could undermine native memory safety outside the sandbox**. A reference following an allowed route and its target remaining valid are different guarantees.

EPT design includes temporal safety as well as type checks. The official source describes table management that keeps valid entries tied to live objects. Its `Verify()` and `ManagedResource` explanations likewise emphasize agreement between table state and resource lifetime. [7]

The research question is consequently whether cleanup can break the consistency needed to sustain that guarantee. Verifying that indirection and type checks exist does not finish the lifetime analysis.

The analysis therefore asked what a check actually guaranteed and what had to remain true independently. A reference can have the expected form or category while its target's lifetime has ended. An object can also be alive without being the same object that the current operation was supposed to use.

The same distinction matters defensively. Introducing indirection is only part of the design. The guarantees about the referenced target must continue to hold while it is being cleaned up.

### 4.1 Spatial and temporal safety

Type consistency asks whether the expected kind of target is being used and constrains reference interpretation. Spatial safety concerns access within the permitted object's bounds: the location and extent of an access.

Temporal safety concerns whether the object is alive when used, linking release and use. Identity consistency asks whether a multi-operation task continues processing the same object established earlier.

The focus of this analysis is external-object temporal safety and identity consistency.

## 5. The questions that guided the investigation

The preserved notes and later summaries are organized around **which judgment an observation supported, and what needed to be checked next**. The following account connects review questions from source analysis, d8 tests, browser progress records, and completion summaries. Section 9.1 records their provenance. [3, 16]

![Research questions grouped by cause, observation, browser context, and interpretation](/assets/research/chrome-m152-externalstring-race/04-research.svg)

*Figure 4. A map of research questions. It does not show executable exploit steps or their dependencies.*

### 5.1 From a source-level cause candidate to execution observations

The starting hypothesis was that an external resource's lifetime could end while an EPT reference remained valid. The target-agreement invariant in section 3.4 supplies a criterion for examining that hypothesis. It explains why the review needed to go beyond a crash location and examine the relationship between the disposed object and a reference treating it as valid.

The early d8 records contain UAF observations, providing grounds for comparing the source-level lifetime hypothesis with execution evidence. The next question was **whether the same lifetime relationship fails in the browser**. Section 6 covers the counts and environmental differences. [3]

### 5.2 From d8 outcomes to browser object lifetime

Different observation counts on the shared host and in the separate d8 test signaled that execution conditions mattered. Rather than attributing the difference to one of several changed conditions, the review needed to compare the event being counted and the observation interventions. The difference alone did not establish the vulnerability's presence or absence.

A browser adds page and Worker lifetimes, string-retention paths, caches, and native allocations. Moving the d8 interpretation into that environment therefore expanded the questions. Alongside **whether a similar symptom appeared**, it became necessary to ask **whether the resource involved was the very object whose lifetime had ended**. The later ownership and consumer-path review addresses that question. [3]

### 5.3 Separate surviving data from a live object

Surviving string data did not support the assumption that the resource object remained alive. `resource_` concerns the resource object, while `resource_data_` concerns character data. Section 7.3's field types and API contracts supply the basis for separating data-retention contracts from object ownership. [17]

If another owner retains the object, disappearance of some references does not establish the end of its lifetime. Conversely, data or address values surviving disposal do not establish that the object remains alive. Experiments that did not establish the expected lifetime ending, or whose later consumer did not use the expected target, required revisiting the original explanation. [3]

The resulting review criterion was to treat **address changes, visible character data, disposal, and actual use as separate observations**. The next judgment needed object identity and a lifetime interval in which a value could be interpreted, rather than merely a value at a location. Section 7 makes that criterion concrete for reference counts and caches.

### 5.4 From intermediate effects to a final completion verdict

The browser records continue into review of external native-memory effects and subsequent behavior. Native-memory errors, observations at indirect calls, and completed file I/O remained separate verdicts. Section 8's separation of CFI call relationships from liveness, and section 9's separation of debugger intervention from execution outcomes, supply conditions for those verdicts. [3]

The technical revision's evidence map retains early browser results in which the final action was not completed. They provide a failure baseline for comparing intermediate observations with completion verdicts. Later local completion summaries and confirmation of the `hosts` read establish **cases completing the final file read**. Sections 11.2–11.3 discuss execution units and denominators for rates. [5, 16]

The research connection therefore does not simply attach a file read to the name UAF. It fixes the source-level target, reviews lifetime relationships in execution, checks browser object identity, and distinguishes what completion records establish. Section 11 presents the final result's evidence; section 12 examines the patch implementation addressing the same cause.

### 5.5 A chronology of the preserved evidence

**7 September — separate conditions from observed events.** Roughly `0/950` on the shared host and `11/150` in the separate d8 test record the same class of observation under different conditions. Report section 4 preserves them as the starting point for reviewing environmental dependence. [18]

**8 September — compare disposal with actual consumption.** Browser records examine which object ended its lifetime and what was subsequently used, alongside address values. Local outcomes from that day separately record `hosts` output and a test-file output, requiring distinct completion goals. [18]

**10–13 September — review ownership hypotheses and observation intervention.** The report records why references remained, whether the expected lifetime ending was established, and how debugger-created states differed from natural execution observations. This strengthened explanations that had relied on changed values alone. [18]

**14 September — compare conditional verdicts with overall completion.** An eligible branch recorded `5/5` for a particular intermediate installation verdict, while completed output across the same experiment group was `2/60`. Separate local `hosts` reads were reported without dependence on debugger or parent-process memory observation. Section 11.3 interprets the counts. [18]

**15–16 September — fix the unit of repeated validation.** Initial browser failures and subsequent completions remain in the record. The final report's unit for no observed failure is an execution group containing several attempts, distinct from an individual race verdict. Section 11 separates that reported conclusion from the availability of its exact denominator. [18]

### 5.6 Reliability improvements during roughly two weeks of research

Reliability did not improve merely by increasing the retry count. Each run was classified by the stage at which it failed, and each change was assessed against the outcome at that stage.

1. **Separate execution environments:** roughly `0/950` on the shared host and `11/150` under CPU-isolated d8 conditions were treated as different populations. The work first established a baseline in which the race could be observed.
2. **Count semantic winners:** a crash or changed value was insufficient. A winner had to show the expected relationship between the disposed object and retained handle. Address changes, disposal, and later consumption remained separate events.
3. **Narrow the race window:** promises, timers, logging, debugger stops, and unnecessary allocation were removed between publishing the handle and invoking the vulnerable cleanup. Instrumentation moved outside the window to reduce observer effects.
4. **Separate allocator roles:** long-lived objects retaining the dangling reference were separated from short-lived objects shaping allocator state. Exact-address reuse was measured independently for the 48-byte resource and a later 80-byte native object; simply increasing spray volume was not treated as proof.
5. **Reduce the number of required races:** the early design recreated a native-read condition several times. The later `read1` design connected the first genuine resource directly to the read primitive, reducing three consecutive race requirements to one.
6. **Isolate attempts:** a failed renderer was not reused for the next attempt. A fresh renderer recreated heap and allocator state, while the controller was limited to launch, timeout, and result collection.

These changes did not make an individual race mathematically certain. They restructured the chain so that a later stage did not repeatedly demand the same accidental state. Under the simple model `p = 11/150`, reducing three consecutive races to one changes the modeled prefix from `p³ ≈ 1/2,536` to `p ≈ 1/14`. Browser events are not actually independent and identically distributed, so this compares design complexity rather than reporting a measured completion rate.

## 6. Moving from d8 to the browser

The early observations varied substantially across environments. The preserved notes describe roughly 950 runs on a shared host with no observed UAF, followed by a separate d8 test configuration with 11 observations in 150 runs. [3]

The shared-host configuration recorded 0 UAF observations, while the separate d8 sample's observation rate was approximately 7.33%. Each figure applies to its own test conditions and sample.

The first result could make the problem seem difficult to observe. However, races depend on execution order and observation timing. Failure to observe an event does not establish that a vulnerability is absent. Conversely, when several environmental conditions changed together, the difference cannot be attributed to one of them without further evidence.

Those d8 observations led to review of the same lifetime relationship in the browser.

A browser contains more surrounding state than a standalone engine. Page and Worker lifetimes, string creation and retention, caches, and native allocations interact. Even when the same class of error is involved, different surrounding conditions can change what happens afterward.

The research questions therefore expanded. Initially the question was whether the lifetime error occurred. In the browser, it also became necessary to ask whether the observed symptom came from that same error, and whether the object was truly no longer owned.

## 7. Rechecking ownership and object identity

Ownership and lifetime recur throughout the later notes. The disappearance of one reference did not establish immediate destruction of the object. Another owner or another retention path could still keep it alive.

Reference counts required the same care. A value can be interpreted as a reference count only when it belongs to the expected field of a still-identifiable object. Once the object's identity has been lost, reading a number from the same location can mean interpreting unrelated data as the old field.

Allocator behavior also affected interpretation. Changed bytes did not alone establish the intended object's release. Seeing the same address again did not establish that the same object had remained alive. **Address identity and object identity are different facts.**

The retained research includes experiments that rejected hypotheses. If the expected end of lifetime was not established, or a later consumer did not use the expected target, the original explanation could not simply be preserved. That required revisiting the assumption even when the result was inconvenient.

This applies beyond exploitation. In ordinary native debugging, “the value changed” and “this destructor ran and released the object” are different claims. Directly observed events should be distinguished from interpretations based on surrounding evidence.

### 7.1 Read reference counts within an ownership contract

A positive reference count does not, by itself, explain a safe use. The object's identity must be established, and acquiring ownership must be synchronized correctly with retirement. Attempting to inspect a count through an already destroyed object may itself be unsafe.

I therefore treated `object identity → ownership acquisition → use interval → ownership release` as an analytical contract, rather than reading only `address → field value`.

### 7.2 Caching and ownership are different states

A cache retains a value. Whether that value owns a resource or only observes one whose lifetime another owner guarantees requires separate inspection. Retaining a numeric address does not create a new owner.

When browser results differed from d8, the existence of a cache alone did not establish the cause. It was necessary to distinguish paths that retain an object from paths that merely retain a reference value. Otherwise, a resource that was not destroyed and one that was destroyed while bytes remained could be misclassified as the same outcome.

### 7.3 Reading caches through types and API contracts

The target revision's `src/objects/string.h` and `include/v8-primitive.h` make the resource object and string-data address more concrete. [17]

`UncachedExternalString::resource_` uses `kExternalStringResourceTag` and refers to the resource object. `ExternalString::resource_data_` uses `kExternalStringResourceDataTag` for an external data member. The data address and the resource-object reference have distinct roles.

`IsCacheable()` declares whether the `data()` result may be cached and returns true by default. Cacheability does not create ownership. `Lock()` and `Unlock()` keep non-cacheable data stable during the protected interval; the API requires thread safety and support for nested calls, although their base implementations are empty.

`Unaccount()` is a virtual accounting callback with an empty base implementation. Accounting state differs from destruction. `Dispose()` cleans up a resource when it is no longer needed and defaults to `delete this`; review which memory and ownership the subclass releases.

The distinct tags show that the two members have different meanings. Correct tag interpretation does not establish liveness: type, data stability, and resource lifetime are separate properties.

`IsCacheable()` governs whether a returned data address can be retained. The header says non-cacheable data is not expected to remain stable beyond the current top-level task, and requires stability between `Lock` and `Unlock`. Empty base lock methods also mean their names alone do not establish an actual mutex.

The same header requires external string data to be immutable. Immutability of contents and lifetime of the object containing those contents are distinct contracts. Unchanging contents do not permit continued use of an address after its owner has been destroyed.

## 8. Separating CFI from memory safety

Control-flow protection also mattered when reviewing later effects in Chrome. Control Flow Integrity, or CFI, constrains operations such as indirect calls to permitted control-flow conditions. Section 9.1 records the extent of the target-build configuration checks. [4]

An effect on a memory value and a completed call are different events. The review distinguishes reference paths, object lifetime, and call relationships.

The reverse mistake is assuming that a control-flow check also resolves every lifetime error around it. Guarantees about a call target and guarantees about an object's continued existence require separate examination.

An allowed reference mechanism and the liveness of its target are separate conditions. Using an object during its valid lifetime also does not establish that the call satisfies control-flow checks.

Even when an indirect call meets its control-flow conditions, the preceding data and ownership states require separate review.

![Reference path, lifetime, control flow, and OS privileges as separate review dimensions](/assets/research/chrome-m152-externalstring-race/05-guarantees.svg)

*Figure 5. Distinct properties covered by different protections. This is not an inventory of all checks or bypass routes in a particular build.*

### 8.1 Checked types and object liveness

Clang distinguishes schemes such as `cfi-vcall` for virtual calls and `cfi-icall` for indirect function calls. Coverage depends on the build and the entity being checked. [4]

An allowed call-type relationship and a continuously live object are different propositions. Conversely, a run stopped by a CFI check cannot count as completion of the behavior after that check.

Section 9.1 distinguishes the evidence needed to compare the target build's check sites with execution results.

## 9. Observation tools were part of the environment

Race analysis naturally creates a need to inspect intermediate state. Yet the debugger or instrumentation used for that inspection can affect execution order. The records explicitly distinguish intervention used for observation from the results of ordinary execution. [3]

A state inspected at a breakpoint can help explain the cause. It does not automatically prove that the same state arises in the same way without the debugger. If a debugger forcibly changed a value, the experiment can support a claim about a later segment; it does not prove that the earlier segment completed naturally.

I therefore read mechanism experiments separately from repeated-run measurements. The former help explain what happens. The latter describe what was observed, and how often, under specified conditions.

Even within one run, observing a race, confirming a memory error, and completing a predefined final action were separate verdicts. Counting a whole run as successful from one early marker would hide later failures.

This is also why failure records matter. Recording only a missing final output does not explain the cause. Recording only intermediate progress does not establish completion. The evidence needed for each claim must be decided explicitly.

### 9.1 Evidence provenance and review scope

The earlier technical revision's `EVIDENCE-MAP.md` associated claims with report sections. The new full-review ZIP actually includes the **research report and some original checkpoints and aggregate records** named by that map. Reference 18 links a public summary of the materials compared here. [16, 18]

**Source checked directly:** the `Chrome VERSION → Chromium DEPS → V8 VERSION` relationship, target API contracts, and cleanup/exchange functions at fix revision `7d1fb25`. Target and fix sources are different revisions. The executed binary was not obtained to recalculate its SHA-256 or inspect build options, so identity with the target source remains unestablished. No fixed-binary regression run was performed. Shipping-version coverage, including M153, and public access to the issue body were not separately verified. [8–10, 15, 17]

**Symptom and cause observations:** call locations, object liveness, reference use, and external-memory effects require corresponding records. The new report explicitly excludes simple crashes and executions after forced intermediate state from whole-run completion verdicts. The confirmed cause here is cleanup-target consistency; ownership, caching, and CFI review questions are not additional confirmed vulnerabilities. Spatial/type faults and every CFI check site in the target build are not separately established findings either. [3, 4, 18]

**Completion records and subsequent confirmation:** local completion records support the author-confirmed `hosts` read. The v147 checkpoint concerns a separate local test output. The report also states that no failure was observed in the later repeated validation, but this edit did not audit every raw campaign log or an exact final session count. The public account therefore centers on verifiable local outcomes and measurements with preserved denominators. [5, 18]

**Integrity and verification scope:** all 15 manifest-listed files in the earlier technical ZIP and all 20 `SHA256SUMS` files in this full-review ZIP matched their digests. The additional original report expands the evidence available for review, while matching hashes establish file integrity. Preparing this post did not involve executing the original PoC or revalidating every stage in one run. Hashes for the public summaries identify those distributed summary files themselves. [16, 18]

## 10. A conceptual object-lifetime demonstration

The demonstration is a **conceptual model** comparing three object-lifetime states. It displays predefined object and reference states; its timer advances the scenes. It does not execute a Chrome/V8 vulnerability or a particular patch's regression test.

- **Normal cleanup:** when use ends, the reference becomes invalid.
- **Lifetime mismatch:** the object has ended but a reference remains. The display highlights that inconsistency.
- **Defensive invariant:** a state that treats an ended object as usable is rejected.

<!--DEMO-->

[Open the conceptual demonstration separately](/assets/research/chrome-m152-externalstring-race/m152-lifetime-demo.html#en)

The important feature is not the warning color. It is whether **object liveness and reference validity continue to describe a consistent relationship**. In a real investigation, that relationship must be supported by observations rather than assumed.

## 11. Local validation and the `hosts` file read

The investigation continued, and **the final chain successfully read local `/etc/hosts`.** [5] The early d8 UAF observation, browser intermediate states, and final file read remained different success verdicts. This separation showed which changes improved the race itself and which stabilized later stages. [18]

![Separate evidence requirements for symptoms, causes, outcomes, and rates](/assets/research/chrome-m152-externalstring-race/03-evidence.svg)

*Figure 6. One crash cannot establish a cause, a final outcome, and a repeated-run success rate. Each claim requires different evidence.*

### 11.1 Scope of the public result

The successful `/etc/hosts` read establishes **completion of a predefined file read in an authorized local environment**. Report section 9 distinguishes early output from separate local test output; section 14 records local completions without dependence on debugger or parent-process memory observation. Those are preserved verdicts, not reruns performed for this edit. [5, 18]

The OS evaluates file access against process privileges and policies. Section 1.2's tests had the process sandbox disabled and required privileges granted beforehand. The result therefore demonstrates chain completion within existing privileges, not acquisition of new OS privileges. It does not guarantee equivalent access to other files or in a default browser configuration.

The public article omits build-specific addresses, control-flow details, and the complete PoC. It retains the cause code, the `h1/h2` transition, size-class reuse verdicts, and rate interpretation so that the basis of the result remains reviewable.

### 11.2 Observations and a simple probability model

The early `11/150`, approximately `7.33%`, is a sample rate for d8 trials meeting the defined UAF verdict. If that value is called `p` and every event is **assumed** to be independent and equally likely, consecutive successes produce the following model.

| Consecutive successes | Model | Probability | Approximately one in |
|---:|---:|---:|---:|
| 1 | `p` | 7.3333% | 14 |
| 2 | `p²` | 0.53778% | 186 |
| 3 | `p³` | 0.039437% | 2,536 |
| 4 | `p⁴` | 0.0028920% | 34,578 |
| 5 | `p⁵` | 0.00021208% | 471,512 |
| 6 | `p⁶` | 0.000015553% | 6,429,711 |

The probability of consecutive independent successes is the product of their individual probabilities. If each success probability is `p`, the result is `pⁿ`. The final column shows the reciprocal, `1/pⁿ`, rounded to the nearest whole number.

This table models the cost of an early design requiring several races; it is not a measured browser completion rate. Real events can be correlated through allocator state and scheduling, and different stages need not have the same probability. That is why the research reduced repeated race requirements and reused already-established state.

### 11.3 Per-stage measurements and the final repeated record

The preserved observations are grouped below by execution environment and measurement unit.

| Stage | Observation | Meaning |
|---|---:|---|
| Shared-host d8 | `0/about 950` | no UAF verdict observed in that environment |
| Isolated d8 condition | `11/150` | 7.33% single-UAF verdict |
| Early local browser | `1/20` | whole-run sample for that version |
| Later full experiment groups | `2/60` | completed output including the upstream race |
| Eligible later branch | `5/5` | intermediate installation verdict after entering the condition |

`5/5` is conditional, while `2/60` covers all trials, so the figures are not interchangeable. The later repeated-validation record states that **no failure was observed at the execution-group level**. Its exact final session count was not preserved, however, so it cannot provide a definite `N/N`, statistical confidence interval, or universal “100% success rate.” The absence of observed failures across execution groups does not guarantee success for an individual race. [18]

### 11.4 Evidence connecting cause and result

The first evidence item is patch source at a pinned revision. The data dependency from a selected entry's previous address through local `value` to disposal callbacks is directly visible. It supports the cleanup-target agreement interpretation of the cause. [8–10]

The second comprises d8 aggregates and browser progress records. Aggregates record whether the defined error was observed; progress records examine which object's ownership, lifetime, and consumption explain the observation. Crashes, cause observations, intermediate validation, and completion are not counted as the same success. [3, 18]

The third comprises local outcome records. The report's `/etc/hosts` cases and the separate fixture checkpoint retain distinct documents and verdicts. The public summary records their sections and claim scope. [5, 18]

In this connection, **source explains the cause contract, observations explain objects and execution events, and completion records explain final outcomes**. Section 9.1 collects the review scope, section 11.1 file privileges, and sections 11.2–11.3 rate units.

## 12. The invariant that matters for remediation

The retained patch review identifies agreement between the entry used to obtain the resource and the entry invalidated during cleanup as the central invariant. [3] Comparing the public fix with source at that revision shows how the exchange path below maintains it. Section 9.1 records the source and binary verification scope. [8–10]

The defensive question is whether the target established at the start remains the same target through cleanup. If shared state can change in between, the assumption that reading it again preserves the earlier meaning needs scrutiny.

It is also necessary to consider what other users can observe while cleanup is underway. A well-formed reference does not make a use safe if its target is being destroyed or has already ended its lifetime.

Comparing the patch's execution effects requires identified pre-fix and post-fix builds under the same regression conditions. The following sections set out invariants and properties for that review.

### 12.1 Defensive pseudocode that preserves ownership

The lifetime contract can be illustrated by a **generic resource registry with locking and leases**. This is a design model, not a V8 patch or an actual engine class. A lease keeps the resource alive until its use finishes.

```text
AcquireForUse(key):
    with registry_lock:
        record = registry.lookup(key)
        if record is absent or record.state != LIVE:
            return no_lease
        lease = record.acquire_lease()
        return lease

Retire(key):
    with registry_lock:
        record = registry.detach(key)
        if record is absent:
            return
        record.state = RETIRING
    record.wait_until_no_leases()
    record.destroy_resource()
    record.state = RETIRED
```

Three properties matter. Checking liveness and acquiring a lease share one synchronization scope. Retirement blocks new acquisition through the registered reference. Existing leases finish before the resource belonging to that same `record` is destroyed.

The model assumes the record itself remains stable until retirement completes, with correctly synchronized lease acquisition, release, and waiting. Waiting while holding a lock needed by a lease holder can deadlock, so changing registry state and waiting for users are separate regions.

An engine can use a different synchronization design. The review question is how it guarantees **no new uses, completion of existing uses, and cleanup of one consistent target**, rather than whether this exact pseudocode is copied into it.

### 12.2 Properties for regression verification

Regression review should establish the following conditions.

- **While a lease remains outstanding:** resource destruction has not completed. Review ownership intervals against destruction callbacks.
- **When retirement begins:** new lease acquisition is rejected. Review synchronization of registry state and ownership acquisition.
- **When selecting the cleanup target:** the same object is processed through completion. Check agreement of the selected entry, returned value, and disposal target.
- **After retirement completes:** no valid remaining reference can use the ended resource. Review reference validity periods against resource-ending conditions.
- **On duplicate retirement requests:** the resource is not destroyed twice. Review handling of already cleared entries and callback counts.

Lease terminology belongs to the general design model in section 12.1. It does not claim that the V8 function contains such a lease object. Review the equivalent properties through the ownership model of the actual engine.

The pinned EPT exchange path also calls for review of tags and GC mark preservation. Clearing a pointer must still respect that implementation's payload format and marking contract. `DCHECK` expresses a developer's expected invariant; its presence alone does not establish an equivalent release-build check. [10]

These are proposed defensive review and regression properties, not claims that five new tests were executed. They translate the lifetime concern in the records into properties an implementation should establish.

### 12.3 What the public fix is intended to guarantee

The change binds resource extraction and clearing to the same EPT entry. It removes the separate cleanup operation that resolves the reference again. This is the central difference established by the commit description. [8]

The member-level exchange delegates to the EPT exchange. The entry implementation uses a compare-and-exchange loop to install a new payload, return the previous pointer value, and preserve the existing GC mark. This describes the sandbox branch at the fix revision. [10]

The exchanged state is the **EPT entry's payload**. It does not mean that every heap handle is erased or every external reference is invalidated together. Nor is this a direct call to JavaScript's `Atomics.exchange`. [10]

The fix connects one entry's exchange result with disposal of that resource. Appendix A retains complete exchange-layer functions, six contract tables, and code flows B–C for comparing the main cause analysis with its implementation.

### 12.4 Separate the protected states

The update target determines the scope of the guarantee. The source review distinguishes three states.

The heap member handle is read and used to select an entry in the sandbox branch. This does not establish synchronization of the entire field.

The EPT entry payload is replaced with the new pointer and tag while preserving its mark; the atomic update covers that one entry. Native resource cleanup uses the returned previous address and must be read alongside actual users' ownership and callback contracts.

Here `kNullAddress` is the chosen replacement pointer value. It is not deletion of a slot or invalidation of all handles. Conversely, returning a previous address does not make it an owning lease. These distinctions allow EPT atomicity and external-resource lifetime safety to be reviewed separately. [9, 10]

## 13. Closing thoughts

The question that kept returning was: does this reference still point to the same object, and is that object still alive?

The investigation began with double-fetch and UAF. Moving into the browser required examining ownership, object identity, control-flow protections, and the effects of observation tools. Evidence at one stage did not substitute for the conclusion at the next.

Following that investigation through to the final exploit, I successfully read the `hosts` file. The result matters, and so does the record of which assumptions held and which needed to be checked again.

I wanted to preserve that progression in the public account. A final result alone hides the assumptions and the reasons for revisiting them. Listing every unsuccessful experiment would make the central lessons harder to follow. Here, I have organized the account around how the questions changed and what evidence each question required.

When studying a protection, understanding the condition it is meant to preserve is more useful than remembering its name alone. Constraining references, preserving lifetimes, and restricting calls work together, but they do different jobs.

Research records need the same precision. A line saying “it worked” is less useful than an account of the environment, the observation, and the limit of the conclusion. At the time, it always feels easy to remember the difference. A little later, it is surprisingly easy to forget.

## Appendix A. Complete exchange-path functions

These are the complete function definitions behind the exchange call in section 3.3, all from fix revision `7d1fb25`. Statements and original comments are preserved; only the outer indentation of the in-class overload is normalized. The functions belong to V8's class, type, and header context. Code blocks scroll horizontally on narrow screens. [10, 13]

Separate delegation from return: the replacement and tag travel down the call chain, while the previous address returns to `DisposeResource`. Graph B shows two field representations chosen at build time. Graph C details the entry CAS loop separately.

![Exchange-helper delegation and sandbox build branch](/assets/research/chrome-m152-externalstring-race/08-exchange-flow.en.svg)

*Code flow B. Overload delegation and the build branch. Both paths return a previous address but update different storage.*

[View at full size](/assets/research/chrome-m152-externalstring-race/08-exchange-flow.en.svg)

#### 1. The single-tag overload

[`src/sandbox/external-pointer.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer.h#L60) · `7d1fb25`

```cpp
inline Address exchange(IsolateForSandbox isolate, Address value)
  requires(kTagRange.Size() == 1)
{
  return exchange<kTagRange.first>(isolate, value);
}
```

**Input and output contract**

| Aspect | Meaning |
|---|---|
| Input | `isolate` and replacement address `value` |
| Return | The tagged member overload's return value |
| Review point | The single-tag constraint selects `kTagRange.first` statically. |

The caller omits a tag, but this overload selects `kTagRange.first` as a template argument when the range contains one tag. It forwards that tag, `isolate`, and the replacement value to the next overload. It reads no field and changes no payload: **its role is to bind the convenient call form to a statically tagged operation**. `requires` selects an overload at compile time; it performs neither a liveness check nor runtime synchronization.

In cleanup, the replacement is `kNullAddress`. That input travels down the call chain; the previous resource address travels back up as the result. Distinguishing these directions explains why `DisposeResource` saves the exchange result in a local variable.

#### 2. Delegation from the member to the field operation

[`src/sandbox/external-pointer-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-inl.h#L77) · `7d1fb25`

```cpp
template <ExternalPointerTagRange kTagRange>
template <ExternalPointerTag tag>
inline Address ExternalPointerMember<kTagRange>::exchange(
    IsolateForSandbox isolate, Address value) {
  static_assert(kTagRange.Contains(tag));
  return ExchangeExternalPointerField<tag>(reinterpret_cast<Address>(storage_),
                                           isolate, value);
}
```

**Input and output contract**

| Aspect | Meaning |
|---|---|
| Input | Member storage location, `isolate`, replacement address |
| Return | The previous address returned by the field exchange |
| Review point | Distinguish a field's address from its stored value. The assertion checks static tag compatibility. |

This layer carries a field address, a replacement address, and execution context. The `Address` expression derived from `storage_` identifies **where to read the handle**; parameter `value` identifies **the replacement pointer value**. Matching C++ types do not imply matching roles.

`static_assert` checks at compile time that the tag belongs to the member's permitted range. The validated tag is forwarded as a template argument. The function does not read the field itself and returns the field helper's result unchanged. Source-level cause analysis should therefore locate actual target selection and mutation in the next layer. Casting the storage location and delegating do not acquire object ownership.

#### 3. Sandbox and non-sandbox exchange paths

[`src/sandbox/external-pointer-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-inl.h#L260) · `7d1fb25`

```cpp
template <ExternalPointerTag tag>
V8_INLINE Address ExchangeExternalPointerField(Address field_address,
                                               IsolateForSandbox isolate,
                                               Address value) {
#ifdef V8_ENABLE_SANDBOX
  static_assert(tag != kExternalPointerNullTag);
  ExternalPointerHandle handle =
      Relaxed_ReadExternalPointerHandle(field_address);
  return isolate.GetExternalPointerTableFor(tag).Exchange(handle, value, tag);
#else
  Address old_value = ReadMaybeUnalignedValue<Address>(field_address);
  WriteMaybeUnalignedValue<Address>(field_address, value);
  return old_value;
#endif  // V8_ENABLE_SANDBOX
}
```

**Input and output contract**

| Aspect | Meaning |
|---|---|
| Input | Field address, `isolate`, replacement address, template tag |
| Return | The pre-exchange address |
| Review point | The sandbox branch targets an EPT entry; the other branch targets a field holding a direct address. |

The sandbox branch replaces the pointer value in the selected entry. It neither overwrites the heap handle field with null nor returns the slot to a free list. A null pointer payload and a deleted table slot are different states.

Graph B's branch is an `#ifdef`, not a runtime `if`. A sandbox build obtains a handle from `field_address`, chooses the table by tag, and passes the handle to `Exchange`. **The tag selects the table; the handle selects an entry**.

The non-sandbox representation stores an address directly at that location. It saves the existing address as `old_value`, writes the replacement, and returns `old_value`. This branch has neither EPT lookup nor entry CAS, so the sandbox payload's atomicity must not be attributed to it.

Both branches expose replacement plus previous-address return. In the sandbox path, the modified state is the selected EPT entry, not the heap's handle field. That distinction is central to comparing the cleanup target with the update target.

#### 4. The atomic handle read

[`src/sandbox/external-pointer-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-inl.h#L193) · `7d1fb25`

```cpp
#ifdef V8_ENABLE_SANDBOX
V8_INLINE ExternalPointerHandle
Relaxed_ReadExternalPointerHandle(Address field_address) {
  // Handles may be written to objects from other threads so the handle needs
  // to be loaded atomically. We assume that the access to the table cannot
  // be reordered before the load of the handle due to the data dependency
  // between the two accesses and therefore use relaxed memory ordering, but
  // technically we should use memory_order_consume here.
  auto location = reinterpret_cast<ExternalPointerHandle*>(field_address);
  return base::AsAtomic32::Relaxed_Load(location);
}
#endif
```

**Input and output contract**

| Aspect | Meaning |
|---|---|
| Input | Address of a field storing a handle |
| Return | The handle observed by one atomic read |
| Review point | This is a handle snapshot, not an ownership token that protects a later use or publishes unrelated data. |

The responsibility here is an atomic read of one handle value. The original comment explains its relaxed ordering in terms of the data dependency before table access. This does not turn several operations into a transaction or keep an object alive.

`location` points to the handle field, not to the external resource. `AsAtomic32::Relaxed_Load` returns the handle value stored there. Obtaining the native resource address belongs to the later EPT entry operation.

The path therefore contains two distinct atomic targets: **the heap field's handle value** is read here, while **an entry's payload** is exchanged below. Their individual atomicity does not make the entire function or every user's lifetime one atomic interval.

The fixed call passes the returned handle as a local value to the table operation. Entry CAS retries remain within that selected entry. Retrying a payload exchange is distinct from selecting another heap-field handle.

#### 5. Selecting an EPT entry

[`src/sandbox/external-pointer-table-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-table-inl.h#L206) · `7d1fb25`

```cpp
Address ExternalPointerTable::Exchange(ExternalPointerHandle handle,
                                       Address value, ExternalPointerTag tag) {
  DCHECK_NE(kNullExternalPointerHandle, handle);
  DCHECK(!IsManagedExternalPointerType(tag));
  uint32_t index = HandleToIndex(handle);
  return at(index).ExchangeExternalPointer(value, tag);
}
```

**Input and output contract**

| Aspect | Meaning |
|---|---|
| Input | Selected handle, replacement address, tag |
| Return | The selected entry's pre-exchange address |
| Review point | Entry selection and payload exchange are separate responsibilities. Index conversion does not retire a resource or free an entry. |

The `DCHECK` statements express expected invariants. Their presence alone does not establish the runtime-check coverage of the target release build.

The first assertion concerns `kNullExternalPointerHandle`, which has a different role from the replacement `kNullAddress`. **A handle selecting an entry must exist, while the pointer value placed in that entry may be null**.

`HandleToIndex(handle)` supplies the index for selection, and `at(index)` invokes that entry's exchange. This function does not invoke resource-disposal callbacks. The returned value propagates through the field and member helpers to become `DisposeResource`'s local `value`.

The assertion excluding managed tags also identifies a precondition of this delegation path. The earlier general `ManagedResource` design is distinct from what this function performs: entry selection does not itself manage object ownership.

#### 6. Exchanging the entry payload

[`src/sandbox/external-pointer-table-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-table-inl.h#L70) · `7d1fb25`

```cpp
Address ExternalPointerTableEntry::ExchangeExternalPointer(
    Address value, ExternalPointerTag tag) {
  // The 2nd most significant byte must be empty as we store the tag in int.
  DCHECK_EQ(0, value & kExternalPointerTagAndMarkbitMask);

  auto old_payload = payload_.load(std::memory_order_relaxed);
  while (true) {
    DCHECK(old_payload.ContainsPointer());
    Payload new_payload(value, tag);
    if (old_payload.HasMarkBitSet()) {
      new_payload.SetMarkBit();
    }
    if (payload_.compare_exchange_weak(old_payload, new_payload,
                                       std::memory_order_relaxed)) {
      MaybeUpdateRawPointerForLSan(value);
      return old_payload.Untag(tag);
    }
  }
}
```

![EPT-entry mark preservation and weak-CAS retry flow](/assets/research/chrome-m152-externalstring-race/09-entry-cas.en.svg)

*Code flow C. Failure rebuilds the candidate from expected state; success returns the previous payload address. Retries stay within the selected entry.*

[View at full size](/assets/research/chrome-m152-externalstring-race/09-entry-cas.en.svg)


**Input and output contract**

| Aspect | Meaning |
|---|---|
| Input | Replacement address and expected tag |
| Return | The previous address decoded from the payload preceding the successful CAS |
| Review point | One payload containing pointer, tag, and mark state is the atomic update unit. |

The first `DCHECK` expresses a precondition that the replacement address does not overlap the payload's tag and mark bits. Inside the loop, `ContainsPointer()` asserts that the observed payload contains a pointer. These concern address representation and payload state, rather than resource liveness or object ownership.

The CAS covers one EPT entry payload. It does not synchronize all heap handle fields or several external objects as one operation.

The first relaxed load supplies `old_payload` as the expected value for the loop. `Payload(value, tag)` constructs a replacement candidate from the caller's pointer and tag. If the observed old payload has its mark set, the candidate is marked too. Constructing the candidate inside the loop lets it **reflect the expected state refreshed after a failed CAS**.

A successful CAS is the point at which **that entry's replacement takes effect**. `old_payload` retains the payload immediately preceding that successful exchange, which allows `old_payload.Untag(tag)` to return the previous address. Returning an address extracted from `new_payload` would have a different meaning. This atomic update and the caller's safe use of the returned resource remain separate contracts.

On failure, the next iteration uses `old_payload` as refreshed through the expected argument; spurious weak-CAS failure follows the same retry path. The loop rebuilds a candidate for the selected entry, rather than reading another handle from the heap field. [14]

`MaybeUpdateRawPointerForLSan(value)` runs in the successful branch using the replacement value. Updating that auxiliary state and returning the previous pointer have different data directions. There is no `Dispose()` call here; actual resource cleanup belongs to the caller receiving the result. Updating auxiliary LSan state does not acquire object ownership.

Source attribution: V8 project authors, Copyright 2017 / 2020 / 2021. The original copyright notices and BSD-style license are provided in the [license file](/assets/research/chrome-m152-externalstring-race/v8-source-license.txt). [13]

## Reference

1. [V8 — The V8 Sandbox](https://v8.dev/blog/sandbox). Official background on the protection's purpose and external references.
2. [Chromium — Sandbox](https://chromium.googlesource.com/chromium/src/+/main/docs/design/sandbox.md). Official background on OS process isolation; the detailed design is Windows-oriented.
3. The supplied research package: original blog draft, detailed report, initial d8 observations, browser progress records, final checkpoint, and lifetime-oriented patch review. These private records support the cases and measurements in this post.
4. [Clang — Control Flow Integrity](https://clang.llvm.org/docs/ControlFlowIntegrity.html). General background on CFI checks.
5. The author's subsequent confirmation and the new review's `RESEARCH_REPORT.md`, sections 9 and 14, support the final exploit's `hosts` read. The v147 checkpoint concerns separate local test output. Reference 18 links the public evidence summary.
6. [V8 public API header — v8-primitive.h](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/include/v8-primitive.h). Public contracts and default disposal from main, retrieved on 1 October 2026, used as structural background.
7. [V8 — external-pointer-table.h](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/sandbox/external-pointer-table.h). EPT design documentation from main, retrieved on 1 October 2026. Background for type and temporal safety.
8. [V8 fix commit — 7d1fb25](https://github.com/v8/v8/commit/7d1fb25f99755c0380cb386e591a532efd7d2b03). External-string disposal fix naming issue `532204454`. Its description and changes were checked directly.
9. [V8 — string-inl.h at the fix revision](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/objects/string-inl.h). Source for the cleanup excerpt and role analysis. The full function is reproduced from that revision, as are the related functions below.
10. V8's [external-pointer-inl.h](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-inl.h) and [external-pointer-table-inl.h](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-table-inl.h) at the fix revision. Sources for exchange delegation, EPT payload behavior, and GC mark preservation.
11. [V8 — assert-scope.h at the fix revision](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/common/assert-scope.h). Confirms the debug-only assertion scope behind `DisallowGarbageCollection`.
12. [V8 — v8-primitive.h at the fix revision](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/include/v8-primitive.h). Source for the `Unaccount` callback contract and empty default implementation.
13. [V8 — external-pointer.h at the fix revision](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer.h) and [original license](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/LICENSE). Sources for the in-class single-tag overload and code redistribution terms.
14. [C++ working draft — atomic operations](https://eel.is/c++draft/atomics.types.operations). Background for expected-argument updates and spurious failure in weak compare-and-exchange.
15. Target-source [Chromium VERSION](https://github.com/chromium/chromium/blob/506c834ecceaa943c5f41e6cfe7f68acb5c45346/chrome/VERSION), [Chromium DEPS](https://github.com/chromium/chromium/blob/506c834ecceaa943c5f41e6cfe7f68acb5c45346/DEPS), and [V8 version header](https://github.com/v8/v8/blob/6aacaf6256a069ee455142333b7d38cad1c8d6e0/include/v8-version.h). Compared directly on 1 October 2026 to establish the relationship between versions and revisions.
16. The author-supplied `m152-blog-technical-revision.zip`: `TECHNICAL-REVIEW.md`, `EVIDENCE-MAP.md`, `PUBLICATION-CHECKLIST.md`, and `SOURCE-INDEX.md`. Editorial evidence for target identifiers, provenance, and measurement interpretation. Section 9.1 records its manifest check.
17. [string.h](https://github.com/v8/v8/blob/6aacaf6256a069ee455142333b7d38cad1c8d6e0/src/objects/string.h) and [v8-primitive.h](https://github.com/v8/v8/blob/6aacaf6256a069ee455142333b7d38cad1c8d6e0/include/v8-primitive.h) at the target V8 revision. Sources checked for resource and data member types, cacheability, and lock/disposal callback contracts.
18. The author-supplied `m152-blog-full-review-20261001.zip`: full revision review, `RESEARCH_REPORT.md`, local checkpoints/progress records, and final archive description. [Public evidence summary](/assets/research/chrome-m152-externalstring-race/evidence-summary.en.md) · [Korean summary](/assets/research/chrome-m152-externalstring-race/evidence-summary.ko.md) · [Summary-file SHA-256](/assets/research/chrome-m152-externalstring-race/evidence-summary.SHA256SUMS). The summary separates the original documents' claims from this edit's review scope.
