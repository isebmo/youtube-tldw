# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YouTube TLDW;** — A browser extension that summarizes YouTube videos using AI. It extracts video transcripts via YouTube's InnerTube API and sends them to an AI service (Gemini, OpenAI, or OpenRouter) for summarization.

## Repository Structure

This is a multi-browser monorepo with three nearly identical extension variants and a landing page:

- `firefox-ext-yt/` — Firefox extension (Manifest V2, `browser.*` APIs)
- `chrome-ext-yt/` — Chrome extension (Manifest V3, `chrome.*` APIs)
- `safari-ext-yt/` — Safari extension (Manifest V3, `chrome.*` APIs)
- `site-ext-yt/` — Static landing page (HTML/CSS only)

## No Build System

Plain vanilla JS/CSS/HTML with no package manager, bundler, or test framework. Extensions are loaded directly into browsers for development.

## Loading Extensions for Development

- **Firefox**: `about:debugging` → "This Firefox" → "Load Temporary Add-on" → select `firefox-ext-yt/manifest.json`
- **Chrome**: `chrome://extensions` → enable Developer Mode → "Load unpacked" → select `chrome-ext-yt/` folder
- **Safari**: Requires Xcode conversion via `xcrun safari-web-extension-converter safari-ext-yt/`

## Architecture

Each extension has the same 4-file structure:

- **`content.js`** — Injected on YouTube pages. Contains `TranscriptFetcher` (extracts captions via InnerTube API) and `YouTubeSummarizerUI` (sidebar panel, header button, markdown renderer). Uses a `MutationObserver` to handle YouTube's SPA navigation.
- **`background.js`** — Receives `"summarize"` messages from content script, calls the selected AI API, returns the summary. Contains the fixed system prompt.
- **`options.html` / `options.js`** — Settings page for AI service selection, API key, and custom prompt instructions. Settings stored in `browser.storage.sync` / `chrome.storage.sync`.
- **`styles.css`** — Sidebar and UI styling with CSS custom properties. Supports YouTube dark mode via `html[dark]`.

## Critical Cross-Browser Differences

The three variants are near-copies. When modifying shared logic, **changes must be applied to all three**. Key API differences:

| | Firefox | Chrome / Safari |
|---|---|---|
| Manifest | V2 | V3 |
| Extension API | `browser.*` | `chrome.*` |
| Background | `"scripts": ["background.js"]` | `"service_worker": "background.js"` |
| Message response | Return a Promise from listener | Use `sendResponse` callback + `return true` |
| Permissions | Flat `permissions` array | Split into `permissions` + `host_permissions` |

## AI Service Integration

- **Gemini**: Google Generative Language API (`generativelanguage.googleapis.com`), model `gemini-3.1-flash-lite-preview`
- **OpenAI**: Chat completions API, model `gpt-4o`
- **OpenRouter**: OpenAI-compatible API with extra headers (`HTTP-Referer`, `X-Title`)

OpenAI and OpenRouter are currently disabled in the options UI (`<option disabled>`).
