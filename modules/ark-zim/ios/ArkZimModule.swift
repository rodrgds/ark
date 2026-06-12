import ExpoModulesCore

public class ArkZimModule: Module {
  private let reader = ArkZimReader()

  public func definition() -> ModuleDefinition {
    Name("ArkZim")

    AsyncFunction("openArchive") { (path: String, promise: Promise) in
      let reader = self.reader
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          promise.resolve(try reader.openArchive(path))
        } catch {
          promise.reject(Self.exception(from: error, fallbackCode: "ERR_ZIM_OPEN", fallbackReason: "Could not open ZIM archive."))
        }
      }
    }

    AsyncFunction("getArticle") { (path: String, promise: Promise) in
      let reader = self.reader
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          promise.resolve(try reader.getArticle(path))
        } catch {
          promise.reject(Self.exception(from: error, fallbackCode: "ERR_ZIM_ARTICLE", fallbackReason: "Article could not be opened."))
        }
      }
    }

    AsyncFunction("search") { (query: String, limit: Int, promise: Promise) in
      let reader = self.reader
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          promise.resolve(try reader.search(query, limit: limit))
        } catch {
          promise.reject(Self.exception(from: error, fallbackCode: "ERR_ZIM_SEARCH", fallbackReason: "Archive search failed."))
        }
      }
    }

    AsyncFunction("suggest") { (prefix: String, limit: Int, promise: Promise) in
      let reader = self.reader
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          promise.resolve(try reader.suggest(prefix, limit: limit))
        } catch {
          promise.reject(Self.exception(from: error, fallbackCode: "ERR_ZIM_SUGGEST", fallbackReason: "Archive title search failed."))
        }
      }
    }
  }

  private static func exception(from error: Error, fallbackCode: String, fallbackReason: String) -> Exception {
    if let exception = error as? Exception {
      return exception
    }
    let nsError = error as NSError
    if let code = nsError.userInfo["code"] as? String {
      return Exception(name: code, description: nsError.localizedDescription)
    }
    return Exception(name: fallbackCode, description: nsError.localizedDescription.isEmpty ? fallbackReason : nsError.localizedDescription)
  }
}
