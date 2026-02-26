# Milestone 1: Simple Key-Value Store

## What You're Building

A key-value store that persists data to disk. You'll implement `Get`, `Put`, `Delete`, and a serialization layer that writes your data to a file and reads it back on startup.

When you're done, your program will:
- Store key-value pairs in memory
- Write them to disk in a binary format
- Reload data from disk when restarted — nothing is lost

This is a working database. Small, but real.

## Why This Matters

Every database you've ever used has a key-value layer underneath. PostgreSQL stores rows in pages — each page is fundamentally a mapping from a tuple ID to bytes. Redis *is* a key-value store. SQLite's B-tree maps keys to row data.

The KV store is the foundation everything else builds on. In the milestones that follow, you'll add a storage engine, B-tree indexing, a query parser, and transactions — but they all sit on top of what you build here.

## What You'll Learn

- **Byte-level I/O in Go** — reading and writing raw bytes, not just strings
- **Binary serialization** — designing a format that encodes length-prefixed data so you can parse it back reliably
- **File operations** — creating, writing, reading, and closing files using Go's `os` package
- **The gap between memory and disk** — why in-memory data structures need a persistence strategy

## How This Works

Your starter code has a complete CLI harness and `KVStore` struct. The `main()` function, constructor, and struct are done. You implement four things:

1. **`Put(key, value string)`** — store a key-value pair in the in-memory map and persist to disk
2. **`Get(key string) (string, bool)`** — retrieve a value by key
3. **`Delete(key string)`** — remove a key and persist the change
4. **`loadFromDisk()` / `saveToDisk()`** — serialize the full map to a binary file and deserialize it back

The acceptance criteria will guide you through these step by step. Start with `Put` and `Get` (pure in-memory), then add persistence.

## Serialization Hint

You need a format where you can tell where one key-value pair ends and the next begins. A common approach: write the *length* of each string before the string itself. Think about what `encoding/binary` gives you.

## Constraints

- **Language:** Go
- **No external dependencies** — standard library only
- **Single file** — everything lives in `main.go`
