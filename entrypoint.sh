#!/bin/sh
set -e

service postgresql start
sleep 5  # wait for PostgreSQL to start

# Recreate the database if the RESET_DATABASE environment variable is true
if [ "$RESET_DATABASE" = "true" ]; then
  echo "RESET_DATABASE enabled: Dropping and recreating graphql_demo database..."
  su - postgres -c "psql -c 'DROP DATABASE IF EXISTS graphql_demo;'" || true
  su - postgres -c "psql -c \"CREATE DATABASE graphql_demo WITH OWNER=docker;\""
fi

# Reset sync_state locks if the table exists
echo "Resetting sync_state locks..."
TABLE_EXISTS=$(su - postgres -c "psql -d graphql_demo -tc \"SELECT to_regclass('public.sync_state');\" | xargs")

if [ \"$TABLE_EXISTS\" = \"sync_state\" ]; then
  su - postgres -c "psql -d graphql_demo -c \"UPDATE sync_state SET locked_by = NULL, locked_at = NULL;\""
fi


npm install

: "${CONCURRENCY:=1}"

pids=""

for i in $(seq 1 "$CONCURRENCY"); do
  echo "Launching process $i..."
  PROCESS_NUM=$i npm run start &
  pids="$pids $!"
  sleep 5
done

trap 'kill -TERM $pids' TERM INT

wait 