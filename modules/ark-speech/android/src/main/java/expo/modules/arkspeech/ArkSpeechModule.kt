package expo.modules.arkspeech

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale

class ArkSpeechModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null
  private var activePromise: Promise? = null
  private var timeoutRunnable: Runnable? = null

  override fun definition() = ModuleDefinition {
    Name("ArkSpeech")

    AsyncFunction("isAvailable") { promise: Promise ->
      val context = appContext.reactContext
      promise.resolve(context != null && SpeechRecognizer.isRecognitionAvailable(context))
    }

    AsyncFunction("recognizeOnce") { options: Map<String, Any?>?, promise: Promise ->
      val context = appContext.reactContext
        ?: return@AsyncFunction promise.reject(
          "ERR_CONTEXT_UNAVAILABLE",
          "Android context is not available for speech recognition.",
          null
        )

      if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        promise.reject("ERR_MIC_PERMISSION", "Microphone permission is required for voice input.", null)
        return@AsyncFunction
      }

      if (!SpeechRecognizer.isRecognitionAvailable(context)) {
        promise.reject("ERR_SPEECH_UNAVAILABLE", "Android speech recognition is not available on this device.", null)
        return@AsyncFunction
      }

      if (activePromise != null) {
        promise.reject("ERR_SPEECH_BUSY", "Speech recognition is already active.", null)
        return@AsyncFunction
      }

      activePromise = promise
      val preferOffline = options?.get("preferOffline") as? Boolean ?: true
      val locale = options?.get("locale") as? String ?: Locale.getDefault().toLanguageTag()
      val timeoutMs = ((options?.get("timeoutMs") as? Number)?.toLong() ?: 45000L).coerceIn(5000L, 120000L)

      mainHandler.post {
        val nextRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
        recognizer = nextRecognizer
        nextRecognizer.setRecognitionListener(object : RecognitionListener {
          override fun onReadyForSpeech(params: Bundle?) = Unit
          override fun onBeginningOfSpeech() = Unit
          override fun onRmsChanged(rmsdB: Float) = Unit
          override fun onBufferReceived(buffer: ByteArray?) = Unit
          override fun onEndOfSpeech() = Unit
          override fun onPartialResults(partialResults: Bundle?) = Unit
          override fun onEvent(eventType: Int, params: Bundle?) = Unit

          override fun onError(error: Int) {
            rejectActive("ERR_SPEECH_FAILED", speechErrorMessage(error), null)
          }

          override fun onResults(results: Bundle?) {
            val matches = results
              ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
              ?.map { it.trim() }
              ?.filter { it.isNotEmpty() }
              ?: emptyList()
            val text = matches.firstOrNull().orEmpty()
            resolveActive(
              mapOf(
                "text" to text,
                "alternatives" to matches,
                "offlinePreferred" to preferOffline
              )
            )
          }
        })

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
          putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, preferOffline)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }

        timeoutRunnable = Runnable {
          recognizer?.cancel()
          rejectActive("ERR_SPEECH_TIMEOUT", "No speech was recognized before the timeout.", null)
        }
        mainHandler.postDelayed(timeoutRunnable!!, timeoutMs)
        nextRecognizer.startListening(intent)
      }
    }

    Function("stop") {
      mainHandler.post {
        recognizer?.stopListening()
      }
    }

    Function("cancel") {
      mainHandler.post {
        recognizer?.cancel()
        rejectActive("ERR_SPEECH_CANCELLED", "Speech recognition was cancelled.", null)
      }
    }
  }

  private fun resolveActive(value: Any) {
    val promise = activePromise ?: return
    cleanup()
    promise.resolve(value)
  }

  private fun rejectActive(code: String, message: String, cause: Throwable?) {
    val promise = activePromise ?: return
    cleanup()
    promise.reject(code, message, cause)
  }

  private fun cleanup() {
    timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    timeoutRunnable = null
    recognizer?.destroy()
    recognizer = null
    activePromise = null
  }

  private fun speechErrorMessage(error: Int): String {
    return when (error) {
      SpeechRecognizer.ERROR_AUDIO -> "Android could not capture microphone audio."
      SpeechRecognizer.ERROR_CLIENT -> "Android speech recognition was interrupted."
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is required for voice input."
      SpeechRecognizer.ERROR_NETWORK -> "Offline speech recognition is unavailable for this language on this device."
      SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Speech recognition timed out while waiting for the recognizer."
      SpeechRecognizer.ERROR_NO_MATCH -> "No speech was recognized."
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Android speech recognition is already busy."
      SpeechRecognizer.ERROR_SERVER -> "Android speech recognition service failed."
      SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech was detected."
      else -> "Android speech recognition failed."
    }
  }
}
