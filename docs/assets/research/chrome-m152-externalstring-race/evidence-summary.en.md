# M152 ExternalString research — public outcome evidence summary

Edited on 2026-10-01. Target: Chrome 152.0.7977.64, issue 532204454. This is an editorial summary of outcomes and provenance in the supplied research materials.

## Materials and review scope

`m152-blog-full-review-20261001.zip` contains the report, some checkpoints, progress records, aggregates, and the final archive description. All 20 files listed in `SHA256SUMS` matched. The earlier technical ZIP's 15 files also matched separately. Integrity checking differs from experiment reproduction; the original PoC was not executed for this edit.

## Research period and early observations

The metadata in `references/RESEARCH_REPORT.md` identifies 2026-09-07 through 09-16 as the intensive record period. Section 4.1 records no UAF observations in roughly 950 shared-host runs; section 4.2 records 11 in 150 trials under separate d8 conditions. 11/150 is approximately 7.33%. The two samples are not combined into a browser completion rate.

## Conditional verdicts and all trials

Report section 13.5 distinguishes 5/5 within an eligible branch for a particular intermediate installation verdict from completed output in 2/60 trials across the same three experiment groups. Their numerator events and denominator populations differ, so the conditional verdict is not used as an overall success rate.

## Local outcomes

Report section 9 separately records early hosts output and local test output. Sections 14.1–14.2 record local hosts reads without dependence on debugger or parent-process memory observation. `evidence/CHECKPOINT-issue532-jop-orw-v147.md` concerns local fixture output with elevated privileges granted beforehand; it is not cited as an official remote result.

The disabled local process sandbox and pregranted privileges are execution assumptions. Completed file access is not interpreted as acquiring new OS privileges.

## Remote outcomes and the final observation unit

Report sections 18–19 distinguish initial remote failures from final completions. Section 19 records no observed failure at the final server execution-group level and states that its exact session denominator was not preserved. `evidence/V1526-REPRO-README.txt` describes an archive for successful remote runs. This ZIP does not include every raw campaign log or the complete reproduction archive itself.

The summary retains remote completion and no observed failure as reported documentary outcomes. It does not establish a definite N/N, a universal 100% rate, a statistical confidence interval, or evidence from a different vulnerability chain for this issue.

## Approval status

Daybreak approval is the author's subsequent confirmation. The approval notice and detailed terms were not directly audited in this material review.

## Public-file hashes

The accompanying `evidence-summary.SHA256SUMS` identifies the Korean and English summary files. It is not certification that the original experimental results were reproduced.
