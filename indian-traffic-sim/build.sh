#!/bin/bash
set -e

echo "=> Configuring CMake project..."
cmake -S engine -B engine/build -DCMAKE_POLICY_VERSION_MINIMUM=3.0

echo "=> Building project..."
cmake --build engine/build -j $(nproc)

echo "=> Running tests..."
cd engine/build
ctest --output-on-failure
echo "=> Build & Test complete!"
