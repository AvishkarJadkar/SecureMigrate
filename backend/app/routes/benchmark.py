from fastapi import APIRouter, HTTPException
from app.schemas import BenchmarkRequest, BenchmarkResponse
from app.services import benchmark_service

router = APIRouter(prefix="/benchmark", tags=["Benchmark"])

# Cache latest results
_latest_results: dict | None = None


@router.post("/run", response_model=BenchmarkResponse)
def run_benchmark(req: BenchmarkRequest = BenchmarkRequest()):
    global _latest_results
    try:
        _latest_results = benchmark_service.run_benchmark(req.iterations)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return _latest_results


@router.get("/results", response_model=BenchmarkResponse)
def get_benchmark_results():
    global _latest_results
    if _latest_results is None:
        try:
            _latest_results = benchmark_service.run_benchmark(50)
        except (RuntimeError, ValueError) as exc:
            raise HTTPException(status_code=503, detail=str(exc))
    return _latest_results
