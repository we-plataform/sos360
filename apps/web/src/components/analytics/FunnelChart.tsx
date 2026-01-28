import {
  Funnel,
  FunnelChart as RechartsFunnelChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface FunnelData {
  name: string;
  value: number;
  fill: string;
}

interface FunnelChartProps {
  data: {
    name: string;
    count: number;
    rate: number;
  }[];
}

const COLORS = [
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#10B981", // emerald-500
  "#3B82F6", // blue-500
  "#8B5CF6", // violet-500
];

export function FunnelChart({ data }: FunnelChartProps) {
  // Create a fixed shape by assigning descending values regardless of actual data
  // e.g., 100, 80, 60, 40, 20 for a 5-step funnel
  const stepSize = 100 / Math.max(data.length, 1);

  const chartData = data.map((item, index) => {
    const isEmpty = item.count === 0;

    return {
      name: item.name,
      // Fixed value for visualization shape
      value: 100 - index * (80 / Math.max(data.length - 1, 1)),
      realValue: item.count,
      // Use Gray-300 for empty, otherwise cycle colors
      fill: isEmpty ? "#d1d5db" : COLORS[index % COLORS.length],
    };
  });

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsFunnelChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <Tooltip
            formatter={(value: any, name: any, props: any) => [
              props.payload.realValue.toLocaleString(),
              "Leads",
            ]}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
          />
          <Funnel
            dataKey="value"
            data={chartData}
            isAnimationActive
            stroke="#fff"
            strokeWidth={4}
          >
            {/* Left side labels (Stage Name) */}
            <LabelList
              position="left"
              dataKey="name"
              stroke="none"
              fill="#6b7280" // gray-500
              style={{ fontSize: 12, fontWeight: 500 }}
            />
            {/* Center labels (Count) */}
            <LabelList
              position="center"
              dataKey="realValue"
              stroke="none"
              content={(props: any) => {
                const { x, y, width, height, value, index } = props;
                // Get the fill color from chartData using index
                const item = chartData[index];
                const textColor = item?.fill === "#d1d5db" ? "#000" : "#fff";

                return (
                  <text
                    x={x + width / 2}
                    y={y + height / 2 + 4} // +4 for vertical alignment correction
                    fill={textColor}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={14}
                    fontWeight="bold"
                  >
                    {value?.toLocaleString() ?? "0"}
                  </text>
                );
              }}
            />
          </Funnel>
        </RechartsFunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
