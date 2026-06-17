import ExpoModulesCore

public class ArkRoutingModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArkRouting")

    AsyncFunction("getEngineStatus") { () -> [String: Any?] in
      return [
        "available": false,
        "engine": "valhalla",
        "reason": "Valhalla native routing is not linked into this development build."
      ]
    }

    AsyncFunction("calculateRoute") { (_ request: [String: Any?]) -> [String: Any?] in
      throw ArkRoutingError.engineUnavailable
    }
  }
}

enum ArkRoutingError: Error {
  case engineUnavailable
}

extension ArkRoutingError: CodedError {
  var code: String {
    switch self {
    case .engineUnavailable:
      return "E_ROUTING_ENGINE_UNAVAILABLE"
    }
  }

  var message: String {
    switch self {
    case .engineUnavailable:
      return "Valhalla native routing is not linked into this development build."
    }
  }
}
