export const demo = [
  { id: 'demo-001', source: '演示数据 · messages', metadata: { title: '本地解析与工具调用', model: '示例模型' }, messages: [
    { role: 'system', content: '你是一个协作助手。输入文件只在浏览器本地处理。' },
    { role: 'user', content: '请帮我核对这份 JSONL，并展示执行过程。' },
    { role: 'assistant', content: '我会先检查数据结构。\n\n- 读取每一行 JSON\n- 保留原始 message_index\n- 识别可渲染的字段', tool_calls: [{ id: 'demo-call', type: 'function', function: { name: 'inspect_jsonl', arguments: '{"file":"example.jsonl"}' } }] },
    { role: 'tool', tool_call_id: 'demo-call', content: '{"rows": 3, "valid": 3, "errors": 0}' },
    { role: 'assistant', content: '核对完成：**3 条记录全部有效**。\n\n| 字段 | 用途 |\n| --- | --- |\n| messages | 执行轨迹 |\n| result | 规则识别结果 |\n\n可以在右侧点击蓝色 M# 或紫色 C#，验证定位。' },
  ], result: { basic_info: { status: 'success', note: '此数据仅用于演示，不包含你的上传内容' }, rule_result: { matched: true, message_index: 2, tool_call_chain: [2, 3] }, filter_result: { accepted: true, evidence: { message_index: 4 } } },
    tool_call_records: [{ name: 'inspect_jsonl', message_index: 2, arguments: { file: 'example.jsonl' }, response: { message_index: 3, rows: 3 } }] },
  { id: 'demo-002', source: '演示数据 · inputs', inputs: { system: '这是一条未转换的输入结构。', messages: [{ from: 'human', value: 'inputs 也能渲染吗？' }, { from: 'gpt', value: '可以。选择 inputs 字段，工具会尝试识别其中的消息数组。系统信息单独显示，不改变数组索引。' }] }, result: { supported: true, message_index: 1 } },
  { id: 'demo-003', source: '演示数据 · 原始输入', inputs: { task: '没有消息角色的业务输入', options: { limit: 10 }, items: ['A', 'B'] }, result: { explanation: '不可识别为对话时，保留原始输入，不编造 user / assistant 轨迹。' } },
];
export function demoFile() { return new File([demo.map(row => JSON.stringify(row)).join('\n')], '演示数据.jsonl', { type: 'application/x-ndjson' }); }
