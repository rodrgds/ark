import ExpoModulesCore
import Foundation
import ObjectiveC.runtime

public class ArkRoutingModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArkRouting")

    AsyncFunction("getEngineStatus") { () -> [String: Any?] in
      let available = findValhallaWrapperClass() != nil
      return [
        "available": available,
        "engine": "valhalla",
        "reason": available ? nil : "Valhalla native routing engine is not linked."
      ]
    }

    AsyncFunction("calculateRoute") { (request: [String: Any?]) -> [String: Any?] in
      do {
        guard let graphPath = request["graphPath"] as? String,
              !graphPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let profile = request["profile"] as? String,
              !profile.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let origin = request["origin"] as? [String: Any?],
              let destination = request["destination"] as? [String: Any?] else {
          throw ArkRoutingError.badRequest("Routing request is incomplete.")
        }
        let preferences = request["preferences"] as? [String: Any?] ?? [:]

        let originLat = try number(origin["latitude"] ?? nil)
        let originLon = try number(origin["longitude"] ?? nil)
        let destLat = try number(destination["latitude"] ?? nil)
        let destLon = try number(destination["longitude"] ?? nil)

        let configPath = try writeValhallaConfig(tileExtractPath: graphPath)
        let requestJson = try buildRouteRequest(
          profile: profile,
          preferences: preferences,
          originLat: originLat,
          originLon: originLon,
          destLat: destLat,
          destLon: destLon
        )

        let valhalla = try makeValhallaWrapper(configPath: configPath)
        let responseJson = try callValhallaRoute(valhalla, requestJson: requestJson)
        guard !responseJson.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
          throw ArkRoutingError.routeFailed("Valhalla returned an empty route response.")
        }
        return try parseValhallaRoute(responseJson)
      } catch let error as ArkRoutingError {
        throw error
      } catch {
        throw ArkRoutingError.routeFailed(error.localizedDescription)
      }
    }
  }
}

private let valhallaWrapperClassNames = [
  "ValhallaWrapper",
  "ValhallaObjc.ValhallaWrapper"
]

private func findValhallaWrapperClass() -> AnyClass? {
  for className in valhallaWrapperClassNames {
    if let runtimeClass = objc_getClass(className) as? AnyClass {
      return runtimeClass
    }
    if let runtimeClass = NSClassFromString(className) {
      return runtimeClass
    }
  }

  return nil
}

private func makeValhallaWrapper(configPath: String) throws -> AnyObject {
  guard let wrapperClass = findValhallaWrapperClass() else {
    throw ArkRoutingError.routeFailed("Valhalla native routing engine is not linked.")
  }

  let allocSelector = sel_registerName("alloc")
  let initSelector = sel_registerName("initWithConfigPath:error:")
  guard let allocMethod = class_getClassMethod(wrapperClass, allocSelector),
        let initMethod = class_getInstanceMethod(wrapperClass, initSelector) else {
    throw ArkRoutingError.routeFailed("Valhalla native routing engine has an incompatible wrapper API.")
  }

  typealias AllocFn = @convention(c) (AnyClass, Selector) -> AnyObject
  typealias InitFn = @convention(c) (
    AnyObject,
    Selector,
    NSString,
    UnsafeMutablePointer<NSError?>?
  ) -> AnyObject?

  let alloc = unsafeBitCast(method_getImplementation(allocMethod), to: AllocFn.self)
  let initialize = unsafeBitCast(method_getImplementation(initMethod), to: InitFn.self)

  var engineError: NSError?
  let allocated = alloc(wrapperClass, allocSelector)
  guard let engine = initialize(allocated, initSelector, configPath as NSString, &engineError) else {
    throw ArkRoutingError.routeFailed(
      engineError?.localizedDescription ?? "Valhalla native routing engine could not be loaded."
    )
  }

  if let engineError {
    throw ArkRoutingError.routeFailed(engineError.localizedDescription)
  }

  return engine
}

private func callValhallaRoute(_ engine: AnyObject, requestJson: String) throws -> String {
  let routeSelector = sel_registerName("route:")
  guard let engineClass = object_getClass(engine),
        let routeMethod = class_getInstanceMethod(engineClass, routeSelector) else {
    throw ArkRoutingError.routeFailed("Valhalla native routing engine has no route API.")
  }

  typealias RouteFn = @convention(c) (AnyObject, Selector, NSString) -> NSString?
  let route = unsafeBitCast(method_getImplementation(routeMethod), to: RouteFn.self)

  guard let response = route(engine, routeSelector, requestJson as NSString) else {
    throw ArkRoutingError.routeFailed("Valhalla returned an empty route response.")
  }

  return response as String
}

private func writeValhallaConfig(tileExtractPath: String) throws -> String {
  let config = buildValhallaConfigJson(tileExtractPath: tileExtractPath)
  let configUrl = FileManager.default.temporaryDirectory.appendingPathComponent(
    "ark_valhalla_config.json"
  )
  try config.write(to: configUrl, atomically: true, encoding: .utf8)
  return configUrl.path
}

private func buildValhallaConfigJson(tileExtractPath: String) -> String {
  let escapedPath = tileExtractPath
    .replacingOccurrences(of: "\\", with: "\\\\")
    .replacingOccurrences(of: "\"", with: "\\\"")

  return """
  {
    "mjolnir": {
      "tile_dir": "",
      "tile_extract": "\(escapedPath)",
      "id_table_size": 1300000000,
      "max_cache_size": 1000000000,
      "use_lru_mem_cache": false,
      "use_simple_mem_cache": false,
      "hierarchy": false,
      "shortcuts": true,
      "include_driveways": true,
      "include_bicycle": true,
      "include_pedestrian": true,
      "include_driving": true,
      "reclassify_links": true,
      "max_concurrent_reader_users": 1
    },
    "loki": {
      "actions": ["route"],
      "use_connectivity": true,
      "service_defaults": {
        "radius": 0,
        "minimum_reachability": 50,
        "search_cutoff": 35000,
        "node_snap_tolerance": 5,
        "street_side_tolerance": 5,
        "street_side_max_distance": 1000,
        "heading_tolerance": 60
      },
      "logging": {"type": "", "color": false},
      "service": {"proxy": ""}
    },
    "meili": {
      "mode": "auto",
      "customizable": [
        "mode",
        "search_radius",
        "turn_penalty_factor",
        "gps_accuracy",
        "interpolation_distance",
        "sigma_z",
        "beta",
        "max_route_distance_factor",
        "max_route_time_factor"
      ],
      "default": {
        "beta": 3,
        "breakage_distance": 2000,
        "geometry": false,
        "gps_accuracy": 5,
        "interpolation_distance": 10,
        "max_route_distance_factor": 5,
        "max_route_time_factor": 5,
        "max_search_radius": 100,
        "route": true,
        "search_radius": 50,
        "sigma_z": 4.07,
        "turn_penalty_factor": 0
      },
      "auto": {
        "search_radius": 50,
        "turn_penalty_factor": 200
      },
      "pedestrian": {
        "search_radius": 50,
        "turn_penalty_factor": 100
      },
      "bicycle": {
        "turn_penalty_factor": 140
      },
      "multimodal": {
        "turn_penalty_factor": 70
      },
      "grid": {
        "cache_size": 100240,
        "size": 500
      },
      "logging": {"type": "", "color": false},
      "service": {"proxy": ""},
      "verbose": false
    },
    "thor": {
      "source_to_target_algorithm": "select_optimal",
      "logging": {"type": "", "color": false},
      "service": {"proxy": ""},
      "max_reserved_labels_count": 1000000,
      "clear_reserved_memory": false,
      "extended_search": false
    },
    "odin": {
      "logging": {"type": "", "color": false},
      "service": {"proxy": ""},
      "markup_formatter": {"markup_language": "text/html"}
    },
    "service_limits": {
      "auto": {
        "max_distance": 5000000.0,
        "max_locations": 20,
        "max_matrix_distance": 400000.0,
        "max_matrix_location_pairs": 2500
      },
      "auto_pedestrian": {
        "max_distance": 1000000.0,
        "max_locations": 50,
        "max_matrix_distance": 200000.0,
        "max_matrix_location_pairs": 2500
      },
      "pedestrian": {
        "max_distance": 1000000.0,
        "max_locations": 50,
        "max_matrix_distance": 200000.0,
        "max_matrix_location_pairs": 2500,
        "min_transit_walking_distance": 1,
        "max_transit_walking_distance": 10000
      },
      "bicycle": {
        "max_distance": 1500000.0,
        "max_locations": 50,
        "max_matrix_distance": 200000.0,
        "max_matrix_location_pairs": 2500
      },
      "bikeshare": {
        "max_distance": 500000.0,
        "max_locations": 50,
        "max_matrix_distance": 200000.0,
        "max_matrix_location_pairs": 2500
      },
      "bus": {
        "max_distance": 5000000.0,
        "max_locations": 50,
        "max_matrix_distance": 400000.0,
        "max_matrix_location_pairs": 2500
      },
      "taxi": {
        "max_distance": 5000000.0,
        "max_locations": 20,
        "max_matrix_distance": 400000.0,
        "max_matrix_location_pairs": 2500
      },
      "truck": {
        "max_distance": 5000000.0,
        "max_locations": 20,
        "max_matrix_distance": 400000.0,
        "max_matrix_location_pairs": 2500
      },
      "motor_scooter": {
        "max_distance": 500000.0,
        "max_locations": 50,
        "max_matrix_distance": 200000.0,
        "max_matrix_location_pairs": 2500
      },
      "motorcycle": {
        "max_distance": 500000.0,
        "max_locations": 50,
        "max_matrix_distance": 200000.0,
        "max_matrix_location_pairs": 2500
      },
      "multimodal": {
        "max_distance": 500000.0,
        "max_locations": 50,
        "max_matrix_distance": 0.0,
        "max_matrix_location_pairs": 0
      },
      "transit": {
        "max_distance": 500000.0,
        "max_locations": 50,
        "max_matrix_distance": 200000.0,
        "max_matrix_location_pairs": 2500
      },
      "centroid": {
        "max_distance": 200000.0,
        "max_locations": 5
      },
      "hierarchy_limits": {
        "max_distance": 5000000.0,
        "max_locations": 50,
        "max_matrix_distance": 400000.0,
        "max_matrix_location_pairs": 2500
      },
      "isochrone": {
        "max_contours": 4,
        "max_distance": 25000.0,
        "max_distance_contour": 200.0,
        "max_locations": 1,
        "max_time_contour": 120.0
      },
      "skadi": {
        "max_shape": 750000,
        "min_resample": 10.0
      },
      "status": {
        "allow_verbose": false
      },
      "trace": {
        "max_alternates": 3,
        "max_alternates_shape": 100,
        "max_distance": 200000.0,
        "max_gps_accuracy": 100.0,
        "max_search_radius": 100.0,
        "max_shape": 16000
      },
      "max_alternates": 2,
      "max_exclude_locations": 50,
      "max_exclude_polygons_length": 10000,
      "max_radius": 200.0,
      "max_reachability": 100,
      "max_timedep_distance": 500000.0,
      "max_timedep_distance_matrix": 0.0,
      "max_distance_disable_hierarchy_culling": 1000000.0
    }
  }
  """
}

private func buildRouteRequest(
  profile: String,
  preferences: [String: Any?],
  originLat: Double,
  originLon: Double,
  destLat: Double,
  destLon: Double
) throws -> String {
  let costing = costingForProfile(profile)
  let request: [String: Any] = [
    "locations": [
      ["lat": originLat, "lon": originLon, "type": "break"],
      ["lat": destLat, "lon": destLon, "type": "break"]
    ],
    "costing": costing,
    "costing_options": costingOptions(for: costing, preferences: preferences),
    "units": "kilometers",
    "format": "json",
    "shape_format": "polyline6",
    "directions_options": [
      "units": "kilometers"
    ]
  ]

  let data = try JSONSerialization.data(withJSONObject: request, options: [])
  guard let json = String(data: data, encoding: .utf8) else {
    throw ArkRoutingError.routeFailed("Failed to encode routing request.")
  }
  return json
}

private func costingForProfile(_ profile: String) -> String {
  switch profile {
  case "car":
    return "auto"
  case "bicycle":
    return "bicycle"
  default:
    return "pedestrian"
  }
}

private func costingOptions(for costing: String, preferences: [String: Any?]) -> [String: Any] {
  let useFerry = preferenceEnabled(preferences, "avoidFerries") ? 0.05 : 0.5
  let useHills = preferenceEnabled(preferences, "avoidHills") ? 0.15 : 0.5
  let useHighways = preferenceEnabled(preferences, "avoidHighways") ? 0.1 : 0.5
  let useTolls = preferenceEnabled(preferences, "avoidTolls") ? 0.1 : 0.5

  switch costing {
  case "auto":
    return [
      "auto": [
        "use_ferry": useFerry,
        "use_highways": useHighways,
        "use_tolls": useTolls
      ]
    ]
  case "bicycle":
    return [
      "bicycle": [
        "bicycle_type": "hybrid",
        "use_ferry": useFerry,
        "use_hills": useHills
      ]
    ]
  default:
    return [
      "pedestrian": [
        "walking_speed": 5.1,
        "use_ferry": useFerry,
        "use_hills": useHills
      ]
    ]
  }
}

private func preferenceEnabled(_ preferences: [String: Any?], _ key: String) -> Bool {
  guard let value = preferences[key] else {
    return false
  }
  if let boolValue = value as? Bool {
    return boolValue
  }
  if let numberValue = value as? NSNumber {
    return numberValue.boolValue
  }
  if let stringValue = value as? String {
    return stringValue.caseInsensitiveCompare("true") == .orderedSame || stringValue == "1"
  }
  return false
}

private func number(_ value: Any?) throws -> Double {
  if let value = value as? NSNumber {
    return value.doubleValue
  }
  if let value = value as? Double {
    return value
  }
  if let value = value as? String,
     let parsed = Double(value) {
    return parsed
  }
  throw ArkRoutingError.badRequest("Invalid routing coordinate.")
}

private func parseValhallaRoute(_ routeJson: String) throws -> [String: Any?] {
  guard let data = routeJson.data(using: .utf8),
        let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
    throw ArkRoutingError.routeFailed("Valhalla returned an invalid route response.")
  }

  if let error = extractValhallaError(root) {
    throw ArkRoutingError.routeFailed(error)
  }

  if let trip = root["trip"] as? [String: Any] {
    return try parseValhallaTrip(trip)
  }

  if let routes = root["routes"] as? [[String: Any]],
     let route = routes.first {
    return try parseOsrmRoute(route)
  }

  throw ArkRoutingError.routeFailed(
    "Valhalla returned an unsupported route response with keys: \(root.keys.sorted().joined(separator: ", "))."
  )
}

private func parseValhallaTrip(_ trip: [String: Any]) throws -> [String: Any?] {
  guard let legs = trip["legs"] as? [[String: Any]],
        !legs.isEmpty else {
    throw ArkRoutingError.routeFailed("Valhalla returned no route legs.")
  }

  var geometry: [[String: Double]] = []
  var maneuvers: [[String: Any?]] = []
  var distanceMeters = 0.0
  var durationSeconds = 0.0
  var pointOffset = 0

  for leg in legs {
    if let summary = leg["summary"] as? [String: Any] {
      distanceMeters += double(summary["length"]) * 1000.0
      durationSeconds += double(summary["time"])
    }

    let decodedShape = try decodePolyline6(leg["shape"] as? String ?? "")
    geometry.append(contentsOf: decodedShape)

    if let legManeuvers = leg["maneuvers"] as? [[String: Any]] {
      for maneuver in legManeuvers {
        let beginIndex = int(maneuver["begin_shape_index"]) + pointOffset
        let endIndex = int(maneuver["end_shape_index"]) + pointOffset
        let streetNames = maneuver["street_names"] as? [String]
        maneuvers.append([
          "instruction": maneuver["instruction"] as? String ?? "Continue",
          "distanceMeters": double(maneuver["length"]) * 1000.0,
          "durationSeconds": double(maneuver["time"]),
          "streetName": streetNames?.first,
          "beginIndex": beginIndex,
          "endIndex": endIndex
        ])
      }
    }

    pointOffset = geometry.count
  }

  return [
    "geometry": geometry,
    "distanceMeters": distanceMeters,
    "durationSeconds": durationSeconds,
    "maneuvers": maneuvers
  ]
}

private func parseOsrmRoute(_ route: [String: Any]) throws -> [String: Any?] {
  let geometry = try decodePolyline6(route["geometry"] as? String ?? "")
  if geometry.isEmpty {
    throw ArkRoutingError.routeFailed("Valhalla returned an OSRM route without a polyline geometry.")
  }

  var maneuvers: [[String: Any?]] = []
  var pointOffset = 0
  if let legs = route["legs"] as? [[String: Any]] {
    for leg in legs {
      guard let steps = leg["steps"] as? [[String: Any]] else {
        continue
      }
      for step in steps {
        let stepGeometry = try decodePolyline6(step["geometry"] as? String ?? "")
        let beginIndex = min(pointOffset, max(geometry.count - 1, 0))
        pointOffset = min(pointOffset + stepGeometry.count, max(geometry.count - 1, 0))
        let maneuver = step["maneuver"] as? [String: Any]
        let stepName = step["name"] as? String
        let instruction =
          nonEmpty(stepName) ??
          nonEmpty(maneuver?["type"] as? String)?.capitalized ??
          "Continue"
        maneuvers.append([
          "instruction": instruction,
          "distanceMeters": double(step["distance"]),
          "durationSeconds": double(step["duration"]),
          "streetName": nonEmpty(stepName),
          "beginIndex": beginIndex,
          "endIndex": pointOffset
        ])
      }
    }
  }

  if maneuvers.isEmpty {
    maneuvers.append([
      "instruction": "Follow the route.",
      "distanceMeters": double(route["distance"]),
      "durationSeconds": double(route["duration"]),
      "beginIndex": 0,
      "endIndex": max(geometry.count - 1, 0)
    ])
  }

  return [
    "geometry": geometry,
    "distanceMeters": double(route["distance"]),
    "durationSeconds": double(route["duration"]),
    "maneuvers": maneuvers
  ]
}

private func extractValhallaError(_ root: [String: Any]) -> String? {
  let message =
    nonEmpty(root["error"] as? String) ??
    nonEmpty(root["message"] as? String) ??
    nonEmpty(root["status_message"] as? String)
  let rawCode = root["error_code"] ?? root["code"]
  let code = nonEmpty(String(describing: rawCode ?? ""))
  let normalizedCode =
    code?.caseInsensitiveCompare("Ok") == .orderedSame ? nil : code

  if message == nil && normalizedCode == nil {
    return nil
  }
  return [normalizedCode.map { "Valhalla error \($0)" }, message]
    .compactMap { $0 }
    .joined(separator: ": ")
}

private func nonEmpty(_ value: String?) -> String? {
  guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
        !value.isEmpty else {
    return nil
  }
  return value
}

private func double(_ value: Any?) -> Double {
  if let value = value as? NSNumber {
    return value.doubleValue
  }
  if let value = value as? Double {
    return value
  }
  if let value = value as? String {
    return Double(value) ?? 0
  }
  return 0
}

private func int(_ value: Any?) -> Int {
  if let value = value as? NSNumber {
    return value.intValue
  }
  if let value = value as? Int {
    return value
  }
  if let value = value as? String {
    return Int(value) ?? 0
  }
  return 0
}

private func decodePolyline6(_ shape: String) throws -> [[String: Double]] {
  if shape.isEmpty {
    return []
  }

  let bytes = Array(shape.utf8)
  var coordinates: [[String: Double]] = []
  var index = 0
  var latitude = 0
  var longitude = 0

  while index < bytes.count {
    let latResult = try decodePolylineValue(bytes: bytes, start: index)
    latitude += latResult.value
    index = latResult.nextIndex

    let lonResult = try decodePolylineValue(bytes: bytes, start: index)
    longitude += lonResult.value
    index = lonResult.nextIndex

    coordinates.append([
      "latitude": Double(latitude) / 1_000_000.0,
      "longitude": Double(longitude) / 1_000_000.0
    ])
  }

  return coordinates
}

private func decodePolylineValue(bytes: [UInt8], start: Int) throws -> (
  value: Int,
  nextIndex: Int
) {
  var index = start
  var result = 0
  var shift = 0
  var byte = 0

  repeat {
    guard index < bytes.count else {
      throw ArkRoutingError.routeFailed("Valhalla returned an invalid route shape.")
    }
    byte = Int(bytes[index]) - 63
    index += 1
    result |= (byte & 0x1f) << shift
    shift += 5
  } while byte >= 0x20

  let value = (result & 1) != 0 ? ~(result >> 1) : (result >> 1)
  return (value, index)
}

enum ArkRoutingError: Error {
  case badRequest(String)
  case routeFailed(String)
}

extension ArkRoutingError: CodedError {
  var code: String {
    switch self {
    case .badRequest:
      return "E_ROUTING_BAD_REQUEST"
    case .routeFailed:
      return "E_ROUTING_FAILED"
    }
  }

  var message: String {
    switch self {
    case let .badRequest(message):
      return message
    case let .routeFailed(message):
      return message
    }
  }
}
