# M152 ExternalString research — public outcome evidence summary

Edited on 2026-10-02. Target: Chrome 152.0.7977.64, issue 532204454. This document summarizes public outcomes and the scope of their numerical interpretation.

## Materials and review scope

The supplied research bundle contains the report, selected checkpoints, progress records, and aggregates. Listed-file integrity was checked, but the original PoC was not rerun for this edit. File integrity and experimental reproduction are different claims.

## Early observations

Roughly 950 shared-host runs produced no UAF verdict, while isolated d8 conditions recorded 11 in 150 trials. `11/150` is approximately 7.33%; it is not combined with a different environment or converted into a browser completion rate.

## Reliability work

The investigation progressed through environment isolation, semantic winner criteria, removal of asynchronous work and logging from the race window, separation of dangling holders from allocator-shaping lifetimes, exact-address reuse measurements, reduction of consecutive race requirements, and a fresh renderer for each attempt.

Putting `p = 11/150` into an independent equal-probability model gives `p² ≈ 1/186`, `p³ ≈ 1/2,536`, `p⁴ ≈ 1/34,578`, `p⁵ ≈ 1/471,512`, and `p⁶ ≈ 1/6,429,711`. These theoretical values compare early design complexity; they are not measured browser completion rates.

## Conditional verdicts and all trials

An eligible branch in a later stage recorded `5/5`, while the same experiment groups produced completed output in `2/60` trials including the upstream race. Conditional `5/5` is not an overall 100% rate. Later repeated validation reports no observed failure at the execution-group level, but its exact final denominator is unavailable, so no definite `N/N` or confidence interval is claimed.

## File-read outcomes and privileges

The author confirmed completion of the `/etc/hosts` read in a remote run. This subsequent result is treated separately from the local experimental measurements.

The report records local `/etc/hosts` reads without dependence on debugger or parent-process memory observation. The disabled local process sandbox and pregranted privileges are execution assumptions. The result shows chain completion within existing privileges, not acquisition of new OS privileges.

## Publication scope

The public article omits build-specific addresses, the complete PoC, and control-flow details. Cause code, the `h1/h2` transition, object size classes, measurements, and the patch invariant remain available for review.

The accompanying `evidence-summary.SHA256SUMS` identifies the Korean and English summary files themselves. It is not certification that the original experiment was reproduced.
