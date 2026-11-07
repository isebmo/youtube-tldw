//
//  HistorySync.swift
//  Shared (App)
//
//  Syncs the summary history across the user's devices through CloudKit
//  (private database, custom zone, one record per summary).
//
//  The web UI stays the source of truth for display: it hands every local
//  change to `enqueue(saves:deletes:)` and receives remote changes through
//  `onRemoteChanges`. Local changes are persisted in a pending queue first, so
//  nothing is lost while offline or signed out of iCloud: the queue is flushed
//  on the next sync.
//

import Foundation
import CloudKit

@MainActor
final class HistorySync {
    static let shared = HistorySync()

    static let containerID = "iCloud.com.mouret.youtube-tldw"
    private let recordType = "Summary"
    private let zoneID = CKRecordZone.ID(zoneName: "History", ownerName: CKCurrentUserDefaultName)
    private let fields = ["videoId", "url", "title", "author", "summary", "model"]

    private let defaults = UserDefaults.standard
    private let tokenKey = "tldw.historySync.changeToken"
    private let zoneReadyKey = "tldw.historySync.zoneReady"
    private let pendingSavesKey = "tldw.historySync.pendingSaves"
    private let pendingDeletesKey = "tldw.historySync.pendingDeletes"

    /// Called with `{"upserts": [entry], "deletions": [id]}` when the cloud
    /// has changes this device hasn't seen.
    var onRemoteChanges: (([String: Any]) -> Void)?

    private lazy var database = CKContainer(identifier: Self.containerID).privateCloudDatabase
    private var isSyncing = false
    private var syncAgain = false

    // MARK: Local changes

    func enqueue(saves: [[String: Any]], deletes: [String]) {
        var pendingSaves = defaults.dictionary(forKey: pendingSavesKey) as? [String: [String: Any]] ?? [:]
        var pendingDeletes = Set(defaults.stringArray(forKey: pendingDeletesKey) ?? [])
        for entry in saves {
            guard let id = entry["id"] as? String, Self.isValidRecordName(id) else { continue }
            pendingSaves[id] = sanitized(entry)
            pendingDeletes.remove(id)
        }
        for id in deletes where Self.isValidRecordName(id) {
            pendingSaves.removeValue(forKey: id)
            pendingDeletes.insert(id)
        }
        defaults.set(pendingSaves, forKey: pendingSavesKey)
        defaults.set(Array(pendingDeletes), forKey: pendingDeletesKey)
        sync()
    }

    // MARK: Sync

    /// Pushes pending local changes, then pulls remote ones. Calls made while a
    /// sync is running are coalesced into one more pass.
    func sync() {
        guard #available(iOS 16.0, macOS 13.0, *) else { return }
        if isSyncing { syncAgain = true; return }
        isSyncing = true
        Task {
            repeat {
                syncAgain = false
                do {
                    try await ensureZone()
                    try await push()
                    let changes = try await pull()
                    let upserts = changes["upserts"] as? [Any] ?? []
                    let deletions = changes["deletions"] as? [Any] ?? []
                    if !upserts.isEmpty || !deletions.isEmpty {
                        onRemoteChanges?(changes)
                    }
                } catch {
                    // Not signed into iCloud, offline, quota… The queue is kept
                    // and retried on the next sync.
                    NSLog("[HistorySync] sync failed: %@", String(describing: error))
                }
            } while syncAgain
            isSyncing = false
        }
    }

    private func ensureZone() async throws {
        if defaults.bool(forKey: zoneReadyKey) { return }
        _ = try await database.modifyRecordZones(saving: [CKRecordZone(zoneID: zoneID)], deleting: [])
        defaults.set(true, forKey: zoneReadyKey)
    }

    private func push() async throws {
        let pendingSaves = defaults.dictionary(forKey: pendingSavesKey) as? [String: [String: Any]] ?? [:]
        let pendingDeletes = defaults.stringArray(forKey: pendingDeletesKey) ?? []
        if pendingSaves.isEmpty && pendingDeletes.isEmpty { return }

        let records = pendingSaves.map { makeRecord(id: $0.key, entry: $0.value) }
        let deleteIDs = pendingDeletes.map { CKRecord.ID(recordName: $0, zoneID: zoneID) }

        var savedNames: [String] = []
        var deletedNames: [String] = []
        // CloudKit caps a modify operation at 400 items.
        for chunk in stride(from: 0, to: records.count, by: 200).map({ Array(records[$0..<min($0 + 200, records.count)]) }) {
            let (results, _) = try await modify(saving: chunk, deleting: [])
            for (id, result) in results {
                switch result {
                case .success: savedNames.append(id.recordName)
                case .failure(let error): NSLog("[HistorySync] save %@ failed: %@", id.recordName, String(describing: error))
                }
            }
        }
        for chunk in stride(from: 0, to: deleteIDs.count, by: 200).map({ Array(deleteIDs[$0..<min($0 + 200, deleteIDs.count)]) }) {
            let (_, results) = try await modify(saving: [], deleting: chunk)
            for (id, result) in results {
                switch result {
                case .success:
                    deletedNames.append(id.recordName)
                case .failure(let error as CKError) where error.code == .unknownItem:
                    deletedNames.append(id.recordName)
                case .failure(let error):
                    NSLog("[HistorySync] delete %@ failed: %@", id.recordName, String(describing: error))
                }
            }
        }

        // Re-read: the web UI may have queued more changes while we awaited.
        var saves = defaults.dictionary(forKey: pendingSavesKey) as? [String: [String: Any]] ?? [:]
        for name in savedNames {
            // Keep it queued if it was edited again during the upload.
            if let sent = pendingSaves[name], let now = saves[name], NSDictionary(dictionary: sent).isEqual(to: now) {
                saves.removeValue(forKey: name)
            }
        }
        let deletes = Set(defaults.stringArray(forKey: pendingDeletesKey) ?? []).subtracting(deletedNames)
        defaults.set(saves, forKey: pendingSavesKey)
        defaults.set(Array(deletes), forKey: pendingDeletesKey)
    }

    private func modify(saving: [CKRecord], deleting: [CKRecord.ID]) async throws
        -> ([CKRecord.ID: Result<CKRecord, Error>], [CKRecord.ID: Result<Void, Error>]) {
        do {
            return try await database.modifyRecords(saving: saving, deleting: deleting,
                                                    savePolicy: .allKeys, atomically: false)
        } catch let error as CKError where error.code == .zoneNotFound || error.code == .userDeletedZone {
            // The zone was removed (e.g. the user wiped iCloud data): recreate it.
            defaults.set(false, forKey: zoneReadyKey)
            try await ensureZone()
            return try await database.modifyRecords(saving: saving, deleting: deleting,
                                                    savePolicy: .allKeys, atomically: false)
        }
    }

    @available(iOS 16.0, macOS 13.0, *)
    private func pull() async throws -> [String: Any] {
        var token = loadToken()
        var upserts: [String: [String: Any]] = [:]
        var deletions: Set<String> = []

        while true {
            let changes: (modificationResultsByID: [CKRecord.ID: Result<CKDatabase.RecordZoneChange.Modification, Error>],
                          deletions: [CKDatabase.RecordZoneChange.Deletion],
                          changeToken: CKServerChangeToken,
                          moreComing: Bool)
            do {
                changes = try await database.recordZoneChanges(inZoneWith: zoneID, since: token)
            } catch let error as CKError where error.code == .changeTokenExpired {
                token = nil
                saveToken(nil)
                continue
            } catch let error as CKError where error.code == .zoneNotFound || error.code == .userDeletedZone {
                defaults.set(false, forKey: zoneReadyKey)
                saveToken(nil)
                throw error
            }

            for (id, result) in changes.modificationResultsByID {
                if case .success(let modification) = result {
                    upserts[id.recordName] = entry(from: modification.record)
                    deletions.remove(id.recordName)
                }
            }
            for deletion in changes.deletions {
                upserts.removeValue(forKey: deletion.recordID.recordName)
                deletions.insert(deletion.recordID.recordName)
            }
            token = changes.changeToken
            if !changes.moreComing { break }
        }
        saveToken(token)
        return ["upserts": Array(upserts.values), "deletions": Array(deletions)]
    }

    // MARK: Records

    private func makeRecord(id: String, entry: [String: Any]) -> CKRecord {
        let record = CKRecord(recordType: recordType, recordID: CKRecord.ID(recordName: id, zoneID: zoneID))
        for key in fields {
            if let value = entry[key] as? String { record[key] = value as NSString }
        }
        if let createdAt = entry["createdAt"] as? Double { record["createdAt"] = createdAt as NSNumber }
        return record
    }

    private func entry(from record: CKRecord) -> [String: Any] {
        var entry: [String: Any] = ["id": record.recordID.recordName]
        for key in fields {
            if let value = record[key] as? String { entry[key] = value }
        }
        if let createdAt = record["createdAt"] as? Double { entry["createdAt"] = createdAt }
        return entry
    }

    /// Keeps only what goes to CloudKit — the transcript stays on the device
    /// (large, and not needed to read a summary).
    private func sanitized(_ entry: [String: Any]) -> [String: Any] {
        var out: [String: Any] = [:]
        for key in fields {
            if let value = entry[key] as? String { out[key] = value }
        }
        if let createdAt = entry["createdAt"] as? NSNumber { out["createdAt"] = createdAt.doubleValue }
        return out
    }

    private static func isValidRecordName(_ name: String) -> Bool {
        return !name.isEmpty && name.utf8.count < 255 && !name.hasPrefix("_") && name.allSatisfy { $0.isASCII }
    }

    private func loadToken() -> CKServerChangeToken? {
        guard let data = defaults.data(forKey: tokenKey) else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(ofClass: CKServerChangeToken.self, from: data)
    }

    private func saveToken(_ token: CKServerChangeToken?) {
        guard let token = token,
              let data = try? NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true) else {
            defaults.removeObject(forKey: tokenKey)
            return
        }
        defaults.set(data, forKey: tokenKey)
    }
}
