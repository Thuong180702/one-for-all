cask "one-for-all" do
  version "0.8.0"
  sha256 "1faaf6a6b65b334723a362f53c44cce812012ba324d2feb48b2d6ebc26edf23a"

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
