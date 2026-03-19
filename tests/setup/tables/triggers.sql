-- Create the timestamp trigger function
CREATE OR REPLACE FUNCTION set_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only set created_on if the column exists
    BEGIN
      NEW.created_on := NOW();
    EXCEPTION
      WHEN undefined_column THEN
        NULL; -- Ignore if column doesn't exist
    END;

    -- Only set created_at if the column exists
    BEGIN
      NEW.created_at := NOW();
    EXCEPTION
      WHEN undefined_column THEN
        NULL; -- Ignore if column doesn't exist
    END;

    -- Only set updated_on if the column exists
    BEGIN
      NEW.updated_on := NOW();
    EXCEPTION
      WHEN undefined_column THEN
        NULL; -- Ignore if column doesn't exist
    END;

    -- Only set updated_at if the column exists
    BEGIN
      NEW.updated_at := NOW();
    EXCEPTION
      WHEN undefined_column THEN
        NULL; -- Ignore if column doesn't exist
    END;
  ELSE
    -- Only set updated_on if the column exists
    BEGIN
      NEW.updated_on := NOW();
    EXCEPTION
      WHEN undefined_column THEN
        NULL; -- Ignore if column doesn't exist
    END;

    -- Only set updated_at if the column exists
    BEGIN
      NEW.updated_at := NOW();
    EXCEPTION
      WHEN undefined_column THEN
        NULL; -- Ignore if column doesn't exist
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate function to avoid parameter name conflicts
DROP FUNCTION IF EXISTS add_timestamp_trigger_to_table(text);

-- Function to add timestamp trigger to a table
CREATE FUNCTION add_timestamp_trigger_to_table(target_table_name text)
RETURNS void AS $$
BEGIN
    -- Check if table has timestamp columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = target_table_name
        AND column_name IN ('created_on', 'updated_on', 'created_at', 'updated_at')
    ) THEN
        -- Drop trigger if it already exists
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', target_table_name || '_timestamps', target_table_name);

        -- Create the trigger
        EXECUTE format('
            CREATE TRIGGER %I
            BEFORE INSERT OR UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION set_timestamps();
        ', target_table_name || '_timestamps', target_table_name);

        RAISE NOTICE 'Created timestamp trigger for table: %', target_table_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply the timestamp trigger to all existing tables that have created_on/updated_on columns
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = tablename
            AND column_name IN ('created_on', 'updated_on', 'created_at', 'updated_at')
        )
    LOOP
        PERFORM add_timestamp_trigger_to_table(r.tablename);
    END LOOP;
END;
$$;

-- Function to automatically add timestamp triggers to new tables
CREATE OR REPLACE FUNCTION auto_add_timestamp_trigger()
RETURNS event_trigger AS $$
DECLARE
    obj record;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE object_type = 'table'
    LOOP
        -- Add timestamp trigger to the new table
        PERFORM add_timestamp_trigger_to_table(obj.object_identity);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create event trigger to automatically add timestamp triggers to new tables
DROP EVENT TRIGGER IF EXISTS auto_timestamp_trigger;
CREATE EVENT TRIGGER auto_timestamp_trigger
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION auto_add_timestamp_trigger();