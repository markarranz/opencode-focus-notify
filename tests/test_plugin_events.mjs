import assert from "node:assert/strict"
import test from "node:test"

import { plugin } from "../plugin.js"

const withEnv = async (overrides, run) => {
  const previous = new Map()

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  try {
    return await run()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

const collectPayloads = async (events, env = {}) => {
  return withEnv(env, async () => {
    const calls = []

    const $ = (strings, ...values) => ({
      nothrow: async () => {
        calls.push({ strings: [...strings], values })
      },
    })

    const instance = await plugin({ $ })

    for (const event of events) {
      await instance.event({ event })
    }

    return calls.map((call) => JSON.parse(call.values[1]))
  })
}

test("session.status idle object emits notification", async () => {
  const payloads = await collectPayloads([
    {
      type: "session.status",
      properties: {
        status: { type: "idle" },
        path: "/tmp/project",
        sessionID: "sess-1",
      },
    },
  ])

  assert.equal(payloads.length, 1)
  assert.equal(payloads[0].message, "Session complete")
  assert.equal(payloads[0].event_type, "session.status")
  assert.equal(payloads[0].session_path, "/tmp/project")
  assert.equal(payloads[0].session_id, "sess-1")
})

test("session.idle compatibility event still emits notification", async () => {
  const payloads = await collectPayloads([
    {
      type: "session.idle",
      properties: {
        path: "/tmp/project",
        sessionID: "sess-2",
      },
    },
  ])

  assert.equal(payloads.length, 1)
  assert.equal(payloads[0].message, "Session complete")
  assert.equal(payloads[0].event_type, "session.idle")
})

test("permission.asked emits notification by default", async () => {
  const payloads = await collectPayloads([
    {
      type: "permission.asked",
      properties: { sessionID: "sess-3" },
    },
  ])

  assert.equal(payloads.length, 1)
  assert.equal(payloads[0].message, "Permission requested")
  assert.equal(payloads[0].event_type, "permission.asked")
})

test("permission.replied does not emit by default", async () => {
  const payloads = await collectPayloads([
    {
      type: "permission.replied",
      properties: { sessionID: "sess-4" },
    },
  ])

  assert.equal(payloads.length, 0)
})

test("permission.replied emits when NOTIFY_PERMISSION_REPLIED=1", async () => {
  const payloads = await collectPayloads(
    [
      {
        type: "permission.replied",
        properties: { sessionID: "sess-5" },
      },
    ],
    { NOTIFY_PERMISSION_REPLIED: "1" },
  )

  assert.equal(payloads.length, 1)
  assert.equal(payloads[0].message, "Permission answered")
  assert.equal(payloads[0].event_type, "permission.replied")
})
