$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "backend\liboqs"
$build = Join-Path $src "build"
$bin = Join-Path $src "bin"

if (-not (Test-Path (Join-Path $src "CMakeLists.txt"))) {
    git clone --depth 1 https://github.com/open-quantum-safe/liboqs.git $src
}

$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if (-not $cmake) {
    $cmake = Join-Path $root "venv\Scripts\cmake.exe"
}
if (-not (Test-Path $cmake)) {
    throw "cmake not found. Install CMake or run: venv\Scripts\pip install cmake ninja"
}

& $cmake -S $src -B $build -G "Visual Studio 17 2022" -A x64 `
    -DBUILD_SHARED_LIBS=ON -DOQS_BUILD_ONLY_LIB=ON
& $cmake --build $build --config Release --parallel

New-Item -ItemType Directory -Force $bin | Out-Null
Copy-Item (Join-Path $build "bin\Release\oqs.dll") (Join-Path $bin "oqs.dll") -Force
Write-Host "Built $bin\oqs.dll"
