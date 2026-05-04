//
//  ViewController.swift
//  Shared (App)
//

import WebKit

#if os(iOS)
import UIKit
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices
typealias PlatformViewController = NSViewController
#endif

let extensionBundleIdentifier = "com.mouret.youtube-tldw.Extension"
let appGroupID = "group.com.mouret.youtube-tldw"
let pendingURLKey = "tldw.pendingURL"

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

#if os(iOS)
        self.webView.scrollView.isScrollEnabled = true
        self.webView.scrollView.bounces = true
#endif

        let ucc = self.webView.configuration.userContentController
        ucc.add(self, name: "controller")
        ucc.add(self, name: "saveSettings")
        let replyHandler: WKScriptMessageHandlerWithReply = self
        ucc.addScriptMessageHandler(replyHandler, contentWorld: .page, name: "nativeFetch")
        ucc.addScriptMessageHandler(replyHandler, contentWorld: .page, name: "openExternal")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)

        NotificationCenter.default.addObserver(self, selector: #selector(handlePendingDeepLink), name: .tldwDeepLink, object: nil)
#if os(iOS)
        NotificationCenter.default.addObserver(self, selector: #selector(handleAppDidBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)
#elseif os(macOS)
        NotificationCenter.default.addObserver(self, selector: #selector(handleAppDidBecomeActive), name: NSApplication.didBecomeActiveNotification, object: nil)
#endif
    }

    @objc func handlePendingDeepLink(_ note: Notification) {
        guard let url = note.object as? URL else { return }
        deliverDeepLinkToWeb(url: url)
    }

    @objc func handleAppDidBecomeActive() {
        if let url = consumePendingURLFromAppGroup() {
            deliverDeepLinkToWeb(url: url)
        }
    }

    func deliverDeepLinkToWeb(url: URL) {
        let urlString = url.absoluteString
        let escaped = urlString
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        NSLog("[App] deliverDeepLinkToWeb: %@", urlString)
        let js = "window.handleDeepLink && window.handleDeepLink('\(escaped)')"
        webView.evaluateJavaScript(js) { _, error in
            if let error = error {
                NSLog("[App] deepLink JS error: %@", String(describing: error))
            } else {
                NSLog("[App] deepLink JS delivered")
            }
        }
    }

    private func consumePendingURLFromAppGroup() -> URL? {
        if let urlString = readFromAppGroup() ?? readFromPasteboard() {
            var components = URLComponents()
            components.scheme = "tldw"
            components.host = "summarize"
            components.queryItems = [URLQueryItem(name: "url", value: urlString)]
            return components.url
        }
        return nil
    }

    private func readFromAppGroup() -> String? {
        guard let defaults = UserDefaults(suiteName: appGroupID) else { return nil }
        guard let payload = defaults.dictionary(forKey: pendingURLKey),
              let urlString = payload["url"] as? String else { return nil }
        defaults.removeObject(forKey: pendingURLKey)
        NSLog("[App] consumed pending URL from App Group: %@", urlString)
        return urlString
    }

    private func readFromPasteboard() -> String? {
#if os(iOS)
        let pb = UIPasteboard.general
        if let url = pb.url, isYouTubeURL(url) {
            pb.items = []
            NSLog("[App] consumed pending URL from Pasteboard: %@", url.absoluteString)
            return url.absoluteString
        }
        if let s = pb.string, let url = URL(string: s), isYouTubeURL(url) {
            pb.items = []
            NSLog("[App] consumed pending URL from Pasteboard string: %@", url.absoluteString)
            return url.absoluteString
        }
#endif
        return nil
    }

    private func isYouTubeURL(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return host.contains("youtube.com") || host == "youtu.be" || host.hasSuffix(".youtube.com")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        injectStoredSettings()
#if os(iOS)
        webView.evaluateJavaScript("window.platform = 'ios'; window.dispatchEvent(new Event('platformready'));")
#elseif os(macOS)
        webView.evaluateJavaScript("window.platform = 'mac'; window.dispatchEvent(new Event('platformready'));")
#endif
        if let pending = AppDeepLink.shared.consume() {
            deliverDeepLinkToWeb(url: pending)
        } else if let pending = consumePendingURLFromAppGroup() {
            deliverDeepLinkToWeb(url: pending)
        }
    }

    private func injectStoredSettings() {
        let settings = UserDefaults(suiteName: appGroupID)?.dictionary(forKey: "tldw.settings") ?? [:]
        guard let data = try? JSONSerialization.data(withJSONObject: settings),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.__INITIAL_SETTINGS__ = \(json);", completionHandler: nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "saveSettings" {
            if let dict = message.body as? [String: Any] {
                UserDefaults(suiteName: appGroupID)?.set(dict, forKey: "tldw.settings")
                NSLog("[App] settings saved to App Group")
            }
            return
        }
#if os(macOS)
        if let body = message.body as? String, body == "open-safari-extension-prefs" {
            SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in }
        }
#endif
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        switch message.name {
        case "nativeFetch":
            handleNativeFetch(body: message.body, reply: replyHandler)
        case "openExternal":
            if let s = message.body as? String, let url = URL(string: s) {
                #if os(iOS)
                UIApplication.shared.open(url)
                #elseif os(macOS)
                NSWorkspace.shared.open(url)
                #endif
            }
            replyHandler(nil, nil)
        default:
            replyHandler(nil, "Unknown handler: \(message.name)")
        }
    }

    private func handleNativeFetch(body: Any, reply: @escaping (Any?, String?) -> Void) {
        guard let dict = body as? [String: Any],
              let urlString = dict["url"] as? String,
              let url = URL(string: urlString) else {
            reply(nil, "Invalid fetch request")
            return
        }
        var req = URLRequest(url: url)
        req.httpMethod = (dict["method"] as? String) ?? "GET"
        if let headers = dict["headers"] as? [String: String] {
            for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        }
        if let bodyStr = dict["body"] as? String {
            req.httpBody = bodyStr.data(using: .utf8)
        }
        req.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", forHTTPHeaderField: "User-Agent")

        URLSession.shared.dataTask(with: req) { data, response, error in
            if let error = error {
                reply(nil, error.localizedDescription)
                return
            }
            let http = response as? HTTPURLResponse
            let status = http?.statusCode ?? 0
            let text = String(data: data ?? Data(), encoding: .utf8) ?? ""
            var headersDict: [String: String] = [:]
            if let allHeaders = http?.allHeaderFields as? [String: String] { headersDict = allHeaders }
            reply([
                "status": status,
                "body": text,
                "headers": headersDict
            ], nil)
        }.resume()
    }
}

extension Notification.Name {
    static let tldwDeepLink = Notification.Name("tldwDeepLink")
}

final class AppDeepLink {
    static let shared = AppDeepLink()
    private var pending: URL?
    func store(_ url: URL) { pending = url }
    func consume() -> URL? { let u = pending; pending = nil; return u }
}

// MARK: - App Intents (iOS 16+ / macOS 13+)
// Allows the Shortcuts app and Siri to drive the summarizer with a YouTube URL.

#if canImport(AppIntents)
import AppIntents

@available(iOS 16.0, macOS 13.0, *)
struct SummarizeVideoIntent: AppIntent {
    static var title: LocalizedStringResource = "Résumer une vidéo YouTube"
    static var description = IntentDescription("Ouvre YouTube TLDW; et génère le résumé d'une vidéo YouTube à partir de son URL.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "URL de la vidéo", description: "Le lien d'une vidéo YouTube (youtube.com/watch?v=… ou youtu.be/…)")
    var videoURL: URL

    @MainActor
    func perform() async throws -> some IntentResult {
        var components = URLComponents()
        components.scheme = "tldw"
        components.host = "summarize"
        components.queryItems = [URLQueryItem(name: "url", value: videoURL.absoluteString)]
        if let target = components.url {
            AppDeepLink.shared.store(target)
            NotificationCenter.default.post(name: .tldwDeepLink, object: target)
        }
        return .result()
    }
}

@available(iOS 16.0, macOS 13.0, *)
struct TLDWAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SummarizeVideoIntent(),
            phrases: [
                "Résume cette vidéo dans \(.applicationName)",
                "Résumer YouTube avec \(.applicationName)",
                "Summarize this video in \(.applicationName)"
            ],
            shortTitle: "Résumer une vidéo",
            systemImageName: "play.rectangle.on.rectangle"
        )
    }
}
#endif
