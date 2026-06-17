#include <jni.h>

#include <sstream>
#include <stdexcept>
#include <string>

#if ARK_ROUTING_WITH_VALHALLA
#include <boost/property_tree/ptree.hpp>
#include <boost/property_tree/json_parser.hpp>
#include <valhalla/tyr/actor.h>
#endif

namespace {

std::string jstring_to_string(JNIEnv *env, jstring value) {
  if (value == nullptr) return "";
  const char *chars = env->GetStringUTFChars(value, nullptr);
  std::string result(chars == nullptr ? "" : chars);
  if (chars != nullptr) env->ReleaseStringUTFChars(value, chars);
  return result;
}

jstring string_to_jstring(JNIEnv *env, const std::string &value) {
  return env->NewStringUTF(value.c_str());
}

std::string json_escape(const std::string &value) {
  std::ostringstream escaped;
  for (const char character : value) {
    switch (character) {
      case '\\':
        escaped << "\\\\";
        break;
      case '"':
        escaped << "\\\"";
        break;
      case '\n':
        escaped << "\\n";
        break;
      case '\r':
        escaped << "\\r";
        break;
      case '\t':
        escaped << "\\t";
        break;
      default:
        escaped << character;
    }
  }
  return escaped.str();
}

void throw_java_error(JNIEnv *env, const std::string &message) {
  jclass exception_class = env->FindClass("java/lang/IllegalStateException");
  if (exception_class != nullptr) env->ThrowNew(exception_class, message.c_str());
}

#if ARK_ROUTING_WITH_VALHALLA
std::string costing_for_profile(const std::string &profile) {
  if (profile == "car") return "auto";
  if (profile == "bicycle") return "bicycle";
  return "pedestrian";
}

boost::property_tree::ptree build_valhalla_config(const std::string &graph_path) {
  boost::property_tree::ptree config;
  config.put("mjolnir.tile_dir", graph_path);
  config.put("mjolnir.tile_extract", "");
  config.put("mjolnir.timezone", "");
  config.put("mjolnir.admin", "");
  config.put("mjolnir.hierarchy", false);
  config.put("service_limits.auto.max_distance", 500000);
  config.put("service_limits.pedestrian.max_distance", 250000);
  config.put("service_limits.bicycle.max_distance", 500000);
  config.put("service_limits.status.allow_verbose", true);
  return config;
}

std::string build_route_request(
    const std::string &profile,
    double origin_latitude,
    double origin_longitude,
    double destination_latitude,
    double destination_longitude
) {
  std::ostringstream request;
  request
      << "{"
      << "\"locations\":["
      << "{\"lat\":" << origin_latitude << ",\"lon\":" << origin_longitude << "},"
      << "{\"lat\":" << destination_latitude << ",\"lon\":" << destination_longitude << "}"
      << "],"
      << "\"costing\":\"" << costing_for_profile(profile) << "\","
      << "\"directions_options\":{\"units\":\"kilometers\"},"
      << "\"shape_format\":\"polyline6\""
      << "}";
  return request.str();
}
#endif

}  // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_expo_modules_arkrouting_ArkRoutingModule_nativeEngineStatusJson(JNIEnv *env, jobject) {
#if ARK_ROUTING_WITH_VALHALLA
  return string_to_jstring(env, "{\"available\":true,\"engine\":\"valhalla\"}");
#else
  return string_to_jstring(
      env,
      "{\"available\":false,\"engine\":\"valhalla\",\"reason\":\"Valhalla native routing is not linked. Build ark-routing with -ParkRoutingValhallaDir=/path/to/prebuilt-valhalla.\"}"
  );
#endif
}

extern "C" JNIEXPORT jstring JNICALL
Java_expo_modules_arkrouting_ArkRoutingModule_nativeCalculateRouteJson(
    JNIEnv *env,
    jobject,
    jstring graph_path,
    jstring profile,
    jdouble origin_latitude,
    jdouble origin_longitude,
    jdouble destination_latitude,
    jdouble destination_longitude
) {
#if ARK_ROUTING_WITH_VALHALLA
  try {
    const std::string graph_path_string = jstring_to_string(env, graph_path);
    const std::string profile_string = jstring_to_string(env, profile);
    auto config = build_valhalla_config(graph_path_string);
    valhalla::tyr::actor_t actor(config);
    const std::string request = build_route_request(
        profile_string,
        origin_latitude,
        origin_longitude,
        destination_latitude,
        destination_longitude
    );
    return string_to_jstring(env, actor.route(request));
  } catch (const std::exception &error) {
    throw_java_error(env, error.what());
    return nullptr;
  }
#else
  (void) graph_path;
  (void) profile;
  (void) origin_latitude;
  (void) origin_longitude;
  (void) destination_latitude;
  (void) destination_longitude;
  throw_java_error(
      env,
      "Valhalla native routing is not linked. Build ark-routing with -ParkRoutingValhallaDir=/path/to/prebuilt-valhalla."
  );
  return nullptr;
#endif
}
