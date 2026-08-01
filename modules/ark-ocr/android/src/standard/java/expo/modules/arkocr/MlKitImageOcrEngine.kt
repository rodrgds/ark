package expo.modules.arkocr

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise

// SPDX-License-Identifier: MIT

/**
 * Google ML Kit image text recognition. Only compiled into the `standard`
 * flavor; the `fdroid` flavor must never resolve this class.
 */
class MlKitImageOcrEngine : ImageOcrEngine {
  override val capabilities = ArkOcrCapabilities(
    distribution = "standard",
    imageOcr = true,
    pdfOcr = true
  )

  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  override fun recognizeFile(context: Context, uri: Uri, promise: Promise) {
    val input = try {
      InputImage.fromFilePath(context, uri)
    } catch (error: Exception) {
      promise.reject("ERR_IMAGE_UNREADABLE", "Could not read image for OCR.", error)
      return
    }
    process(input, promise)
  }

  override fun recognizeBitmap(context: Context, bitmap: Bitmap, promise: Promise) {
    process(InputImage.fromBitmap(bitmap, 0), promise)
  }

  private fun process(input: InputImage, promise: Promise) {
    recognizer.process(input)
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
}
