# iPhone Share Sheet feasibility plan

Recorded 24 October 2026. **Status updated 25 October: the owner confirmed the
production iPhone import works. PNG-normalized button handoff, three correct
synthetic previews and local WebP conversion passed earlier. Large-batch errors
now identify the individual limit and offer size-based recovery from the same
clipboard. Actual iPhone recovery, representative-format and direct HEIC coverage
remain open. Diagnostic hosting is closed.**

Owner reports **iPhone 17, iOS 27.0.1**. The first local-only diagnostic source,
synthetic fixture generator and test checklist are in
[`tools/ios-share-sheet`](../tools/ios-share-sheet/README.md). Mac action inspection
and fixture generation are preparation evidence, not actual iPhone acceptance.

### Preparation evidence — 24 October 2026

- Independently authored local-only diagnostic with 12 actions: count shared
  images, inspect each image's dimensions/orientation/extension/size, show a report
  and preview the input. Source action allowlist passed; no networking or mutation
  actions. Source compiles with Python; documentation formatting and diff checks pass.
- Apple's signer produced an importable file. The corrected diagnostic is installed
  as **Dayframe-Photo-Check** on the Mac. Editor inspection shows all actions
  recognized and count/repeat/preview bound to Shortcut Input. An earlier draft had
  incorrect action/parameter identifiers; it was replaced before the test handoff.
- CLI runs did not produce an observable completed report and were cancelled.
  No runtime-processing pass is claimed, even on the Mac. Signing/import/editor
  checks do not establish iPhone behavior.
- Synthetic JPEG/HEIC/JPEG fixtures generated using native ImageIO and dimensions
  independently checked with `sips`: 1600 × 1000, 1200 × 1800 and 4032 × 3024.
  Landscape fixture visually inspected. Source generator and reproduction steps
  are tracked; generated files/signing certificates stay outside Git.
- Prepared local handoff at `/private/tmp/dayframe-iphone-test`, containing the
  signed Shortcut, three fixtures, manifest/checksums, checklist and ZIP bundle.
  Apple signing/export intermittently returned HTTP 500; a retry signed the final
  artifact successfully. No service or deployment setting was changed.
- One task-created action-inspection draft **Dayframe — test photos** remains
  unused: automatic approval review rejected its synced deletion. Use only
  **Dayframe-Photo-Check** for the iPhone test. Existing personal Shortcuts were not
  edited. At preparation handoff, no iPhone acceptance result was recorded;
  the subsequent owner result follows below.

### Owner iPhone result — 24 October 2026

The owner shared synthetic fixture A from Photos to **Dayframe-Photo-Check** on
the reported iPhone 17 / iOS 27.0.1 and supplied screenshots of the report and
the preview after tapping Done. The report shows one image, 1600 × 1000,
orientation Up, extension `jpeg`, and size **144 KB**. The preview shows fixture A
upright, with TOP above BOTTOM and all four colored corners visible. This passes
single-JPEG Share Sheet input, report generation and local preview on the actual
iPhone. No upload or browser handoff was exercised.

The generated source file was 102,646 bytes (about 103 KB decimal). The reported
144 KB differs, but no received-byte export/hash was captured. Whether the change
arose during transfer/import, Photos sharing or Shortcuts representation/property
conversion remains unknown. Do not infer original-byte preservation or stable
cross-path exact deduplication. The supplied screenshots stay outside Git because
the Photos UI also shows unrelated personal library thumbnails; this sanitized
description records the relevant evidence.

The owner subsequently supplied two screenshots covering the full three-image
batch report. It received three images and reported:

| Item | Dimensions  | Orientation | Reported extension | Reported size |
| ---- | ----------- | ----------- | ------------------ | ------------- |
| A    | 1600 × 1000 | Up          | jpeg               | 144 KB        |
| B    | 1200 × 1800 | Up          | png                | 136 KB        |
| C    | 4032 × 3024 | Up          | jpeg               | 483 KB        |

This passes three-item input and per-item report generation, including the larger
JPEG's full dimensions. B's generated source was HEIC, but the report identifies
PNG. The transfer/import/share/Shortcuts conversion stage remains unknown; this
does not prove direct HEIC decoding. C's source was 388,423 bytes, likewise
different from its reported size. No raw received-byte comparison was performed.
The owner subsequently confirmed browsing all three previews after Done. This
passes batch preview navigation; individual B/C preview orientation, measured
timing and memory behavior have not been separately established. No additional
individual B/C run is inferred from the batch evidence.

The owner also clarified that all fixtures were saved to the iPhone through
ChatGPT. This adds an image-transfer step that could account for the reported PNG
and size changes; the conversion stage has not been isolated. Do not attribute
those changes specifically to Photos or Shortcuts. A direct original-file transfer
or verified camera HEIC is still needed to establish native HEIC coverage.

**Current owner direction, 25 October:** after investigating direct sharing and
server-side conversion, the owner selected testing the Paste compromise. Helper
apps remain a last resort. Server-side conversion is not selected. The earlier
zero-paste preference remains the ideal, not a blocker to this experiment.

Next: design a simple native-paste import flow using the existing browser pipeline
and administrator authentication, with an explicit preview/duplicate/upload step.
No more synthetic clipboard tests are needed to establish this route's feasibility.
Byte-identity stability, direct HEIC coverage, independent output verification,
edited/Live Photo inputs and production upload acceptance remain open.

## Goal and scope

Prove a practical route from **Photos → select photo → Share → Send to Dayframe**
to an upload-ready image on the phone, without selecting the image again. Begin
with one image, then a small batch. Decide whether we can reuse the existing
browser processing or need a different approach before implementing credentials
or production endpoints.

This slice produces a disposable Shortcut, a diagnostic browser harness if needed,
and an evidence-backed route decision. It does not deploy changes, upload household
photos, create credentials, alter the frame, or implement the full sharing feature.

## Existing constraints

- Reuse `src/lib/photos/processing.ts` where possible: source SHA-256, orientation,
  resize without upscaling, sRGB rendering, dHash, WebP encoding and metadata removal.
- The current upload contract in `worker/photo-api.ts` requires static WebP,
  maximum 1,600px edge and 2 MiB, plus SHA-256 and dHash headers. Passing this
  contract is the definition of upload-ready, not merely producing a JPEG.
- Existing browser authentication must not be assumed available to Shortcuts.
  No broad admin token or display credential belongs in a Shortcut.
- Keep image processing on the phone and infrastructure at €0 recurring cost.
- Do not put image payloads or credentials in URLs, browser history, logs, analytics
  or a publicly shared Shortcut. Use synthetic images for experiments.

Apple documents image input and file POSTs, but its Run JavaScript on Webpage
action requires an active Safari webpage. A shortcut launched from Photos cannot
be assumed to run our browser code directly. Photo-to-browser transfer is the
main unknown; opening the upload page alone does not meet the goal.

## Experiments, in order

### 1. Establish what Photos actually shares

Record the owner's iPhone model, iOS version and Safari version where available.
Build a diagnostic Shortcut accepting Images from the Share Sheet. Inspect input
locally without sending it anywhere. Record item count, format, dimensions,
orientation, byte size and whether repeated sharing preserves source bytes/hash.
Use synthetic JPEG, portrait HEIC and a large image saved to Photos. Include an
edited image and a Live Photo; v1 may use only the still image, but must say so.

**Gate:** one selected image arrives correctly, and a three-image selection arrives
as three independently processable items. Record any automatic conversion, metadata
retention and changes in byte identity. Photos may supply a representation rather
than original library bytes; do not claim cross-path exact deduplication without
evidence.

### 2. Direct-route assessment — 24 October 2026

The owner prefers a zero-paste route and a helper app only as a last resort.
Research findings and limits:

| Route                                                   | Evidence                                                                                                                                                               | Decision / remaining gate                                                                                                                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native Shortcuts, unchanged WebP contract               | Installed Mac Convert Image menu offers JPEG, PNG, TIFF, GIF, BMP, PDF, HEIF and Match Input; no WebP. Generate Hash offers SHA256.                                    | Native hashing exists on the Mac; WebP and the equivalent pixel-processing actions remain unproven on the iPhone. Do not claim platform parity or native-only feasibility.                                                               |
| Native Shortcuts, optimized JPEG plus tiny pixel sample | A macOS ImageIO test via `sips` generated an uncompressed 24-bit 9 × 8 BMP in 278 bytes, with a 54-byte header and top-down rows. This is host evidence only.          | Promising diagnostic candidate. Verify actual iPhone resizing, metadata removal, JPEG size/quality, SHA-256 and sample encoding first. JPEG acceptance requires an explicit upload-contract/spec decision.                               |
| Scriptable helper                                       | Official docs expose shared image/file arguments, local HTML WebView loading and JavaScript evaluation. French App Store listing is free with in-app purchases.        | Last resort, not selected or installed. WebP/WASM loading, hashing, memory and batch behavior still require a prototype. Documentation warns large image inputs can terminate extensions; Run in App is a documented mitigation to test. |
| Custom containing iPhone app plus share extension       | Apple documents receiving shared attachments. Free Personal Team profiles expire after seven days; Developer Program membership is USD 99/year or regional equivalent. | No new subscription approved. Poor default for a zero-maintenance, no-new-recurring-cost workflow; an existing membership would change distribution considerations. No native app work begun.                                            |

For the JPEG/sample candidate, one possible design moves only the 64 dHash
comparisons to the Worker using the phone-generated small pixel sample. It would
not decode, resize or compress the full photo on the server. This **deviates from
the current client-side perceptual-hashing requirement**, so it is a proposal,
not an authorized implementation. Alternatively, assess decoding the tiny BMP and
calculating dHash with native Shortcut arithmetic; prove its speed/complexity
before preferring it. Do not remove perceptual duplicate detection or weaken the
current WebP-only API as a workaround. Existing browser/frame/offline contracts
also need compatibility review before introducing JPEG records.

Sources: [Apple Personal Team limitations](https://developer.apple.com/help/account/basics/about-your-developer-account),
[Apple program fees](https://developer.apple.com/help/account/membership/program-enrollment),
[Apple share extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html),
[Scriptable shared input](https://docs.scriptable.app/args/),
[Scriptable WebView](https://docs.scriptable.app/webview/),
and [French App Store listing](https://apps.apple.com/fr/app/scriptable/id1405459188).
Native-menu inspection used only the existing task-owned draft; the accepted
**Dayframe-Photo-Check** diagnostic was not modified. No personal Shortcut was edited.

### Server-side conversion candidate — owner question, 24 October 2026

Current Cloudflare documentation makes a managed conversion route worth testing
before introducing JPEG storage or a helper app. The Images binding accepts raw
request bytes and can output WebP without a publicly accessible original URL.
Images Free documents 5,000 unique transformations per month, with new transforms
failing at the limit and no overage charges. This is distinct from the paid Images
plan and does not require Images storage or R2 in the proposed flow.

Candidate: native Shortcut resizes/removes metadata and sends a bounded JPEG to
an authenticated Worker endpoint; the Images binding converts it; the Worker
validates the resulting WebP and stores only that output in the existing KV.
Convert once on upload, rather than on every photo read. Do not place private
results in shared/public caches or source images at public URLs. Duplicate
detection, retry identity and transformation-request budgets still need design;
the conversion service does not automatically supply our dHash contract.

Writing a JPEG/WebP codec inside the ordinary Worker is a different route:
Workers Free has a 10 ms CPU budget, so in-Worker encoding is not assumed viable
without benchmarks. Managed Images processing avoids implementing that codec in
the Worker; its account availability, Free-plan binding behavior, quota errors,
output metadata/privacy and actual Worker CPU still need verification.

This candidate changes the current specification's on-device conversion rule and
its service-selection gate. The owner's question is not authorization to enable
Images, deploy code, send private photos or purchase/upgrade any plan. Prepare a
local synthetic proof and explicit spec/architecture proposal first; retain the
hard €0 limit and fail closed at quota exhaustion.

Sources checked 24 October 2026:
[Images pricing and hard Free limit](https://developers.cloudflare.com/images/pricing/),
[raw-byte Images binding](https://developers.cloudflare.com/images/optimization/binding/),
and [Worker CPU limits](https://developers.cloudflare.com/workers/platform/limits/).

### Clipboard/browser experiment — active, 25 October 2026

**Owner-selected experiment: clipboard handoff.** Have the
Shortcut copy the shared image and open a first-party HTTPS diagnostic page.
The owner explicitly taps Paste; the page reads image blobs and calls the existing
`processPhoto` pipeline without uploading. WebKit documents image clipboard reads,
secure-context/user-gesture requirements and possible native Paste confirmation
([source](https://webkit.org/blog/10855/async-clipboard-api/)). This establishes a
candidate API, not a tested iOS 27.0.1 route. Prototype one image, then three: count
the actual received image items and fail visibly if the batch is incomplete.
Do not assume copying a Shortcuts list preserves separate clipboard images.
Test cancellation, PNG representation growth and the large fixture. Explain that
copying replaces clipboard contents; inspect native local-only/expiry controls
before using household images. Original-byte deduplication remains unproven.
Preparation completed for the authorized test:

- `/experiments/photo-paste/` reads clipboard images only on explicit Paste, or a
  native paste event in its manual paste zone. Text/HTML are ignored, not inserted.
  It compares received item count with the selected count, flags incomplete
  batches and disables conversion for a mismatch. It shows local previews and
  optionally runs the existing `processPhoto` resize/WebP/SHA-256/dHash pipeline.
- Nothing uploads or persists. Displayed previews and page-held references clear
  on Clear/pagehide/hidden; an in-flight conversion can finish before its fenced
  result is discarded. This does not erase the system clipboard. Only synthetic
  fixtures are authorized for this diagnostic.
- The generator's `--clipboard-url` mode produces **Dayframe-Photo-Paste**:
  Count → Copy Shortcut Input with **Local Only** enabled → build the HTTPS URL
  with only `expected=N` → Open URL. No photo payload/credential is put in the URL.
  Native clipboard parameters were verified using the existing task-owned draft's
  export. The signed handoff was imported and all five actions/bindings inspected
  on the Mac. This is not an actual iPhone clipboard pass.
- A dedicated read-only loopback server exposes only this page and generated
  public JS/CSS/font/WASM assets, under a strict CSP. APIs/private/admin routes
  return 404 and POST returns 405. No dashboard API bindings or credentials exist
  in this server. There are no request/access logs.
- The temporary HTTPS Quick Tunnel uses Cloudflare's official `cloudflared`
  2026.10.3 ARM64 archive, verified against its release SHA-256
  `1165d14b6f6360a3b8c283d7d1100024d6ec7cd9bc9e32519e96150645f3ec55`.
  No Cloudflare account, paid service, production deployment, router or frame
  configuration changed. The public URL can be reached by anyone knowing it;
  pasted photo bytes remain in the browser. The URL stops when the local tunnel
  stops. Stop the tunnel/server when owner testing is complete; do not install a
  background service or create a recurring monitor.
- Validation: type check, focused XO, build; 16 Playwright checks across Chromium,
  Firefox, WebKit and mobile WebKit with simulated clipboard input. Covered real
  local WebP processing, three items, incomplete batches, denied clipboard,
  ignored HTML/text and cancellation fencing. A separate mobile WebKit smoke
  passed local conversion under the actual isolated server's CSP and its path/
  method rejection checks. Mobile screenshot reviewed. HTTPS edge checks also
  passed 200 for the page, 404 for private/API/admin paths and 405 for POST.
  These checks do not establish the native iPhone clipboard item behavior.

Handoff artifacts are outside Git under `/private/tmp/dayframe-iphone-test`.
The selected count is automatically passed to the page; do not lower it to hide a
missing-image result. If a quick tunnel expires, prepare a new URL and re-sign the
Shortcut before repeating; no stale URL is treated as a product failure. See
[Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

#### Owner single-image clipboard result — 25 October 2026

The owner ran **Dayframe-Photo-Paste** with fixture A and reported a Paste prompt
before the webpage opened. The prompt's exact wording/initiating application was
not captured, so its cause remains unestablished. On the page, the owner needed
to long-press the manual paste box and select Paste; the button path did not
complete the handoff in this run. No specific button error was reported.

The supplied screenshot shows **1 received / 1 expected**, `image/jpeg`, **144 Ko**,
**1600 × 1000**, fixture A upright in the preview, and **1 photo converted to WebP
on this device; no upload**. This passes actual iPhone single-image manual paste,
preview and the existing browser processing path. Output WebP bytes/metadata and
fingerprints were not independently exported or inspected; no upload, duplicate
matching or timing/memory acceptance is implied by the success message.

The subsequent batch test below supersedes the earlier unresolved button result.

#### Owner batch clipboard result and clarification — 25 October 2026

The owner clarified that the page's button displays the native Paste control;
the earlier single-image report was partly an interaction misunderstanding and
does not establish that the button itself was broken. In the new three-photo run,
the button/native-control path received **one of three**: fixture B, `image/png`,
136 Ko, 1200 × 1800. The page visibly flagged the incomplete batch and disabled
conversion. This is observed incomplete retrieval through this path; it is not
evidence that the Shortcut failed to copy the whole batch, nor proof of the
underlying browser implementation cause.

Manual long-press Paste in the box then received **three of three**. The owner
confirmed all three converted successfully, and the final screenshot shows
**3 photos converted to WebP on this device; no upload**, with 3/3 received.
This passes actual iPhone synthetic batch transfer through the native paste event
and the existing on-phone processing path. No independent encoded output capture,
production upload, real HEIC/edited/Live Photo, timing or memory acceptance is
claimed. Supplied screenshots remain outside Git; this transcription retains the
relevant evidence.

Feasibility conclusion: use a plainly visible native paste zone as the primary
interaction for the next design. Do not present asynchronous button reads as an
equivalent batch path on this tested device. Preserve the received/expected count
check so incomplete imports cannot silently proceed. The current two-path test UI
is diagnostic, not the intended product interaction. No helper, new upload token,
server-side conversion or additional service is needed for this demonstrated
local handoff. Actual imports still require the existing protected admin upload
flow, duplicate review, session-expiry handling and acceptance in a later slice.
After recording the result, the Quick Tunnel shut down and the isolated loopback
server was stopped. The diagnostic URL in the signed prototype is now inactive.

#### Button format comparison — actual iPhone result, 25 October 2026

The button result is not yet a conclusive dead end. In the tested mixed batch,
A/C were JPEG and B was PNG; only B reached the button path. WebKit's documented
asynchronous clipboard image representation is PNG. A format-exposure difference
is therefore a hypothesis worth testing before concluding a one-image limit.
The current code already iterates all returned clipboard items, selecting one
image representation per item; it does not intentionally take only the first item.

One focused follow-up should record returned item counts and MIME type names for
the existing mixed batch, then compare a Shortcut that explicitly converts all
three synthetic inputs to PNG before copying. Capture manual-paste file counts
as the control. Do not treat multiple representations as distinct photos, display
clipboard text/HTML or fetch clipboard URLs. If non-image representations exist,
record only their presence initially rather than assuming they contain the other
photos. If PNG normalization preserves all three in the button path, assess
memory, orientation, metadata, size and duplicate-identity effects before adoption.
This hypothesis is based on the observed format pattern and
[WebKit's API documentation](https://webkit.org/blog/10855/async-clipboard-api/),
not a verified iOS 27.0.1 implementation diagnosis.

Prepared the follow-up with a visible metadata-only report: API item count and
MIME types, extracted image count, and equivalent native paste event metadata.
Clipboard text, HTML content, filenames and URLs are never read for the report.
Added two separately named signed Shortcuts without replacing the previous ones:
**Dayframe-Paste-Mixed** (original inputs) and **Dayframe-Paste-PNG** (repeat each
input → Convert Image to PNG → copy Repeat Results, Local Only). The expected
count still comes from the original input. The native Mac editor confirms PNG,
Repeat Item and Repeat Results bindings. The workflow sets preserve metadata off;
actual iPhone PNG handoff and local WebP conversion subsequently passed below.
Metadata removal is not independently verified. No resize is requested.

The isolated read-only static server and accountless HTTPS tunnel were restarted
for this comparison; URL is transient and kept outside source. Existing prototype
and original photo-check Shortcuts remain unchanged. Owner should share the same
A+B+C selection through each new Shortcut, use the button/native Paste, screenshot
the report and count, then use manual paste as the control if incomplete. If PNG
button yields 3/3, verify all distinct upright previews and local WebP conversion.
No production endpoint, upload or authentication change is included.

Follow-up validation: type checks, production build and focused XO passed.
All 16 focused simulated clipboard tests passed across Chromium, Firefox, WebKit
and mobile WebKit, including report item/type counts, one image per item despite
multiple representations, discarded text/HTML and pending-read cleanup. Separate
mobile WebKit smoke against the isolated server showed the PNG label without
page errors; API/admin/private routes returned 404 and POST returned 405.
HTTPS returned the updated report. These checks do not establish iPhone clipboard
behavior. Both new signed Shortcuts were added and their current URLs verified
in the native Mac editor. The owner subsequently ran both on the iPhone.

Owner screenshot evidence at 09:44 (mixed): expected 3, API returned 3 items;
item 1 had no exposed types, item 2 exposed `image/png`, item 3 had no exposed
types. Only one image was extracted. This rules out a simple one-item return
limit for this case and supports the format-exposure hypothesis.

Owner screenshot evidence at 09:46 (PNG): expected 3, API returned 3 items, each
exposing `image/png`; all 3 were extracted and the page reported all 3 converted
to WebP locally with no upload. First visible input preview metadata: PNG,
263 Ko, 1600 × 1000. Owner: “That seemed to work.” The screenshot does not show
all previews. The owner subsequently confirmed they were correct after closing
the page, completing synthetic preview acceptance for this variant. This demonstrates a viable button route for the
synthetic batch, not general format or large-batch acceptance.

Proceed with PNG normalization as the candidate handoff; retain manual paste as
fallback. Before production adoption, check representative camera originals,
orientation, memory/intermediate PNG size, metadata and duplicate identity across
picker and Shortcut paths. Browser processing hashes its received bytes, which
may differ after PNG normalization. Authenticated upload integration remains a
separate reviewable slice; no server-side image conversion or helper is needed
for this demonstrated route.

Investigate supported ways to transfer the selected bytes into a first-party HTTPS
page without using payload-bearing URLs or a server-side original-image inbox.
Use a minimal diagnostic page that calls the existing `processPhoto` function and
shows a local preview plus processing results; it makes no production API calls.
Do not assume Open URLs, a web share target, a local HTML preview or Safari
JavaScript provides the required transfer. Verify an actual supported mechanism
on the phone before building around it.

**Gate:** the selected photo reaches the page without a second picker, processes
successfully and remains available through the expected handoff. If no supported
transfer exists under these constraints, mark this route blocked and move on;
do not expand into custom native code or server staging in this slice.

### 3. Native Shortcut processing diagnostic — held alternative

Before asking the owner for another session, prepare a local-only native processing
diagnostic with inspectable outputs: longest edge at most 1,600px, JPEG size and
metadata behavior, SHA-256, and an explicitly 9 × 8 BMP sample. Check landscape,
portrait and large inputs on the actual iPhone. Do not assume Resize Image
stretches to 9 × 8 or that the Mac BMP format matches the iPhone. The sample must
represent the entire image, not a small center crop. Any on-phone dHash prototype
must match the documented bit/grayscale layout and be timed on the phone.
This diagnostic may write only synthetic test outputs locally; no upload, token,
new endpoint, helper installation or production format change is included.

Use these results to present a concrete contract decision: a proven native route
with explicit JPEG/dHash tradeoffs, or the still-unproven helper route. Keep the
current backend and specification unchanged pending that decision.

Inspect the image actions available on the actual iPhone. Test whether they can
produce the required WebP, strip disallowed metadata, preserve orientation and
compute the required fingerprints entirely on-device. Compare outputs with the
browser pipeline using synthetic fixtures. Native conversion changing source bytes
must have an explicit deduplication consequence in the findings.

**Gate:** all current upload-contract requirements pass. Resizing or JPEG conversion
alone is insufficient. If WebP encoding or dHash needs an additional app, native
extension or a changed contract, record the dependency and stop this route rather
than silently weakening validation.

### 4. Validate the viable route and its limits

For whichever route passes, process the JPEG, HEIC and large-image fixtures, then
a three-image batch sequentially. Verify orientation, dimensions, actual WebP
decodability, metadata removal and fingerprint stability. Exercise cancellation,
background/foreground and retry. Record prompts, taps, elapsed time, visible stalls
or termination; do not infer memory safety from one successful small photo.

Where browser code is available, validate the output with the existing photo
validator/local synthetic API harness. No new production upload route or real
credential is needed. Distinguish validated output from a completed authenticated
end-to-end upload.

## Decision and deliverables

Produce a short results table with each experiment, observed result, sanitized
evidence and limitations, plus the prototype Shortcut without secrets and any
diagnostic source. Do not commit test images with personal data or raw phone logs.

- **Browser route passes:** propose a separate authenticated handoff slice,
  including sign-in/expired-session behavior and how pending photos survive it.
- **Direct route passes:** propose a separate upload-only credential/API slice,
  including per-person revocation and advisory duplicate handling without granting
  access to the private photo collection.
- **Neither passes:** document the precise blocker and present the smallest options
  with their tradeoffs, such as an additional on-device component or a revised
  handoff. Keep the existing browser uploader as the usable baseline. No automatic
  fallback to server processing, private-photo staging or paid services.

Success means a demonstrated route on the actual iPhone, or a conclusive blocker
report that prevents committing to an unsupported architecture. Full authentication,
network upload/retry acceptance, installable distribution and household rollout
belong to subsequent slices.

## Sources and preparation for implementation

- [Apple: Share Sheet input types](https://support.apple.com/en-gb/guide/shortcuts/apd7644168e1/ios).
- [Apple: API requests and file bodies](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios).
- [Apple: JavaScript webpage input restrictions](https://support.apple.com/en-gb/guide/shortcuts/apd218e2187d/9.0/ios/26).
- Local requirements: `technical-specification.md` sections 6.2–6.6, 10 and 12;
  `photos.md`; current photo processing, admin and Worker upload code.
- Before writing the prototype, refresh the required upstream review in
  `implementation-plan.md` section 1, inspect relevant photo/upload code and docs,
  and record paths, revision, licensing and reuse/differences. No upstream code is
  copied or hardware procedure proposed by this planning document.

## Authenticated browser import slice — 25 October 2026

Owner requested moving forward after confirming all three PNG previews. Implement
clipboard intake in the existing protected `/admin/photos` page. Sign in before
Paste; preview and compare received/expected count; only explicit **Ajouter à la
collection** passes files to the existing sequential uploader. Keep normal picker,
manual native paste, exact delivered-byte checks, perceptual review and per-file
retry. An incomplete or unsupported-item batch cannot silently upload. Limit intake
to 10 images, 40 MiB each and 100 MB total. No new endpoint, token, image service,
helper, database or recurring charge.

Threat model and retention: HTML/text are never parsed or inserted. Credentials
remain in the existing HttpOnly browser session; URL carries only intake/count
parameters. Staged bytes live only in page memory; Clear/page exit release them. Thumbnails
are generated sequentially at at most 320px, releasing each full-size preview
decode before moving on. Upload waits until every preview is prepared.
Access denial hides/revokes staged previews and blocks intake/upload; revalidation
can restore a staged batch in the same tab. Existing selected-file upload retries
also remain in memory. Reconnect in another tab, then refresh access in the original
tab. Reload/navigation loses pending bytes and requires another Paste. No clipboard
background read and no new photo persistence. Native clipboard contents remain
until overwritten by the OS/user.

SHA-256 identifies received PNG bytes before browser processing. Cross-route exact
identity is not promised; visually similar content still requires human review.
Document this explicitly rather than changing the backend identity contract.

Upstream refreshed 25 October at `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`:
README, `dashboard/js/views/photos.js`, `dashboard/js/slideshow.js` and MIT LICENSE
reviewed. Upstream uses mock slideshow sources and provides no authenticated
clipboard uploader to adapt. This intake is independently authored and reuses
Dayframe's uploader/processing/security modules; no upstream code/assets copied.

The generator's `--admin-import` flag requires PNG normalization and an explicit
HTTPS admin URL. It adds `import=clipboard` to open the intake section and retains
the original selected count. A non-installable example.invalid template was built
locally to inspect its eight actions. No production Shortcut installed or deployment
performed in this slice; use the deployed first-party admin URL only after rollout.

Local implementation validation: type checks/build/lint passed (existing complexity
warnings only), 134 unit/integration tests passed, and 72 photo/clipboard browser
checks passed. Final intake changes rechecked with 12 passing clipboard cases
across four browser projects. Mobile staged layout reviewed; 320px thumbnail output
is asserted. Tests use simulated clipboard bytes and real local Worker/KV auth/
upload handling, not an actual iPhone authenticated import. Production rollout,
real camera inputs and independent iPhone output acceptance remain pending.

## Production rollout authorized — 25 October 2026

Owner authorized deployment, installation of the real Shortcut and removal of old
Dayframe test Shortcuts. Built/signed/installed **Dayframe PNG** on the Mac with
PNG-per-input conversion, Local Only clipboard, original input count and the
existing first-party `/admin/photos` page (`import=clipboard`). Native editor
verified action bindings and destination; no token/cookie is embedded. iPhone
sync and authenticated upload acceptance remain pending. Final signed artifact
stays outside Git.

Selected only the five retired task-created Shortcuts for cleanup:
Dayframe-Paste-Mixed, Dayframe-Paste-PNG, Dayframe-Photo-Paste,
Dayframe-Photo-Check and Dayframe — test photos. Automatic approval review rejected
the delete action because it could be irreversible and sync across devices;
no deletion occurred. Request explicit confirmation of these names before retrying.
Personal Shortcuts and the replacement were not selected.

## Rollout and cleanup completed — 25 October 2026

Deployed application source `52ed5f4` (feature `674d90a` plus the test-only heartbeat
fix) through successful [release 40182021955](https://github.com/codyzu/dayframe/actions/runs/40182021955).
All 134 unit/integration, 328 browser and 44 navigation checks passed; four existing
intentional browser skips remain. Deploy and live smoke jobs passed. Worker
version `6d164a6a-9c9f-4665-9bf1-219d24b0ab08`; public build ID
`38aa63f5-fe1a-45ce-b009-307186268407`. An independent live check matched the
clipboard admin JS asset to the local build, verified admin sign-in 302 with
selected-count preservation, and anonymous catalog denial 401.

The owner explicitly confirmed **Delete those five** in response to the named
cross-device cleanup question. Deleted exactly Dayframe-Paste-Mixed,
Dayframe-Paste-PNG, Dayframe-Photo-Paste, Dayframe-Photo-Check and
Dayframe — test photos through Shortcuts' iCloud deletion confirmation. Native UI
and filtered CLI listing now show only **Dayframe PNG** among Dayframe Shortcuts.
Four signed test copies plus the task-owned draft reference were retained in
ignored `private/shortcut-cleanup-20261025/`; no personal Shortcut was selected.
The earlier automatic-review block is resolved by that explicit confirmation.
iPhone sync and the owner's first authenticated upload are still pending; no
private photo upload was performed by the agent during rollout.

## Owner authenticated acceptance and size recovery — 25 October 2026

Owner: “It works.” This closes owner-reported actual-iPhone authenticated import
acceptance for the production flow, without independent payload/format/HDR
inspection. The owner also tried approximately ten photos and suspects the 100 MB
limit; exact trigger is not established because the previous error named all
three limits at once. They reported that reselecting the same photos is painful.

Prepared precise errors and two-photo recovery using the same clipboard. No
Shortcut reinstall or new permission scope is needed. Each group uses an explicit
native Paste gesture and Add confirmation, then enters the existing uploader;
source count is checked on every group. The page never empties the clipboard, but
OS expiry or another copy operation can replace it. Recovery does not promise
persistent bytes or detect same-count substitutions; previews remain mandatory.
The 40 MiB individual cap remains; this slice does not silently enlarge it or add
server-side conversion. Successful upload row listeners are removed to release
large source references; failed rows preserve their current retry behavior.

Recovery deployment completed from `0d8413d` through
[release 40194141441](https://github.com/codyzu/dayframe/actions/runs/40194141441).
Checks, deployment and live smoke all succeeded: 134 unit/integration tests,
340 browser passes with four existing skips, and 44 navigation passes. Worker
version `0b545288-2ab3-448d-bd7d-655079bc649a`; public build ID
`1695d7c8-4818-4ece-8b84-c4e6fef03395`. The live recovery JS matched the local
build; signed-out admin still redirects to Access preserving `expected=10`, and
anonymous catalog reads still return 401. No Shortcut reinstall is needed.
Owner clarified the old message listed all limits, so the original failure's
specific cause remains unknown. Actual iPhone recovery remains pending.

## Adaptive recovery follow-up — 25 October 2026

Owner found two-photo groups too small and requested the size-based alternative.
Prepared **Coller par lots adaptés**: retain clipboard order, fill each group up
to ten photos and 100 MB, show staged range/size, then await confirmation. A single
lookahead can be read to locate the boundary but is not retained or skipped;
future explicit Paste starts there. The native paste path uses the same rule.
Exact 100 MB fits; the single-photo 40 MiB cap remains, and a problematic next
photo cannot disappear silently. No re-encoding, Shortcut reinstall, backend or
security-policy changes. The existing diagnostic single/batch acceptance does
not establish actual iPhone adaptive recovery; deployment and phone testing are
still pending in this follow-up.

Adaptive follow-up is now deployed from `205642e`; the
[release](https://github.com/codyzu/dayframe/actions/runs/40214009211) passed
134 unit/integration, 348 browser cases (four existing skips), 44 navigation
checks, deployment and live smoke. Worker version
`e9425aac-5d4a-4f29-877c-dd4aa3678e1d`, build
`383dfbc4-321f-46f4-95d6-be90ce634080`. Independent live module equality and
private-access checks passed. Refresh/reopen the admin page; no Shortcut
reinstallation is needed. Actual iPhone adaptive recovery remains an owner gate.

## Owner acceptance and quieter upload UI — 26 October 2026

Owner confirmed the adaptive flow works well on the actual iPhone, commonly
splitting large selections into groups of three/four. Earlier pending adaptive
phone-acceptance notes above are historical. Single-image size recovery remains
limited to choosing/sharing a smaller representation.

The next UI slice makes adaptive sizing automatic at first Paste, unifies picker
and clipboard previews/confirmation, removes visible expected-count/recovery-mode
controls, and preserves per-photo conversion feedback with a compact success
summary. Manual paste appears only after a paste problem. The existing Dayframe
PNG Shortcut remains compatible without reinstalling; no server conversion,
helper app, credential or image-quality change. See the current photo operations
and implementation-plan entries for validation/rollout evidence.

Simplified UI rollout completed from `3ac32c8` through
[release 40407204551, attempt 2](https://github.com/codyzu/dayframe/actions/runs/40407204551/attempts/2).
Full release verification, deploy and smoke passed. The live upload module matches
the local tested source and private access remains protected. Refresh the page;
the installed Dayframe PNG Shortcut needs no update. Owner phone acceptance of the
new interface remains separate from the already accepted adaptive batching.
