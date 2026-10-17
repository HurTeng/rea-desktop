export const TARGET_FORMATS = [
  'asar',
  'directory',
  'javascript',
  'source-map',
  'pe',
  'elf',
  'mach-o',
  'mach-o-universal',
  'dos-mz',
  'dos-com',
  'zip',
  'ipa',
  'apk',
  'msix',
  'appx',
  'hap',
  'hsp',
  'app-pack',
  'dmg',
  'pkg',
  'plist',
  'wasm',
  'sqlite',
  'har',
  'mitmproxy',
  'saz',
  'qlog',
  'dex',
  'class',
  'jeb-project',
  'hopper',
  'pcap',
  'firmware',
  'evm',
  'core',
  'signal',
  'web',
  'file'
] as const
export type TargetFormat = (typeof TARGET_FORMATS)[number]
export type TargetFamily =
  | 'javascript'
  | 'native'
  | 'managed'
  | 'android'
  | 'package'
  | 'network'
  | 'firmware'
  | 'data'
  | 'web'

export function isJavaScriptTarget(target: { format: TargetFormat }): boolean {
  return ['asar', 'directory', 'javascript'].includes(target.format)
}

export const FORMAT_FAMILIES = [
  {
    id: 'javascript',
    title: 'JavaScript / Electron',
    extensions: '.app / .asar / .js / .mjs / .cjs / .map / 目录',
    tools: ['analyze_javascript_application'],
    recovery: '随包脚本、内嵌 source map 源码；Wakaru 可恢复可读模块，受宿主与引擎限制。'
  },
  {
    id: 'native',
    title: '原生应用与库',
    extensions: '.exe / .dll / .sys / .hop / ELF / .so / .dylib / Mach-O / DOS',
    tools: ['open_binary', 'binary_overview', 'procedure_pseudo_code'],
    recovery: 'Ghidra / Hopper / IDA 返回函数伪代码和汇编，不能保证恢复原始源码工程。'
  },
  {
    id: 'managed',
    title: '.NET 托管程序集',
    extensions: '.exe / .dll（PE/CLI）',
    tools: ['inspect_managed_artifact', 'inspect_managed_members'],
    recovery:
      '可导出元数据与 CIL；REA 的 managed reconstruction 是外部反编译结果的验证导入，不是 C# 反编译器。'
  },
  {
    id: 'android',
    title: 'Android / Flutter',
    extensions: '.apk / .aab / .dex / .jar / .jdb2',
    tools: [
      'inspect_android_package',
      'identify_flutter_build',
      'inspect_dart_aot',
      'open_jeb_project'
    ],
    recovery:
      'JADX / JEB 可返回 Java、方法伪代码或 smali；Flutter AOT 检查不等于恢复 Dart 原始工程。'
  },
  {
    id: 'package',
    title: '安装包与应用资源',
    extensions: '.zip / .ipa / .msix / .appx / .dmg / .pkg / .app / .plist / .hap / .hsp',
    tools: ['inspect_artifact', 'extract_artifact'],
    recovery: '提取实际存在的文件、资源、脚本与源码映射；PKG 等格式的覆盖范围以工具报告为准。'
  },
  {
    id: 'data',
    title: 'WASM / SQLite / Go / Rust',
    extensions: '.wasm / .db / .sqlite / Go 与 Rust 可执行文件',
    tools: [
      'inspect_wasm_artifact',
      'inspect_sqlite_database',
      'inspect_go_binary',
      'inspect_rust_binary'
    ],
    recovery: 'WAT、表结构与离线样本、构建与符号线索；不能据此声称恢复原项目。'
  },
  {
    id: 'network',
    title: '网络与逻辑记录',
    extensions: '.har / mitmproxy / .saz / .qlog / .pcap / .pcapng / .vcd / .sr',
    tools: [
      'inspect_web_network_capture',
      'inspect_pcap_capture',
      'inspect_packet_capture',
      'decode_signal_recording'
    ],
    recovery: '保留的脚本和协议数据；采集或解码依赖对应引擎与操作系统。'
  },
  {
    id: 'firmware',
    title: '固件 / EVM / 崩溃记录',
    extensions: '.bin / .hex / EVM / ELF core',
    tools: ['inspect_firmware_regions', 'inspect_evm_interface', 'inspect_recorded_crash'],
    recovery: '分区、字节码接口与崩溃观察；Binwalk / Unblob / pwntools 等受宿主限制。'
  },
  {
    id: 'web',
    title: '网站与运行时',
    extensions: 'Chrome CDP / Electron Inspector / Android ADB / JEB',
    tools: ['inspect_web_page', 'analyze_web_bundle', 'list_adb_devices', 'inspect_jeb_client'],
    recovery: '已捕获的脚本、DOM、网络、设备与运行时证据。涉及执行或修改的操作必须由用户明确选择。'
  }
] as const
