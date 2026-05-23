package expo.modules.arkocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

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
  }
}
