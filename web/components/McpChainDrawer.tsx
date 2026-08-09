import { Drawer, List, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

export function McpChainDrawer({ opened, onClose, activeStep }: { opened: boolean; onClose: () => void; activeStep: number }) {
  const steps = ["填写筛选条件", "浏览器发起请求", "Bridge 调用 MCP", "渲染行情结果"];
  return <Drawer opened={opened} onClose={onClose} title="MCP 调用链路" position="bottom" size="md"><Stack><Text c="dimmed" size="sm">用于调试 Browser → HTTP Bridge → STDIO MCP 的真实请求过程。</Text><List spacing="md" center icon={<ThemeIcon color="blue" size={22} radius="xl"><IconCheck size={14} /></ThemeIcon>}>{steps.map((step, index) => <List.Item key={step}><Text fw={index + 1 <= activeStep ? 700 : 400}>{index + 1}. {step}</Text></List.Item>)}</List><Text size="xs" c="dimmed">场外基金正式净值可能在收盘后更新，页面不会把前一交易日数据伪装成实时价格。</Text></Stack></Drawer>;
}
