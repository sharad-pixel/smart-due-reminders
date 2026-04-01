ALTER TABLE ingestion_audit_log DROP CONSTRAINT ingestion_audit_log_scanned_file_id_fkey;
ALTER TABLE ingestion_audit_log ADD CONSTRAINT ingestion_audit_log_scanned_file_id_fkey 
  FOREIGN KEY (scanned_file_id) REFERENCES ingestion_scanned_files(id) ON DELETE CASCADE;

ALTER TABLE ingestion_audit_log DROP CONSTRAINT ingestion_audit_log_review_item_id_fkey;
ALTER TABLE ingestion_audit_log ADD CONSTRAINT ingestion_audit_log_review_item_id_fkey 
  FOREIGN KEY (review_item_id) REFERENCES ingestion_review_queue(id) ON DELETE CASCADE;

DELETE FROM drive_connections
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM drive_connections
  ORDER BY user_id, created_at DESC
);

ALTER TABLE drive_connections ADD CONSTRAINT drive_connections_user_id_unique UNIQUE (user_id);