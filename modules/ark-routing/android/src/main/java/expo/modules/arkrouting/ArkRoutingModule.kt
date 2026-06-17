package expo.modules.arkrouting

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class ArkRoutingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArkRouting")

    AsyncFunction("getEngineStatus") {
      val status = JSONObject(nativeEngineStatusJson())
      mapOf(
        "available" to status.optBoolean("available", false),
        "engine" to status.optString("engine", "valhalla"),
        "reason" to status.optString("reason").takeIf { it.isNotBlank() }
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

        val routeJson = nativeCalculateRouteJson(
          graphPath,
          profile,
          number(origin["latitude"]),
          number(origin["longitude"]),
          number(destination["latitude"]),
          number(destination["longitude"])
        )
        promise.resolve(parseValhallaRoute(routeJson))
      } catch (error: UnsatisfiedLinkError) {
        promise.reject(
          "E_ROUTING_ENGINE_UNAVAILABLE",
          "ArkRouting native bridge could not be loaded.",
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

  private external fun nativeEngineStatusJson(): String
  private external fun nativeCalculateRouteJson(
    graphPath: String,
    profile: String,
    originLatitude: Double,
    originLongitude: Double,
    destinationLatitude: Double,
    destinationLongitude: Double
  ): String

  companion object {
    init {
      System.loadLibrary("arkrouting")
    }
  }
}
