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
  s.source_files   = '**/*.swift'
  s.dependency 'ExpoModulesCore'
end
