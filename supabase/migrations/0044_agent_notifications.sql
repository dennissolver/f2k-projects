-- Add notification preferences to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS notify_new_client BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_status_change BOOLEAN DEFAULT true;
