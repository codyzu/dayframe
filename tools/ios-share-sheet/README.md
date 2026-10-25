# iPhone photo input diagnostic

This is the first experiment in [the feasibility plan](../../docs/ios-share-sheet-feasibility.md).
It inspects images locally and previews them. It has no networking, credential,
photo-library search, save or delete actions. The reported properties describe
what Photos shares, which may differ from the library original.

## Build on macOS

```sh
python3 tools/ios-share-sheet/build-diagnostic.py /private/tmp/dayframe-ios-share-sheet/Dayframe-Photo-Check.unsigned.shortcut
shortcuts sign --mode anyone --input /private/tmp/dayframe-ios-share-sheet/Dayframe-Photo-Check.unsigned.shortcut --output /private/tmp/dayframe-ios-share-sheet/Dayframe-Photo-Check.shortcut
swift -module-cache-path /private/tmp/dayframe-swift-module-cache tools/ios-share-sheet/make-fixtures.swift /private/tmp/dayframe-ios-share-sheet
```

Apple receives the Shortcut definition for signing; it contains no images or
credentials. Use only the signed `.shortcut` for installation. Keep generated
signed files outside Git: their envelopes include signing identity certificates.
The native HEIC encoder and Shortcut signer may require execution outside a
restricted shell sandbox. A successful signature does not establish runtime
correctness or iPhone compatibility.

## First iPhone session: about 5–10 minutes

Target reported by owner: iPhone 17, iOS 27.0.1. Fixture A passed actual iPhone
input/report/upright preview on 24 October 2026. The report's 144 KB differs from
the 102,646-byte source; the cause remains unestablished. The three-item batch
report also passed with expected dimensions; B reports PNG, leaving direct HEIC
coverage unproven. The owner confirmed browsing all three batch previews and
saving the fixtures through ChatGPT, which may explain conversion during transfer.
The initial input/report/preview test is complete; handoff/processing and direct
HEIC coverage remain open.

1. Transfer the signed `Dayframe-Photo-Check.shortcut` to the phone and add it in
   Shortcuts. If it has already synced from the Mac, use that installed copy.
2. Transfer the three generated images to Photos, preserving the HEIC format.
   Use AirDrop or another original-file transfer, rather than a messaging service
   that might resize/convert them. Do not use household pictures for this test.
3. In Photos, share **A** to **Dayframe-Photo-Check**. Record the report, close it,
   and check the preview is upright with TOP at the top and all four corners visible.
4. Repeat for **B**, then **C**.
5. Select all three and share them together. Confirm three report entries and
   three previews; source order is not an acceptance requirement.
6. Report any error verbatim and any prompts or unusually long pause. If it fails,
   stop and report the failure rather than changing the Shortcut's actions.

Expected source fixtures before import/sharing:

| Label | Format | Dimensions  | Purpose                      |
| ----- | ------ | ----------- | ---------------------------- |
| A     | JPEG   | 1600 × 1000 | Landscape baseline           |
| B     | HEIC   | 1200 × 1800 | Portrait and format handling |
| C     | JPEG   | 4032 × 3024 | Larger image                 |

Record a changed extension or size as a finding, not automatically a failure.
These fixtures have drawn orientation markers, not rotated EXIF, real camera HDR,
an edited Photos representation or Live Photo motion. Those remain later tests.
This first diagnostic does not compute source hashes, process WebP or upload;
it cannot establish deduplication, browser handoff or full feature feasibility.

## Clipboard handoff experiment — 25 October 2026

The owner selected testing a Paste step. The original **Dayframe-Photo-Check**
remains unchanged. Use **Dayframe-Photo-Paste** for the new experiment.

Build the application, then run the isolated server:

```sh
pnpm build
node tools/ios-share-sheet/serve-clipboard.mjs
```

It listens on `127.0.0.1:8794`, serves only the experiment and generated public
assets, rejects upload methods and API/private paths, and sends CSP/no-store
headers. Use a temporary HTTPS Quick Tunnel to that port for phone testing; never
tunnel the ordinary dev server or an API harness. No paid service/account or
production deployment is needed. Stop the tunnel/server after testing.

Generate and sign against the active temporary HTTPS page (replace the example):

```sh
python3 tools/ios-share-sheet/build-diagnostic.py /private/tmp/dayframe-iphone-test/Dayframe-Photo-Paste.unsigned.shortcut --clipboard-url https://EXAMPLE.trycloudflare.com/experiments/photo-paste/
shortcuts sign --mode anyone --input /private/tmp/dayframe-iphone-test/Dayframe-Photo-Paste.unsigned.shortcut --output /private/tmp/dayframe-iphone-test/Dayframe-Photo-Paste.shortcut
```

The five actions count images, copy the full input with Local Only enabled, build
the URL with only the expected item count and open it. Clipboard contents are
replaced and are not automatically restored or cleared after this prototype.
Do not launch it without shared image input. Use synthetic test images only.

On the iPhone, share **A** to **Dayframe-Photo-Paste**, then tap **Coller les photos**
on the opened page and accept the native Paste confirmation if offered. Expect
one image, an upright preview, and optional local conversion after tapping
**Tester la conversion WebP**. Repeat with **A + B + C** and expect three images.
Do not change the expected count when fewer arrive. Report the count, preview
orientation and any error. If the button fails, the manual paste zone provides a
second explicitly initiated paste path. No photo upload, login or credential is
needed; the page clears its previews when hidden/closed.

The test URL is temporary. A stopped tunnel needs a regenerated URL/Shortcut;
this is test infrastructure, not the intended final user experience. Simulated
browser clipboard tests cannot establish actual iPhone clipboard transfer.

Owner result, 25 October: fixture A passed manual long-press Paste in the box,
preview and local WebP conversion on the iPhone (1/1, JPEG, 1600 × 1000, 144 Ko).
The owner needed the manual route and also reported a Paste prompt before the
page opened. In the subsequent A+B+C run, the owner clarified the button opens
the native Paste control: this path received only B (1/3), while manual long-press
Paste received all three and all three converted to WebP. The incomplete batch
was correctly flagged and conversion disabled until the manual paste supplied 3/3.
Manual-paste feasibility is demonstrated for the synthetic inputs on this iPhone.
Use a visible native paste zone as the primary interaction for the next design;
do not assume the asynchronous button is an equivalent batch path. Production
upload/authentication, representative formats and independent output checks remain
later work. Stop the temporary tunnel/server after this completed test.

## Button format comparison — 25 October 2026

The follow-up uses **Dayframe-Paste-Mixed** and **Dayframe-Paste-PNG**; retain the
older Shortcuts. Generate both against the current HTTPS URL using the command
above with the new filenames. Add `--normalize-png` only for the PNG variant,
then sign each. PNG mode repeats through each shared input, converts it to PNG,
and copies Repeat Results with Local Only enabled. Original input count is
preserved in the URL; `variant=mixed|png` labels the report. No resize requested;
preserve metadata is set false. Native Mac editor verified PNG and variable
bindings; actual iPhone PNG handoff and three-image WebP conversion passed.

Use the same A+B+C selection for each new Shortcut, tap the button then native
Paste, and capture the report/count. Report includes only item counts, MIME type
names and extracted image count; it does not read text/HTML contents or filenames.
If incomplete, capture the button result before trying manual paste as a control.
If PNG gives 3/3, check distinct upright previews and run local WebP conversion.
Temporary hosting is open for this comparison; stop it after results are received.

Owner comparison result: mixed mode returned three clipboard items with types
`(none)`, `image/png`, `(none)` and extracted one image. PNG mode returned three
items each exposing `image/png`, extracted all three and converted all three to
WebP locally. First visible PNG: 263 Ko, 1600 × 1000. Full distinct/upright preview
confirmation and representative camera originals remain open. PNG normalization
is the candidate button handoff; evaluate intermediate memory/size, metadata and
cross-route duplicate identity before production integration.

## Implementation provenance

Independently authored diagnostic and synthetic fixture generator. Native action
identifiers/property names were checked against actions in the installed macOS
Shortcuts editor and a task-owned export. No personal Shortcut source was read.
Do not infer iPhone availability from the Mac action list.

Upstream reviewed at saved revision
`f1e0820918c926396e0ccafb4839568825f63edc`: `README.md`, `LICENSE`,
`dashboard/js/views/photos.js`, `dashboard/js/slideshow.js`, and the tracked path
list for share/upload/shortcut features. The public upstream README was refreshed
24 October 2026; a fresh Git HEAD lookup failed DNS in the restricted shell, so
this review claims the saved SHA only. The saved sources use mock slideshow data
and provide no photo Share Sheet upload implementation. Retain the browser-first
photo concept; independently implement local inspection for Dayframe's protected
upload pipeline. MIT license inspected; no upstream code or assets copied.

Apple references: [image inputs](https://support.apple.com/en-gb/guide/shortcuts/apd7644168e1/ios),
[Safari JavaScript input restriction](https://support.apple.com/en-gb/guide/shortcuts/apd218e2187d/9.0/ios/26),
and [Shortcut signing](https://support.apple.com/en-au/guide/shortcuts-mac/apd455c82f02/mac).

## Authenticated import generator

After the admin integration is deployed, generate a separate Shortcut with the
first-party HTTPS `/admin/photos` URL, `--normalize-png --admin-import`, then sign
it using the existing procedure. This sets `expected=N&variant=png&import=clipboard`
without photo bytes or credentials. Keep production hostname/signing outputs
outside Git. No real import Shortcut is installed by the local implementation.
The browser must sign in before Paste; adding to the collection is a separate
explicit action after preview. The prototype diagnostic names remain separate.
