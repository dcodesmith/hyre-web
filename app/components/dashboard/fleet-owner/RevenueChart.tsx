import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { NameType, Payload, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useIsMobile } from "~/hooks/use-mobile";
import { formatCurrency } from "~/lib/utils";

interface RevenueChartProps {
  readonly data: Array<{ readonly date: Date; readonly revenue: number }>;
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const tooltipLabelFormatter = (_: unknown, payload: Payload<ValueType, NameType>[]) => {
  const value = payload?.[0]?.payload?.date;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const tooltipValueFormatter = (value: unknown) => formatCurrency(value as number);

const xAxisTickFormatter = (value: Date) => {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export function RevenueChart({ data }: RevenueChartProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("7d");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const filteredData = React.useMemo(() => {
    let daysToShow = 7;
    if (timeRange === "30d") {
      daysToShow = 30;
    } else if (timeRange === "90d") {
      daysToShow = 90;
    }
    return data.slice(-daysToShow);
  }, [data, timeRange]);

  const totalRevenue = filteredData.reduce((sum, day) => sum + day.revenue, 0);
  const avgRevenue = filteredData.length > 0 ? totalRevenue / filteredData.length : 0;

  return (
    <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-md dark:bg-card">
      <CardHeader className="relative">
        <CardTitle className="md:text-lg">
          {timeRange === "7d" && "Last 7 days revenue"}
          {timeRange === "30d" && "Last 30 days revenue"}
          {timeRange === "90d" && "Last 3 months revenue"}
        </CardTitle>
        <CardDescription className="mt-0">
          <span className="@[540px]/card:block hidden">
            Total {formatCurrency(totalRevenue)} • Avg {formatCurrency(avgRevenue)}
            /day
          </span>
          <span className="@[540px]/card:hidden">{formatCurrency(totalRevenue)} total</span>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(value) => value && setTimeRange(value)}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="90d" className="h-8 px-2.5">
              Last 3 months
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" className="h-8 px-2.5">
              Last 30 days
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" className="h-8 px-2.5">
              Last 7 days
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="@[767px]/card:hidden flex w-40"
              aria-label="Select a time range"
            >
              <SelectValue placeholder="Last 7 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <BarChart
            data={filteredData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={xAxisTickFormatter}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={tooltipLabelFormatter}
                  formatter={tooltipValueFormatter}
                  indicator="dot"
                />
              }
            />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
