"""
Synthetix – FastAPI Application
Duplicate Defect Finder & Bug Report Enhancer.
"""
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.routers import analyze, ingest, clusters
from backend.utils.logger import setup_logging, get_logger

log = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    setup_logging()
    log.info("🚀 Synthetix is starting up...")
    log.info(f"   Embedding model: {settings.EMBEDDING_MODEL}")
    log.info(f"   Vector DB: ChromaDB at {settings.CHROMA_DIR}")
    log.info(f"   Duplicate threshold: {settings.DUPLICATE_THRESHOLD}")
    log.info(f"   Possible duplicate threshold: {settings.POSSIBLE_DUPLICATE_THRESHOLD}")
    yield
    log.info("👋 Synthetix is shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description=(
        "**Synthetix** detects duplicate defect reports, assigns cluster IDs, "
        "suggests missing fields, and generates enhanced bug report summaries.\n\n"
        "Powered by HuggingFace Transformers, ChromaDB, and DBSCAN clustering."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    """Add X-Process-Time header to every response."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    response.headers["X-Process-Time"] = f"{elapsed:.4f}s"
    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler."""
    log.error(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred.",
        },
    )


# Register routers
app.include_router(analyze.router, prefix=settings.API_PREFIX, tags=["Analysis"])
app.include_router(ingest.router, prefix=settings.API_PREFIX, tags=["Ingestion"])
app.include_router(clusters.router, prefix=settings.API_PREFIX, tags=["Clustering"])


# Service metadata (kept under /api so the SPA can own "/")
@app.get("/api", tags=["Root"])
async def service_info():
    """Service metadata endpoint."""
    return {
        "service": "Synthetix",
        "description": "Duplicate Defect Finder & Bug Report Enhancer",
        "version": settings.API_VERSION,
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health",
    }


# Serve the built React SPA (frontend/dist) at "/" when present.
# In dev, run Vite separately (it proxies /api here); this mount is skipped.
_FRONTEND_DIST = settings.PROJECT_ROOT / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="spa")
    log.info(f"Serving SPA from {_FRONTEND_DIST}")
else:
    @app.get("/", tags=["Root"])
    async def root():
        """Fallback root when the SPA has not been built."""
        return {
            "service": "Synthetix",
            "message": "Frontend not built. Run `npm run build` in ./frontend, or use the Vite dev server.",
            "docs": "/docs",
            "health": f"{settings.API_PREFIX}/health",
        }
