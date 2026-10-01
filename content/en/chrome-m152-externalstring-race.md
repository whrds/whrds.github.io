---
title: "[V8] Chrome M152 ExternalString race and sandbox boundary research"
description: "Research into a Chrome M152 ExternalString race, object lifetime, and a successful hosts file read through the final exploit."
date: "2026-10-01"
translation_key: "chrome-m152-externalstring-race"
tags: ["V8", "Chrome", "Sandbox", "Race condition"]
category: "V8"
concept_demo: "m152-lifetime"
private: false
published: true
---

This post revisits the `ExternalString` race I investigated in Chrome M152.

The final exploit successfully read the `hosts` file. [5] This post follows the research direction that led to that result and the assumptions I needed to revisit along the way.

The initial question was fairly simple. Could memory corruption inside the V8 sandbox affect the lifetime of an external native object? If external pointers are managed through a table, what happens when a retained reference and the object it represents no longer agree?

Observing a race once and explaining its significance inside a browser turned out to be different tasks. A problem observed in d8 could appear differently in Chrome. Results obtained under a debugger also needed to be distinguished from results obtained without that intervention. Even deciding whether a result represented an intermediate observation or completion of the whole experiment required care.

I will focus on the questions that guided the investigation, the assumptions behind the protection boundary, and the limits of the recorded results. Reproduction code and the operational chain are omitted. An interactive conceptual demonstration compares object and reference states instead.

## 1. The starting assumption

The recorded target is Chrome 152.0.7977.64 / V8 M152. The subject is cleanup and lifetime management of ExternalString resources: whether changes to sandboxed state can undermine an external native object's lifetime in the same renderer process. The account draws on source analysis notes, early observations, browser research records, and later checkpoints.

The starting assumption matters. This post does not describe a single vulnerability that grants every capability from ordinary JavaScript. It examines whether external memory remains isolated **after memory inside the sandbox can already be corrupted**.

The full research package contains preceding and subsequent work. The subject here is the lifetime of external string resources. How the earlier in-sandbox access was obtained is a separate question outside this post.

Without that distinction, a reader could reasonably wonder whether this race alone provided OS privileges from a webpage. Explaining the scope requires stating what capabilities were already assumed.

### 1.1 Pinning the target build and its provenance

The technical revision identifies the target by source revisions and a binary fingerprint as well as its version name. This account separates relationships checked in the public repositories from values reported by the research material. [15, 16]

The `chrome/VERSION` file at Chromium revision `506c834eccea` identifies Chrome `152.0.7977.64`. DEPS at the same revision pins `v8_revision` to `6aacaf6256a0`, whose `include/v8-version.h` defines V8 `15.2.124.18`.

The technical revision reports Linux x86-64 as the platform and a disabled process sandbox for the local test results.

The full identifiers follow. The Chrome SHA-256 is **reported by the research material**; it was not independently recalculated from a binary during this edit.

```text
Chromium revision: 506c834ecceaa943c5f41e6cfe7f68acb5c45346
V8 revision:       6aacaf6256a069ee455142333b7d38cad1c8d6e0
Chrome SHA-256:    3ed7df7904694145caf8da676d053f68300e8d2778a507e27b15f142c4efd0af
```

The public-source relationship checked here is `Chrome VERSION → Chromium DEPS → V8 VERSION`. It supports consistency of the version identifiers. Establishing that the executed binary was built from those sources, with particular build options, requires the binary and build records separately.

The patch functions reproduced in this post come from fix revision `7d1fb25`. The recorded target revision and the fix revision have distinct roles; these records do not establish coverage in M153 or another shipping version.

## 2. ExternalString and external resources

It is easy to picture a JavaScript string as an object whose character data all lives inside the JavaScript heap. `ExternalString` instead connects a string representation to external resources. That means the state visible to V8 and the state maintained by native resource owners must be considered together.

The character contents are only part of the problem. Ownership, cleanup, and the lifetime of the final user must also agree. A plausible pointer value does not establish that the object expected at that location is still alive.

The V8 Sandbox limits the spread of corruption from its heap to other memory in the process. External references can use indirection through an External Pointer Table, or EPT, instead of treating a field in a sandboxed object as a raw native address. [1]

This led to two separate questions: whether the **reference path is permitted**, and whether the **referenced object is still alive**. Both conditions must hold.

![Diagram separating V8 memory isolation from the renderer's OS resource boundary](/assets/research/chrome-m152-externalstring-race/01-boundaries.svg)

*Figure 1. Memory isolation inside a renderer and OS resource restrictions are separate boundaries. This diagram shows protection scope, not addresses or a bypass route.*

The V8 Sandbox also needs to be distinguished from Chrome's process sandbox. The latter uses OS facilities to restrict process access to resources. [2] An out-of-sandbox memory error in V8 does not, by itself, establish escape from the browser's process sandbox or a kernel privilege escalation.

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

A later use of a retained reference can lead to a use-after-free, or UAF. But retaining a reference, using that reference, and observing an effect on external memory are separate claims. Evidence of the first does not automatically prove the others.

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

An individual atomic read and a multi-operation cleanup that preserves one target's identity are different guarantees. Atomicity can prevent observing a partially mixed value; it does not make two reads at different times carry the same meaning.

A double-fetch therefore needs more than a count of loads. The important question is whether the target established earlier remains the target of the later operation.

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

The public fix identifies a consistency failure rather than a missing cast or null check. The resource selected for disposal and the resulting EPT state must agree. Separate reference operations could fail to preserve that agreement; the fix binds them to an exchange on one target. [8]

An explanation of UAF should therefore identify which object's lifetime ends and whether a reference can still treat it as valid. That is source-level lifetime analysis. Browser outcomes remain separate observations, reported in section 11.

The causal criterion is **whether the disposed resource is the previous pointer from the selected EPT entry**. When reference interpretation and reference-state modification are separate operations, atomic individual reads still require a separate guarantee that both operations concern the same target. Stronger memory ordering alone does not create target identity.

The fixed sandbox path first exchanges the selected entry's pointer value and saves the previous address in local `value`. Casting and callbacks then use the resource represented by that local value. This data flow binds **entry selection → that entry's previous value → disposal of that resource**. The heap member's handle, the existence of an EPT slot, and the pointer stored in its payload are distinct states. This function changes the payload's pointer value. [9, 10]

The cause is therefore not the mere use of a C++ pointer cast or the presence of `Unaccount`. The central contract is agreement between the selected resource and reference state throughout cleanup. Callback ownership and accounting contracts need their own review on top of that relationship.

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

This is not a finding that the public patch is insufficient. It separates the work performed by this function from the conditions its callers and resource implementations must jointly preserve. That boundary is necessary to explain the purpose of the atomic exchange accurately.

### 3.7 Separate the root cause from later review questions

**Cleanup-target consistency** is the cause addressed directly by this public fix. The review criterion is whether disposal concerns the previous pointer from the exchanged entry. Clearing an entry and disposing a resource must refer to matching targets.

**Lifetime and ownership** explain why that consistency matters for memory safety. An interpretable EPT handle does not establish resource liveness or ownership held by the current user. The same memory address also does not establish continuity of the same object's lifetime. This separates treating an ended object as valid from a generic pointer-value error.

**Data caching and consumers** are conditions for interpreting browser observations. `resource_` concerns the resource object, while `resource_data_` concerns string data. A resource's disposal state alone does not establish the validity periods of every data reference. Section 7.3 uses types and API contracts to distinguish owning references from stored data addresses.

**Control-flow checks** constrain permitted call relationships. Liveness of the object used by a call is a separate condition, as discussed in section 8.

The six exchange helpers below are not six separate vulnerabilities. They divide tag selection, field interpretation, entry selection, and payload exchange across one cleanup path. The flow graphs and walkthrough connect each layer to the cause and defensive contract. [9, 10, 17]

## 4. The protection assumption behind the bypass research

This raises the obvious question: how can a boundary problem exist when an EPT is present?

The direction investigated was whether **a mismatch between an indirect reference and its target's lifetime could undermine native memory safety outside the sandbox**. A reference following an allowed route and its target remaining valid are different guarantees.

EPT design includes temporal safety as well as type checks. The official source describes table management that keeps valid entries tied to live objects. Its `Verify()` and `ManagedResource` explanations likewise emphasize agreement between table state and resource lifetime. [7]

The research question is consequently whether cleanup can break the consistency needed to sustain that guarantee. Verifying that indirection and type checks exist does not finish the lifetime analysis.

The analysis therefore asked what a check actually guaranteed and what had to remain true independently. A reference can have the expected form or category while its target's lifetime has ended. An object can also be alive without being the same object that the current operation was supposed to use.

That is the high-level meaning of the bypass investigated here: a failure to preserve lifetime and identity consistency between sandboxed state and an external object. The values, timing, object combinations, and later control-flow operations needed to turn that into a working chain are outside this public account.

The same distinction matters defensively. Introducing indirection is only part of the design. The guarantees about the referenced target must continue to hold while it is being cleaned up.

### 4.1 Spatial and temporal safety

Type consistency asks whether the expected kind of target is being used and constrains reference interpretation. Spatial safety concerns access within the permitted object's bounds: the location and extent of an access.

Temporal safety concerns whether the object is alive when used, linking release and use. Identity consistency asks whether a multi-operation task continues processing the same object established earlier.

These are analytical distinctions. The focus here was external-object lifetime and identity. Spatial or type faults cannot be added to the findings without separate observations.

## 5. The questions that guided the investigation

Looking back through the notes, the research was not simply one program becoming progressively longer. It involved checking whether an earlier assumption remained valid in the next environment, then separating the changes when it did not.

I first examined the consistency of the cleanup target to distinguish a source-level lifetime cause candidate from a generic crash. Execution observations then needed to connect use after release with external memory errors.

Moving to Chrome required reviewing ownership, caching, and allocation differences rather than generalizing the standalone d8 result. Intermediate errors and their later effects also needed separate evidence: a crash alone does not establish control. Comparing repeated runs required consistent run units, environments, and observation methods to avoid merging unrelated experiments into one rate.

![Research questions grouped by cause, observation, browser context, and interpretation](/assets/research/chrome-m152-externalstring-race/04-research.svg)

*Figure 4. A map of research questions. It does not show executable exploit steps or their dependencies.*

When looking only at the final result, unsuccessful experiments can seem incidental. In practice, understanding which assumptions failed is necessary to explain the result. Similar-looking symptoms repeatedly had to be separated.

## 6. Moving from d8 to the browser

The early observations varied substantially across environments. The preserved notes describe roughly 950 runs on a shared host with no observed UAF, followed by a separate d8 test configuration with 11 observations in 150 runs. [3]

The shared-host configuration recorded 0 UAF observations, while the separate d8 sample's observation rate was approximately 7.33%. Each figure applies to its own test conditions and sample.

The first result could make the problem seem difficult to observe. However, races depend on execution order and observation timing. Failure to observe an event does not establish that a vulnerability is absent. Conversely, when several environmental conditions changed together, the difference cannot be attributed to one of them without further evidence.

The d8 result justified investigating the proposed cause further. It did not establish completion of the entire browser experiment.

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

I therefore treated `object identity → ownership acquisition → use interval → ownership release` as an analytical contract, rather than reading only `address → field value`. This describes review dimensions, not an executable reproduction sequence.

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

Control-flow protections were another distinct concern when studying later effects in Chrome. Control Flow Integrity, or CFI, constrains operations such as indirect calls to permitted control-flow conditions. The exact coverage must be checked for the build being examined. [4]

One easy mistake is treating influence over some memory value as immediate proof of arbitrary code execution. A lifetime error, an external memory effect, an indirect-call observation, and completion of a final action are separate results.

The reverse mistake is assuming that a control-flow check also resolves every lifetime error around it. Guarantees about a call target and guarantees about an object's continued existence require separate examination.

An allowed reference mechanism and the liveness of its target are separate conditions. Using an object during its valid lifetime also does not establish that the call satisfies control-flow checks.

An indirect call meeting its control-flow conditions does not establish correctness of earlier data and ownership states. OS permission for a process's file access must likewise be distinguished from newly acquiring those privileges through a vulnerability.

![Reference path, lifetime, control flow, and OS privileges as separate review dimensions](/assets/research/chrome-m152-externalstring-race/05-guarantees.svg)

*Figure 5. Distinct properties covered by different protections. This is not an inventory of all checks or bypass routes in a particular build.*

For that reason, this post does not collapse those properties into a claim that every protection was bypassed. The original notes include research into later effects; this public account focuses on the guarantees examined and the meaning of the recorded results.

### 8.1 Checked types and object liveness

Clang distinguishes schemes such as `cfi-vcall` for virtual calls and `cfi-icall` for indirect function calls. Coverage depends on the build and the entity being checked. [4]

An allowed call-type relationship and a continuously live object are different propositions. Conversely, a run stopped by a CFI check cannot count as completion of the behavior after that check.

This public record does not include an inventory of every check in the target build. It therefore does not assign a particular check to each call or infer that all CFI protection was defeated from the completed file read. Lifetime findings and later completion remain distinct claims.

## 9. Observation tools were part of the environment

Race analysis naturally creates a need to inspect intermediate state. Yet the debugger or instrumentation used for that inspection can affect execution order. The records explicitly distinguish intervention used for observation from the results of ordinary execution. [3]

A state inspected at a breakpoint can help explain the cause. It does not automatically prove that the same state arises in the same way without the debugger. If a debugger forcibly changed a value, the experiment can support a claim about a later segment; it does not prove that the earlier segment completed naturally.

I therefore read mechanism experiments separately from repeated-run measurements. The former help explain what happens. The latter describe what was observed, and how often, under specified conditions.

Even within one run, observing a race, confirming a memory error, and completing a predefined final action were separate verdicts. Counting a whole run as successful from one early marker would hide later failures.

This is also why failure records matter. Recording only a missing final output does not explain the cause. Recording only intermediate progress does not establish completion. The evidence needed for each claim must be decided explicitly.

### 9.1 Classifying the question each evidence item answers

The technical revision's `EVIDENCE-MAP.md` associates claims with report sections and checkpoints. That map helps locate evidence; it does not replace the underlying execution records. [16]

Pinned source shows the states and contracts a function handles. Connecting it to execution requires identifying the relationship between that source and the executed binary. Breakpoints or forced debugger state can explain an intermediate state or limited later behavior; an execution record without that intervention is separate evidence.

An observation recorded by the executing component needs its verdict criteria and final output. A completed file-read record answers whether the predefined outcome was reached in the specified environment. Repeatability claims also require all trials and failures.

A package SHA-256 manifest checks whether received files match the manifest. Establishing the truth of experimental claims is a different evidentiary task.

All 15 files listed in the supplied technical ZIP's manifest matched their SHA-256 digests. This is an integrity check, not a rerun of the reported experiment. The ZIP does not contain every original report and checkpoint named in its evidence map; naming a log must not be presented as directly auditing it.

Source and observation should support the same proposition. A failing call location records a symptom; the lifetime of the object used by that call is a separate causal observation. Output of the final file contents is a third, outcome-oriented record.

## 10. A conceptual object-lifetime demonstration

The demonstration compares three ways of representing the lifetime of the same abstract object. It does not run a Chrome or V8 vulnerability. The scenes are predefined object and reference states; its timer only advances their display.

- **Normal cleanup:** when use ends, the reference becomes invalid.
- **Lifetime mismatch:** the object has ended but a reference remains. The display highlights that inconsistency without accessing freed memory.
- **Defensive invariant:** a state that treats an ended object as usable is rejected. This does not implement a particular patch or run its regression test.

<!--DEMO-->

[Open the conceptual demonstration separately](/assets/research/chrome-m152-externalstring-race/m152-lifetime-demo.html#en)

The important feature is not the warning color. It is whether **object liveness and reference validity continue to describe a consistent relationship**. In a real investigation, that relationship must be supported by observations rather than assumed.

No fabricated terminal output or success transcript is presented. Mixing a conceptual animation with supposed evidence from a real PoC would recreate the very ambiguity this post is trying to resolve.

## 11. Final exploit and successful hosts file read

After the initial d8 observations, the package records research into external native memory effects and subsequent behavior in the browser. A final local checkpoint reports completion of a predefined file input/output action. Later summaries also report completed remote runs. [3]

The investigation continued, and **the final exploit successfully read the `hosts` file.** [5] The initial observation of a UAF in d8 and the completed file read through the final exploit remain separate results. The newly confirmed outcome is a completion case for the latter.

The wording needs to remain precise. The original PoC was not rerun while preparing this post. The package does not contain every raw execution log; some outcomes survive as checkpoints and reports. These are therefore **descriptions grounded in the retained research records and a subsequent confirmation of the final file read**.

![Separate evidence requirements for symptoms, causes, outcomes, and rates](/assets/research/chrome-m152-externalstring-race/03-evidence.svg)

*Figure 6. One crash cannot establish a cause, a final outcome, and a repeated-run success rate. Each claim requires different evidence.*

The early record of 11 UAF observations in 150 d8 trials supports the observation rate for that experiment. Research notes summarize the source and debugger observations of external native-memory effects. Local checkpoints and later completion summaries support their recorded completion cases.

The final exploit's `hosts` read rests on subsequent research confirmation of the final run. [5] The full final-campaign denominator was not retained, so no general numerical success rate is established. Results from a test environment with privileges already granted are not treated as evidence of newly acquired OS privileges.

In particular, `11/150` is not the end-to-end browser success rate. Observing an error in d8 and completing the browser experiment are different events. An execution group containing several attempts also differs from a single attempt.

For the same reason, I did not preserve the original “100%” wording. Completion cases can be reported, but without the total number of final trials, they do not establish an absence of failures or a generally guaranteed outcome. Calculations that assume independent stages must also remain separate from measured results.

The final output obtained at elevated privilege needs its own qualification. That local checkpoint came from an environment with privileges already granted. It records completion of the defined action, not acquisition of new OS privileges through the vulnerability.

### 11.1 What the hosts file read establishes

The final run successfully read `hosts`. It establishes completion of the later file-read behavior in that test environment. [5] The OS judges file access against process privileges and applicable policies, so the execution environment is part of the result's interpretation.

I recorded two dimensions: **what was established at the engine's memory boundary**, and **which later behavior completed in that environment**. The earlier native-memory observations and the final file read belong in the same account, but they are separate verdicts.

The filename alone does not establish privilege escalation. It also does not prove access to every arbitrary file or the same outcome in another browser's default configuration. The confirmed result is a completed `hosts` file read.

### 11.2 A rate needs both an observed event and an execution unit

The technical revision distinguishes initial d8 trials, individual renderer executions, and final execution groups containing several trials. This determines whether the numerator and denominator count the same event. [16]

For initial d8 observations, the numerator counts trials meeting the defined UAF verdict, and the denominator includes all d8 trials under the same conditions. An individual browser completion rate counts executions reaching the predefined final outcome against all individual executions with the same stopping rule.

For a group containing multiple trials, count groups meeting their completion rule against all groups using the same policy and environment.

`11/150` measures the first row. A rate for another row requires records for that execution unit. A sample restricted to trials satisfying an intermediate condition also has a different denominator from the full set. No failures in that conditional sample does not establish no failures across all trials.

The material contains measurements from different experiments and calculations based on models. I do not multiply those observation rates into an overall success rate. Races, object lifetimes, observation interventions, and execution conditions may be correlated; a product without evidence of independence and matching conditions is not a measured rate.

The exact final-campaign denominator remains unspecified in this material. Completed file reads and a general repeatability rate therefore remain separate claims.

### 11.3 Recording approval status separately from execution outcomes

According to the author's subsequent confirmation, **this research received Daybreak approval.** [18] This research status is recorded alongside the successful `hosts` file read through the final exploit.

Approval concerns an external review process; the file read concerns a particular execution. Approval does not supply a final-trial count or a build-specific repeatability rate. Details of the approval's scope, reward, or publication terms are not separately established here.

## 12. The invariant that matters for remediation

The retained patch review identifies agreement between the entry used to obtain the resource and the entry invalidated during cleanup as the central invariant. [3] For this expansion, I directly checked the linked public commit and source at that revision. [8–10] That verifies the source change, not its coverage across shipping Chrome versions or execution of a fixed binary.

The defensive question is whether the target established at the start remains the same target through cleanup. If shared state can change in between, the assumption that reading it again preserves the earlier meaning needs scrutiny.

It is also necessary to consider what other users can observe while cleanup is underway. A well-formed reference does not make a use safe if its target is being destroyed or has already ended its lifetime.

The effect of a patch requires more than a plausible source-level intention. A comparison of identified pre-fix and post-fix builds under the same regression conditions is needed. That comparison is not supplied by the retained patch review.

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

The fix links one entry's reference state to disposal of the resource obtained from it. It does not establish a solution to every lifetime error or verification that the target browser contains the fix.

### 12.4 Follow the complete exchange functions

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

### 12.5 Separate the protected states

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

## Reference

1. [V8 — The V8 Sandbox](https://v8.dev/blog/sandbox). Official background on the protection's purpose and external references, not evidence for these experiments.
2. [Chromium — Sandbox](https://chromium.googlesource.com/chromium/src/+/main/docs/design/sandbox.md). Official background on OS process isolation; the detailed design is Windows-oriented.
3. The supplied research package: original blog draft, detailed report, initial d8 observations, browser progress records, final checkpoint, and lifetime-oriented patch review. These private records support the cases and measurements in this post. Operational code and detailed experimental material are not included in this public draft.
4. [Clang — Control Flow Integrity](https://clang.llvm.org/docs/ControlFlowIntegrity.html). General background on CFI checks; it does not establish the configuration or results of the target Chrome build.
5. The author's subsequent confirmation that the final exploit read `hosts`. The technical revision's `EVIDENCE-MAP.md` identifies `RESEARCH_REPORT.md` and `CHECKPOINT-issue532-jop-orw-v147.md` as retained evidence. The received revision ZIP does not contain all those original execution records; this edit does not represent direct verification of additional logs or a PoC rerun.
6. [V8 public API header — v8-primitive.h](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/include/v8-primitive.h). Public contracts and default disposal from main, retrieved on 1 October 2026, used as structural background. This does not identify the target M152 build's source revision.
7. [V8 — external-pointer-table.h](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/sandbox/external-pointer-table.h). EPT design documentation from main, retrieved on 1 October 2026. Background for type and temporal safety, not proof of the target build or patch coverage.
8. [V8 fix commit — 7d1fb25](https://github.com/v8/v8/commit/7d1fb25f99755c0380cb386e591a532efd7d2b03). External-string disposal fix naming issue `532204454`. Its description and changes were checked directly; this does not verify public access to the issue body or coverage in a shipping Chrome version.
9. [V8 — string-inl.h at the fix revision](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/objects/string-inl.h). Source for the cleanup excerpt and role analysis. The full function is reproduced from that revision, as are the related functions below.
10. V8's [external-pointer-inl.h](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-inl.h) and [external-pointer-table-inl.h](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-table-inl.h) at the fix revision. Sources for exchange delegation, EPT payload behavior, and GC mark preservation. This revision was not established as identical to the recorded target M152 binary.
11. [V8 — assert-scope.h at the fix revision](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/common/assert-scope.h). Confirms the debug-only assertion scope behind `DisallowGarbageCollection`; its name does not establish synchronization in a release build.
12. [V8 — v8-primitive.h at the fix revision](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/include/v8-primitive.h). Source for the `Unaccount` callback contract and empty default implementation.
13. [V8 — external-pointer.h at the fix revision](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer.h) and [original license](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/LICENSE). Sources for the in-class single-tag overload and code redistribution terms.
14. [C++ working draft — atomic operations](https://eel.is/c++draft/atomics.types.operations). Background for expected-argument updates and spurious failure in weak compare-and-exchange.
15. Target-source [Chromium VERSION](https://github.com/chromium/chromium/blob/506c834ecceaa943c5f41e6cfe7f68acb5c45346/chrome/VERSION), [Chromium DEPS](https://github.com/chromium/chromium/blob/506c834ecceaa943c5f41e6cfe7f68acb5c45346/DEPS), and [V8 version header](https://github.com/v8/v8/blob/6aacaf6256a069ee455142333b7d38cad1c8d6e0/include/v8-version.h). Compared directly on 1 October 2026 to establish the relationship between versions and revisions, separately from binary fingerprints or execution outcomes.
16. The author-supplied `m152-blog-technical-revision.zip`: `TECHNICAL-REVIEW.md`, `EVIDENCE-MAP.md`, `PUBLICATION-CHECKLIST.md`, and `SOURCE-INDEX.md`. Editorial evidence for target identifiers, provenance, and measurement interpretation. Its 15 manifest-listed files were checked for integrity; that check is not experiment reproduction.
17. [string.h](https://github.com/v8/v8/blob/6aacaf6256a069ee455142333b7d38cad1c8d6e0/src/objects/string.h) and [v8-primitive.h](https://github.com/v8/v8/blob/6aacaf6256a069ee455142333b7d38cad1c8d6e0/include/v8-primitive.h) at the target V8 revision. Sources checked for resource and data member types, cacheability, and lock/disposal callback contracts.
18. The author's subsequent confirmation of Daybreak approval. The approval notice and its detailed terms were not independently audited during this edit.
