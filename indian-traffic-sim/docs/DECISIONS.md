# Architectural Decisions Log

This document tracks resolutions to ambiguities, assumptions made during implementation, and technology stack justifications.

## 1. Parameter & Numeric Ambiguity Resolutions (Aug 6, 2026)

During the alignment of the PRD with the initial architecture models, three numeric inconsistencies were resolved:

* **Spatial Grid Neighbor Cap (K)**: The PRD specified a range of `15-20`. We have adopted **`K = 16`** as the default baseline tunable in `config.default.json`, as this satisfies the computational bounding limit while allowing a sufficiently dense candidate set for the IDM/SFM models.
* **Latency Budget**: The physics step execution latency budget is formally locked to **`< 12 ms`**. This is enforced during the hot-cell stress testing.
* **Road Width Mapping**: The exact physical channel widths for offset-path extrusion have been resolved to **10.5m** for Trunk roads and **5.5m** for Residential roads, correcting initial estimation errors.

## 2. Technology Stack & Framework Justifications

* **Testing Framework**: We selected **GoogleTest (gtest)** over Catch2. GoogleTest offers robust, built-in mocking (`gmock`), which will be essential when we need to isolate the non-holonomic pure pursuit controllers from the broader spatial hash grid logic. Furthermore, gtest handles large parameter spaces gracefully, which is useful for our behavior fuzzing.
* **SIMD & Linear Algebra Library**: We deliberately chose **NOT to use Eigen**. Eigen introduces significant template metaprogramming overhead, bloating compile times. As our operations strictly revolve around 2D vectors and low-vertex (N<=5) polygons, we will rely entirely on manual `alignas(16)` structs and `std::experimental::simd` to ensure the C++20 engine remains lightning fast to compile and dependency-lean.
* **Package Management**: **CMake FetchContent** was selected over vcpkg/conan to guarantee a seamless, zero-friction local build for any developer pulling the repository. It avoids requiring external package manager installations.
