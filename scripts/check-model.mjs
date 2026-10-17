/* eslint-disable @typescript-eslint/explicit-function-return-type -- Node 原生执行的 JavaScript 验证脚本。 */
// 只模拟模型 HTTP 响应；不读取用户配置、API Key，不调用真实模型或 REA。
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const directory = await mkdtemp(join(tmpdir(), 'rea-model-check-'))
const originalFetch = globalThis.fetch
const evidenceId = 'ev_' + 'a'.repeat(64)
try {
  const outfile = join(directory, 'model.mjs')
  await build({
    entryPoints: [resolve('src/main/model.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    plugins: [
      {
        name: 'isolate-model',
        setup(builder) {
          builder.onResolve({ filter: /^\.\/(storage|rea)$/ }, ({ path }) => ({
            path,
            namespace: 'mock'
          }))
          builder.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({
            contents:
              path === './storage'
                ? 'export async function modelConfiguration() { return globalThis.__reaModelTestConfig }'
                : 'export function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {} }'
          }))
        }
      }
    ]
  })
  const { answerQuestion } = await import(pathToFileURL(outfile).href)
  const task = () => ({
    target: { name: 'sample.asar', format: 'asar', family: 'javascript' },
    parentEvidenceId: evidenceId,
    summary: {},
    evidence: [],
    analysisScope: {
      mode: 'architecture',
      totalFiles: 41984,
      selectedFiles: 24,
      missingUnpackedCount: 195,
      limitations: ['仅解析24个入口；字节码不可还原。']
    },
    messages: [
      { id: 'question-1', role: 'user', content: '说明主进程、preload 与渲染进程的关系。' }
    ]
  })
  const text = (protocol, content, limited = false) =>
    protocol === 'anthropic'
      ? {
          stop_reason: limited ? 'max_tokens' : 'end_turn',
          content: [{ type: 'text', text: content }]
        }
      : protocol === 'responses'
        ? {
            status: limited ? 'incomplete' : 'completed',
            incomplete_details: limited ? { reason: 'max_output_tokens' } : null,
            output: [
              {
                type: 'message',
                status: limited ? 'incomplete' : 'completed',
                role: 'assistant',
                content: [{ type: 'output_text', text: content }]
              }
            ]
          }
        : {
            choices: [
              {
                finish_reason: limited ? 'length' : 'stop',
                message: { role: 'assistant', content }
              }
            ]
          }
  const tool = (protocol, limited = false) =>
    protocol === 'anthropic'
      ? {
          stop_reason: limited ? 'max_tokens' : 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'call-1',
              name: 'list_modules',
              input: limited ? undefined : { limit: 8 }
            }
          ]
        }
      : protocol === 'responses'
        ? {
            status: limited ? 'incomplete' : 'completed',
            incomplete_details: limited ? { reason: 'max_output_tokens' } : null,
            output: [
              {
                type: 'function_call',
                call_id: 'call-1',
                name: 'list_modules',
                arguments: limited ? '{"limit":' : '{"limit":8}',
                status: limited ? 'incomplete' : 'completed'
              }
            ]
          }
        : {
            choices: [
              {
                finish_reason: limited ? 'length' : 'tool_calls',
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call-1',
                      type: 'function',
                      function: {
                        name: 'list_modules',
                        arguments: limited ? '{"limit":' : '{"limit":8}'
                      }
                    }
                  ]
                }
              }
            ]
          }
  function setup(protocol, handlers, overrides = {}) {
    globalThis.__reaModelTestConfig = {
      protocol,
      model: 'test-model',
      baseUrl: 'https://model.invalid/v1',
      apiKey: ''
    }
    const requests = []
    const saved = []
    const executed = []
    const labels = []
    globalThis.fetch = async (_url, init) => {
      init.signal.throwIfAborted()
      const body = JSON.parse(init.body)
      requests.push(body)
      const handler = handlers.shift()
      assert.ok(handler, '出现了非预期的额外模型请求')
      const result = typeof handler === 'function' ? await handler(body) : handler
      return result instanceof Response ? result : Response.json(result)
    }
    const options = {
      task: task(),
      catalog: [],
      available: new Set(['inspect_analysis_view']),
      signal: new AbortController().signal,
      execute: async (name, args) => {
        executed.push({ name, args })
        return { evidence_id: evidenceId, modules: [] }
      },
      progress: (label) => labels.push(label),
      checkpoint: async (state) => saved.push(structuredClone(state)),
      ...overrides
    }
    return { run: () => answerQuestion(options), requests, saved, executed, labels, options }
  }
  let passed = 0
  for (const protocol of ['chat-completions', 'anthropic', 'responses']) {
    const check = setup(protocol, [
      text(protocol, '主进程负责应用生命周期。', true),
      text(protocol, 'preload 提供 IPC 桥接，渲染进程负责界面。')
    ])
    const answer = await check.run()
    assert.match(answer, /主进程负责/)
    assert.match(answer, /preload 提供/)
    assert.equal(check.requests.length, 2)
    assert.match(JSON.stringify(check.requests[1]), /从断点继续/)
    assert.equal(check.saved.at(-1).finished, true)
    passed++
    console.log(`✓ ${protocol} 截断后保留文本并自动续写`)

    const calls = setup(protocol, [
      tool(protocol, true),
      tool(protocol),
      text(protocol, '依据模块证据完成分析。')
    ])
    await calls.run()
    assert.equal(calls.executed.length, 1)
    assert.equal(
      calls.saved.some((state) =>
        state.messages.some(
          (message) => message.tool_calls?.[0]?.function.arguments === '{"limit":'
        )
      ),
      false
    )
    const budgetKey = protocol === 'responses' ? 'max_output_tokens' : 'max_tokens'
    assert.ok(calls.requests[1][budgetKey] > calls.requests[0][budgetKey])
    passed++
    console.log(`✓ ${protocol} 残缺工具调用重试后仅执行完整调用一次`)
  }

  const recovery = setup('chat-completions', [
    text('chat-completions', '已经确认主进程入口。', true),
    () => {
      throw new Error('模拟断网')
    }
  ])
  await assert.rejects(recovery.run(), /模拟断网/)
  const resumed = setup('chat-completions', [text('chat-completions', '接下来说明渲染入口。')], {
    resume: recovery.saved.at(-1)
  })
  assert.match(await resumed.run(), /已经确认主进程入口。[\s\S]*接下来说明渲染入口/)
  assert.equal(resumed.executed.length, 0)
  assert.match(resumed.labels.join(), /恢复上次调查/)
  passed++
  console.log('✓ 网络中断后恢复已保存的回答与续写位置')

  const big = task()
  big.messages.unshift({
    id: 'old',
    role: 'assistant',
    content: '历史调查内容'.repeat(6000) + evidenceId
  })
  const compact = setup(
    'chat-completions',
    [
      text('chat-completions', '已确认入口，尚需查询 IPC。'),
      text('chat-completions', '完成当前架构问题。')
    ],
    { task: big }
  )
  await compact.run()
  const compacted = JSON.stringify(compact.requests.at(-1))
  assert.ok(compacted.length < 15000)
  assert.match(compacted, /说明主进程、preload/)
  assert.match(compacted, /字节码不可还原/)
  assert.match(compacted, new RegExp(evidenceId))
  assert.match(compact.labels.join(), /压缩上下文/)
  passed++
  console.log('✓ 主动压缩保留原问题、范围限制与证据ID')

  const overflow = setup('anthropic', [
    new Response('{"error":{"message":"prompt is too long"}}', { status: 400 }),
    text('anthropic', '调查摘要。'),
    text('anthropic', '压缩后完成。')
  ])
  assert.equal(await overflow.run(), '压缩后完成。')
  assert.match(overflow.labels.join(), /自动重试/)
  passed++
  console.log('✓ 服务端上下文超限后压缩并自动重试')

  const repeat = setup('chat-completions', [
    text('chat-completions', '重复的同一段内容', true),
    text('chat-completions', '重复的同一段内容', true)
  ])
  await assert.rejects(repeat.run(), /未产生新内容/)
  assert.equal(repeat.saved.at(-1).answer, '重复的同一段内容')
  passed++
  console.log('✓ 重复续写停止并保留已有内容')

  const filtered = setup('responses', [
    { status: 'incomplete', incomplete_details: { reason: 'content_filter' }, output: [] }
  ])
  await assert.rejects(filtered.run(), /content_filter/)
  assert.equal(filtered.requests.length, 1)
  passed++
  console.log('✓ 内容过滤不会被误判为长度限制自动重试')

  const controller = new AbortController()
  const cancelled = setup('anthropic', [text('anthropic', '可恢复的部分报告。', true)], {
    signal: controller.signal,
    checkpoint: async (state) => {
      if (state.answer) controller.abort()
    }
  })
  await assert.rejects(cancelled.run(), { name: 'AbortError' })
  assert.equal(cancelled.requests.length, 1)
  passed++
  console.log('✓ 用户取消后立即停止续写')

  const long = setup('chat-completions', [
    ...Array.from({ length: 13 }, () => tool('chat-completions')),
    text('chat-completions', '已完成13轮调查。')
  ])
  assert.equal(await long.run(), '已完成13轮调查。')
  assert.equal(long.executed.length, 13)
  passed++
  console.log('✓ 长任务可继续超过原来的12轮查询限制')

  const thinking = setup('responses', [
    {
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [{ type: 'reasoning', summary: [] }]
    },
    text('responses', '提高预算后完成回答。')
  ])
  assert.equal(await thinking.run(), '提高预算后完成回答。')
  assert.equal(thinking.requests[1].max_output_tokens, thinking.requests[0].max_output_tokens * 2)
  passed++
  console.log('✓ 仅推理耗尽预算时提高输出额度重试')
  console.log(`${passed} 项模型循环验证通过（无真实 API 调用）。`)
} finally {
  globalThis.fetch = originalFetch
  delete globalThis.__reaModelTestConfig
  await rm(directory, { recursive: true, force: true })
}
