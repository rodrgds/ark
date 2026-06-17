cmake_minimum_required(VERSION 3.22.1)

project(arkrouting)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(arkrouting SHARED ark_routing_jni.cpp)

find_library(log-lib log)

set(ARK_ROUTING_WITH_VALHALLA 0)
set(ARK_ROUTING_VALHALLA_LIBS "")

if(DEFINED ARK_ROUTING_VALHALLA_DIR AND NOT "${ARK_ROUTING_VALHALLA_DIR}" STREQUAL "")
  set(VALHALLA_INCLUDE_DIR "${ARK_ROUTING_VALHALLA_DIR}/include")
  set(VALHALLA_LIB_DIR "${ARK_ROUTING_VALHALLA_DIR}/android/${ANDROID_ABI}/lib")

  if(EXISTS "${VALHALLA_INCLUDE_DIR}" AND EXISTS "${VALHALLA_LIB_DIR}")
    target_include_directories(arkrouting PRIVATE "${VALHALLA_INCLUDE_DIR}")
    file(GLOB ARK_ROUTING_VALHALLA_LIBS "${VALHALLA_LIB_DIR}/*.a" "${VALHALLA_LIB_DIR}/*.so")
    if(ARK_ROUTING_VALHALLA_LIBS)
      set(ARK_ROUTING_WITH_VALHALLA 1)
    endif()
  endif()
endif()

target_compile_definitions(arkrouting PRIVATE ARK_ROUTING_WITH_VALHALLA=${ARK_ROUTING_WITH_VALHALLA})

if(ARK_ROUTING_WITH_VALHALLA)
  target_link_libraries(arkrouting ${ARK_ROUTING_VALHALLA_LIBS} ${log-lib})
else()
  target_link_libraries(arkrouting ${log-lib})
endif()
