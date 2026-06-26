package expo.modules.arkrouting

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File

class ArkRoutingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArkRouting")

    AsyncFunction("getEngineStatus") {
      val available = try {
        loadNativeLibrary()
        true
      } catch (_: UnsatisfiedLinkError) {
        false
      }
      mapOf(
        "available" to available,
        "engine" to "valhalla",
        "reason" to if (available) null else "Install a development build with the ArkRouting native module (valhalla-mobile)."
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
    val method = nativeClass.getDeclaredMethod("route", String::class.java, String::class.java)
    return method.invoke(instance, requestJson, configPath) as String
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
          "logging": {"type": "", "color": false},
          "service": {"proxy": ""}
        },
        "thor": {
          "logging": {"type": "", "color": false},
          "service": {"proxy": ""}
        },
        "odin": {
          "logging": {"type": "", "color": false},
          "service": {"proxy": ""},
          "markup_formatter": {"markup_language": "text/html"}
        },
        "service_limits": {
          "auto": {"max_distance": 500000},
          "pedestrian": {"max_distance": 250000},
          "bicycle": {"max_distance": 500000}
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
        "directions_options": {
          "units": "kilometers",
          "format": "json",
          "shape_format": "polyline6"
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
    val trip = root.getJSONObject("trip")
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
    var result = 1
    var shift = 0
    var byte: Int
    do {
      byte = shape[index++].code - 63 - 1
      result += byte shl shift
      shift += 5
    } while (byte >= 0x1f)
    return PolylineValue(if ((result and 1) != 0) result shr 1 else -(result shr 1), index)
  }

  private data class PolylineValue(val value: Int, val nextIndex: Int)
}
