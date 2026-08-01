package expo.modules.arkocr

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import expo.modules.kotlin.Promise

// SPDX-License-Identifier: MIT

/**
 * Capabilities reported to JavaScript for the distribution this APK was
 * compiled for. `standard` ships Google ML Kit image/PDF OCR; the `fdroid`
 * flavor intentionally ships without ML Kit and reports those features as
 * unavailable so the UI can label them instead of attempting them.
 */
data class ArkOcrCapabilities(
  val distribution: String,
  val imageOcr: Boolean,
  val pdfOcr: Boolean
)

/**
 * Image text recognition engine. The concrete implementation is provided per
 * flavor: ML Kit on `standard`, a typed unsupported stub on `fdroid`. PDF text
 * layer extraction (PDFBox) is shared and lives in the main source set.
 */
interface ImageOcrEngine {
  val capabilities: ArkOcrCapabilities

  fun recognizeFile(context: Context, uri: Uri, promise: Promise)

  fun recognizeBitmap(context: Context, bitmap: Bitmap, promise: Promise)
}
