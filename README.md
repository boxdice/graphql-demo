# GraphQL Client Sync with Box and Dice

This example shows how to use the Box and Dice GraphQL API to sync data. It uses no GraphQL libraries or ORMs, just a minimal, demonstration-only approach, not intended for production.

## Setup

1. Copy `.env.example` to `.env` and update it with your values.
2. Ensure Docker is installed.
3. From the command line:
```
   $ docker compose build
   $ docker compose up
```
After syncing, you can use your favorite PostgreSQL client to explore the downloaded data. For example, connect with:
```
jdbc:postgresql://127.0.0.1:5433/graphql_demo
(user: docker, password: docker)
```

