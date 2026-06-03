import CoreGraphics
import ExpoModulesCore
import PDFKit
import UIKit
import Vision

public class ArkOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArkOcr")

    AsyncFunction("recognizeText") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let image = try Self.loadImage(from: uri)
          let result = try Self.recognize(cgImage: image)
          promise.resolve([
            "text": result.text,
            "blocks": result.blocks
          ])
        } catch {
          promise.reject(Self.exception(from: error, fallbackCode: "ERR_OCR_FAILED", fallbackReason: "Text recognition failed."))
        }
      }
    }

    AsyncFunction("extractPdfText") { (uri: String, maxPages: Int, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let document = try Self.loadPdf(from: uri)
          let pageCount = document.pageCount
          let pageLimit = min(max(maxPages, 1), pageCount)
          var pages: [[String: Any?]] = []

          if pageLimit > 0 {
            for pageIndex in 0..<pageLimit {
              let page = document.page(at: pageIndex)
              pages.append([
                "pageNumber": pageIndex + 1,
                "text": page?.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
                "extractionMethod": "text_layer",
                "confidence": nil
              ])
            }
          }

          promise.resolve([
            "pageCount": pageCount,
            "pages": pages,
            "truncated": pageLimit < pageCount
          ])
        } catch {
          promise.reject(Self.exception(from: error, fallbackCode: "ERR_PDF_TEXT_FAILED", fallbackReason: "PDF text extraction failed."))
        }
      }
    }

    AsyncFunction("recognizePdf") { (uri: String, maxPages: Int, renderDpi: Int, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let document = try Self.loadPdf(from: uri)
          let pageCount = document.pageCount
          let pageLimit = min(max(maxPages, 1), pageCount)
          var pages: [[String: Any?]] = []

          if pageLimit > 0 {
            for pageIndex in 0..<pageLimit {
              guard let page = document.page(at: pageIndex) else {
                continue
              }
              let image = try Self.render(page: page, dpi: renderDpi)
              let result = try Self.recognize(cgImage: image)
              pages.append([
                "pageNumber": pageIndex + 1,
                "text": result.text.trimmingCharacters(in: .whitespacesAndNewlines),
                "extractionMethod": "ocr",
                "confidence": nil
              ])
            }
          }

          promise.resolve([
            "pageCount": pageCount,
            "pages": pages,
            "truncated": pageLimit < pageCount
          ])
        } catch {
          promise.reject(Self.exception(from: error, fallbackCode: "ERR_PDF_OCR_FAILED", fallbackReason: "PDF OCR failed."))
        }
      }
    }
  }

  private static func loadImage(from uri: String) throws -> CGImage {
    let url = try fileURL(from: uri)
    guard let image = UIImage(contentsOfFile: url.path)?.cgImage else {
    throw Exception(name: "ERR_IMAGE_UNREADABLE", description: "Could not read image for OCR.")
    }
    return image
  }

  private static func loadPdf(from uri: String) throws -> PDFDocument {
    let url = try fileURL(from: uri)
    guard FileManager.default.fileExists(atPath: url.path) else {
      throw Exception(name: "ERR_PDF_NOT_FOUND", description: "PDF file is not available.")
    }
    guard let document = PDFDocument(url: url) else {
      throw Exception(name: "ERR_PDF_UNREADABLE", description: "Could not open PDF.")
    }
    return document
  }

  private static func fileURL(from uri: String) throws -> URL {
    if uri.hasPrefix("file://"), let url = URL(string: uri) {
      return url
    }
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }
    throw Exception(name: "ERR_FILE_URI_UNSUPPORTED", description: "Only local file URIs are supported for OCR.")
  }

  private static func render(page: PDFPage, dpi: Int) throws -> CGImage {
    let bounds = page.bounds(for: .mediaBox)
    let scale = max(CGFloat(dpi), 96) / 72
    let size = CGSize(width: max(bounds.width * scale, 1), height: max(bounds.height * scale, 1))
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    let image = renderer.image { context in
      UIColor.white.set()
      context.fill(CGRect(origin: .zero, size: size))
      context.cgContext.translateBy(x: 0, y: size.height)
      context.cgContext.scaleBy(x: scale, y: -scale)
      context.cgContext.translateBy(x: -bounds.origin.x, y: -bounds.origin.y)
      page.draw(with: .mediaBox, to: context.cgContext)
    }
    guard let cgImage = image.cgImage else {
      throw Exception(name: "ERR_PDF_RENDERER", description: "Could not render PDF pages for OCR.")
    }
    return cgImage
  }

  private static func recognize(cgImage: CGImage) throws -> (text: String, blocks: [[String: Any?]]) {
    var recognizedText = ""
    var recognizedBlocks: [[String: Any?]] = []
    var requestError: Error?
    let semaphore = DispatchSemaphore(value: 0)

    let request = VNRecognizeTextRequest { request, error in
      defer { semaphore.signal() }
      if let error {
        requestError = error
        return
      }
      let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
      let texts = observations.compactMap { observation -> String? in
        observation.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines)
      }.filter { !$0.isEmpty }

      recognizedText = texts.joined(separator: "\n")
      recognizedBlocks = observations.compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else {
          return nil
        }
        let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty {
          return nil
        }
        return [
          "text": text,
          "confidence": Double(candidate.confidence)
        ]
      }
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])
    semaphore.wait()

    if let requestError {
      throw requestError
    }
    return (recognizedText, recognizedBlocks)
  }

  private static func exception(from error: Error, fallbackCode: String, fallbackReason: String) -> Exception {
    if let exception = error as? Exception {
      return exception
    }
    return Exception(name: fallbackCode, description: error.localizedDescription.isEmpty ? fallbackReason : error.localizedDescription)
  }
}
