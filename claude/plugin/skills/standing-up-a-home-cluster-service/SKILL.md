---
name: standing-up-a-home-cluster-service
description: Use when adding a service to the home cluster, deploying a household app or prototype, choosing where a service's data lives, moving a service between tiers, or writing healthchecks for anything running on the cluster.
---

# Standing Up a Home Cluster Service

**The cluster's tier model already tells you where things run. What goes wrong is everything around that decision:** guessing at requirements instead of asking, writing healthchecks nobody ever watched fail, and changing the platform while pretending to add a service.

Tier definitions live in `~/workspace/homelab/docs/superpowers/specs/` — that spec is the source of truth for what Tier P/H/O mean and what the governing rules are. Read it. This skill covers the decisions the spec doesn't make for you.

## Step 1: Fill in the brief. Do not skip to a recommendation.

**You MUST produce this table, filled, before proposing any placement.** Every row you can't fill from what the user told you is a question you ask. Answering it yourself is guessing, and a guess written into a table reads as a decision three months later.

| Field | Why it decides something |
|---|---|
| **Who reaches it, from where** | Household-from-abroad forces Tier P and the family plane. Only-you-at-home permits Tier H. |
| **What breaks if it's down for a day** | This is the tier test. "Nothing" is a valid and common answer — take it seriously rather than over-provisioning. |
| **Data owner: this service, or the household?** | Decides the datastore. See Step 2. |
| **Data size now, and in a year** | Kilobytes of text and 200GB of photos are not the same storage problem. |
| **Does anything else need to query this data?** | If yes, it's canonical and needs a server. If no, it doesn't. |
| **Interactive or asynchronous?** | Async work goes through NATS. Interactive work needs a synchronous path and a latency budget. |
| **Is losing the last hour of writes acceptable?** | Decides whether continuous replication is required or a nightly dump suffices. |
| **Off-the-shelf or ours?** | Off-the-shelf brings its own healthcheck endpoints and auth model, and may fight oauth2-proxy. Ours means we define the contract in Step 3. |

Ask them all at once. Don't interview one question at a time.

## Step 2: Datastore follows data ownership, not service size

| The data is… | Store | Backup |
|---|---|---|
| Read and written only by this service | **SQLite** on a host volume | Litestream → object store, continuous |
| Queried by other services; household-canonical | **Postgres**, the shared instance in the service's tier | Whatever that instance already does |
| Bulk blobs — photos, media, archives | **Object store**, or NFS off the NAS | Per tier policy in the spec |

**Default to SQLite.** A service that owns its data has no business in a shared server: it costs you isolation and buys nothing. Postgres is for data that is genuinely canonical — several services must read it, and it must stay consistent across them.

**The trap:** choosing SQLite everywhere, then discovering three services need to join across their private databases and building a sync layer to paper over it. That's worse than either option. So the question in Step 1 is not "how big is the data" but "who reads it" — and the answer decides this row.

**Object stores need local block storage.** Never back MinIO or Garage with NFS.

## Step 3: The healthcheck contract

A healthcheck is not a probe stanza. It's a contract the service must satisfy, and **if the service doesn't expose these yet, adding them is part of this work** — not an assumption you write a probe against.

| Endpoint | Asserts | Must NOT |
|---|---|---|
| `/healthz` | The process is alive and serving | Touch the database, the network, or any dependency |
| `/readyz` | Dependencies are reachable — `SELECT 1`, object store HEAD, queue connection | Do expensive work; it runs every few seconds |

Liveness that checks dependencies turns a transient database blip into a crash loop. Readiness that checks nothing lets a broken service stay in rotation. Getting these backwards is the single most common failure here.

**Behind the family plane, carve out an unauthenticated path for `/healthz`.** An external check hitting an authenticated URL proves only that the login redirect works — it returns healthy while the service is entirely broken.

**Storage that can hang needs a bounded check.** A `stat` on a stale NFS mount blocks in uninterruptible sleep and never fails a normal probe. Wrap it: `timeout 10 stat <sentinel>`.

## Step 4: Watch it fail. Then watch it recover.

**A healthcheck you haven't seen go red is not a healthcheck. It's a guess with YAML syntax.**

Before this service is done:

1. Break the dependency deliberately — stop the database, unmount the share, scale the backend to zero.
2. **Observe** readiness flip red and the service leave rotation.
3. If it should alert, **observe the alert arrive** on the device it's supposed to reach.
4. Restore the dependency. **Observe** recovery without a manual kick.

Record what you observed. "Configured and should work" is not a result.

**No exceptions:**
- Not for "it's the same probe as the last service"
- Not for "the endpoint obviously returns 200"
- Not for off-the-shelf apps whose docs state the path — docs drift, versions change
- A green probe at deploy time proves the happy path only. It says nothing about whether failure is detected.

## Step 5: Platform changes are separate work

If standing up this service requires something the platform doesn't have yet — an object store, a Postgres instance, a backup destination, a new node — **stop and surface it as its own decision.**

Do not resolve a known platform gap as a side effect of adding a service. Standing up MinIO to back up a meal planner is a platform change that alters the cluster's dependency graph, and it deserves the scrutiny that implies rather than arriving inside a pull request about recipes.

Name the gap, say what it blocks, and let it be decided on its own terms.

## Red flags — stop and go back

- You proposed a tier before filling in Step 1's table
- You answered a Step 1 row yourself because it "seemed obvious"
- You wrote a probe against an endpoint you haven't confirmed exists
- You reached for Postgres without asking who reads the data
- You're about to say a healthcheck works without having seen it fail
- Adding this service quietly requires new infrastructure

## Job specification

**SLOT — not yet written.** The orchestrator is undecided: the spec says k3s, and the current direction is Nomad. No job spec belongs here until the cluster exists and a real service has been deployed through it, because the first one written from imagination would be wrong in ways nobody would catch.

Fill this section from the first service actually deployed, using what ran — not what should have.
