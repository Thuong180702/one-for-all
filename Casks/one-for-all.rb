cask "one-for-all" do
  version "0.7.0"
  sha256 "9a5caf25cd0caa2bc5fedee80e2f010b644996c3a47e5586b6e0c86f01d3a378"

  url "https://github.com/Thuong180702/one-for-all/releases/download/v#{version}/one-for-all-v#{version}-mac.zip"
  name "one-for-all"
  desc "Native macOS notification hub for web apps (Messenger, Zalo, Gmail, etc.)"
  homepage "https://github.com/Thuong180702/one-for-all"

  app "one-for-all.app"

  zap trash: [
    "~/Library/Application Support/one-for-all",
    "~/Library/Preferences/com.thuong180702.one-for-all.plist",
    "~/Library/Saved Application State/com.thuong180702.one-for-all.savedState",
  ]
end
