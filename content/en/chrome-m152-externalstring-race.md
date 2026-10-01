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

| Item | Scope |
|---|---|
| Target in the records | Chrome 152.0.7977.64 / V8 M152 |
| Subject | Cleanup and lifetime management of ExternalString resources |
| Research question | Can changes to sandboxed state undermine an external object's lifetime guarantees? |
| Starting assumption | A separate preceding vulnerability already permits reads and writes inside the V8 sandbox |
| Boundary examined | V8 sandbox memory versus other native memory in the same renderer process |
| Evidence available | Source analysis notes, early observations, browser research notes, and later checkpoints |

The starting assumption matters. This post does not describe a single vulnerability that grants every capability from ordinary JavaScript. It examines whether external memory remains isolated **after memory inside the sandbox can already be corrupted**.

The full research package contains preceding and subsequent work. The subject here is the lifetime of external string resources. How the earlier in-sandbox access was obtained is a separate question outside this post.

Without that distinction, a reader could reasonably wonder whether this race alone provided OS privileges from a webpage. Explaining the scope requires stating what capabilities were already assumed.

## 2. ExternalString and external resources

It is easy to picture a JavaScript string as an object whose character data all lives inside the JavaScript heap. `ExternalString` instead connects a string representation to external resources. That means the state visible to V8 and the state maintained by native resource owners must be considered together.

The character contents are only part of the problem. Ownership, cleanup, and the lifetime of the final user must also agree. A plausible pointer value does not establish that the object expected at that location is still alive.

The V8 Sandbox limits the spread of corruption from its heap to other memory in the process. External references can use indirection through an External Pointer Table, or EPT, instead of treating a field in a sandboxed object as a raw native address. [1]

This led to two separate questions: whether the **reference path is permitted**, and whether the **referenced object is still alive**. Both conditions must hold.

![Diagram separating V8 memory isolation from the renderer's OS resource boundary](/assets/research/chrome-m152-externalstring-race/01-boundaries.svg)

*Figure 1. Memory isolation inside a renderer and OS resource restrictions are separate boundaries. This diagram shows protection scope, not addresses or a bypass route.*

The V8 Sandbox also needs to be distinguished from Chrome's process sandbox. The latter uses OS facilities to restrict process access to resources. [2] An out-of-sandbox memory error in V8 does not, by itself, establish escape from the browser's process sandbox or a kernel privilege escalation.

## 3. The lifetime inconsistency under investigation

The investigation began with the `ExternalString::DisposeResource` cleanup path. The retained analysis identifies a double-fetch in that path as the central cause. [3]

A double-fetch reads shared state at different times. Reading twice is not inherently a vulnerability. The important question is whether the state can change between those reads while the code continues to assume that the earlier and later operations concern the same target.

Resource cleanup has at least two meanings: ending the actual object's lifetime, and ensuring that references to that object are no longer treated as valid. If those responsibilities become inconsistent, an object may be gone while a path to it remains.

That inconsistency was the focus here. The key question was whether **the object being cleaned up and the reference regarded as cleaned up still represented the same target**.

A later use of a retained reference can lead to a use-after-free, or UAF. But retaining a reference, using that reference, and observing an effect on external memory are separate claims. Evidence of the first does not automatically prove the others.

![Object and reference states after normal cleanup and after a lifetime inconsistency](/assets/research/chrome-m152-externalstring-race/02-lifetime.svg)

*Figure 2. Normal cleanup keeps object lifetime and reference validity consistent. A lifetime error can leave a reference to an object whose lifetime has ended.*

## 4. The protection assumption behind the bypass research

This raises the obvious question: how can a boundary problem exist when an EPT is present?

The direction investigated was whether **a mismatch between an indirect reference and its target's lifetime could undermine native memory safety outside the sandbox**. A reference following an allowed route and its target remaining valid are different guarantees.

An address-book entry provides a rough analogy. Being registered in an address book does not guarantee that the same person still owns that contact information. Similarly, a reference that was valid when established does not remain safe merely because it once passed through a legitimate path. Real engines add ownership and concurrency, making the situation more complex than the analogy.

The analysis therefore asked what a check actually guaranteed and what had to remain true independently. A reference can have the expected form or category while its target's lifetime has ended. An object can also be alive without being the same object that the current operation was supposed to use.

That is the high-level meaning of the bypass investigated here: a failure to preserve lifetime and identity consistency between sandboxed state and an external object. The values, timing, object combinations, and later control-flow operations needed to turn that into a working chain are outside this public account.

The same distinction matters defensively. Introducing indirection is only part of the design. The guarantees about the referenced target must continue to hold while it is being cleaned up.

## 5. The questions that guided the investigation

Looking back through the notes, the research was not simply one program becoming progressively longer. It involved checking whether an earlier assumption remained valid in the next environment, then separating the changes when it did not.

| Research question | What needed to be established | Why it mattered |
|---|---|---|
| Is a lifetime inconsistency possible in the source? | Consistency of the target expected by cleanup | Distinguish a cause candidate from a generic crash |
| Does execution show the same problem? | Connection between use after release and external memory errors | Connect source-level reasoning to observations |
| Does the d8 finding retain its meaning in Chrome? | Differences in ownership, caching, and allocation context | Avoid generalizing a standalone engine result |
| Does an intermediate observation support the next claim? | Difference between an error and its later effects | Avoid treating a crash as proof of control |
| Are repeated runs comparable? | Consistent run units, environments, and observation methods | Avoid combining unrelated experiments into one rate |

![Research questions grouped by cause, observation, browser context, and interpretation](/assets/research/chrome-m152-externalstring-race/04-research.svg)

*Figure 3. A map of research questions. It does not show executable exploit steps or their dependencies.*

When looking only at the final result, unsuccessful experiments can seem incidental. In practice, understanding which assumptions failed is necessary to explain the result. Similar-looking symptoms repeatedly had to be separated.

## 6. Moving from d8 to the browser

The early observations varied substantially across environments. The preserved notes describe roughly 950 runs on a shared host with no observed UAF, followed by a separate d8 test configuration with 11 observations in 150 runs. [3]

| Early experiment | Recorded trials | UAF observations | Meaning of the number |
|---|---:|---:|---|
| Shared host | Approximately 950 | 0 | No observation under those test conditions |
| Separate d8 configuration | 150 | 11 | Approximately 7.33% observed in that sample |

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

## 8. Separating CFI from memory safety

Control-flow protections were another distinct concern when studying later effects in Chrome. Control Flow Integrity, or CFI, constrains operations such as indirect calls to permitted control-flow conditions. The exact coverage must be checked for the build being examined. [4]

One easy mistake is treating influence over some memory value as immediate proof of arbitrary code execution. A lifetime error, an external memory effect, an indirect-call observation, and completion of a final action are separate results.

The reverse mistake is assuming that a control-flow check also resolves every lifetime error around it. Guarantees about a call target and guarantees about an object's continued existence require separate examination.

| Property | Question | What it does not establish alone |
|---|---|---|
| Reference path | Is the external target referenced through an allowed mechanism? | Is the target still alive? |
| Object lifetime | Is the object within a valid lifetime when used? | Is the call permitted by control-flow checks? |
| Control flow | Does an indirect call satisfy its required conditions? | Are earlier data and ownership states correct? |
| Process privileges | Does the OS allow this process to perform the access? | Were those privileges newly obtained through the vulnerability? |

![Reference path, lifetime, control flow, and OS privileges as separate review dimensions](/assets/research/chrome-m152-externalstring-race/05-guarantees.svg)

*Figure 4. Distinct properties covered by different protections. This is not an inventory of all checks or bypass routes in a particular build.*

For that reason, this post does not collapse those properties into a claim that every protection was bypassed. The original notes include research into later effects; this public account focuses on the guarantees examined and the meaning of the recorded results.

## 9. Observation tools were part of the environment

Race analysis naturally creates a need to inspect intermediate state. Yet the debugger or instrumentation used for that inspection can affect execution order. The records explicitly distinguish intervention used for observation from the results of ordinary execution. [3]

A state inspected at a breakpoint can help explain the cause. It does not automatically prove that the same state arises in the same way without the debugger. If a debugger forcibly changed a value, the experiment can support a claim about a later segment; it does not prove that the earlier segment completed naturally.

I therefore read mechanism experiments separately from repeated-run measurements. The former help explain what happens. The latter describe what was observed, and how often, under specified conditions.

Even within one run, observing a race, confirming a memory error, and completing a predefined final action were separate verdicts. Counting a whole run as successful from one early marker would hide later failures.

This is also why failure records matter. Recording only a missing final output does not explain the cause. Recording only intermediate progress does not establish completion. The evidence needed for each claim must be decided explicitly.

## 10. A conceptual object-lifetime demonstration

The demonstration compares three ways of representing the lifetime of the same abstract object. It does not run a Chrome or V8 vulnerability. The scenes are predefined object and reference states; its timer only advances their display.

- **Normal cleanup:** when use ends, the reference becomes invalid.
- **Lifetime mismatch:** the object has ended but a reference remains. The display highlights that inconsistency without accessing freed memory.
- **Defensive invariant:** a state that treats an ended object as usable is rejected. This does not implement a particular patch or run its regression test.

<!--DEMO-->

[Open the conceptual demonstration separately](m152-lifetime-demo.html#en)

The important feature is not the warning color. It is whether **object liveness and reference validity continue to describe a consistent relationship**. In a real investigation, that relationship must be supported by observations rather than assumed.

No fabricated terminal output or success transcript is presented. Mixing a conceptual animation with supposed evidence from a real PoC would recreate the very ambiguity this post is trying to resolve.

## 11. Final exploit and successful hosts file read

After the initial d8 observations, the package records research into external native memory effects and subsequent behavior in the browser. A final local checkpoint reports completion of a predefined file input/output action. Later summaries also report completed remote runs. [3]

The investigation continued, and **the final exploit successfully read the `hosts` file.** [5] The initial observation of a UAF in d8 and the completed file read through the final exploit remain separate results. The newly confirmed outcome is a completion case for the latter.

The wording needs to remain precise. The original PoC was not rerun while preparing this post. The package does not contain every raw execution log; some outcomes survive as checkpoints and reports. These are therefore **descriptions grounded in the retained research records and a subsequent confirmation of the final file read**.

![Separate evidence requirements for symptoms, causes, outcomes, and rates](/assets/research/chrome-m152-externalstring-race/03-evidence.svg)

*Figure 5. One crash cannot establish a cause, a final outcome, and a repeated-run success rate. Each claim requires different evidence.*

| Claim | Available record | Supported scope |
|---|---|---|
| UAF observed in early d8 testing | Record of 11 observations in 150 trials | Observation rate for that experiment |
| Effect on external native memory | Research notes summarizing source and debugger observations | Boundary violation reported in the records |
| Completion of later behavior | Local checkpoint and later completion summaries | The recorded completion cases |
| Successful hosts file read through the final exploit | Subsequent research confirmation of the final run [5] | Completion of the file read in that run |
| Final overall success rate | Full final-campaign denominator not retained | No general numerical rate established |
| OS privilege escalation | Test environment had privileges granted beforehand | No evidence of newly acquired OS privileges |

In particular, `11/150` is not the end-to-end browser success rate. Observing an error in d8 and completing the browser experiment are different events. An execution group containing several attempts also differs from a single attempt.

For the same reason, I did not preserve the original “100%” wording. Completion cases can be reported, but without the total number of final trials, they do not establish an absence of failures or a generally guaranteed outcome. Calculations that assume independent stages must also remain separate from measured results.

The final output obtained at elevated privilege needs its own qualification. That local checkpoint came from an environment with privileges already granted. It records completion of the defined action, not acquisition of new OS privileges through the vulnerability.

## 12. The invariant that matters for remediation

The retained patch review identifies agreement between the entry used to obtain the resource and the entry invalidated during cleanup as the central invariant. [3] Here I describe that review in terms of resource lifetime. The linked patch and its release coverage were not directly verified during this edit, so this post does not identify a specific fixed shipping version.

The defensive question is whether the target established at the start remains the same target through cleanup. If shared state can change in between, the assumption that reading it again preserves the earlier meaning needs scrutiny.

It is also necessary to consider what other users can observe while cleanup is underway. A well-formed reference does not make a use safe if its target is being destroyed or has already ended its lifetime.

The effect of a patch requires more than a plausible source-level intention. A comparison of identified pre-fix and post-fix builds under the same regression conditions is needed. That comparison is not supplied by the retained patch review.

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
5. The author's subsequent research confirmation that the final exploit successfully read the `hosts` file. No additional execution log was verified and the PoC was not rerun during this edit.
