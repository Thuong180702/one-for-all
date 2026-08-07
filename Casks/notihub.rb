cask "notihub" do
  version "0.8.0"
  sha256 "7cbdfaa2f629a676e5187d36518dce837a8c9827eb4087f5f957b1a73f11e436"

  # v0.8.0 was built and uploaded before the project was renamed from
  # one-for-all to notihub, so the asset filename, the .app inside it, and
  # the on-disk paths it writes are all still the old name. These three
  # lines should switch to the notihub-branded equivalents the next time a
  # release is cut under the new name.
  url "https://github.com/Thuong180702/notihub/releases/download/v#{version}/one-for-all-v#{version}-mac.dmg"
  app "one-for-all.app"
  zap trash: [
    "~/Library/Application Support/one-for-all",
    "~/Library/Preferences/com.thuong180702.one-for-all.plist",
    "~/Library/Saved Application State/com.thuong180702.one-for-all.savedState",
  ]

  name "notihub"
  desc "Native macOS notification hub for web apps (Messenger, Zalo, Gmail, etc.)"
  homepage "https://github.com/Thuong180702/notihub"
end
