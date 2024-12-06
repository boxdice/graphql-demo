# GraphQL Sync Demo

A simple demo showing how to sync data using the Box and Dice GraphQL API.  
No libraries, no ORMs, no extras - just a barebones example focused on syncing.  
It does not handle errors, include tests, or do rate limiting.

In your project you should consider using SDL (Schema Definition Language) and a
code-first or schema-first approach, depending on your preference.

Once the syncing is complete, you can open the `data.db` file in your  
favorite SQLite browser/editor to explore the downloaded data.

## Setup

1. Copy `.env.example` to `.env` and update it with your values.
2. Ensure Docker is installed.
3. From the command line:
```
   $ docker compose build
   $ docker compose up
```
