## High-level summary
One line was added and one was modified in `parallel-scheduler.ts`.  
The change refines how in-degrees are calculated during the DAG walk: **seeded parents are no longer treated as “already satisfied” when the parent node itself is *both* included in the execution set and flagged as `bypass === true`.**

## Tour of changes
Start with the body of `executeWorkflowParallel`, specifically the loop that builds `inDegree` (around the added comment).  
This is the only place that changed and is the key to understanding the behavioural difference: whether or not an incoming edge from a “seed” node should increase a child’s unsatisfied-dependency count.

## File level review

### `workflow/Core/engine/parallel-scheduler.ts`
Changes
1. Added explanatory comment.
2. Introduced `parentIsBypassIncluded` boolean:
      parent && includedIds.has(e.source) && (parent as any)?.data?.bypass === true
3. Re-wrote the `if` that decides whether to bump `inDegree`:
      old: if (!seedIds.has(e.source) && !parentDisabled)
      new: if ((!seedIds.has(e.source) || parentIsBypassIncluded) && !parentDisabled)

Correctness & behaviour
• Objective: when a node is *seeded* (already run) we usually skip its outgoing edges, but if that seeded node is also “included” and has `bypass: true`, it will still emit a “completion” event later; therefore the child must wait for it → the edge must count.  
The new logic achieves this:  
– seeded & NOT bypass: edge skipped (unchanged behaviour)  
– seeded & bypass: edge counted (new behaviour)  
– not seeded: edge counted (unchanged)  
– disabled: still skipped (unchanged).

Edge cases / potential issues
1. Type safety: `(parent as any)?.data?.bypass` breaks compile-time checking.  
   • Prefer a type-guard or extend the `NodeData` interface with an optional `bypass?: boolean`.
2. Performance: negligible—just one boolean eval per edge.
3. Logical coupling: `includedIds.has(e.source)` is required to avoid counting bypass nodes that are excluded. Good.
4. Comment consistency: update the earlier comment that still says “Treat seeded parents as satisfied” because that statement is now qualified; consider rewriting to avoid future confusion.

Security
No security impact.

Suggested improvements
• Replace `(parent as any)` with a safe accessor or proper typing.  
• Rewrite comments to match new truth table:  
  “Treat seeded parents as satisfied *unless* the seeded parent is both included and bypassed.”