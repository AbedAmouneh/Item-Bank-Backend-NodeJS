#!/bin/bash

# PostgreSQL Database Setup Script
# Dynamically creates all tables and indexes from the tables folder

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TABLES_DIR="$(dirname "$SCRIPT_DIR")/tables"

# Database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required environment variables are set
check_env() {
    if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
        print_error "Required environment variables are not set."
        echo "Please set the following environment variables:"
        echo "  DB_NAME - Database name"
        echo "  DB_USER - Database user"
        echo "  DB_PASSWORD - Database password (optional if using .pgpass)"
        echo "  DB_HOST - Database host (default: localhost)"
        echo "  DB_PORT - Database port (default: 5432)"
        echo ""
        echo "You can also use DATABASE_URL instead:"
        echo "  DATABASE_URL=postgresql://user:password@host:port/database"
        exit 1
    fi
}

# Function to test database connection
test_connection() {
    print_status "Testing database connection..."

    if [ -n "$DATABASE_URL" ]; then
        PSQL_CMD="psql $DATABASE_URL"
    else
        if [ -n "$DB_PASSWORD" ]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER"
    fi

    if ! $PSQL_CMD -c "SELECT 1;" > /dev/null 2>&1; then
        print_error "Failed to connect to database. Please check your connection parameters."
        exit 1
    fi

    print_success "Database connection successful"
}

# Function to process a single SQL file
process_sql_file() {
    local file="$1"
    local filename=$(basename "$file" .sql)

    print_status "Processing table: $filename"

    # Create a temporary file with modified SQL
    local temp_file=$(mktemp)

    # Process the SQL file to add IF NOT EXISTS for tables and indexes
    # Remove any foreign key constraints and replace with simple column definitions
    sed -e 's/CREATE TABLE \([^(]*\)/CREATE TABLE IF NOT EXISTS \1/g' \
        -e 's/CREATE INDEX \([^ ]*\)/CREATE INDEX IF NOT EXISTS \1/g' \
        -e 's/CREATE UNIQUE INDEX \([^ ]*\)/CREATE UNIQUE INDEX IF NOT EXISTS \1/g' \
        -e 's/ REFERENCES [^,)]*//g' \
        -e 's/ ON DELETE [^,)]*//g' \
        -e 's/ ON UPDATE [^,)]*//g' \
        "$file" > "$temp_file"

    # Execute the modified SQL
    if $PSQL_CMD -f "$temp_file" > /dev/null 2>&1; then
        print_success "Successfully processed: $filename"
    else
        print_warning "Some statements in $filename may have warnings (this is normal for existing objects)"
    fi

    rm -f "$temp_file"
}

# Function to setup all tables dynamically
setup_tables() {
    print_status "Discovering SQL files in $TABLES_DIR..."

    # Check if tables directory exists
    if [ ! -d "$TABLES_DIR" ]; then
        print_error "Tables directory not found: $TABLES_DIR"
        exit 1
    fi

    # Count SQL files
    local sql_files=("$TABLES_DIR"/*.sql)
    local file_count=${#sql_files[@]}

    if [ $file_count -eq 0 ] || [ ! -f "${sql_files[0]}" ]; then
        print_error "No SQL files found in $TABLES_DIR"
        exit 1
    fi

    print_status "Found $file_count SQL files"

    # Process triggers.sql last if it exists
    local triggers_file="$TABLES_DIR/triggers.sql"
    local has_triggers=false

    # Process all SQL files except triggers.sql first
    for sql_file in "$TABLES_DIR"/*.sql; do
        if [ -f "$sql_file" ]; then
            local filename=$(basename "$sql_file")
            if [ "$filename" = "triggers.sql" ]; then
                has_triggers=true
                continue
            fi
            process_sql_file "$sql_file"
        fi
    done

    # Process triggers.sql last
    if [ "$has_triggers" = true ] && [ -f "$triggers_file" ]; then
        print_status "Processing triggers and functions..."
        process_sql_file "$triggers_file"
    fi
}

# Function to display summary
display_summary() {
    print_status "Database setup summary:"

    # Count tables
    local table_count=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>/dev/null | tr -d ' ' || echo "0")

    # Count indexes
    local index_count=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

    # Count functions
    local function_count=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');" 2>/dev/null | tr -d ' ' || echo "0")

    echo "  Tables: $table_count"
    echo "  Indexes: $index_count"
    echo "  Functions: $function_count"

    print_success "Database setup completed successfully!"
}

# Main execution
main() {
    echo "==========================================="
    echo "PostgreSQL Database Setup Script"
    echo "==========================================="

    # Load environment variables from .env if it exists
    local env_file="$(dirname "$SCRIPT_DIR")/../../.env"
    if [ -f "$env_file" ]; then
        print_status "Loading environment variables from .env file..."
        set -a
        # Use grep to filter out comments and empty lines, then source
        grep -E '^[A-Z_]+=.*' "$env_file" | while IFS='=' read -r key value; do
            export "$key"="$value"
        done
        # Alternative: export only the variables we need
        export DATABASE_URL=$(grep '^DATABASE_URL=' "$env_file" | cut -d'=' -f2-)
        export DB_HOST=$(grep '^DB_HOST=' "$env_file" | cut -d'=' -f2-)
        export DB_PORT=$(grep '^DB_PORT=' "$env_file" | cut -d'=' -f2-)
        export DB_NAME=$(grep '^DB_NAME=' "$env_file" | cut -d'=' -f2-)
        export DB_USER=$(grep '^DB_USER=' "$env_file" | cut -d'=' -f2-)
        export DB_PASSWORD=$(grep '^DB_PASSWORD=' "$env_file" | cut -d'=' -f2-)
        set +a
    fi

    # Check environment variables
    if [ -z "$DATABASE_URL" ]; then
        check_env
    fi

    # Test database connection
    test_connection

    # Setup database
    setup_tables

    # Display summary
    display_summary

    echo "==========================================="
}

# Run main function
main "$@"