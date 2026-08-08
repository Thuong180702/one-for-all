cask "notihub" do
  version "1.0.0"
  sha256 "22f60b747cc73967761d157c5e8d08223c5cb72fa014def40d457efe6645f4ab"

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
