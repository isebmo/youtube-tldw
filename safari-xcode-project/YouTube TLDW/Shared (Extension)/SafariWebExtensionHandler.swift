//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by Sébastien Mouret on 14/03/2026.
//

import SafariServices
import Security
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private static let keychainService = "com.mouret.youtube-tldw"
    private static let keychainAccount = "apiKey"
    private static let keychainAccessGroup = "2T8A23HDD8.com.mouret.youtube-tldw.shared"

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        let payload = handle(message: message)

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: payload]
        } else {
            response.userInfo = ["message": payload]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    private func handle(message: Any?) -> [String: Any] {
        guard let dict = message as? [String: Any], let action = dict["action"] as? String else {
            return ["error": "missing action"]
        }

        switch action {
        case "getApiKey":
            return ["apiKey": Self.getApiKey() as Any]
        case "setApiKey":
            guard let key = dict["apiKey"] as? String else { return ["error": "missing apiKey"] }
            let ok = Self.setApiKey(key)
            return ["ok": ok]
        case "deleteApiKey":
            let ok = Self.deleteApiKey()
            return ["ok": ok]
        default:
            return ["error": "unknown action: \(action)"]
        }
    }

    private static func baseQuery() -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecAttrAccessGroup as String: keychainAccessGroup,
            kSecAttrSynchronizable as String: kCFBooleanTrue!,
        ]
    }

    private static func getApiKey() -> String? {
        var query = baseQuery()
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnData as String] = true

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else {
            if status != errSecItemNotFound {
                os_log(.error, "Keychain read failed: %d", status)
            }
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private static func setApiKey(_ apiKey: String) -> Bool {
        guard let data = apiKey.data(using: .utf8) else { return false }
        let query = baseQuery()

        let updateStatus = SecItemUpdate(
            query as CFDictionary,
            [kSecValueData as String: data] as CFDictionary
        )
        if updateStatus == errSecSuccess { return true }
        if updateStatus != errSecItemNotFound {
            os_log(.error, "Keychain update failed: %d", updateStatus)
            return false
        }

        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        if addStatus != errSecSuccess {
            os_log(.error, "Keychain add failed: %d", addStatus)
            return false
        }
        return true
    }

    private static func deleteApiKey() -> Bool {
        let status = SecItemDelete(baseQuery() as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

}
