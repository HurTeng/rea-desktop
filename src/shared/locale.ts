export type Language = 'zh' | 'en'

// 中文文案作为键，用户输入、模型历史与 REA 原始证据不参与界面翻译。
const english: Record<string, string> = {
  '默认以搜索功能为例；也可以在下方填写你想了解的功能。':
    'Search is the default example. Add your own feature in the question below.',
  '请选择本地应用、ASAR 文件或 JavaScript 目录。':
    'Choose a local app, ASAR file, or JavaScript folder.',
  '首版支持 .asar、Electron .app 和已解包的 JavaScript 应用目录。':
    'Supported targets are .asar files, Electron .app bundles, and extracted JavaScript folders.',
  '该 .app 未找到 Electron 应用资源。原生应用的反编译将在后续版本支持。':
    'This .app does not contain Electron resources. Native app decompilation is not supported yet.',
  '当前分析范围内的摘要视图。完整记录请导出 JSON 证据包。':
    'Summary of the current analysis scope. Export the JSON evidence bundle for complete records.',
  问题: 'Question',
  解释: 'Answer',
  记录: 'Note',
  目标: 'Target',
  时间: 'Time',
  分析摘要: 'Analysis summary',
  证据索引: 'Evidence index',
  '完整证据请同时导出 REA JSON 证据包。':
    'Export the REA JSON evidence bundle for complete records.',

  工作区: 'Workspace',
  新建分析: 'New analysis',
  历史记录: 'History',
  搜索历史记录: 'Search history',
  搜索应用或问题: 'Search apps or questions',
  清空搜索: 'Clear search',
  清理: 'Clear',
  删除记录: 'Delete record',
  '清理全部历史记录？': 'Clear all history?',
  '删除这条历史记录？': 'Delete this history entry?',
  '将删除本机保存的全部 {count} 条分析记录及其证据，删除后无法恢复。':
    'This deletes all {count} saved analyses and their evidence from this computer. It cannot be undone.',
  '将删除“{name}”及其保存的证据，删除后无法恢复。':
    'This deletes “{name}” and its saved evidence. It cannot be undone.',
  清理全部: 'Clear all',
  确认删除记录: 'Delete',
  '已删除该条历史记录。': 'History entry deleted.',
  '已清理 {count} 条历史记录。': 'Cleared {count} history entries.',
  没有匹配的记录: 'No matching results',
  '试试其他应用名称或关键词。': 'Try another app name or keyword.',
  还没有分析记录: 'No analyses yet',
  '完成一次分析后，可以在这里继续查看和提问。':
    'Your analyses will appear here, ready to revisit and explore.',
  连接模型: 'Connect a model',
  可先体验本地分析: 'Local analysis works without a model',
  使用指南: 'Getting started',
  分析中: 'Analyzing',
  生成报告中: 'Writing report',
  解释中: 'Writing report',
  已完成: 'Completed',
  已停止: 'Stopped',
  需要重试: 'Retry needed',
  主题: 'Theme',
  浅色主题: 'Light theme',
  深色主题: 'Dark theme',
  切换语言: 'Switch language',
  设置: 'Settings',
  关闭提示: 'Dismiss notification',
  '在本机，读懂应用': 'Understand apps, locally',
  '从应用到架构，清楚每一步。': 'From app to architecture. One clear path.',
  '选择一个应用，REA 会整理它的结构和实现证据。无需启动目标应用。':
    'Choose an app to explore its structure and implementation. No need to run it.',
  分析步骤: 'Analysis steps',
  选择应用: 'Choose an app',
  选择目标: 'Choose a goal',
  查看结果: 'Explore results',
  分析目标: 'Analysis target',
  选择或拖入一个应用: 'Choose an app or drop it here',
  '支持 Electron .app、.asar 和 JavaScript 目录': 'Electron .app, .asar, or JavaScript folders',
  更换: 'Change',
  选择目录: 'Choose folder',
  移除应用: 'Remove app',
  '你想先了解什么？': 'What would you like to explore?',
  随时可以继续追问: 'You can ask more questions later',
  整体架构: 'Architecture',
  '了解技术栈、主要模块和进程关系': 'Tech stack, modules, and process boundaries',
  功能实现: 'Feature flow',
  从一个功能追踪到实现证据: 'Trace a feature to its implementation',
  'IPC 通信': 'IPC connections',
  查看界面与主进程如何通信: 'How the UI talks to the main process',
  '分析这个应用的整体架构，说明主要模块和 Electron 主进程、渲染进程之间的关系。':
    'Analyze the overall architecture of this app. Explain its main modules and the relationships between Electron main and renderer processes.',
  '请分析这个应用的搜索功能，追踪涉及的模块和调用关系，并给出证据。':
    'Analyze the search feature of this app. Trace the relevant modules and calls, and cite the evidence.',
  '列出这个应用的重要 IPC 接口，说明它们如何连接界面与主进程，并提供证据。':
    'List important IPC interfaces in this app. Explain how they connect the UI to the main process, and cite the evidence.',
  补充一个具体问题: 'Add a specific question',
  选填: 'Optional',
  分析问题: 'Analysis question',
  '例如：搜索功能是怎么实现的？留空会按上方目标分析。':
    'For example: how does search work? Leave blank to use the goal above.',
  进阶选项: 'Advanced options',
  快速架构分析: 'Quick architecture scan',
  完整静态分析: 'Full static analysis',
  静态分析: 'Static analysis',
  分析范围: 'Analysis scope',
  '快速架构分析（推荐）': 'Quick architecture scan (recommended)',
  '完整静态分析（耗时较长）': 'Full static analysis (takes longer)',
  '快速模式只解析关键入口并保留完整文件索引。完整模式会读取全部文件，可能需要较长时间。':
    'Quick scan parses key entry points and keeps the full file inventory. Full analysis reads every file and may take much longer.',
  '补充 unpacked 目录': 'Attach unpacked folder',
  移除配套目录: 'Remove companion folder',
  '仅在 ASAR 缺少外置文件时需要。完整模式请直接选择完整 .app 或把 .unpacked 放在 ASAR 旁边。':
    'Only needed if the ASAR is missing external files. For full analysis, choose the complete .app or place .unpacked beside the ASAR.',
  '文件在本机分析，选取的证据发送到模型。':
    'Files stay local. Selected evidence is sent to your model.',
  '无需配置模型，也能查看应用结构与证据。': 'Explore app structure and evidence without a model.',
  开始分析: 'Start analysis',
  '想要易读的分析报告？连接模型即可获取解释。':
    'Want an explained report? Connect a model to get insights.',
  证据: 'Evidence',
  导出: 'Export',
  关闭导出菜单: 'Close export menu',
  'Markdown 报告': 'Markdown report',
  'JSON 证据包': 'JSON evidence bundle',
  '已导出到 {path}': 'Exported to {path}',
  你: 'You',
  '生成中 · ': 'Writing · ',
  '部分内容 · ': 'Partial · ',
  '已扫描 {total} 个文件，选取 {selected} 个架构入口分析。':
    'Scanned {total} files and selected {selected} architecture entry points for analysis.',
  停止: 'Stop',
  '本轮未完成，已有结果已保存': 'This run did not finish. Your results are saved.',
  重试本轮: 'Retry this run',
  检查模型设置: 'Check model settings',
  正在读取历史任务: 'Loading analysis history',
  继续提问: 'Ask a follow-up',
  '继续追问某个功能，或补充你想了解的细节…': 'Ask about a feature, or explore a detail…',
  发送问题: 'Send question',
  继续任务: 'Continue',
  'Enter 发送 · Shift + Enter 换行': 'Enter to send · Shift + Enter for a new line',
  连接模型以获取解释: 'Connect a model for insights',
  松开以选择应用: 'Drop to select this app',
  '请运行 npm run dev，在 Electron 桌面窗口中使用本地分析功能。':
    'Run npm run dev to use local analysis in the Electron desktop app.',
  三步开始分析: 'Get started in three steps',
  关闭指南: 'Close guide',
  选择一个完整应用: 'Choose a complete app',
  '推荐选择 Electron .app；也支持单独的 .asar 或 JavaScript 目录。直接拖入窗口即可。':
    'An Electron .app is the best starting point. You can also drop an .asar or JavaScript folder into the window.',
  '选目标，点击开始': 'Pick a goal and start',
  '默认快速分析整体架构，不必填写问题。需要时再展开进阶选项。':
    'Start with a quick architecture scan. No question is required. Advanced options are there when you need them.',
  '查看报告，继续追问': 'Explore results and ask more',
  '报告里的证据链接可直接查看来源。结果自动保存到历史，也能导出 Markdown 或 JSON。':
    'Open evidence links to inspect sources. Results are saved to history, and you can export Markdown or JSON.',
  '目标应用不会被启动。文件在本机分析；使用云端模型时，问题和选取的证据会发送给模型服务。':
    'The target app is never launched. Analysis runs locally; questions and selected evidence are sent to your model when you use a cloud service.',
  开始使用: 'Got it',
  模型配置: 'Models',
  添加和切换服务: 'Add and switch providers',
  导入已有配置: 'Import your providers',
  分析引擎: 'Analysis engine',
  检查本机环境: 'Check local environment',
  密钥加密保存在本机: 'Keys are encrypted on this device',
  关闭设置: 'Close settings',
  设置分类: 'Settings categories',
  连接你熟悉的模型: 'Connect your preferred model',
  '可保存多套配置，下一次提问使用当前启用的服务。':
    'Save multiple profiles. Your next question uses the active provider.',
  '已经在用 CC Switch？': 'Already using CC Switch?',
  '直接导入，不用重新填写地址和密钥。': 'Import your providers without re-entering URLs or keys.',
  已保存配置: 'Saved profiles',
  新建配置: 'New profile',
  新建: 'New',
  已启用: 'Active',
  启用: 'Activate',
  删除配置: 'Delete profile',
  '删除此配置？已保存的分析不会受到影响。': 'Delete this profile? Saved analyses will be kept.',
  取消: 'Cancel',
  确认删除: 'Delete profile',
  快速填写: 'Presets',
  选择服务商自动填写: 'Pick a provider to fill in the fields',
  火山方舟: 'Volcengine Ark',
  '火山 Coding Plan': 'Volcengine Coding Plan',
  配置名称: 'Profile name',
  '例如：我的 DeepSeek': 'For example: My DeepSeek',
  接口协议: 'API protocol',
  服务地址: 'Base URL',
  '使用服务商提供的地址；普通 API 和 Coding Plan 地址可能不同。':
    'Use the URL from your provider. Standard APIs and Coding Plans may use different URLs.',
  模型名称: 'Model ID',
  '填写服务商提供的模型 ID': 'Enter the model ID from your provider',
  '火山普通 API 可使用 Endpoint ID（ep-…）。':
    'Standard Ark APIs also accept an Endpoint ID (ep-…).',
  本地服务可留空: 'Optional for local services',
  '已安全保存，留空保留此密钥': 'Saved securely. Leave blank to keep this key.',
  '输入 API Key': 'Enter API key',
  移除此配置的密钥: 'Remove the saved key for this profile',
  接口详情与隐私: 'Connection details and privacy',
  请输入有效的服务地址: 'Enter a valid base URL',
  '文件在本机分析。问题和选取的证据发送到模型服务，密钥不会传入界面。不同服务商建议使用独立配置。':
    'Files are analyzed locally. Questions and selected evidence are sent to your model. Keys never reach the UI. Use a separate profile for each provider.',
  '复用 CC Switch 配置': 'Import from CC Switch',
  '读取本机配置并导入到 REA，原有 CC Switch 设置保持不变。':
    'Import profiles from this device. Your CC Switch settings are left unchanged.',
  '支持 Claude、Codex、OpenCode 和 Pi 的 API Key 配置':
    'API key profiles for Claude, Codex, OpenCode, and Pi',
  重新读取: 'Refresh',
  读取配置: 'Read profiles',
  '把已有模型带到 REA': 'Bring your models to REA',
  '点击“读取配置”，选择要导入的服务。密钥将加密保存，之后可独立切换。':
    'Read your profiles, then choose a provider to import. Keys are encrypted and each profile can be switched independently.',
  '没有找到可识别的服务配置。': 'No supported provider profiles found.',
  当前: 'Current',
  未指定模型: 'No model specified',
  无法导入此配置: 'This profile cannot be imported',
  导入: 'Import',
  '官方订阅登录（OAuth）无法作为 API Key 导入。CC Switch 配置更新后，重新导入即可同步。':
    'Subscription sign-ins (OAuth) cannot be imported as API keys. Re-import a profile after updating it in CC Switch.',
  确认本地分析环境: 'Check the local environment',
  'REA 和 Node 已随应用内置，通常无需额外安装。遇到分析问题时可先检查环境。':
    'REA and Node are included. No extra setup is usually needed. Check the engine here if analysis fails.',
  本地静态分析引擎: 'Local static analysis engine',
  '支持 JavaScript、Electron 和 ASAR 架构分析':
    'Architecture analysis for JavaScript, Electron, and ASAR',
  '正在检查环境…': 'Checking environment…',
  检查分析环境: 'Check analysis engine',
  '静态分析不会执行目标代码。字节码、动态通道和未解析文件会标为未知，不代表相关功能不存在。':
    'Static analysis does not run target code. Bytecode, dynamic channels, and unparsed files remain unknown; missing evidence does not mean a feature is absent.',
  '正在验证模型连接和工具调用，可能需要一点时间…':
    'Checking the connection and tool calls. This may take a moment…',
  '当前服务：{name}': 'Active provider: {name}',
  '未配置模型，也可先做本地分析': 'No model connected. Local analysis is available.',
  检查连接: 'Check connection',
  保存并启用: 'Save and activate',
  完成: 'Done',
  '配置已保存并启用。': 'Profile saved and activated.',
  '配置已启用。': 'Profile activated.',
  '已导入并启用，可在模型配置中检查连接。':
    'Imported and activated. You can check its connection in Models.',
  '连接正常，已验证工具调用和结果回传。': 'Connected. Tool calls and result delivery are working.',
  'REA 引擎连接正常，内置运行时、架构分析、模块查询和证据读写均可用。':
    'REA is ready. The bundled runtime, architecture analysis, module queries, and evidence storage are available.',
  归档文件: 'Archive files',
  解析文件: 'Parsed JS files',
  文件: 'Source files',
  IPC通道: 'IPC channels',
  分析证据: 'Analysis evidence',
  收起证据: 'Close evidence panel',
  应用信息: 'APPLICATION',
  '架构快速分析 · 抽取 {count} 个入口文件': 'Quick scan · {count} entry files selected',
  查看应用概览: 'View overview',
  应用模块: 'App modules',
  刷新: 'Refresh',
  浏览: 'Browse',
  '此页没有可展示的模块。': 'No modules on this page.',
  '当前页 {count} 项': '{count} items on this page',
  查看本页证据: 'View page evidence',
  下一页: 'Next page',
  '按需读取模块，完整分析保留在本机。':
    'Browse modules on demand. Full evidence stays on this device.',
  证据记录: 'Evidence records',
  '分析完成后，证据会显示在这里。': 'Evidence will appear here after analysis.',
  '正在读取证据…': 'Loading evidence…',
  证据详情: 'Evidence details',
  已复制: 'Copied',
  复制: 'Copy',
  '当前为部分预览，导出 JSON 证据包可查看完整内容。':
    'This is a partial preview. Export the JSON bundle for the complete evidence.',
  覆盖范围与未确认项: 'Coverage and unknowns',
  正在准备分析: 'Preparing analysis',
  正在恢复已保存的分析证据: 'Restoring saved evidence',
  正在连接本地分析引擎: 'Connecting to the local engine',
  正在准备应用架构入口与文件索引: 'Preparing entry points and file inventory',
  '正在使用 REA 分析应用结构与模块': 'Analyzing structure and modules with REA',
  正在保存本地分析证据: 'Saving local evidence',
  正在保存解释与证据: 'Saving the report and evidence',
  正在恢复上次调查进度: 'Resuming the investigation',
  '正在压缩上下文，保留调查进度与证据': 'Condensing context while preserving findings and evidence',
  正在继续生成分析报告: 'Continuing the analysis report',
  正在整理解释与证据: 'Organizing findings and evidence',
  '模型上下文已满，正在压缩后自动重试':
    'Model context is full. Condensing and retrying automatically',
  '单次输出达到上限，正在自动续写': 'Output limit reached. Continuing automatically',
  '静态分析已完成。可以输入具体功能问题继续调查。':
    'Static analysis is complete. Ask about a feature to explore further.',
  '静态分析已完成，可以查看应用概览和模块。配置模型后，继续追问即可获得中文解释。':
    'Static analysis is complete. Browse the overview and modules, or connect a model to get an explained report.',
  '任务已停止，已保存的分析和证据仍可查看。':
    'Analysis stopped. Your saved findings and evidence are still available.',
  '架构快速分析仅解析选定的小型入口、preload、HTML 和清单；未解析的第三方依赖、大型 bundle 及字节码不属于本次 REA 语义覆盖范围。':
    'Quick scan covers selected small entry points, preloads, HTML, and manifests. Unparsed dependencies, large bundles, and bytecode are outside this scan’s semantic coverage.',
  '发现 V8 .jsc 字节码，当前 JavaScript 静态分析不能还原其中的实现。':
    'V8 .jsc bytecode was found. JavaScript static analysis cannot recover its implementation.',
  '补充目录中存在哈希不匹配文件，已跳过，可能来自不同版本。':
    'Some companion files had mismatched hashes and were skipped. They may belong to a different version.',
  '没有可导入的 API Key（官方订阅登录/OAuth 或环境变量不属于 API Key 配置）':
    'No importable API key. Subscription/OAuth sign-ins or unresolved environment variables cannot be used as API key profiles.',
  '缺少服务地址或默认模型，请手动新建配置':
    'Missing base URL or default model. Create a profile manually.',
  '配置格式无法识别，请手动新建配置': 'Unrecognized profile format. Create a profile manually.',
  '无法读取 CC Switch 数据库，请确认已安装并配置 CC Switch。':
    'Could not read the CC Switch database. Make sure CC Switch is installed and configured.',
  'CC Switch 配置不存在。': 'CC Switch profile not found.',
  '模型配置不存在。': 'Model profile not found.',
  '请先选择应用。': 'Choose an app first.',
  '当前任务仍在运行，请等待完成或停止后再开始。':
    'An analysis is running. Wait for it to finish or stop it first.',
  '分析完成后即可浏览模块。': 'Modules will be available after analysis finishes.',
  '请先完成应用分析。': 'Complete app analysis first.',
  '任务完成或停止后即可导出。': 'Finish or stop the task before exporting.',
  '请先在模型设置中填写模型名称。': 'Enter a model ID in Settings first.',
  '系统密钥存储不可用，无法安全保存 API Key。可连接无需密钥的本地模型服务。':
    'System key storage is unavailable, so this API key cannot be saved securely. You can use a local model that needs no key.',
  '连接正常。': 'Connection successful.',
  原有配置: 'Original profile',
  应用概览: 'App overview',
  '应用分析（摘要）': 'App analysis (summary)',
  '架构入口分析（摘要）': 'Architecture scan (summary)',
  '完整应用分析（摘要）': 'App analysis (summary)',
  语义关系追踪: 'Semantic trace',
  '完整分析需要 ASAR 相邻的 .unpacked 目录；请直接选择完整 .app，或使用架构快速分析来指定补充目录。':
    'Full analysis needs a .unpacked folder beside the ASAR. Choose the complete .app, or use Quick scan to attach a companion folder.',
  应用分析: 'App analysis',
  '选择 Electron 应用或 ASAR': 'Choose an Electron app or ASAR',
  '选择 JavaScript 应用目录': 'Choose a JavaScript app folder',
  'Electron 应用 / ASAR': 'Electron app / ASAR',
  导出分析结果: 'Export analysis',
  'REA 证据包': 'REA evidence bundle',
  '请输入 HTTP 或 HTTPS 模型服务地址。': 'Enter an HTTP or HTTPS model URL.'
}

Object.assign(english, {
  源码运行时: 'Source runtime',
  自定义服务: 'Custom service',
  'npm 兼容运行时': 'npm compatibility runtime',
  切换到独立工具会话: 'Use standalone tool session',
  关联当前任务: 'Link current task',
  捕获的图片: 'Captured image',
  保存文件: 'Save file',
  相关文件与输出: 'Related files & outputs',
  定位文件: 'Show in folder',
  预览图片: 'Preview image',
  '完整原始响应（JSON）': 'Complete raw response (JSON)',
  '仅预览前 30 项，完整结果可导出。': 'Showing the first 30 items. Export for the complete result.',

  最近工具记录: 'Recent tool results',
  '历史结果可查看和导出；跨会话引用证据前需导入对应 REA 证据包。':
    'View and export saved results. Import the corresponding REA evidence bundle before using references across sessions.',

  '自定义 REA 服务（可选）': 'Custom REA service (optional)',
  '留空使用内置 REA。可连接源码构建的 MCP，或通过 ssh 连接 Linux 上的 REA，以使用受宿主限制的工具。路径按服务端解释。':
    'Leave empty for bundled REA. Connect a source-built MCP server, or use ssh to run REA on Linux for host-restricted tools. Paths are interpreted on the server.',
  启动命令: 'Launch command',
  '启动参数（每行一项）': 'Arguments (one per line)',

  'REA 能力中心': 'REA capabilities',
  当前目标: 'Current target',
  '独立工具会话 · 结果保存在本机': 'Standalone session · Results saved locally',
  项能力: 'capabilities',
  全部能力: 'All capabilities',
  刷新状态: 'Refresh status',
  配置依赖与引擎: 'Configure dependencies & engines',
  '正在读取 REA 完整工具目录…': 'Loading the complete REA tool catalog…',
  依赖状态尚未确认: 'Dependency status not yet confirmed',
  '正在连接 REA 并读取工具目录（最多 15 秒）…':
    'Connecting to REA and loading tools (up to 15 seconds)…',
  '工具目录已就绪，正在连接引擎并检查状态（最多 30 秒），可继续浏览…':
    'Tool catalog ready. Connecting and checking status (up to 30 seconds); you can keep browsing…',
  '工具可用性尚未检查；目录就绪后可浏览和填写参数。':
    'Availability has not been checked yet. Browse tools and fill in parameters once the catalog is ready.',
  '操作已完成并保存，后续更新未完成：': 'Operation completed and saved; follow-up updates failed: ',
  选择你要调查的内容: 'What would you like to investigate?',
  '先选一种任务，再按推荐步骤操作。全部工具也可直接搜索。':
    'Choose a task and follow the suggested steps, or search all tools.',
  当前可调用: 'Ready to call',
  依赖和目标状态会随会话更新: 'Availability updates with dependencies and target state',
  操作指南: 'Workflow guide',
  推荐顺序: 'Suggested steps',
  '搜索工具、格式或操作…': 'Search tools, formats, or operations…',
  '搜索 REA 工具': 'Search REA tools',
  返回能力列表: 'Back to capabilities',
  需要打开分析目标: 'Open an analysis target first',
  当前依赖未就绪: 'Dependencies are not ready',
  '执行时会自动打开当前目标。': 'The current target will open when you run this tool.',
  '可先执行 open_binary，或在设置中配置所需引擎后刷新。':
    'Run open_binary first, or configure the required engine in Settings and refresh.',
  操作参数: 'Parameters',
  'JSON 模式': 'JSON mode',
  使用之前的结果: 'Previous results',
  查看结果: 'View results',
  复制完整结果: 'Copy full result',
  操作影响: 'Operation effects',
  '我确认对上述参数执行此操作；它可能运行代码、修改目标或与设备/页面交互。':
    'I confirm this operation with these parameters. It may execute code, modify the target, or interact with a device or page.',
  '执行中…': 'Running…',
  执行操作: 'Run tool',
  真实执行结果: 'Execution result',
  '预览已截断，导出可查看完整结果。': 'Preview truncated. Export for the complete result.',
  其他参数: 'Additional parameters',
  移除: 'Remove',
  添加一项: 'Add item',
  选择文件: 'Choose file',
  目录: 'Folder',
  另存为: 'Save as',
  移除参数: 'Remove parameter',
  配置本机分析工具: 'Configure local analysis tools',
  'REA 和 Node 已内置。按目标配置外部引擎，保存后会在下次操作生效。':
    'REA and Node are bundled. Configure external engines for your target; changes apply to the next operation.',
  原生分析引擎: 'Native analysis engine',
  自动选择: 'Automatic',
  '更多 REA 环境变量': 'More REA environment variables',
  选择路径: 'Choose path',
  添加: 'Add',
  保存并检查环境: 'Save & check environment',
  保存配置: 'Save configuration',
  已保存: 'Saved',
  '工具依赖和宿主限制请在能力中心查看；有些操作需要先打开目标或连接设备。':
    'Check tool dependencies and host restrictions in Capabilities. Some operations require an open target or device connection.',
  代码恢复与导出: 'Code recovery & export',
  '已识别 PyInstaller：可提取 Python 字节码与 PYZ。指定函数时可反编译原生加载器。':
    'PyInstaller detected: extract Python bytecode and PYZ archives, or specify a function to decompile the native loader.',
  '输入函数名或地址，导出引擎生成的伪代码。可先在证据面板浏览函数。':
    'Enter a function name or address to export engine-generated pseudocode. Browse functions in the evidence panel first.',
  '导出实际存在的脚本、内嵌源码、CIL 或 WAT；输出类型会逐文件标明。':
    'Export existing scripts, embedded sources, CIL, or WAT. Each file records its representation.',
  函数名或地址: 'Function name or address',
  '留空提取 Python 字节码': 'Leave empty to extract Python bytecode',
  '恢复中…': 'Recovering…',
  '恢复 / 导出代码': 'Recover / export code',
  更多恢复工具: 'More recovery tools',
  个文件: 'files',
  打开输出目录: 'Open output folder',
  导出文件夹: 'Export folder',
  已导出: 'Exported',
  '筛选文件…': 'Filter files…',
  选择文件查看实际恢复内容: 'Select a file to inspect recovered content',
  查看对应工具: 'View tools for this format',
  支持的格式与完整功能: 'Supported formats & capabilities',
  打开全部能力与推荐流程: 'Open all capabilities & workflows',
  '支持 EXE、ASAR、APK、.NET、WASM、数据库和应用目录':
    'EXE, ASAR, APK, .NET, WASM, databases, and app folders',
  系统交互: 'System interactions',
  '格式、技术栈与主要模块': 'Format, technology, and modules',
  '系统、库和网络的交互证据': 'System, library, and network interactions',
  代码: 'Code',
  工具: 'Tools',
  函数与符号: 'Functions & symbols',
  选择分析文件: 'Choose analysis file',
  选择应用目录: 'Choose app folder',
  所有分析文件: 'All analysis files',
  原生应用与库: 'Native apps & libraries',
  '.NET 托管程序集': '.NET assemblies',
  安装包与应用资源: 'Packages & resources',
  网络与逻辑记录: 'Network & logic captures',
  '固件 / EVM / 崩溃记录': 'Firmware / EVM / crashes',
  网站与运行时: 'Web & runtime',
  '选择或拖入 EXE、ASAR、APK、.NET、WASM、数据库、网络捕获或应用目录，程序会识别格式并选择分析流程。':
    'Select or drop an EXE, ASAR, APK, .NET, WASM, database, capture, or app folder. The app identifies the format and starts the matching workflow.',
  '分析这个应用的格式、技术栈、主要模块和架构。区分实际观察、推断和未知项。':
    'Analyze the format, technology stack, modules, and architecture. Separate observations, inferences, and unknowns.',
  '追踪这个应用的主要功能和调用关系，引用真实证据并说明覆盖限制。':
    'Trace the main features and calls, citing real evidence and coverage limits.',
  '分析这个应用与系统、库和网络之间的交互，给出证据。':
    'Analyze interactions with the system, libraries, and network, with evidence.'
})

export function translate(
  text: string,
  language: Language,
  values?: Record<string, string | number>
): string {
  const result = language === 'en' ? (english[text] ?? text) : text
  return result.replace(/\{(\w+)\}/g, (match, key: string) =>
    values?.[key] === undefined ? match : String(values[key])
  )
}

export function localizeSystemText(text: string, language: Language): string {
  if (language === 'zh') return text
  if (english[text]) return english[text]
  return text
    .split('\n')
    .map((line) => {
      if (english[line]) return english[line]
      const missing =
        /^缺少 (\d+) 个 unpacked 文件；需要原应用配套的 app.asar.unpacked 目录。$/.exec(line)
      if (missing)
        return `Missing ${missing[1]} unpacked files. Attach the matching app.asar.unpacked folder.`
      return line
        .replace(/^正在读取证据 · /, 'Reading evidence · ')
        .replace(/^模块列表 · /, 'Module list · ')
        .replace(/^模块 · /, 'Module · ')
        .replace(/^功能追踪 · /, 'Feature trace · ')
        .replace(/^未找到 CC Switch 数据库：/, 'CC Switch database not found: ')
        .replace(/^模型服务返回 (\d+)：/, 'Model service returned $1: ')
        .replace(/^模型请求失败：/, 'Model request failed: ')
        .replace(/^请求地址：/, 'Request URL: ')
        .replace(/^模型：/, 'Model: ')
        .replace(/^协议：/, 'Protocol: ')
        .replace(
          /^请检查接口协议、模型 ID、API Key 和该套餐允许的接口。$/,
          'Check the API protocol, model ID, API key, and supported endpoints for your plan.'
        )
        .replace(/^请检查网络、代理和服务地址。$/, 'Check your network, proxy, and service URL.')
    })
    .join('\n')
}
