# Apple Intelligence (on-device) provider — iOS/macOS

**Date:** 2026-06-22
**Status:** Approved, implementing

## Goal

Add Apple Intelligence (Foundation Models, on-device) as an AI provider on the
iOS/macOS Safari apps so users get summaries **without entering an API key**.
Chrome/Firefox are out of scope (no Apple Intelligence access).

## Decisions

1. **Role:** Apple Intelligence is the **default** when the device supports it
   (zero key). Falls back automatically to Gemini-with-key when unavailable
   (old OS, ineligible device, Apple Intelligence off).
2. **Long transcripts:** **map-reduce** — summarize the transcript in segments,
   then a final merge pass (4,096-token context window, ~3–4 chars/token).
3. **Paywall:** unchanged — 14-day trial then Premium gates the feature
   regardless of provider (Apple Intelligence included).
4. **macOS deployment target:** keep 13.0; gate Apple Intelligence with
   `@available(iOS 26, macOS 26, *)`. No user dropped.

## Architecture (Approach A — shared native engine)

### 1. `AppleIntelligenceEngine.swift` (new, shared by Extension + App targets)
Gated `@available(iOS 26, macOS 26, *)`:
- `availability() -> (available: Bool, reason: String?)` via
  `SystemLanguageModel.default.availability`.
- `summarize(transcript:instructions:lang:) async throws -> String` — segments
  the transcript (~3,000-token budget/segment, leaving room for output),
  summarizes each via `LanguageModelSession.respond(to:)`, then a final merge
  pass. Catches `LanguageModelError.contextSizeExceeded` → re-chunk smaller /
  fresh session.
- `answer(question:transcript:qaHistory:) async throws -> String` — same token
  discipline; context trimmed/summarized when oversized.

### 2. Safari extension bridge
`SafariWebExtensionHandler.swift`: new actions `aiAvailability`, `aiSummarize`,
`aiAsk` dispatched to the engine. `background.js`: when `service === 'apple'`,
route to `sendNativeMessage(...)` instead of `fetch`.

### 3. Container app bridge
New `WKScriptMessageHandler` `appleIntelligence` in `ViewController.swift`
(mirrors the existing `nativeFetch` pattern) → calls the engine.
`Script.js`: when `service === 'apple'`, call native.

### 4. Settings UI (`options.html`/`options.js` + app web UI)
- New `<option value="apple">Apple Intelligence · on device</option>`.
- Probe availability on load: if available **and** no prior choice → default to
  `apple`; **hide the API-key field** when `apple` is selected.
- If `apple` selected but unavailable → fallback notice + switch to Gemini.
- New i18n strings (FR/EN).

## Scope boundary
iOS/macOS Safari targets only. Chrome/Firefox untouched.

## Risk to validate early
Running `FoundationModels` inside the Safari app-extension process (memory
budget). The model is a system service (out-of-process), so expected OK —
confirm with a quick simulator test. Fallback if not: route the extension's
request to the container app.

## Testing
- Swift unit checks on segment/token estimation and `contextSizeExceeded`
  recovery.
- Manual: iOS 26 simulator (available path) + a non-eligible context (fallback
  path).
