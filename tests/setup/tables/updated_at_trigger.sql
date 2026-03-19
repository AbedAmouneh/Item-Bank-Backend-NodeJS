-- Function that sets updated_at to the current time on every UPDATE.
-- Tables with a created_at/updated_at pair use this instead of the
-- legacy set_timestamps() function (which targets _on columns).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to users
DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to item_banks
DROP TRIGGER IF EXISTS item_banks_set_updated_at ON item_banks;
CREATE TRIGGER item_banks_set_updated_at
BEFORE UPDATE ON item_banks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to questions
DROP TRIGGER IF EXISTS questions_set_updated_at ON questions;
CREATE TRIGGER questions_set_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
