# Overnight morning resource investigation — 20 October 2026

Offline analysis of the existing ten-hour native observation. **CPU work rises sharply near the scheduled 06:00 Morning boundary; memory has gradual growth plus a distinct main-process allocation/residency event near 07:31.** Rendering is the leading CPU hypothesis. The samples locate memory growth but cannot identify its allocating subsystem or prove a leak. No frame connection, input, collection, restart, settings change or deployment was performed for this investigation. The owner is changing animated icons in a separate conversation; this investigation changes no application behavior.

## Evidence and method

- Source: ignored `private/m6-overnight-20261019/{run.json,samples.jsonl}`, 601 complete samples, 19 October 22:07:43 through 20 October 08:07:44 Paris. Source JSONL SHA-256: `991ec68b9ee653d9e43b093119a8b0bbefabe2afec3f487944c35f2c6dbe61f1`.
- Classic10, board `exdroid`, firmware `Classic10_A33M187_20250910-1617_V09`, Android 6.0.1/API 23; native kiosk 0.1.3/code 4, GeckoView `143.0.20251003115653`. Observer host revision `755bbc1e52fced709b7799f8191e5bc0691e0727`. The loaded web revision was not pinned.
- Recomputed CPU from each process's tick delta / device `AT_CLKTCK` (100) / its own monotonic elapsed seconds. All 600 sums match the recorded rounded CPU values. This avoids the known aggregate CPU-counter/hotplug problem. A core equivalent is CPU time, not hardware GPU utilization or percent of the whole device.
- Checked all 3,005 per-process PSS totals against raw `dumpsys meminfo`, summed them against every recorded total, and checked stable process identities/start times, generation 2 and sampled healthy/supervisor state throughout. Samples are sequential measurements, not simultaneous snapshots; CPU values are interval averages ending at the sample.
- Used Paris timestamps to separate the **scheduled** Night and Morning windows. The observer did not capture DOM mode, saved schedule, current weather/icon identities, paint, animation state, network request timing, Gecko memory reports, thread stacks or allocation traces. The windows are not independently observed mode transitions.
- Sanitized derivatives: [per-sample CSV](../evidence/m6-overnight/samples.csv) and [summary JSON](../evidence/m6-overnight/summary.json). These omit raw process IDs, addresses, command output, credentials and household content. The offline reproduction script remains ignored at `private/m6-overnight-analysis-20261020/analyze.py` and imports no device tools.

## CPU: an immediate sustained change, not continuous escalation

| Process               | Night median CPU cores | Morning median CPU cores | Morning PSS first → last |         Change |
| --------------------- | ---------------------: | -----------------------: | -----------------------: | -------------: |
| Main Gecko/native app |                 0.0220 |                   0.0963 |      114.58 → 196.87 MiB |     +82.29 MiB |
| GPU process           |                 0.0117 |                   1.0949 |        62.01 → 74.99 MiB |     +12.98 MiB |
| Content process       |                 0.0478 |                   0.3207 |        91.52 → 84.89 MiB |      −6.63 MiB |
| Supervisor            |                 0.0047 |                   0.0048 |          8.21 → 7.54 MiB |      −0.67 MiB |
| Crash helper          |                 0.0028 |                   0.0032 |          5.68 → 4.91 MiB |      −0.77 MiB |
| All processes         |            **0.08885** |              **1.52225** |  **282.00 → 369.20 MiB** | **+87.20 MiB** |

Medians of individual processes need not sum to the median of the total. The GPU median is approximately 72% of the total Morning median. Total Morning CPU is about 17.1 times the Night median, equivalent to 152% of one CPU core. It is not 152% of the frame's total CPU capacity, and the process name does not establish which hardware/software rendering backend was active.

At 05:59:42 total CPU was 0.0856 cores. The next sample at 06:00:43 averaged 1.0631 cores over an interval straddling the scheduled boundary; 06:01:42 was 1.5149. Ten-minute medians subsequently stayed around 1.51–1.54, apart from transient spikes. Night also has brief spikes, including near collection startup; the distinguishing Morning behavior is sustained work. CPU did not rise proportionally with the later memory increase.

## Memory: separate steady growth from the 07:31 step

| Paris sample time |  Total PSS | Interpretation                                            |
| ----------------- | ---------: | --------------------------------------------------------- |
| 05:59:42          | 280.34 MiB | Last sample before scheduled Morning                      |
| 06:00:43          | 282.00 MiB | First sample after boundary                               |
| 06:59:43          | 300.52 MiB | Gradual growth                                            |
| 07:30:43          | 311.91 MiB | Gradual growth continues                                  |
| 07:31:44          | 356.47 MiB | Main process +57.72 MiB; other processes partly offset it |
| 08:07:44          | 369.20 MiB | Growth continues after the step                           |

Least-squares main-process slopes were +1.02 MiB/hour during Night, +12.38 MiB/hour during 06:00–07:30, and +9.13 MiB/hour during 07:32–08:07. GPU-process slopes over those windows were +0.05, +7.16 and +6.45 MiB/hour. The final window is short; these descriptive slopes are not forecasts. There is no observed Morning plateau.

The largest main-process change is between the samples at **07:30:43 and 07:31:44**, roughly 91 minutes after scheduled Morning began, rather than at the mode boundary:

- Main PSS increases **57.72 MiB**, while its `Unknown` private-dirty category increases **64.06 MiB**. Total native PSS increases 44.57 MiB because other processes shrink.
- Main CPU briefly rises from 0.0952 to **0.8658 cores**; total CPU reaches **2.3 cores**, while GPU CPU stays close to its preceding baseline. Main threads rise from 58 to 65, then fall toward 59–60. Additional file-backed residency, faults and swap changes accompany the event.
- Main/content `.apk mmap` PSS falls by approximately 9.0/8.4 MiB. Some apparent content-process shrinkage is therefore code residency/accounting, not proof its live JavaScript heap shrank.
- Process identities, session generation and sampled native health state do not change. The samples show no process/session replacement explaining the step. They cannot exclude a same-session reload or an internal engine operation.

Across the Morning window, main `Unknown` private-dirty memory rises **71.23 → 159.93 MiB** (+88.70 MiB), whereas its Dalvik allocated heap stays **4.850 → 4.845 MiB**, native allocator heap **4.803 → 4.747 MiB**, and view/activity counts remain 49/1 at the checked boundary/end samples. GPU `Unknown` private-dirty rises another 14.69 MiB; content `Unknown` rises 2.38 MiB despite lower total content PSS. The main increase is real private-dirty growth, not just a larger shared-PSS share.

Android describes `Unknown` as memory it cannot classify, often native allocations. It is **not a JavaScript heap measurement**, nor equivalent to a named Gecko allocation category. Stable Dalvik/native-heap counters do not exclude Gecko allocations elsewhere. See [Android's memory-field definitions](https://developer.android.com/tools/dumpsys). The saved data cannot distinguish retained SVG/image surfaces, allocator retention, engine caches, background work or a leak. Gecko's own [per-process memory reporters](https://firefox-source-docs.mozilla.org/performance/memory/about_colon_memory.html) provide a different level of attribution; none was collected here.

## Source audit and ranked hypotheses

Reviewed local source at `ddb9ba1` (observation closeout), rather than assuming the running web document matched it:

1. **Visible animated SVG rendering: leading explanation for sustained CPU, unproven for memory.** `src/lib/weather/view.ts` renders the current icon and four checkpoint icons. `uno.config.ts` embeds animated SVG image data, including expanded symbol trees; `src/components/MorningWeather.astro` selects still image alternatives under reduced motion. Morning visibility changes near the observed CPU boundary, whereas much of the scheduling/refresh code runs in Night too. GPU-process CPU dominance fits rendering work, but neither actual icon conditions nor backend were captured. The owner's separate icon change is the appropriate comparison candidate.
2. **Repeated DOM/image replacement: possible contributor to resource churn.** `src/lib/weather/service.ts` renders about every minute even without fresh weather; `view.ts` replaces checkpoint and chart `innerHTML` on each render. This recreates four icon elements. The dashboard controller also rewrites clock/date text every second, including unchanged text. These are concrete opportunities to reduce work, not evidence of retained detached DOM or a proven leak. The same minute refresh exists during Night, so it alone does not explain the visibility-correlated CPU jump.
3. **Main-engine allocation/background event: unresolved 07:31 step.** Main-process CPU, private-dirty memory and thread activity change together. A one-off event must be separated from gradual rendering-associated growth. The samples contain no trace identifying it, and it should not be attributed to animation, weather fetching or a scheduled task merely from timing.
4. **Supervisor or Android view accumulation: weak fit.** Supervisor CPU is unchanged and its PSS falls; checked main Java heap/view/activity counts are stable. `KioskActivity.java` uses one two-second pulse, and `publishHealth()` writes on state changes; the isolated extension uses one five-second readiness probe. This audit found no source-level evidence tying a growing native Java UI collection or restart loop to the measured increase. It does not rule out all native/extension involvement.

The content process remaining near its previous PSS before the 07:31 event weighs against an obvious steadily expanding page heap as the main measured cost. It does not exclude JavaScript retention: PSS, paging and unclassified allocation totals cannot answer that question.

## Upstream provenance

Re-read the retained Wes Bos checkout at `e97c50ba459c49ea8237259f69b95cd28054b628`: `dashboard/kiosk/README.md`, `dashboard/kiosk/src/com/wesbos/homehq/MainActivity.java`, and `dashboard/js/app.js` view build/hide/resume paths. Its WebView recovery/hidden-view approach is useful context but does not attribute GeckoView memory on this Classic 10. Dayframe retains its independently authored Gecko recovery, security boundary and weather implementation. No upstream code or assets copied; this analysis introduces no new device procedure. The prior [ADR 0007](../decisions/0007-geckoview-recovery-trial.md) issue/PR review remains historical; no current upstream behavior claim or device change is proposed here.

## Follow-up after the separate icon change

Use this as a baseline, not a passed performance gate. A future bounded comparison should pin the exact served web build, record actual mode/animation state, and hold viewport, weather data, number of icons, native build and collector cadence constant. Change motion alone where possible, with matched warm-up and similar run durations; repeat/reverse order if results vary. Compare per-process CPU, private-dirty growth and steps separately, not just total end PSS. Run long enough to cover the approximately 91-minute event window without claiming that event must recur.

If still icons substantially lower GPU CPU but main memory continues growing, investigate that separately rather than claiming animation solved both. If needed, first prepare a version-supported, privacy-reviewed Gecko memory/profiling route that preserves the accepted kiosk restrictions. Do not enable remote debugging or navigate to privileged pages as an assumed consequence of this report. Minute-level markup churn is another independent comparison only after motion is isolated.

No new hardware experiment was started. Existing security, outage, physical and 48-hour acceptance deferrals remain open. This investigation narrows the problem and preserves a reproducible baseline; it does not establish a root cause or close H4/M6.

## Focused 07:31 log audit — 20 October 2026

The owner's follow-up requested further attribution using existing logs only, leaving icon work to the separate conversation. Re-read raw process counters, system memory, process lists, native state and retained window dumps surrounding samples 563–565. [Sanitized event detail](../evidence/m6-overnight/jump-detail.json) records the extracted numbers; the ignored reproduction script is `private/m6-overnight-analysis-20261020/investigate_jump.py`.

**The narrowest supported description is a brief main-process private-memory/page-fault burst, accompanied by system-wide reclaim/paging changes.** It is distinct from the sustained GPU-process CPU workload. The exact engine operation or external trigger is not recorded.

| Main-process evidence                            | Before sample | Event sample |                Change |
| ------------------------------------------------ | ------------: | -----------: | --------------------: |
| Paris sample time                                |      07:30:43 |     07:31:44 | One sampling interval |
| PSS                                              |    133.21 MiB |   190.94 MiB |            +57.72 MiB |
| Unclassified private-dirty memory                |     90.09 MiB |   154.15 MiB |            +64.06 MiB |
| Virtual address-space size                       |   1236.11 MiB |  1263.98 MiB |           +27.875 MiB |
| Threads                                          |            58 |           65 |  +7, mostly transient |
| User CPU consumed in interval ending at sample   |        3.58 s |      35.92 s | Burst in main process |
| Kernel CPU consumed in interval ending at sample |        2.10 s |      16.35 s | Burst in main process |

The event interval contains **54,218 minor page faults and 94 major faults** in the main process, the largest deltas for each counter in the entire run. Those counts cannot be converted into unique bytes allocated: a page can fault more than once. The subsequent interval still consumes 14.58 main-process CPU seconds; by 07:33 its CPU is near the preceding Morning baseline. Memory remains elevated through the last sample, so the observed effect is not merely a transient CPU spike or fully released scratch buffer.

The extra private-dirty memory exceeds the net virtual-address growth. The data therefore do not support interpreting the event as exactly one new 64 MiB mapping/allocation. Previously reserved pages becoming resident/dirty, allocation/free combinations and internal mapping changes remain possible. The [kernel's `/proc` documentation](https://www.kernel.org/doc/html/v5.19/filesystems/proc.html) explains the distinction between address-space size, residency, faults and private/anonymous memory; it supplies field semantics, not a diagnosis for this device.

Additional checks narrow the alternatives:

- **The burst largely precedes that sample's memory inspection.** The earlier native snapshot `command-7362.stdout` already has 65 main threads, all 94 new major faults and 54,109 of the eventual 54,218 minor faults. Approximately 50.02 of the interval's 52.27 main CPU seconds have already accrued. This snapshot precedes the Reader's `dumpsys meminfo` calls. Its retained host-file mtime is 07:31:38.541 Paris, corroborating that the event was underway before the 07:31:44 row was finalized. File mtimes are supporting host metadata, not exact device event timestamps. Earlier sampling overhead or a delayed effect remains unmeasured; this only rules against attributing the burst to the cost of this sample's later memory dump itself.
- **System memory corroborates physical pressure/change.** Between the two snapshots, `AnonPages` increases 54.34 MiB, free RAM falls 56.02 MiB, file-backed `Mapped` falls 34.64 MiB and free swap falls 7.80 MiB. `Shmem` is unchanged. File-backed main/content code residency also falls. These whole-system counters are consistent with private-memory growth accompanied by reclaim/paging, not an isolated PSS sharing calculation. They cannot establish whether memory pressure triggered the engine work or followed it.
- **No sampled application/lifecycle transition explains it.** Non-root process identities/names are unchanged; kernel worker churn accompanies the already observed CPU hotplug. Native health remains byte-for-byte equivalent, with the same main process, generation, foreground and maintenance values. Adjacent window dumps are byte-identical, and collector command error outputs are empty. GPU process CPU is 1.0667 cores in the event interval, versus 1.0881 in the preceding interval; the CPU burst is in the main process. Stable Java allocated heaps further weaken an Android UI accumulation explanation. Short-lived activity or a same-session page operation between samples cannot be excluded.
- **No event-level logcat covers 07:31.** The overnight collector retained state/process/window outputs, not logcat, native event history, mapping lists, memory reports, per-thread names/stacks or network timings. The dated native logcat archives inspected end on 19 October (the latest at 21:12:54); older fault captures do not establish the cause of this overnight event. Collector output only says each sampled state was healthy. It provides no hidden allocation/event trace to extract.

This narrows the location and mechanism, but cannot name a cache, decoder, allocator, garbage collector, weather refresh, reload or background job as the cause. The existing files have reached their attribution limit. In particular, the 07:31 burst is not evidence that the icons caused the step, and does not justify an engine/configuration change or blind periodic reload. No new capture, instrumentation, device action or icon change was performed. If this step recurs in a later authorized comparison, event-level main-process memory/mapping and thread evidence would be needed to separate those remaining explanations.
