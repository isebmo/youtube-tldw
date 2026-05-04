//
//  ShareViewController.swift
//  ShareExtension (deprecated — kept as build stub).
//
//  The Share Extension flow was abandoned: iOS 17/18 no longer lets a Share
//  Extension launch the host app silently, even via Universal Links. The TLDW
//  product instead exposes an AppIntent (see ViewController.swift) so users
//  can drive the summarizer via the Shortcuts app, which has the system
//  privileges to open the host app from the share sheet.
//
//  Delete the ShareExtension target from Xcode when ready.
//

import UIKit

class ShareViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
