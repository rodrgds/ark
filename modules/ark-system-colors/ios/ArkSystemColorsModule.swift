import ExpoModulesCore

public class ArkSystemColorsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArkSystemColors")

    AsyncFunction("getAccentColors") { () -> [String: Any?] in
      return [
        "available": false,
        "source": "unsupported",
        "reason": "iOS does not expose wallpaper-derived dynamic accent colors to apps."
      ]
    }
  }
}
