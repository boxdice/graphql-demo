# GraphQL Sync Demo

A simple demo showing how to use the Box and Dice GraphQL API to sync data.  No GraphQL libraries, no ORMs, no extras - just a barebones example focused on syncing.  It does not handle errors, include tests, or do rate limiting. In your own project you should consider using SDL (Schema Definition Language).

Once the syncing is complete, you can open the `data.db` file in your  favorite SQLite browser/editor to explore the downloaded data.

## Setup

1. Copy `.env.example` to `.env` and update it with your values.
2. Ensure Docker is installed.
3. From the command line:
```
   $ docker compose build
   $ docker compose up
```
