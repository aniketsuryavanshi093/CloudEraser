# Real-Time Synchronization Algorithm

## Current architecture

The application uses Socket.IO for authenticated transport and ShareDB with the `json0` operational-transformation type for shared board state.

```text
Fabric.js client
   | local JSON0 operation
   v
Socket.IO server
   | validate board membership
   v
ShareDB document (boards/<boardId>)
   | transform against concurrent operations
   v
ShareDB op event -> all clients in the board room
```

## Why synchronization is needed

A normal request/response flow requires a refresh or polling. In a collaborative board, two users can edit the same logical state while their network messages are in flight. The server therefore needs one authoritative document version and a rule for transforming operations that arrive concurrently.

## Operational Transformation

An operation describes a change relative to a document version. For JSON0, an operation can set, insert, delete, or replace a value at a JSON path. ShareDB maintains the document version and transforms an incoming operation against operations already accepted at later versions.

Conceptually:

```text
client A has version 4 and submits A
client B has version 4 and submits B
server accepts A -> version 5
server transforms B against A -> B'
server applies B' -> version 6
```

Clients eventually receive both committed operations in the same order and reach the same document state.

## `transform(op1, op2, side)`

The OT type exposes a transform function. It receives two operations that were created against the same base version and returns an equivalent operation that can be applied after the other operation. `side` is a deterministic tie-breaker for operations affecting the same path. The transform must preserve intent as far as the data type allows and must be deterministic on every node.

ShareDB owns this operation-type implementation; application code submits JSON0 operations instead of implementing transform logic itself.

## Version and acknowledgement flow

1. The client loads `board-snapshot` and records the ShareDB version.
2. A local canvas change is converted into a JSON0 operation.
3. The client sends the operation with its local version and a unique operation ID.
4. The server verifies the socket's board membership.
5. ShareDB accepts, rejects, or transforms the operation.
6. ShareDB emits the committed operation and increments the document version.
7. The client applies remote operations silently and acknowledges its local operation.
8. If an operation is rejected or the client detects a version gap, it reloads the snapshot and resynchronizes.

In production, the client should keep a pending queue and retry only after a resync or a transient transport failure. It must never blindly apply the same operation twice; operation IDs are used for deduplication at the application boundary.

## Conflict example

Initial state:

```json
{ "objects": { "shape-1": { "left": 10, "top": 10 } } }
```

Both clients read version 7.

- Alice moves `shape-1.left` to `100`.
- Bob moves `shape-1.top` to `200`.

The operations touch different JSON paths, so both can be applied:

```text
version 7 + Alice op -> version 8
version 8 + transformed Bob op -> version 9
```

Both clients converge to:

```json
{ "objects": { "shape-1": { "left": 100, "top": 200 } } }
```

If both users replace the same property, JSON0 applies its deterministic transform/tie-breaking rules. The application should communicate last-writer semantics for such cases, or use field-level operations when preserving both intents matters.

## OT versus CRDT

| Property | OT (ShareDB) | CRDT (for example Yjs) |
|---|---|---|
| Coordination | Central versioned operation stream | Concurrent replicas with merge metadata |
| Server role | Usually authoritative for ordering | Can be relay or persistence provider |
| Learning focus | Transform, compose, versions, acknowledgements | Causal ordering, tombstones, vector/state clocks |
| Fit for this phase | Explicitly demonstrates OT algorithms | Good future alternative for offline-first editing |
| Complexity | Requires correct pending/retry handling | Requires managing CRDT document growth and encoding |

## Important implementation boundary

Socket.IO provides delivery and rooms; it does not resolve conflicts. ShareDB provides the operation log, versioning, and JSON0 transformation. PostgreSQL snapshots provide durable cold-start state. These are separate responsibilities.
