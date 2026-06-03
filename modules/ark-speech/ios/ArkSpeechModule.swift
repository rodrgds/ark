import AVFoundation
import ExpoModulesCore
import Speech

public class ArkSpeechModule: Module {
  private let audioEngine = AVAudioEngine()
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var activePromise: Promise?
  private var timeoutWorkItem: DispatchWorkItem?

  public func definition() -> ModuleDefinition {
    Name("ArkSpeech")

    AsyncFunction("isAvailable") { () -> Bool in
      return SFSpeechRecognizer()?.isAvailable ?? false
    }

    AsyncFunction("recognizeOnce") { (options: [String: Any]?, promise: Promise) in
      self.recognizeOnce(options: options, promise: promise)
    }.runOnQueue(.main)

    Function("stop") {
      DispatchQueue.main.async {
        self.audioEngine.stop()
        self.recognitionRequest?.endAudio()
      }
    }

    Function("cancel") {
      DispatchQueue.main.async {
        self.rejectActive(Exception(name: "ERR_SPEECH_CANCELLED", description: "Speech recognition was cancelled."))
      }
    }
  }

  private func recognizeOnce(options: [String: Any]?, promise: Promise) {
    guard activePromise == nil else {
      promise.reject(Exception(name: "ERR_SPEECH_BUSY", description: "Speech recognition is already active."))
      return
    }

    activePromise = promise
    requestSpeechAuthorization { [weak self] authorized in
      guard let self else {
        return
      }
      guard authorized else {
        self.rejectActive(Exception(name: "ERR_SPEECH_PERMISSION", description: "Speech recognition permission is required for voice input."))
        return
      }
      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        DispatchQueue.main.async {
          guard granted else {
            self.rejectActive(Exception(name: "ERR_MIC_PERMISSION", description: "Microphone permission is required for voice input."))
            return
          }
          self.startRecognition(options: options)
        }
      }
    }
  }

  private func startRecognition(options: [String: Any]?) {
    let localeIdentifier = options?["locale"] as? String ?? Locale.current.identifier
    let preferOffline = options?["preferOffline"] as? Bool ?? true
    let timeoutMs = min(max((options?["timeoutMs"] as? NSNumber)?.doubleValue ?? 45_000, 5_000), 120_000)
    let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeIdentifier)) ?? SFSpeechRecognizer()

    guard let recognizer, recognizer.isAvailable else {
      rejectActive(Exception(name: "ERR_SPEECH_UNAVAILABLE", description: "iOS speech recognition is not available on this device."))
      return
    }

    if preferOffline, !recognizer.supportsOnDeviceRecognition {
      rejectActive(Exception(name: "ERR_SPEECH_OFFLINE_UNAVAILABLE", description: "Offline iOS speech recognition is unavailable for this language on this device."))
      return
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = false
    if #available(iOS 13.0, *) {
      request.requiresOnDeviceRecognition = preferOffline
    }

    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
      try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
    } catch {
      rejectActive(Exception(name: "ERR_AUDIO_SESSION", description: error.localizedDescription))
      return
    }

    recognitionRequest = request
    let inputNode = audioEngine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    inputNode.removeTap(onBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
      request.append(buffer)
    }

    audioEngine.prepare()
    do {
      try audioEngine.start()
    } catch {
      rejectActive(Exception(name: "ERR_AUDIO_START", description: error.localizedDescription))
      return
    }

    recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self else {
        return
      }
      if let result, result.isFinal {
        let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
        self.resolveActive([
          "text": text,
          "alternatives": text.isEmpty ? [] : [text],
          "offlinePreferred": preferOffline
        ])
        return
      }
      if let error {
        self.rejectActive(Exception(name: "ERR_SPEECH_FAILED", description: error.localizedDescription))
      }
    }

    let timeout = DispatchWorkItem { [weak self] in
      self?.rejectActive(Exception(name: "ERR_SPEECH_TIMEOUT", description: "No speech was recognized before the timeout."))
    }
    timeoutWorkItem = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(Int(timeoutMs)), execute: timeout)
  }

  private func requestSpeechAuthorization(_ completion: @escaping (Bool) -> Void) {
    SFSpeechRecognizer.requestAuthorization { status in
      DispatchQueue.main.async {
        completion(status == .authorized)
      }
    }
  }

  private func resolveActive(_ value: Any) {
    guard let promise = activePromise else {
      return
    }
    cleanup()
    promise.resolve(value)
  }

  private func rejectActive(_ error: Exception) {
    guard let promise = activePromise else {
      return
    }
    cleanup()
    promise.reject(error)
  }

  private func cleanup() {
    timeoutWorkItem?.cancel()
    timeoutWorkItem = nil
    audioEngine.inputNode.removeTap(onBus: 0)
    if audioEngine.isRunning {
      audioEngine.stop()
    }
    recognitionRequest?.endAudio()
    recognitionTask?.cancel()
    recognitionTask = nil
    recognitionRequest = nil
    activePromise = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
