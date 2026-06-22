//
//  ViewController.swift
//  Shared (App)
//

import WebKit
import Security

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
        ucc.addScriptMessageHandler(replyHandler, contentWorld: .page, name: "refreshEntitlement")
        ucc.addScriptMessageHandler(replyHandler, contentWorld: .page, name: "purchasePremium")
        ucc.addScriptMessageHandler(replyHandler, contentWorld: .page, name: "restorePurchases")
        ucc.addScriptMessageHandler(replyHandler, contentWorld: .page, name: "aiAvailability")
        ucc.addScriptMessageHandler(replyHandler, contentWorld: .page, name: "aiSummarize")
        ucc.addScriptMessageHandler(replyHandler, contentWorld: .page, name: "aiAsk")

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
        if let window = webView.window {
            window.contentMinSize = NSSize(width: 380, height: 500)
        }
#endif
        if let pending = AppDeepLink.shared.consume() {
            deliverDeepLinkToWeb(url: pending)
        } else if let pending = consumePendingURLFromAppGroup() {
            deliverDeepLinkToWeb(url: pending)
        }
    }

    private func injectStoredSettings() {
        var settings = UserDefaults(suiteName: appGroupID)?.dictionary(forKey: "tldw.settings") ?? [:]

        // One-shot migration: move a legacy plaintext key from the App Group
        // into the shared Keychain, where the Safari extension reads it.
        if let legacy = settings["apiKey"] as? String, !legacy.isEmpty,
           SharedKeychain.getApiKey() == nil,
           SharedKeychain.setApiKey(legacy) {
            settings.removeValue(forKey: "apiKey")
            UserDefaults(suiteName: appGroupID)?.set(settings, forKey: "tldw.settings")
        }

        if let apiKey = SharedKeychain.getApiKey(), !apiKey.isEmpty {
            settings["apiKey"] = apiKey
        }

        guard let data = try? JSONSerialization.data(withJSONObject: settings),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.__INITIAL_SETTINGS__ = \(json);", completionHandler: nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "saveSettings" {
            if var dict = message.body as? [String: Any] {
                // The API key lives in the shared Keychain (read by the Safari
                // extension); everything else stays in the App Group.
                if let apiKey = dict["apiKey"] as? String {
                    if SharedKeychain.setApiKey(apiKey) {
                        dict.removeValue(forKey: "apiKey")
                    } else {
                        NSLog("[App] Keychain write failed; keeping apiKey in App Group")
                    }
                }
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
        case "refreshEntitlement":
            handleEntitlement(reply: replyHandler)
        case "purchasePremium":
            handlePurchase(reply: replyHandler)
        case "restorePurchases":
            handleRestore(reply: replyHandler)
        case "aiAvailability":
            let info = AppleIntelligence.availabilityInfo()
            replyHandler(["available": info.available, "reason": info.reason as Any], nil)
        case "aiSummarize":
            handleAISummarize(body: message.body, reply: replyHandler)
        case "aiAsk":
            handleAIAsk(body: message.body, reply: replyHandler)
        default:
            replyHandler(nil, "Unknown handler: \(message.name)")
        }
    }

    private func handleAISummarize(body: Any, reply: @escaping (Any?, String?) -> Void) {
        guard let dict = body as? [String: Any] else { reply(nil, "Invalid body"); return }
        guard #available(iOS 26.0, macOS 26.0, *) else {
            reply(nil, "Apple Intelligence requires iOS 26 / macOS 26"); return
        }
        Task {
            do {
                let text = try await AppleIntelligence.summarize(
                    transcript: dict["transcript"] as? String ?? "",
                    userPrompt: dict["userPrompt"] as? String,
                    lang: dict["lang"] as? String)
                reply(["summary": text, "model": AppleIntelligence.modelName], nil)
            } catch {
                reply(nil, error.localizedDescription)
            }
        }
    }

    private func handleAIAsk(body: Any, reply: @escaping (Any?, String?) -> Void) {
        guard let dict = body as? [String: Any] else { reply(nil, "Invalid body"); return }
        guard #available(iOS 26.0, macOS 26.0, *) else {
            reply(nil, "Apple Intelligence requires iOS 26 / macOS 26"); return
        }
        Task {
            do {
                let qa = dict["qaHistory"] as? [[String: String]] ?? []
                let text = try await AppleIntelligence.answer(
                    question: dict["question"] as? String ?? "",
                    transcript: dict["transcript"] as? String ?? "",
                    qaHistory: qa,
                    userPrompt: dict["userPrompt"] as? String,
                    lang: dict["lang"] as? String)
                reply(["answer": text, "model": AppleIntelligence.modelName], nil)
            } catch {
                reply(nil, error.localizedDescription)
            }
        }
    }

    private func handleEntitlement(reply: @escaping (Any?, String?) -> Void) {
        if #available(iOS 15.0, macOS 12.0, *) {
            Task {
                let payload = await IAP.currentEntitlement()
                reply(payload, nil)
            }
        } else {
            reply(["premium": false, "trialDaysRemaining": 0, "trialActive": true, "price": ""], nil)
        }
    }

    private func handlePurchase(reply: @escaping (Any?, String?) -> Void) {
        if #available(iOS 15.0, macOS 12.0, *) {
            Task {
                let success = await IAP.purchase()
                let payload = await IAP.currentEntitlement()
                var dict = payload
                dict["success"] = success
                reply(dict, nil)
            }
        } else {
            reply(nil, "StoreKit 2 requires iOS 15 / macOS 12")
        }
    }

    private func handleRestore(reply: @escaping (Any?, String?) -> Void) {
        if #available(iOS 15.0, macOS 12.0, *) {
            Task {
                let success = await IAP.restore()
                let payload = await IAP.currentEntitlement()
                var dict = payload
                dict["success"] = success
                reply(dict, nil)
            }
        } else {
            reply(nil, "StoreKit 2 requires iOS 15 / macOS 12")
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

// MARK: - Shared Keychain ----------------------------------------------------
// Same item (service/account/access group, synchronizable) as
// SafariWebExtensionHandler.swift in Shared (Extension) — keep both in sync so
// the app and the Safari extension genuinely share the API key.

enum SharedKeychain {
    private static let service = "com.mouret.youtube-tldw"
    private static let account = "apiKey"
    private static let accessGroup = "2T8A23HDD8.com.mouret.youtube-tldw.shared"

    private static func baseQuery() -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
            kSecAttrSynchronizable as String: kCFBooleanTrue!,
        ]
    }

    static func getApiKey() -> String? {
        var query = baseQuery()
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnData as String] = true

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else {
            if status != errSecItemNotFound {
                NSLog("[App] Keychain read failed: %d", status)
            }
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func setApiKey(_ apiKey: String) -> Bool {
        guard let data = apiKey.data(using: .utf8) else { return false }
        let query = baseQuery()

        let updateStatus = SecItemUpdate(
            query as CFDictionary,
            [kSecValueData as String: data] as CFDictionary
        )
        if updateStatus == errSecSuccess { return true }
        if updateStatus != errSecItemNotFound {
            NSLog("[App] Keychain update failed: %d", updateStatus)
            return false
        }

        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        if addStatus != errSecSuccess {
            NSLog("[App] Keychain add failed: %d", addStatus)
            return false
        }
        return true
    }
}

final class AppDeepLink {
    static let shared = AppDeepLink()
    private var pending: URL?
    func store(_ url: URL) { pending = url }
    func consume() -> URL? { let u = pending; pending = nil; return u }
}

// MARK: - IAP / 14-day trial -----------------------------------------------

#if canImport(StoreKit)
import StoreKit

let premiumProductID = "com.mouret.youtubetldw.premium"
let trialDurationDays = 14
let trialStartKey = "tldw.trialStart"

@available(iOS 15.0, macOS 12.0, *)
enum IAP {
    static func ensureTrialStarted() {
        let defaults = UserDefaults(suiteName: appGroupID) ?? .standard
        if defaults.object(forKey: trialStartKey) == nil {
            defaults.set(Date().timeIntervalSince1970, forKey: trialStartKey)
        }
    }

    static func trialDaysRemaining() -> Int {
        let defaults = UserDefaults(suiteName: appGroupID) ?? .standard
        let start = defaults.double(forKey: trialStartKey)
        guard start > 0 else { return trialDurationDays }
        let elapsed = Date().timeIntervalSince1970 - start
        let remaining = Double(trialDurationDays * 86400) - elapsed
        return max(0, Int(ceil(remaining / 86400)))
    }

    static func isPremiumPurchased() async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == premiumProductID,
               transaction.revocationDate == nil {
                return true
            }
        }
        return false
    }

    static func loadProduct() async -> Product? {
        do {
            let products = try await Product.products(for: [premiumProductID])
            NSLog("[IAP] loaded %d product(s) for %@", products.count, premiumProductID)
            return products.first
        } catch {
            NSLog("[IAP] loadProduct error: %@", String(describing: error))
            return nil
        }
    }

    static func purchase() async -> Bool {
        guard let product = await loadProduct() else {
            NSLog("[IAP] purchase: no product loaded")
            return false
        }
        NSLog("[IAP] purchase: starting for %@ (%@)", product.id, product.displayPrice)
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                if case .verified(let transaction) = verification {
                    NSLog("[IAP] purchase verified, finishing transaction")
                    await transaction.finish()
                    return true
                }
                NSLog("[IAP] purchase succeeded but verification failed")
            case .userCancelled:
                NSLog("[IAP] purchase userCancelled")
            case .pending:
                NSLog("[IAP] purchase pending")
            @unknown default:
                NSLog("[IAP] purchase unknown result")
            }
        } catch {
            NSLog("[IAP] purchase error: %@", String(describing: error))
        }
        return false
    }

    static func restore() async -> Bool {
        try? await AppStore.sync()
        return await isPremiumPurchased()
    }

    static func currentEntitlement() async -> [String: Any] {
        ensureTrialStarted()
        let premium = await isPremiumPurchased()
        let days = trialDaysRemaining()
        let product = await loadProduct()
        return [
            "premium": premium,
            "trialDaysRemaining": days,
            "trialActive": days > 0,
            "productID": premiumProductID,
            "price": product?.displayPrice ?? "",
            "productName": product?.displayName ?? "Premium"
        ]
    }
}
#endif

// MARK: - App Intents (iOS 16+ / macOS 13+)
// Allows the Shortcuts app and Siri to drive the summarizer with a YouTube URL.

#if canImport(AppIntents)
import AppIntents

@available(iOS 16.0, macOS 13.0, *)
struct SummarizeVideoIntent: AppIntent {
    static var title: LocalizedStringResource = "Summarize a YouTube video"
    static var description = IntentDescription("Opens YouTube TLDW; and summarizes a YouTube video from its URL.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Video URL", description: "The link to a YouTube video (youtube.com/watch?v=… or youtu.be/…)")
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
                "Summarize this video in \(.applicationName)",
                "Summarize YouTube with \(.applicationName)"
            ],
            shortTitle: "Summarize a video",
            systemImageName: "play.rectangle.on.rectangle"
        )
    }
}
#endif
