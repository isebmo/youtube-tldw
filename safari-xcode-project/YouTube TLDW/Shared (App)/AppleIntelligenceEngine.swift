//
//  AppleIntelligenceEngine.swift
//  YouTube TLDW;
//
//  On-device summarization via Apple Intelligence (Foundation Models).
//  Shared by the container app and the Safari extension targets.
//
//  The model has a 4,096-token context window (instructions + prompt + output),
//  so long transcripts are summarized map-reduce style: each segment is
//  summarized on its own, then the partial summaries are merged.
//

import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

enum AppleIntelligence {

    /// Display name reported back to the web UI (shown as "Model: …").
    static let modelName = "Apple Intelligence"

    // ~3.5 characters per token in Latin scripts. We keep each request's input
    // well under the 4,096-token window to leave room for instructions and the
    // generated output.
    private static let segmentCharBudget = 7_000   // ≈ 2,000 input tokens

    // MARK: - Availability

    /// Whether the on-device model can be used right now. Safe to call on any OS;
    /// returns `false` with a machine-readable reason on pre-26 systems.
    static func availabilityInfo() -> (available: Bool, reason: String?) {
        if #available(iOS 26.0, macOS 26.0, *) {
            switch SystemLanguageModel.default.availability {
            case .available:
                return (true, nil)
            case .unavailable(let reason):
                return (false, reasonString(reason))
            @unknown default:
                return (false, "unknown")
            }
        }
        return (false, "osTooOld")
    }

    @available(iOS 26.0, macOS 26.0, *)
    private static func reasonString(
        _ reason: SystemLanguageModel.Availability.UnavailableReason
    ) -> String {
        switch reason {
        case .deviceNotEligible: return "deviceNotEligible"
        case .appleIntelligenceNotEnabled: return "appleIntelligenceNotEnabled"
        case .modelNotReady: return "modelNotReady"
        @unknown default: return "unknown"
        }
    }

    // MARK: - Public API

    @available(iOS 26.0, macOS 26.0, *)
    static func summarize(transcript: String, userPrompt: String?, lang: String?) async throws -> String {
        let segments = chunk(transcript, maxChars: segmentCharBudget)

        if segments.count <= 1 {
            let prompt = "Transcript:\n\(segments.first ?? transcript)"
            return try await respondWithFallback(
                instructions: summaryInstructions(userPrompt: userPrompt, lang: lang),
                prompt: prompt,
                maxTokens: 900
            )
        }

        // Map: summarize each segment independently.
        var partials: [String] = []
        partials.reserveCapacity(segments.count)
        for segment in segments {
            let partial = try await respondWithFallback(
                instructions: "Summarize this portion of a YouTube video transcript as concise markdown bullet points covering every key point. Respond in the same language as the transcript. Output only the bullets, no preamble.",
                prompt: "Transcript portion:\n\(segment)",
                maxTokens: 500
            )
            partials.append(partial)
        }

        // Reduce: merge the partial summaries into one structured summary.
        let joined = partials.enumerated()
            .map { "Part \($0.offset + 1):\n\($0.element)" }
            .joined(separator: "\n\n")
        return try await respondWithFallback(
            instructions: summaryInstructions(userPrompt: userPrompt, lang: lang),
            prompt: "Below are partial summaries of one YouTube video, in order. Produce ONE unified, structured markdown summary of the whole video. Do not mention that the input was split, and do not keep \"Part N\" labels; organize by topic instead.\n\n\(joined)",
            maxTokens: 900
        )
    }

    @available(iOS 26.0, macOS 26.0, *)
    static func answer(question: String, transcript: String, qaHistory: [[String: String]], userPrompt: String?, lang: String?) async throws -> String {
        // Keep the transcript within budget; the question + history also cost tokens.
        let context = String(transcript.prefix(segmentCharBudget))
        var historyText = ""
        for turn in qaHistory.suffix(3) {
            if let q = turn["question"], let a = turn["answer"] {
                historyText += "\nQ: \(q)\nA: \(a)"
            }
        }
        var instructions = "You answer questions about a YouTube video using only its transcript. If the answer is not in the transcript, say so. Answer in markdown."
        if let lang, !lang.isEmpty, lang != "auto" {
            instructions += " Respond in \(lang)."
        } else {
            instructions += " Respond in the language of the question."
        }
        if let userPrompt, !userPrompt.isEmpty {
            instructions += "\n\(userPrompt)"
        }
        let prompt = "Transcript:\n\(context)\(historyText.isEmpty ? "" : "\n\nEarlier:\(historyText)")\n\nQuestion: \(question)"
        return try await respondWithFallback(instructions: instructions, prompt: prompt, maxTokens: 700)
    }

    // MARK: - Generation helpers

    @available(iOS 26.0, macOS 26.0, *)
    private static func summaryInstructions(userPrompt: String?, lang: String?) -> String {
        var instructions = "Summarize the YouTube video transcript precisely and in a structured way, formatted in markdown, so a reader can understand all points without watching. Output only the summary, with no introductory sentence."
        if let lang, !lang.isEmpty, lang != "auto" {
            instructions += " Respond in \(lang)."
        } else {
            instructions += " Respond in the same language as the transcript."
        }
        if let userPrompt, !userPrompt.isEmpty {
            instructions += "\n\nAdditional instructions:\n\(userPrompt)"
        }
        return instructions
    }

    /// Runs a single generation. On failure (e.g. context window exceeded) it
    /// retries once with a hard-truncated prompt before giving up.
    @available(iOS 26.0, macOS 26.0, *)
    private static func respondWithFallback(instructions: String, prompt: String, maxTokens: Int) async throws -> String {
        let options = GenerationOptions(maximumResponseTokens: maxTokens)
        do {
            let session = LanguageModelSession(instructions: instructions)
            let response = try await session.respond(to: prompt, options: options)
            return response.content
        } catch {
            // Most likely the context window was exceeded — retry with a fresh
            // session and a shorter prompt.
            let shorter = String(prompt.prefix(segmentCharBudget / 2))
            let session = LanguageModelSession(instructions: instructions)
            let response = try await session.respond(to: shorter, options: options)
            return response.content
        }
    }

    // MARK: - Chunking

    /// Splits text into chunks no larger than `maxChars`, preferring to break on
    /// paragraph then sentence then whitespace boundaries near the limit.
    static func chunk(_ text: String, maxChars: Int) -> [String] {
        guard text.count > maxChars else { return text.isEmpty ? [] : [text] }
        var chunks: [String] = []
        var remaining = Substring(text)
        while remaining.count > maxChars {
            let window = remaining.prefix(maxChars)
            // Find a reasonable break point in the back third of the window.
            let minIndex = window.index(window.startIndex, offsetBy: maxChars * 2 / 3)
            let breakIndex = window.range(of: "\n", options: .backwards, range: minIndex..<window.endIndex)?.lowerBound
                ?? window.range(of: ". ", options: .backwards, range: minIndex..<window.endIndex)?.upperBound
                ?? window.range(of: " ", options: .backwards, range: minIndex..<window.endIndex)?.lowerBound
                ?? window.endIndex
            chunks.append(String(remaining[remaining.startIndex..<breakIndex]).trimmingCharacters(in: .whitespacesAndNewlines))
            remaining = remaining[breakIndex...]
        }
        let tail = remaining.trimmingCharacters(in: .whitespacesAndNewlines)
        if !tail.isEmpty { chunks.append(tail) }
        return chunks
    }
}
