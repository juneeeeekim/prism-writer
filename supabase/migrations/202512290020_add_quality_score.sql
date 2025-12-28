-- Add quality_score column to raft_dataset table
ALTER TABLE raft_dataset 
ADD COLUMN IF NOT EXISTS quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 5);
