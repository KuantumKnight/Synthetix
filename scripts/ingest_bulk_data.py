import os
import sys
import pandas as pd
from loguru import logger
import argparse
import time

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.models.defect import DefectReport
from backend.services.preprocessor import TextNormalizer
from backend.services.embedder import EmbeddingService
from backend.services.vector_store import VectorStore

embedder_service = EmbeddingService()

def ingest_file(file_path, vector_store, limit=1000):
    logger.info(f"Processing {file_path}")
    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        logger.error(f"Failed to read {file_path}: {e}")
        return 0

    # Ensure required columns exist, mapping Common GitBugs/Bugzilla columns
    if 'Issue id' in df.columns:
        df = df.rename(columns={"Issue id": "defect_id", "Summary": "title", "Description": "description"})
    elif 'Bug ID' in df.columns:
         df = df.rename(columns={"Bug ID": "defect_id", "Summary": "title"})
         if 'Description' not in df.columns:
             df['description'] = ""
    
    # Just generic columns check
    if 'defect_id' not in df.columns or 'title' not in df.columns:
        logger.warning(f"Skipping {file_path} - missing defect_id or title columns. Available: {df.columns.tolist()}")
        return 0

    # Drop nulls and limit
    df = df.dropna(subset=['defect_id', 'title'])
    
    # Optional sample limiting for speed on large datasets
    if limit and len(df) > limit:
        logger.info(f"Limiting to randomly sampled {limit} records from {len(df)}")
        df = df.sample(n=limit, random_state=42)

    df['defect_id'] = df['defect_id'].astype(int, errors='ignore').astype(str)
    
    reports = []
    # Identify environment context from filename
    env = os.path.basename(file_path).split('_')[0].lower()
    
    for _, row in df.iterrows():
        try:
            report = DefectReport(
                defect_id=f"{env}_{row['defect_id']}",
                title=str(row['title'])[:200], # Cap length to avoid token limits
                description=str(row.get('description', ''))[:1000] if not pd.isna(row.get('description')) else "",
                steps=None,
                expected=None,
                actual=None,
                environment=env,
                logs=None
            )
            reports.append(report)
        except Exception as e:
            pass
            
    # Process in chunks
    chunk_size = 500
    total_processed = 0
    
    for i in range(0, len(reports), chunk_size):
        chunk = reports[i:i+chunk_size]
        
        processed_texts = []
        valid_reports = []
        for report in chunk:
            processed_text = TextNormalizer.combine_fields(
                title=report.title,
                description=report.description,
                steps=report.steps,
                expected=report.expected,
                actual=report.actual
            )
            if processed_text and len(processed_text.strip()) > 10:
                processed_texts.append(processed_text)
                valid_reports.append(report)
        
        if not valid_reports:
            continue
            
        logger.info(f"Generating embeddings for {len(valid_reports)} reports...")
        try:
            embeddings = embedder_service.generate_embeddings(processed_texts)
            
            ids = [r.defect_id for r in valid_reports]
            metadatas = [{"environment": r.environment} for r in valid_reports]
            
            vector_store.add_defects(
                ids=ids,
                embeddings=embeddings,
                documents=processed_texts,
                metadatas=metadatas
            )
            
            total_processed += len(valid_reports)
        except Exception as e:
            logger.error(f"Error during embedding/storage: {e}")
            
    logger.info(f"Successfully ingested {total_processed} defects from {os.path.basename(file_path)}.")
    return total_processed

def main():
    parser = argparse.ArgumentParser(description="Bulk Dataset Ingestion")
    parser.add_argument("--limit", type=int, default=1000, help="Max rows per file to ingest (0 for all)")
    args = parser.parse_args()
    
    vector_store = VectorStore()
    
    data_dirs = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "bugzilla")
    ]
    
    total_ingested = 0
    start_time = time.time()
    
    for d in data_dirs:
        if not os.path.exists(d):
            logger.warning(f"Directory {d} does not exist. Skipping.")
            continue
            
        logger.info(f"Scanning directory: {d}")
        for root, _, files in os.walk(d):
            for file in files:
                if file.endswith('.csv') and not "combined" in file.lower():
                    # Process main dataset files (ignore -combined relationship files)
                    file_path = os.path.join(root, file)
                    total_ingested += ingest_file(file_path, vector_store, limit=args.limit if args.limit > 0 else None)
                    
    duration = time.time() - start_time
    logger.info(f"=== BULK INGESTION COMPLETE ===")
    logger.info(f"Total defects ingested: {total_ingested}")
    logger.info(f"Total time elapsed: {duration:.2f} seconds")
    
if __name__ == "__main__":
    main()
