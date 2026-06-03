Pod::Spec.new do |s|
  s.name           = 'ArkSpeech'
  s.version        = '1.0.0'
  s.summary        = 'Native speech recognition for Ark'
  s.description    = 'Provides one-shot speech recognition using platform speech APIs.'
  s.author         = 'Ark'
  s.homepage       = 'https://github.com/ark-offline/ark'
  s.license        = 'MIT'
  s.platform       = :ios, '15.1'
  s.source         = { git: 'https://github.com/ark-offline/ark.git' }
  s.static_framework = true
  s.swift_version  = '5.4'
  s.source_files   = '**/*.swift'
  s.frameworks     = 'Speech', 'AVFoundation'
  s.dependency 'ExpoModulesCore'
end
