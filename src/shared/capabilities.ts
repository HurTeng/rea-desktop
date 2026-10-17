export const CAPABILITY_GROUPS = [
  {
    id: 'native',
    title: '原生程序',
    en: 'Native binaries',
    description: '函数、伪代码、汇编、字符串与调用图',
    doc: 'native-investigation.md',
    steps: [
      'open_binary',
      'binary_overview',
      'list_procedures',
      'procedure_pseudo_code',
      'analyze_function',
      'get_call_graph'
    ]
  },
  {
    id: 'javascript',
    title: 'JavaScript / Electron',
    en: 'JavaScript / Electron',
    description: '静态架构、模块、IPC 与语义追踪',
    doc: 'javascript-application-workflows.md',
    steps: [
      'analyze_javascript_application',
      'inspect_analysis_view',
      'trace_application_feature',
      'trace_javascript_semantics'
    ]
  },
  {
    id: 'recovery',
    title: '代码恢复与重构',
    en: 'Recovery & reconstruction',
    description: '源码映射、Wakaru、重构覆盖与验证',
    doc: 'javascript-recovery.md',
    steps: [
      'recover_javascript_sources',
      'compare_source_to_bundle',
      'build_reconstruction_obligation_ledger',
      'evaluate_reconstruction_coverage',
      'verify_reconstruction'
    ]
  },
  {
    id: 'managed',
    title: '.NET 程序集',
    en: '.NET assemblies',
    description: '元数据、CIL、原生边界与外部 C# 重构验证',
    doc: 'managed-code-analysis.md',
    steps: [
      'inspect_managed_artifact',
      'inspect_managed_members',
      'inspect_managed_native_boundaries',
      'import_managed_reconstruction',
      'project_managed_application_graph'
    ]
  },
  {
    id: 'android',
    title: 'Android / Flutter',
    en: 'Android / Flutter',
    description: 'JADX 反编译、资源、Dart AOT 与应用关系',
    doc: 'android-analysis.md',
    steps: [
      'inspect_android_package',
      'search_android_classes',
      'inspect_android_class',
      'inspect_android_method',
      'decode_android_resources',
      'identify_flutter_build',
      'inspect_dart_aot',
      'project_android_application_graph'
    ]
  },
  {
    id: 'adb',
    title: 'Android 设备',
    en: 'Android devices',
    description: '设备、应用、日志、屏幕、文件与安装操作',
    doc: 'adb-device-analysis.md',
    steps: [
      'inspect_adb_client',
      'list_adb_devices',
      'list_adb_packages',
      'pull_adb_package',
      'read_adb_logcat',
      'capture_adb_screen'
    ]
  },
  {
    id: 'jeb',
    title: 'JEB 项目',
    en: 'JEB projects',
    description: '连接本机 JEB、选择项目并反编译单元',
    doc: 'jeb-analysis.md',
    steps: ['inspect_jeb_client', 'open_jeb_project', 'list_jeb_units', 'decompile_jeb_item']
  },
  {
    id: 'web',
    title: '网页与浏览器',
    en: 'Web & browser',
    description: 'CDP 页面、脚本、网络、截图与交互记录',
    doc: 'browser-observation.md',
    steps: [
      'list_browser_targets',
      'inspect_web_page',
      'analyze_web_bundle',
      'export_web_scripts',
      'capture_web_screenshot',
      'capture_browser_scenario'
    ]
  },
  {
    id: 'runtime',
    title: 'Electron / JS 运行时',
    en: 'Electron / JS runtime',
    description: 'Inspector、运行时观察与静态关系核对',
    doc: 'javascript-runtime-observation.md',
    steps: [
      'list_electron_targets',
      'inspect_electron_page',
      'list_javascript_runtime_targets',
      'observe_javascript_runtime',
      'reconcile_javascript_runtime',
      'capture_electron_scenario'
    ]
  },
  {
    id: 'network',
    title: '网络捕获',
    en: 'Network captures',
    description: 'HAR、mitmproxy、PCAP、字段与协议',
    doc: 'web-network-captures.md',
    steps: [
      'inspect_web_network_capture',
      'inspect_pcap_client',
      'inspect_pcap_capture',
      'inspect_packet_fields',
      'inspect_packet_capture'
    ]
  },
  {
    id: 'data',
    title: 'WASM / SQLite / Go / Rust',
    en: 'WASM / SQLite / Go / Rust',
    description: 'WAT、数据库、构建标识与依赖',
    doc: 'wasm-artifacts.md',
    steps: [
      'inspect_wasm_artifact',
      'compare_wasm_interfaces',
      'inspect_sqlite_database',
      'inspect_go_binary',
      'inspect_rust_binary',
      'inspect_evm_interface'
    ]
  },
  {
    id: 'package',
    title: '安装包与 Apple / Harmony',
    en: 'Packages / Apple / Harmony',
    description: '资源提取、plist、签名、应用包关系',
    doc: 'javascript-artifact-reconstruction.md',
    steps: [
      'open_binary',
      'inspect_artifact',
      'extract_artifact',
      'inspect_plist',
      'decode_interface_builder',
      'inspect_asset_catalog',
      'project_apple_application_graph',
      'project_harmony_application_graph'
    ]
  },
  {
    id: 'firmware',
    title: '固件与崩溃',
    en: 'Firmware & crashes',
    description: '固件区域、提取、ELF 布局与 core dump',
    doc: 'firmware-analysis.md',
    steps: [
      'inspect_firmware_regions',
      'extract_firmware',
      'inspect_binary_layout',
      'inspect_recorded_crash'
    ]
  },
  {
    id: 'signal',
    title: '逻辑信号',
    en: 'Logic signals',
    description: '选择 sigrok 解码器并检查录制信号',
    doc: 'signal-recordings.md',
    steps: ['inspect_signal_decoders', 'decode_signal_recording']
  },
  {
    id: 'debug',
    title: '调试与插桩',
    en: 'Debugging & instrumentation',
    description: 'Frida、GDB、Rizin、Cutter 与 objdump',
    doc: 'reverse-engineering-tools.md',
    steps: [
      'inspect_with_objdump',
      'list_frida_devices',
      'start_frida_session',
      'start_gdb_session',
      'start_rizin_debug_session',
      'list_cutter_sessions'
    ]
  },
  {
    id: 'process',
    title: '进程与原生界面',
    en: 'Processes & native UI',
    description: '受控执行、界面观察、调用记录与行为比较',
    doc: 'process-capture.md',
    steps: [
      'capture_process_scenario',
      'observe_native_ui',
      'capture_native_ui_scenario',
      'observe_native_calls',
      'compare_process_captures'
    ]
  },
  {
    id: 'compare',
    title: '比较与证据关联',
    en: 'Comparison & correlation',
    description: '版本、函数、构建、截图及静态/运行时对比',
    doc: 'cli.md',
    steps: [
      'compare_application_versions',
      'compare_artifacts',
      'compare_functions',
      'compare_bundles',
      'find_changed_behavior',
      'correlate_static_and_runtime'
    ]
  },
  {
    id: 'session',
    title: '会话、证据与未知项',
    en: 'Session, evidence & unknowns',
    description: '保存/导入证据、导航上下文与未知项验证',
    doc: 'cli.md',
    steps: [
      'binary_session',
      'get_evidence_bundle',
      'export_evidence_bundle',
      'import_evidence_bundle',
      'list_unknowns',
      'record_unknown',
      'verify_unknown_resolution'
    ]
  }
] as const
export type CapabilityGroup = (typeof CAPABILITY_GROUPS)[number]
export function capabilityGroup(name: string): string {
  if (/reconstruction|recover_javascript|source_to_bundle|export_shapes/.test(name))
    return 'recovery'
  if (/managed/.test(name)) return 'managed'
  if (/adb/.test(name)) return 'adb'
  if (/jeb/.test(name)) return 'jeb'
  if (/android|flutter|dart|apktool/.test(name)) return 'android'
  if (/web_network|pcap|packet/.test(name)) return 'network'
  if (/wasm|sqlite|go_binary|rust_binary|evm/.test(name)) return 'data'
  if (/firmware|recorded_crash|binary_layout/.test(name)) return 'firmware'
  if (/signal/.test(name)) return 'signal'
  if (/frida|gdb|rizin|cutter|objdump/.test(name)) return 'debug'
  if (/process_|native_ui|native_calls/.test(name)) return 'process'
  if (/electron|javascript_runtime|reconcile_javascript/.test(name)) return 'runtime'
  if (/^compare_|changed_behavior|correlate_/.test(name)) return 'compare'
  if (/web|browser/.test(name)) return 'web'
  if (/javascript|application_feature/.test(name)) return 'javascript'
  if (
    /artifact|plist|keyed_archive|asset_catalog|interface_builder|apple_application|harmony_application|signature|dylib/.test(
      name
    )
  )
    return 'package'
  if (
    /evidence|unknown|navigation|address_context|binary_session|close_binary|analysis_view/.test(
      name
    )
  )
    return 'session'
  return 'native'
}
export const TOOL_LABELS: Record<string, string> = {
  annotate_native_function: '标注函数名称与注释',
  inspect_native_load_image: '核对原生加载映像',
  inspect_native_data_type: '检查恢复的数据类型',
  inspect_native_instruction: '检查指令与操作数',
  resolve_native_call_targets: '解析调用目标',
  address_name: '查询地址名称',
  comment: '读取地址注释',
  current_address: '当前地址',
  current_procedure: '当前函数',
  current_document: '当前分析文档',
  goto_address: '跳转到地址',
  inline_comment: '读取行内注释',
  list_bookmarks: '浏览书签',
  list_documents: '浏览分析文档',
  list_names: '浏览符号名称',
  list_segments: '浏览内存段',
  list_strings: '浏览字符串',
  next_address: '下一地址',
  prev_address: '上一地址',
  procedure_address: '查询函数地址',
  procedure_callees: '查看被调用函数',
  procedure_callers: '查看调用方',
  procedure_info: '查看函数信息',
  read_function_instructions: '读取函数指令',
  search_bytes: '搜索字节序列',
  address_to_file_offset: '地址转换为文件偏移',
  procedure_references: '查看函数引用',
  resolve_containing_procedure: '查找地址所属函数',
  set_address_name: '设置地址名称',
  set_addresses_names: '批量设置地址名称',
  set_bookmark: '添加书签',
  set_comment: '设置注释',
  set_inline_comment: '设置行内注释',
  unset_bookmark: '移除书签',
  trace_native_values: '追踪原生值流',
  inspect_native_dispatch_metadata: '检查动态分派元数据',
  get_objc_classes: '浏览 Objective-C 类',
  get_objc_protocols: '浏览 Objective-C 协议',
  batch_decompile: '批量反编译函数',
  analyze_swift_types: '分析 Swift 类型',
  find_xrefs_to_name: '查找名称引用',
  inspect_native_api: '检查原生 API',
  trace_feature: '追踪原生功能',
  trace_call_path: '追踪调用路径',
  trace_native_ui_action: '追踪原生界面操作',
  observe_native_ui: '观察原生界面',
  capture_native_ui_scenario: '录制原生界面场景',
  observe_native_calls: '观察原生调用',
  inspect_macho: '检查 Mach-O 结构',
  inspect_signature: '检查代码签名',
  inspect_plist: '检查 Plist',
  list_architectures: '列出架构',
  demangle_swift: '还原 Swift 符号名称',
  decode_interface_builder: '解码 Interface Builder 资源',
  inspect_keyed_archive: '检查 Keyed Archive',
  inspect_asset_catalog: '检查资源目录',
  trace_dylib_resolution: '追踪动态库解析',
  inspect_managed_native_boundaries: '检查 .NET 原生调用边界',
  compare_managed_members: '比较 .NET 成员',
  verify_managed_native_boundaries: '验证 .NET 原生边界',
  import_managed_reconstruction: '导入并验证外部 C# 重构',
  project_managed_application_graph: '生成 .NET 应用关系图',
  inspect_with_objdump: '用 objdump 检查文件',
  execute_rizin_command: '执行 Rizin 分析命令',
  list_frida_devices: '列出 Frida 设备',
  list_frida_processes: '列出 Frida 进程',
  start_frida_session: '启动 Frida 会话',
  load_frida_script: '加载 Frida 脚本',
  resume_frida_session: '恢复 Frida 进程',
  unload_frida_script: '卸载 Frida 脚本',
  frida_session_status: 'Frida 会话状态',
  close_frida_session: '关闭 Frida 会话',
  instrument_with_frida: '使用 Frida 插桩',
  list_cutter_sessions: '列出 Cutter 会话',
  cutter_command: '执行 Cutter 命令',
  start_gdb_session: '启动 GDB 会话',
  gdb_console: '执行 GDB 控制台命令',
  gdb_session_status: 'GDB 会话状态',
  close_gdb_session: '关闭 GDB 会话',
  start_rizin_debug_session: '启动 Rizin 调试会话',
  rizin_debug_command: '执行 Rizin 调试命令',
  rizin_debug_session_status: 'Rizin 调试会话状态',
  close_rizin_debug_session: '关闭 Rizin 调试会话',
  inspect_packet_capture: '解码数据包捕获',
  inspect_packet_fields: '检查数据包字段',
  decode_signal_recording: '解码逻辑信号',
  inspect_signal_decoders: '浏览信号解码器',
  trace_android_references: '追踪 Android 引用',
  inspect_jeb_client: '检查 JEB 客户端',
  open_jeb_project: '打开 JEB 项目',
  list_jeb_units: '浏览 JEB 项目单元',
  decompile_jeb_item: '反编译 JEB 类型或方法',
  inspect_binary_layout: '检查 ELF 布局',
  compare_wasm_interfaces: '比较 WASM 接口',
  inspect_recorded_crash: '分析已录制的崩溃',
  inspect_firmware_regions: '检查固件区域',
  extract_firmware: '提取固件',
  trace_web_module_imports: '追踪网页模块导入',
  trace_web_source_location: '追踪网页源码位置',
  observe_web_execution: '观察网页执行',
  inspect_web_event_listeners: '检查网页事件监听',
  inspect_adb_client: '检查 ADB 客户端',
  inspect_adb_device: '检查 Android 设备',
  list_adb_packages: '浏览设备安装包',
  pull_adb_package: '拉取设备 APK',
  read_adb_logcat: '读取 Android 日志',
  inspect_adb_package: '检查设备应用',
  pull_adb_file: '拉取设备文件',
  push_adb_file: '传送文件到设备',
  capture_adb_screen: 'Android 截图',
  list_adb_processes: '浏览设备进程',
  list_adb_directory: '浏览设备目录',
  list_adb_features: '浏览设备功能',
  list_adb_services: '浏览设备服务',
  inspect_adb_display: '检查设备显示',
  inspect_adb_window: '检查设备窗口',
  read_adb_setting: '读取设备设置',
  collect_adb_bugreport: '收集设备诊断包',
  resolve_adb_packages: '解析设备包名',
  install_adb_package: '安装 Android 应用',
  uninstall_adb_package: '卸载 Android 应用',
  start_adb_app: '启动 Android 应用',
  start_adb_activity: '启动 Android Activity',
  stop_adb_app: '停止 Android 应用',
  inspect_pcap_client: '检查 PCAP 工具链',
  inspect_apktool_client: '检查 Apktool',
  observe_web_session: '观察浏览器会话',
  discover_webmcp_tools: '发现网页 WebMCP 工具',
  compare_web_captures: '比较网页捕获',
  compare_web_screenshots: '比较网页截图',
  capture_browser_scenario: '录制浏览器操作场景',
  inspect_electron_fuses: '检查 Electron Fuses',
  list_electron_targets: '浏览 Electron 页面',
  inspect_electron_page: '检查 Electron 页面',
  reconcile_javascript_runtime: '核对 JS 静态与运行时',
  capture_electron_scenario: '录制 Electron 场景',
  list_javascript_runtime_targets: '浏览 JS 运行时目标',
  observe_javascript_runtime: '观察 JavaScript 运行时',
  compare_application_versions: '比较应用版本',
  compare_source_to_bundle: '比较源码与发布产物',
  compare_javascript_export_shapes: '比较 JavaScript 导出形状',
  build_reconstruction_obligation_ledger: '建立重构义务清单',
  evaluate_reconstruction_coverage: '评估重构覆盖率',
  project_android_application_graph: '生成 Android 应用关系图',
  project_apple_application_graph: '生成 Apple 应用关系图',
  project_harmony_application_graph: '生成 Harmony 应用关系图',
  capture_process_scenario: '录制进程场景',
  compare_process_captures: '比较进程记录',
  compare_artifacts: '比较工件',
  compare_functions: '比较函数',
  compare_bundles: '比较分析包',
  find_changed_behavior: '定位行为变化',
  build_call_path: '构建调用路径',
  correlate_static_and_runtime: '关联静态与运行时证据',
  update_unknown: '更新未知项',
  verify_unknown_resolution: '验证未知项是否已解决',
  get_navigation_context: '读取导航上下文',
  inspect_address_context: '检查地址上下文',

  open_binary: '打开分析目标',
  binary_overview: '应用概览',
  list_procedures: '浏览函数',
  procedure_pseudo_code: '函数反编译',
  procedure_assembly: '查看汇编',
  analyze_function: '分析函数',
  get_call_graph: '生成调用图',
  search_strings: '搜索字符串',
  search_procedures: '搜索函数',
  read_bytes: '读取字节',
  xrefs: '交叉引用',
  analyze_javascript_application: '分析 JS / Electron 架构',
  inspect_analysis_view: '浏览已保存的分析',
  trace_application_feature: '追踪应用功能',
  trace_javascript_semantics: '追踪 JavaScript 语义',
  inspect_managed_artifact: '.NET 程序集概览',
  inspect_managed_members: '查看类型与 CIL',
  inspect_android_package: '分析 APK',
  search_android_classes: '搜索 Android 类',
  inspect_android_class: '查看 Android 类',
  inspect_android_method: '反编译 Android 方法',
  decode_android_resources: '解码 Android 资源',
  identify_flutter_build: '识别 Flutter 构建',
  inspect_dart_aot: '检查 Dart AOT',
  list_browser_targets: '选择浏览器页面',
  inspect_web_page: '检查网页',
  analyze_web_bundle: '分析网页脚本',
  export_web_scripts: '导出网页脚本',
  capture_web_screenshot: '网页截图',
  recover_javascript_sources: '恢复 JavaScript 模块',
  verify_reconstruction: '验证重构实现',
  inspect_artifact: '检查安装包与资源',
  extract_artifact: '提取安装包',
  inspect_wasm_artifact: '检查 WASM / WAT',
  inspect_sqlite_database: '检查 SQLite 数据库',
  inspect_pe_resources: '读取 PE 资源',
  inspect_go_binary: '检查 Go 构建',
  inspect_rust_binary: '检查 Rust 依赖',
  inspect_evm_interface: '检查 EVM 接口',
  inspect_web_network_capture: '分析 HAR / mitmproxy',
  inspect_pcap_capture: '分析 PCAP',
  binary_session: '会话与依赖诊断',
  get_evidence_bundle: '读取完整证据包',
  export_evidence_bundle: '导出 REA 证据包',
  import_evidence_bundle: '导入 REA 证据包',
  close_binary: '关闭分析目标',
  list_adb_devices: '列出 Android 设备',
  list_unknowns: '查看未知项',
  record_unknown: '记录未知项'
}
