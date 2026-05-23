package expo.modules.arkocr

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlin.math.max
import kotlin.math.min

class ArkOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArkOcr")

    AsyncFunction("recognizeText") { uri: String, promise: Promise ->
      val context = appContext.reactContext
        ?: return@AsyncFunction promise.reject(
          "ERR_CONTEXT_UNAVAILABLE",
          "Android context is not available for OCR.",
          null
        )

      val imageUri = if (uri.startsWith("file://") || uri.startsWith("content://")) {
        Uri.parse(uri)
      } else {
        Uri.fromFile(File(uri))
      }

      val image = try {
        InputImage.fromFilePath(context, imageUri)
      } catch (error: Exception) {
        promise.reject("ERR_IMAGE_UNREADABLE", "Could not read image for OCR.", error)
        return@AsyncFunction
      }

      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      recognizer.process(image)
        .addOnSuccessListener { visionText ->
          val blocks = visionText.textBlocks.map { block ->
            mapOf(
              "text" to block.text,
              "confidence" to block.lines
                .flatMap { line -> line.elements }
                .mapNotNull { element -> element.confidence.takeIf { it >= 0f } }
                .average()
                .takeIf { !it.isNaN() }
            )
          }
          promise.resolve(
            mapOf(
              "text" to visionText.text,
              "blocks" to blocks
            )
          )
        }
        .addOnFailureListener { error ->
          promise.reject("ERR_OCR_FAILED", "Text recognition failed.", error)
        }
    }

    AsyncFunction("extractPdfText") { uri: String, maxPages: Int, promise: Promise ->
      val context = appContext.reactContext
        ?: return@AsyncFunction promise.reject(
          "ERR_CONTEXT_UNAVAILABLE",
          "Android context is not available for PDF extraction.",
          null
        )
      val file = fileFromUri(uri)
      if (!file.exists()) {
        promise.reject("ERR_PDF_NOT_FOUND", "PDF file is not available.", null)
        return@AsyncFunction
      }

      try {
        PDFBoxResourceLoader.init(context)
        PDDocument.load(file).use { document ->
          val pageCount = document.numberOfPages
          val pageLimit = min(max(maxPages, 1), pageCount)
          val stripper = PDFTextStripper()
          val pages = mutableListOf<Map<String, Any?>>()
          for (pageNumber in 1..pageLimit) {
            stripper.startPage = pageNumber
            stripper.endPage = pageNumber
            pages.add(
              mapOf(
                "pageNumber" to pageNumber,
                "text" to stripper.getText(document).trim(),
                "extractionMethod" to "text_layer",
                "confidence" to null
              )
            )
          }
          promise.resolve(
            mapOf(
              "pageCount" to pageCount,
              "pages" to pages,
              "truncated" to (pageLimit < pageCount)
            )
          )
        }
      } catch (error: Exception) {
        promise.reject("ERR_PDF_TEXT_FAILED", "PDF text extraction failed.", error)
      }
    }

    AsyncFunction("recognizePdf") { uri: String, maxPages: Int, renderDpi: Int, promise: Promise ->
      val context = appContext.reactContext
        ?: return@AsyncFunction promise.reject(
          "ERR_CONTEXT_UNAVAILABLE",
          "Android context is not available for PDF OCR.",
          null
        )
      val file = fileFromUri(uri)
      if (!file.exists()) {
        promise.reject("ERR_PDF_NOT_FOUND", "PDF file is not available.", null)
        return@AsyncFunction
      }

      val descriptor = try {
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
      } catch (error: Exception) {
        promise.reject("ERR_PDF_UNREADABLE", "Could not open PDF for OCR.", error)
        return@AsyncFunction
      }
      val renderer = try {
        PdfRenderer(descriptor)
      } catch (error: Exception) {
        descriptor.close()
        promise.reject("ERR_PDF_RENDERER", "Could not render PDF pages for OCR.", error)
        return@AsyncFunction
      }

      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      val totalPages = renderer.pageCount
      val pageLimit = min(max(maxPages, 1), totalPages)
      val pages = mutableListOf<Map<String, Any?>>()

      fun closeRenderer() {
        try {
          renderer.close()
        } catch (_: Exception) {
        }
        try {
          descriptor.close()
        } catch (_: Exception) {
        }
      }

      fun processPage(index: Int) {
        if (index >= pageLimit) {
          closeRenderer()
          promise.resolve(
            mapOf(
              "pageCount" to totalPages,
              "pages" to pages,
              "truncated" to (pageLimit < totalPages)
            )
          )
          return
        }

        val page = renderer.openPage(index)
        val scale = max(renderDpi, 96).toFloat() / 72f
        val width = max((page.width * scale).toInt(), 1)
        val height = max((page.height * scale).toInt(), 1)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(Color.WHITE)
        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
        page.close()

        recognizer.process(InputImage.fromBitmap(bitmap, 0))
          .addOnSuccessListener { visionText ->
            pages.add(
              mapOf(
                "pageNumber" to (index + 1),
                "text" to visionText.text.trim(),
                "extractionMethod" to "ocr",
                "confidence" to null
              )
            )
            bitmap.recycle()
            processPage(index + 1)
          }
          .addOnFailureListener { error ->
            bitmap.recycle()
            closeRenderer()
            promise.reject("ERR_PDF_OCR_FAILED", "PDF OCR failed.", error)
          }
      }

      processPage(0)
    }
  }

  private fun fileFromUri(uri: String): File {
    return if (uri.startsWith("file://")) {
      File(Uri.parse(uri).path ?: uri)
    } else {
      File(uri)
    }
  }
}
