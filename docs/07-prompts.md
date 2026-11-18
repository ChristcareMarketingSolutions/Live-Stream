# 07 — Prompts for driving Claude

Claude Code reads `CLAUDE.md` automatically, so prompts can stay short and point at the docs.
Paste one prompt per session/phase. Replace `<N>` with the phase number.

---

## Prompt 0 — Kickoff (Phase 0)

```
Read CLAUDE.md and every file in docs/. Then do PHASE 0 ONLY from docs/03-roadmap.md.

Before writing code, give me (briefly):
1. Any gaps or contradictions you find in the docs.
2. The exact dependency list with pinned versions and one-line justification each.
3. The files you will create in this phase.

Then implement Phase 0, run lint/unit/build/e2e, write ADRs 0001-0006 and the first dev-log
entry, commit and push. Finish with a Phase Completion Report (docs/templates/phase-certificate.md)
listing what I must check manually. Do not start Phase 1.
```

## Prompt — Start phase N

```
Phase <N-1> is signed off. Start PHASE <N> from docs/03-roadmap.md.
First: list the tasks you will do, requirement IDs covered, files to create/modify, and any
decisions needing an ADR (wait for my approval on ADRs). Then implement task by task, committing
after each task with requirement IDs. Run the full test suite before you finish.
End with the Phase Completion Report and the manual hardware checks I must perform.
```

## Prompt — Resume a session

```
Resume work. Read CLAUDE.md, the last 3 dev-log entries and the current phase in the roadmap.
Tell me in 5 lines: where we are, what is outstanding, what you will do now. Then continue.
```

## Prompt — Phase review (before sign-off)

```
Review the implementation of Phase <N> against docs/01-product-spec.md and the Phase <N> exit
gate. Produce a compliance table: requirement ID | status (done / partial / missing) | evidence
(test ID or file) | notes. Also list: non-functional controls, architectural violations
(layering rules in CLAUDE.md §5), real-time rule violations (§6), performance risks, and
missing tests. Fix everything you can, then re-run tests and update the report.
```

## Prompt — Bug fix

```
Bug: <what happened>. Steps: <steps>. Expected: <expected>. Browser/OS/MIDI device: <details>.
Do not rewrite modules. Reproduce (write a failing test first if possible), find the root cause,
explain it in 3-5 lines, make the smallest reliable fix, keep the test as a regression test,
run the full suite, and log it in the dev log.
```

## Prompt — Manual test results feedback

```
Manual test results for Phase <N>:
M-xxx: pass/fail — notes
...
Machine: <laptop, OS, browser version, audio output, MIDI keyboard>.
Fix the failures, tell me which need re-testing on hardware, and update the certificate.
```

## Prompt — Phase sign-off

```
I sign off Phase <N>. Update the status table in docs/03-roadmap.md (status = Done, signed off =
today's date), finalise the certificate in docs/certificates/phase-<N>.md, commit and push.
Do not start the next phase yet.
```

## Prompt — Change request

```
Change request: <description>. Write it into docs/change-requests.md with: affected requirement
IDs, effect on architecture, effect on schedule, risks. Do not implement until I approve.
```

## Prompt — Sound-quality iteration (Phase 3)

```
Instrument <name> rated <score>/5. Problems I hear: <e.g. harsh at high velocity, release too
short, uneven between C4 and D4>. Propose specific changes (mapping, gain, filter, envelope,
samples) and implement them; tell me exactly which notes/velocities to re-check.
```
