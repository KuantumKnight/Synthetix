"""
Synthetix – POST /api/ingest
Bulk defect dataset ingestion endpoint.
"""
import csv
import json
import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.models.defect import DefectReport, IngestResponse
from backend.services.preprocessor import TextNormalizer
from backend.services.embedder import EmbeddingService
from backend.services.vector_store import VectorStore
from backend.services.clusterer import ClusteringService
from backend.utils.logger import get_logger
from backend.utils.exceptions import SynthetixException, handle_synthetix_error

log = get_logger("router.ingest")
router = APIRouter()


@router.post(
    "/ingest",
    response_model=IngestResponse,
    summary="Ingest defect dataset",
    description="Upload a CSV or JSON file containing defect reports for bulk ingestion.",
)
async def ingest_dataset(file: UploadFile = File(...)) -> IngestResponse:
    """
    Ingest a batch of defect reports:
    1. Parse CSV/JSON file
    2. Normalize text
    3. Generate embeddings
    4. Store in vector database
    5. Run clustering
    """
    try:
        log.info(f"📥 Ingesting dataset: {file.filename}")

        # Read file content
        content = await file.read()
        content_str = content.decode("utf-8")

        # Parse based on file type
        if file.filename and file.filename.endswith(".json"):
            records = _parse_json(content_str)
        elif file.filename and file.filename.endswith(".csv"):
            records = _parse_csv(content_str)
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Use CSV or JSON.",
            )

        if not records:
            raise HTTPException(status_code=400, detail="No valid records found in file.")

        log.info(f"Parsed {len(records)} defect records")

        # Normalize and embed
        normalizer = TextNormalizer()
        embedder = EmbeddingService()
        vector_store = VectorStore()

        ids = []
        documents = []
        metadatas = []
        skipped = 0

        for record in records:
            defect_id = record.get("defect_id", "").strip()
            title = record.get("title", "").strip()
            description = record.get("description", "").strip()

            if not defect_id or not title:
                skipped += 1
                continue

            combined = normalizer.combine_fields(
                title=title,
                description=description,
                steps=record.get("steps"),
                expected=record.get("expected"),
                actual=record.get("actual"),
            )

            ids.append(defect_id)
            documents.append(combined)
            metadatas.append({
                "title": title,
                "description": description[:200],
                "environment": record.get("environment", ""),
                "cluster_id": -1,
            })

        if not ids:
            raise HTTPException(status_code=400, detail="No valid defect records after parsing.")

        # Generate embeddings in batch
        embeddings = embedder.encode_batch(documents)

        # Store in vector DB
        added = vector_store.add_defects(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

        # Run clustering
        clusterer = ClusteringService()
        cluster_result = clusterer.run_clustering()

        result = IngestResponse(
            total_ingested=added,
            total_skipped=skipped,
            clusters_formed=cluster_result["total_clusters"],
            message=f"Successfully ingested {added} defects into {cluster_result['total_clusters']} clusters.",
        )

        log.info(f"✅ Ingestion complete: {result.message}")
        return result

    except SynthetixException as e:
        raise handle_synthetix_error(e)
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _parse_csv(content: str) -> list[dict]:
    """Parse CSV content into list of dicts."""
    reader = csv.DictReader(io.StringIO(content))
    records = []
    for row in reader:
        records.append({k.strip().lower(): v.strip() if v else "" for k, v in row.items()})
    return records


def _parse_json(content: str) -> list[dict]:
    """Parse JSON content into list of dicts."""
    data = json.loads(content)
    if isinstance(data, list):
        return data
    elif isinstance(data, dict):
        # Could be {defects: [...]} or single record
        if "defects" in data:
            return data["defects"]
        return [data]
    return []
