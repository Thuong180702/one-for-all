cask "notihub" do
  version "1.0.1"
  sha256 "703cf64dff8e93bdeabfeb5fa8c1c1714df51bc519ce60f68e85ce30d0fcd816"

  url "https://github.com/Thuong180702/notihub/releases/download/v#{version}/notihub-v#{version}-mac.dmg"
  name "notihub"
  desc "Native macOS notification hub for web apps (Messenger, Zalo, Gmail, etc.)"
  homepage "https://github.com/Thuong180702/notihub"

  app "notihub.app"

  zap trash: [
    "~/Library/Application Support/notihub",
    "~/Library/Preferences/io.github.thuong180702.notihub.plist",
    "~/Library/Saved Application State/io.github.thuong180702.notihub.savedState",
  ]

  caveats <<~EOS
    notihub is signed ad-hoc, not notarized by Apple (no paid Developer ID yet).
    macOS Gatekeeper will refuse to open it with "notihub is damaged and can't
    be opened" on first launch. This isn't corruption — it's Gatekeeper
    rejecting an unnotarized app. Clear the quarantine flag once to fix it:

      xattr -dr com.apple.quarantine /Applications/notihub.app
  EOS
end
