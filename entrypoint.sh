#!/bin/sh
set -e

service postgresql start
sleep 5  # wait for PostgreSQL to start

if [ "$RESET_DATABASE" = "true" ]; then
  echo "RESET_DATABASE enabled: Dropping and recreating graphql_demo database..."
  su - postgres -c "psql -c 'DROP DATABASE IF EXISTS graphql_demo;'" || true
  su - postgres -c "psql -c \"CREATE DATABASE graphql_demo WITH OWNER=docker;\""
fi

npm install

: "${CONCURRENCY:=1}"

pids=""

for i in $(seq 1 "$CONCURRENCY"); do
  echo "Launching process $i..."
  PROCESS_NUM=$i npm run start &
  pids="$pids $!"
  sleep 2
done

trap 'kill -TERM $pids' TERM INT

wait 