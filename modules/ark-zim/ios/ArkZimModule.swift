import ExpoModulesCore

public class ArkZimModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArkZim")

    AsyncFunction("openArchive") { (path: String) -> [String: Any?] in
      throw ArkZimError.notImplemented
    }

    AsyncFunction("getArticle") { (_ path: String) -> [String: String] in
      throw ArkZimError.notImplemented
    }

    AsyncFunction("search") { (_ query: String, _ limit: Int) -> [[String: String]] in
      throw ArkZimError.notImplemented
    }

    AsyncFunction("suggest") { (_ prefix: String, _ limit: Int) -> [[String: String]] in
      throw ArkZimError.notImplemented
    }
  }
}

enum ArkZimError: Error {
  case notImplemented
}

extension ArkZimError: CodedError {
  var code: String {
    switch self {
    case .notImplemented:
      return "E_NOT_IMPLEMENTED"
    }
  }

  var message: String {
    switch self {
    case .notImplemented:
      return "In-app ZIM reading is not yet implemented on iOS. Open the archive in Kiwix."
    }
  }
}
