Pod::Spec.new do |s|
  s.name           = 'ArkSystemColors'
  s.version        = '1.0.0'
  s.summary        = 'System color bridge for Ark'
  s.description    = 'Resolves platform dynamic accent colors for Ark themes where available.'
  s.author         = 'Ark'
  s.homepage       = 'https://github.com/ark-offline/ark'
  s.license        = 'MIT'
  s.platform       = :ios, '16.4'
  s.source         = { git: 'https://github.com/ark-offline/ark.git' }
  s.static_framework = true
  s.swift_version  = '5.4'
  s.source_files   = '**/*.swift'
  s.frameworks     = 'UIKit'
  s.dependency 'ExpoModulesCore'
end
