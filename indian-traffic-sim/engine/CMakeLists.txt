cmake_minimum_required(VERSION 3.20)
project(IndianTrafficSim VERSION 1.5 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(OpenMP REQUIRED)
include(FetchContent)

FetchContent_Declare(pugixml GIT_REPOSITORY https://github.com/zeux/pugixml.git GIT_TAG v1.14)
FetchContent_MakeAvailable(pugixml)

FetchContent_Declare(googletest GIT_REPOSITORY https://github.com/google/googletest.git GIT_TAG v1.14.0)
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

FetchContent_Declare(nlohmann_json GIT_REPOSITORY https://github.com/nlohmann/json.git GIT_TAG v3.11.3)
FetchContent_MakeAvailable(nlohmann_json)

FetchContent_Declare(usockets GIT_REPOSITORY https://github.com/uNetworking/uSockets.git GIT_TAG v0.8.8)
FetchContent_Populate(usockets)
add_library(usockets STATIC
    ${usockets_SOURCE_DIR}/src/bsd.c
    ${usockets_SOURCE_DIR}/src/eventing/epoll_kqueue.c
    ${usockets_SOURCE_DIR}/src/context.c
    ${usockets_SOURCE_DIR}/src/loop.c
    ${usockets_SOURCE_DIR}/src/socket.c
    ${usockets_SOURCE_DIR}/src/crypto/openssl.c
    ${usockets_SOURCE_DIR}/src/crypto/sni_tree.cpp
)
target_compile_definitions(usockets PRIVATE LIBUS_NO_SSL)
target_include_directories(usockets PUBLIC ${usockets_SOURCE_DIR}/src)

FetchContent_Declare(uwebsockets GIT_REPOSITORY https://github.com/uNetworking/uWebSockets.git GIT_TAG v20.69.0)
FetchContent_Populate(uwebsockets)
add_library(uwebsockets INTERFACE)
target_include_directories(uwebsockets INTERFACE ${uwebsockets_SOURCE_DIR}/src ${uwebsockets_SOURCE_DIR}/capi)
target_link_libraries(uwebsockets INTERFACE usockets z)

add_library(engine_core
    src/core/Agent.cpp
    src/parser/NetXmlParser.cpp
    src/core/SimConfig.cpp
    src/network/SpatialHash.cpp
    src/network/RoadGraph.cpp
    src/collision/SAT.cpp
    src/obstacles/Obstacles.cpp
    src/tactics/FSM.cpp
    src/physics/Physics.cpp
    src/network/WebSocketServer.cpp
    src/core/Engine.cpp
)
target_include_directories(engine_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)
target_link_libraries(engine_core PUBLIC OpenMP::OpenMP_CXX pugixml nlohmann_json::nlohmann_json uwebsockets)

add_executable(traffic_sim src/main.cpp)
target_link_libraries(traffic_sim PRIVATE engine_core)

enable_testing()
add_executable(unit_tests test/unit_tests.cpp)
target_link_libraries(unit_tests PRIVATE engine_core gtest_main)
include(GoogleTest)
gtest_discover_tests(unit_tests)
