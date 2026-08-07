cask "notihub" do
  version "0.9.0"
  sha256 "81c1131001b09fcb071a582695a24dc83964ca6180fa44768e467ea024683147"

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
end
