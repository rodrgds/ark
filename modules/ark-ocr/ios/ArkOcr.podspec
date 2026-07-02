Pod::Spec.new do |s|
  s.name           = 'ArkOcr'
  s.version        = '1.0.0'
  s.summary        = 'Native OCR engine for Ark'
  s.description    = 'Provides image OCR and PDF text extraction using iOS Vision and PDFKit.'
  s.author         = 'Ark'
  s.homepage       = 'https://github.com/ark-offline/ark'
  s.license        = 'MIT'
  s.platform       = :ios, '16.4'
  s.source         = { git: 'https://github.com/ark-offline/ark.git' }
  s.static_framework = true
  s.swift_version  = '5.4'
  s.source_files   = '**/*.swift'
  s.frameworks     = 'Vision', 'PDFKit', 'UIKit', 'CoreGraphics'
  s.dependency 'ExpoModulesCore'
end
