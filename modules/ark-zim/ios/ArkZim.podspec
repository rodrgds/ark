Pod::Spec.new do |s|
  s.name           = 'ArkZim'
  s.version        = '1.0.0'
  s.summary        = 'Native ZIM engine for Ark using libzim'
  s.description    = 'Provides in-app ZIM archive reading via libzim/libkiwix'
  s.author         = 'Ark'
  s.homepage       = 'https://github.com/ark-offline/ark'
  s.license        = 'MIT'
  s.platform       = :ios, '15.1'
  s.source         = { git: 'https://github.com/ark-offline/ark.git' }
  s.static_framework = true
  s.swift_version  = '5.4'
  s.source_files   = 'ArkZimModule.swift', 'ArkZimReader.h', 'ArkZimReader.mm'
  s.public_header_files = 'ArkZimReader.h'
  s.exclude_files = 'CoreKiwix.xcframework/**/*'
  s.vendored_frameworks = 'CoreKiwix.xcframework'
  s.preserve_paths = 'CoreKiwix.modulemap'
  s.prepare_command = <<-CMD
    set -e
    if [ ! -d "CoreKiwix.xcframework" ]; then
      curl -L https://download.kiwix.org/release/libkiwix/libkiwix_xcframework-14.2.1-2.tar.gz | tar -x --strip-components 2
    fi
    for slice in ios-arm64 ios-arm64_x86_64-simulator macos-arm64_x86_64; do
      if [ -f "CoreKiwix.xcframework/${slice}/merged.a" ] && [ ! -f "CoreKiwix.xcframework/${slice}/libmerged.a" ]; then
        mv "CoreKiwix.xcframework/${slice}/merged.a" "CoreKiwix.xcframework/${slice}/libmerged.a"
      fi
    done
    /usr/libexec/PlistBuddy -c "Set :AvailableLibraries:0:BinaryPath libmerged.a" \
      -c "Set :AvailableLibraries:0:LibraryPath libmerged.a" \
      -c "Set :AvailableLibraries:1:BinaryPath libmerged.a" \
      -c "Set :AvailableLibraries:1:LibraryPath libmerged.a" \
      -c "Set :AvailableLibraries:2:BinaryPath libmerged.a" \
      -c "Set :AvailableLibraries:2:LibraryPath libmerged.a" \
      CoreKiwix.xcframework/Info.plist
    cp CoreKiwix.modulemap CoreKiwix.xcframework/ios-arm64/Headers/module.modulemap
    cp CoreKiwix.modulemap CoreKiwix.xcframework/ios-arm64_x86_64-simulator/Headers/module.modulemap
  CMD
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'
  }
  s.dependency 'ExpoModulesCore'
end
