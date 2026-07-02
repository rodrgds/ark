package expo.modules.arkrouting

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File
import java.lang.reflect.InvocationTargetException

class ArkRoutingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArkRouting")

    AsyncFunction("getEngineStatus") {
      val unavailableReason = try {
        loadNativeLibrary()
        routingMethod()
        null
      } catch (error: Throwable) {
        engineUnavailableReason(error)
      }
      mapOf(
        "available" to (unavailableReason == null),
        "engine" to "valhalla",
        "reason" to unavailableReason
      )
    }

    AsyncFunction("calculateRoute") { request: Map<String, Any?>, promise: Promise ->
      try {
        val graphPath = request["graphPath"] as? String
        val profile = request["profile"] as? String
        val origin = request["origin"] as? Map<*, *>
        val destination = request["destination"] as? Map<*, *>
        if (graphPath.isNullOrBlank() || profile.isNullOrBlank() || origin == null || destination == null) {
          promise.reject("E_ROUTING_BAD_REQUEST", "Routing request is incomplete.", null)
          return@AsyncFunction
        }

        loadNativeLibrary()

        val originLat = number(origin["latitude"])
        val originLon = number(origin["longitude"])
        val destLat = number(destination["latitude"])
        val destLon = number(destination["longitude"])

        val configPath = writeValhallaConfig(graphPath)
        val requestJson = buildRouteRequest(profile, originLat, originLon, destLat, destLon)
        val responseJson = callValhallaNative(requestJson, configPath)

        promise.resolve(parseValhallaRoute(responseJson))
      } catch (error: UnsatisfiedLinkError) {
        promise.reject(
          "E_ROUTING_ENGINE_UNAVAILABLE",
          "Valhalla native routing engine could not be loaded.",
          error
        )
      } catch (error: Exception) {
        promise.reject(
          "E_ROUTING_FAILED",
          error.message ?: "Offline route calculation failed.",
          error
        )
      }
    }
  }

  private val nativeClass: Class<*> by lazy {
    Class.forName("com.valhalla.valhalla.ValhallaKotlin")
  }

  @Throws(UnsatisfiedLinkError::class)
  private fun loadNativeLibrary() {
    System.loadLibrary("valhalla-wrapper")
  }

  private fun callValhallaNative(requestJson: String, configPath: String): String {
    val instance = nativeClass.getDeclaredConstructor().newInstance()
    return try {
      routingMethod().invoke(instance, requestJson, configPath) as String
    } catch (error: InvocationTargetException) {
      val cause = error.targetException
      when (cause) {
        is Exception -> throw cause
        is UnsatisfiedLinkError -> throw cause
        is Throwable -> throw IllegalStateException(cause.message ?: "Valhalla route failed.", cause)
        else -> throw IllegalStateException("Valhalla route failed.")
      }
    }
  }

  private fun routingMethod() =
    nativeClass.getDeclaredMethod("route", String::class.java, String::class.java)

  private fun engineUnavailableReason(error: Throwable): String {
    return when (error) {
      is UnsatisfiedLinkError -> "Valhalla routing engine library is missing from this build."
      is ClassNotFoundException -> "Valhalla routing wrapper class is missing from this build."
      is NoSuchMethodException -> "Valhalla routing wrapper method is missing from this build."
      else -> error.message ?: "Valhalla routing engine is unavailable in this build."
    }
  }

  private fun writeValhallaConfig(tileExtractPath: String): String {
    val config = buildValhallaConfigJson(tileExtractPath)
    val dir = appContext.reactContext?.filesDir ?: appContext.throwingActivity.filesDir
    val file = File(dir, "ark_valhalla_config.json")
    file.writeText(config)
    return file.absolutePath
  }

  private fun buildValhallaConfigJson(tileExtractPath: String): String {
    val escaped = tileExtractPath.replace("\\", "\\\\").replace("\"", "\\\"")
    return """
      {
        "mjolnir": {
          "tile_dir": "",
          "tile_extract": "$escaped",
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
    """.trimIndent()
  }

  private fun buildRouteRequest(
    profile: String,
    originLat: Double,
    originLon: Double,
    destLat: Double,
    destLon: Double
  ): String {
    return """
      {
        "locations": [
          {"lat": $originLat, "lon": $originLon, "type": "break"},
          {"lat": $destLat, "lon": $destLon, "type": "break"}
        ],
        "costing": "${costingForProfile(profile)}",
        "units": "kilometers",
        "format": "json",
        "shape_format": "polyline6",
        "directions_options": {
          "units": "kilometers"
        }
      }
    """.trimIndent()
  }

  private fun costingForProfile(profile: String): String {
    return when (profile) {
      "car" -> "auto"
      "bicycle" -> "bicycle"
      else -> "pedestrian"
    }
  }

  private fun number(value: Any?): Double {
    return when (value) {
      is Number -> value.toDouble()
      is String -> value.toDouble()
      else -> throw IllegalArgumentException("Invalid routing coordinate.")
    }
  }

  private fun parseValhallaRoute(routeJson: String): Map<String, Any?> {
    val root = JSONObject(routeJson)
    extractValhallaError(root)?.let { throw IllegalStateException(it) }

    val trip = root.optJSONObject("trip")
    if (trip != null) return parseValhallaTrip(trip)

    val routes = root.optJSONArray("routes")
    if (routes != null && routes.length() > 0) return parseOsrmRoute(routes.getJSONObject(0))

    throw IllegalStateException(
      "Valhalla returned an unsupported route response with keys: ${rootKeys(root).joinToString(", ")}."
    )
  }

  private fun parseValhallaTrip(trip: JSONObject): Map<String, Any?> {
    val legs = trip.getJSONArray("legs")
    if (legs.length() == 0) throw IllegalStateException("Valhalla returned no route legs.")

    val geometry = mutableListOf<Map<String, Double>>()
    val maneuvers = mutableListOf<Map<String, Any?>>()
    var distanceMeters = 0.0
    var durationSeconds = 0.0
    var pointOffset = 0

    for (legIndex in 0 until legs.length()) {
      val leg = legs.getJSONObject(legIndex)
      val summary = leg.optJSONObject("summary")
      distanceMeters += (summary?.optDouble("length", 0.0) ?: 0.0) * 1000.0
      durationSeconds += summary?.optDouble("time", 0.0) ?: 0.0

      val decodedShape = decodePolyline6(leg.optString("shape", ""))
      geometry.addAll(decodedShape)

      val legManeuvers = leg.optJSONArray("maneuvers")
      if (legManeuvers != null) {
        for (maneuverIndex in 0 until legManeuvers.length()) {
          val maneuver = legManeuvers.getJSONObject(maneuverIndex)
          val beginIndex = maneuver.optInt("begin_shape_index", 0) + pointOffset
          val endIndex = maneuver.optInt("end_shape_index", beginIndex) + pointOffset
          maneuvers.add(
            mapOf(
              "instruction" to maneuver.optString("instruction", "Continue"),
              "distanceMeters" to maneuver.optDouble("length", 0.0) * 1000.0,
              "durationSeconds" to maneuver.optDouble("time", 0.0),
              "streetName" to maneuver.optJSONArray("street_names")?.optString(0),
              "beginIndex" to beginIndex,
              "endIndex" to endIndex
            )
          )
        }
      }
      pointOffset = geometry.size
    }

    return mapOf(
      "geometry" to geometry,
      "distanceMeters" to distanceMeters,
      "durationSeconds" to durationSeconds,
      "maneuvers" to maneuvers
    )
  }

  private fun parseOsrmRoute(route: JSONObject): Map<String, Any?> {
    val geometry = decodePolyline6(route.optString("geometry", ""))
    if (geometry.isEmpty()) {
      throw IllegalStateException("Valhalla returned an OSRM route without a polyline geometry.")
    }

    val maneuvers = mutableListOf<Map<String, Any?>>()
    val legs = route.optJSONArray("legs")
    var pointOffset = 0
    if (legs != null) {
      for (legIndex in 0 until legs.length()) {
        val leg = legs.getJSONObject(legIndex)
        val steps = leg.optJSONArray("steps") ?: continue
        for (stepIndex in 0 until steps.length()) {
          val step = steps.getJSONObject(stepIndex)
          val stepGeometry = decodePolyline6(step.optString("geometry", ""))
          val beginIndex = pointOffset.coerceAtMost((geometry.size - 1).coerceAtLeast(0))
          pointOffset = (pointOffset + stepGeometry.size).coerceAtMost(geometry.size - 1)
          val maneuver = step.optJSONObject("maneuver")
          val instruction =
            step.optString("name").takeIf { it.isNotBlank() }
              ?: maneuver?.optString("type")?.replaceFirstChar { it.uppercase() }
              ?: "Continue"
          maneuvers.add(
            mapOf(
              "instruction" to instruction,
              "distanceMeters" to step.optDouble("distance", 0.0),
              "durationSeconds" to step.optDouble("duration", 0.0),
              "streetName" to step.optString("name").takeIf { it.isNotBlank() },
              "beginIndex" to beginIndex,
              "endIndex" to pointOffset
            )
          )
        }
      }
    }

    return mapOf(
      "geometry" to geometry,
      "distanceMeters" to route.optDouble("distance", 0.0),
      "durationSeconds" to route.optDouble("duration", 0.0),
      "maneuvers" to maneuvers.ifEmpty {
        listOf(
          mapOf(
            "instruction" to "Follow the route.",
            "distanceMeters" to route.optDouble("distance", 0.0),
            "durationSeconds" to route.optDouble("duration", 0.0),
            "beginIndex" to 0,
            "endIndex" to (geometry.size - 1).coerceAtLeast(0)
          )
        )
      }
    )
  }

  private fun extractValhallaError(root: JSONObject): String? {
    val message =
      root.optString("error").takeIf { it.isNotBlank() }
        ?: root.optString("message").takeIf { it.isNotBlank() }
        ?: root.optString("status_message").takeIf { it.isNotBlank() }
    val code =
      root.opt("error_code")?.toString()?.takeIf { it.isNotBlank() }
        ?: root.opt("code")?.toString()?.takeIf {
          it.isNotBlank() && !it.equals("Ok", ignoreCase = true)
        }

    if (message == null && code == null) return null
    return listOfNotNull(code?.let { "Valhalla error $it" }, message).joinToString(": ")
  }

  private fun rootKeys(root: JSONObject): List<String> {
    val keys = mutableListOf<String>()
    val iterator = root.keys()
    while (iterator.hasNext()) keys.add(iterator.next())
    return keys
  }

  private fun decodePolyline6(shape: String): List<Map<String, Double>> {
    if (shape.isBlank()) return emptyList()
    val coordinates = mutableListOf<Map<String, Double>>()
    var index = 0
    var latitude = 0
    var longitude = 0

    while (index < shape.length) {
      val latResult = decodePolylineValue(shape, index)
      latitude += latResult.value
      index = latResult.nextIndex
      val lonResult = decodePolylineValue(shape, index)
      longitude += lonResult.value
      index = lonResult.nextIndex
      coordinates.add(
        mapOf(
          "latitude" to latitude / 1_000_000.0,
          "longitude" to longitude / 1_000_000.0
        )
      )
    }
    return coordinates
  }

  private fun decodePolylineValue(shape: String, startIndex: Int): PolylineValue {
    var index = startIndex
    var result = 0
    var shift = 0
    var byte: Int
    do {
      byte = shape[index++].code - 63
      result = result or ((byte and 0x1f) shl shift)
      shift += 5
    } while (byte >= 0x20)
    return PolylineValue(if ((result and 1) != 0) (result shr 1).inv() else result shr 1, index)
  }

  private data class PolylineValue(val value: Int, val nextIndex: Int)
}
