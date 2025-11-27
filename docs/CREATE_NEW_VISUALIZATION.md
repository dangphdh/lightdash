# Creating a New Visualization in Lightdash

This guide walks you through the complete process of adding a new visualization type (chart type) to Lightdash.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Step-by-Step Implementation](#step-by-step-implementation)
3. [Frontend Implementation](#frontend-implementation)
4. [Backend Implementation](#backend-implementation)
5. [Database Changes](#database-changes)
6. [Type Definitions](#type-definitions)
7. [Testing](#testing)
8. [Example: Adding a Scatter Chart](#example-adding-a-scatter-chart)

## Architecture Overview

Lightdash uses a monorepo structure with clear separation between frontend and backend visualization handling:

```
┌─────────────────────────────────────────────┐
│          Frontend (React + Vite)            │
│  - Simple[ChartName] component              │
│  - [ChartName]Config configuration panel    │
│  - useEcharts[ChartName]Config hook         │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│       Common Types & Interfaces             │
│  - ChartType enum                           │
│  - ChartKind enum                           │
│  - Viz[ChartName]Config & Options types     │
│  - Migration types                          │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│    Backend (Express.js + PostgreSQL)        │
│  - Database chart_types table               │
│  - Migration file                           │
│  - Saved chart validation                   │
└─────────────────────────────────────────────┘
```

### Chart Type Hierarchy

Lightdash maintains two chart type enums:

- **`ChartType`**: High-level grouping (cartesian, table, pie, funnel, treemap, gauge, custom, big_number)
- **`ChartKind`**: Specific visualization variants (line, vertical_bar, horizontal_bar, scatter, area, mixed, pie, table, big_number, funnel, custom, treemap, gauge)

## Step-by-Step Implementation

### Phase 1: Type Definitions

**Step 1: Add chart type enum values**

In `packages/common/src/types/savedCharts.ts`:

```typescript
export enum ChartKind {
    // ... existing kinds ...
    MY_CHART = 'my_chart',  // Add your new kind
}

export enum ChartType {
    // ... existing types ...
    MY_CHART = 'my_chart',  // Add your new high-level type (if not already covered)
}
```

**Step 2: Define visualization config types**

Still in `packages/common/src/types/savedCharts.ts`, add types for your chart configuration:

```typescript
// Display options visible in the UI
export type MyChartDisplay = {
    // e.g., for a gauge:
    minValue?: number;
    maxValue?: number;
    showPercentage?: boolean;
};

// Main configuration type
export type MyChart = {
    metricId?: string;
    dimensionId?: string;
    // ... chart-specific options ...
};

// Configuration to persist in database
export type MyChartConfig = {
    type: ChartKind.MY_CHART;
    fieldConfig?: PivotChartLayout;
    display?: MyChartDisplay;
};
```

**Step 3: Update union types**

In `packages/common/src/types/savedCharts.ts`, add your config to the union type:

```typescript
export type AllChartConfig =
    | CartesianChartConfig
    | TableConfig
    | PieChartConfig
    | MyChartConfig  // Add this
    | /* ... other configs ... */;
```

### Phase 2: Backend Database Changes

**Step 4: Create a database migration**

In `packages/backend/src/database/migrations/`, create a new file following the naming pattern `YYYYMMDDHHMMSS_add-my-chart-type.ts`:

```typescript
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex('chart_types').insert({ chart_type: 'my_chart' });
}

export async function down(knex: Knex): Promise<void> {
    await knex('saved_queries_versions')
        .where('chart_type', 'my_chart')
        .delete();
    await knex('chart_types')
        .delete()
        .where('chart_type', 'my_chart');
}
```

Run migrations:
```bash
cd packages/backend
pnpm db:migrate
```

### Phase 3: Frontend Implementation

**Step 5: Create the main visualization component**

Create `packages/frontend/src/components/Simple[ChartName]/index.tsx`:

```typescript
import { memo, useCallback, useEffect, useState, type FC } from 'react';
import { type EChartsReactProps, type Opts } from 'echarts-for-react/lib/types';
import useEchartsMyChartConfig from '../../hooks/echarts/useEchartsMyChartConfig';
import EChartsReact from '../EChartsReactWrapper';
import { useVisualizationContext } from '../LightdashVisualization/useVisualizationContext';
import SuboptimalState from '../common/SuboptimalState/SuboptimalState';

type SimpleMyChartProps = Omit<EChartsReactProps, 'option'> & {
    isInDashboard: boolean;
    $shouldExpand?: boolean;
    className?: string;
    'data-testid'?: string;
};

const EchartOptions: Opts = { renderer: 'svg' };

const SimpleMyChart: FC<SimpleMyChartProps> = memo((props) => {
    const { chartRef, isLoading, resultsData } = useVisualizationContext();
    const chartConfig = useEchartsMyChartConfig();

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!resultsData || resultsData.length === 0) {
        return (
            <SuboptimalState
                title="No data available"
                description="Query metrics and dimensions with results."
            />
        );
    }

    return (
        <EChartsReact
            ref={chartRef}
            option={chartConfig}
            opts={EchartOptions}
            {...props}
        />
    );
});

SimpleMyChart.displayName = 'SimpleMyChart';

export default SimpleMyChart;
```

**Step 6: Create the eCharts config hook**

Create `packages/frontend/src/hooks/echarts/useEchartsMyChartConfig.ts`:

```typescript
import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { useVisualizationContext } from '../../components/LightdashVisualization/useVisualizationContext';

const useEchartsMyChartConfig = (): EChartsOption => {
    const { visualizationConfig, resultsData, colorPalette } =
        useVisualizationContext();

    return useMemo(() => {
        if (!visualizationConfig || !resultsData || resultsData.length === 0) {
            return {};
        }

        // Transform resultsData into eCharts format
        const series = resultsData.map((row) => ({
            value: row.metric_value,
            name: row.dimension_name,
        }));

        return {
            // Configure your chart here
            // For example, gauge chart:
            series: [
                {
                    type: 'gauge',
                    min: 0,
                    max: 100,
                    data: series,
                    // ... gauge-specific config ...
                },
            ],
            // ... other eCharts options ...
        };
    }, [visualizationConfig, resultsData, colorPalette]);
};

export default useEchartsMyChartConfig;
```

**Step 7: Create configuration panel component**

Create `packages/frontend/src/components/VisualizationConfigs/MyChartConfig/index.tsx`:

```typescript
import { type FC } from 'react';
import { Box, NumberInput, Group } from '@mantine/core';
import type { MyChartConfig } from '@lightdash/common';
import { Config } from '../common/Config';

type Props = {
    chartConfig: MyChartConfig | undefined;
    onChartConfigChange?: (chartConfig: MyChartConfig) => void;
};

const MyChartConfig: FC<Props> = ({ chartConfig, onChartConfigChange }) => {
    if (!chartConfig) return null;

    const display = chartConfig.display || {};

    const handleMinValueChange = (value: number | '') => {
        if (onChartConfigChange) {
            onChartConfigChange({
                ...chartConfig,
                display: {
                    ...display,
                    minValue: value === '' ? undefined : value,
                },
            });
        }
    };

    return (
        <Box>
            <Config.Section>
                <Group spacing="md">
                    <NumberInput
                        label="Minimum Value"
                        value={display.minValue}
                        onChange={handleMinValueChange}
                        placeholder="0"
                    />
                    {/* Add more configuration options */}
                </Group>
            </Config.Section>
        </Box>
    );
};

export default MyChartConfig;
```

**Step 8: Register visualization in main component**

In `packages/frontend/src/components/LightdashVisualization/index.tsx`:

```typescript
import SimpleMyChart from '../SimpleMyChart';

// Add to imports at the top
const LightdashVisualization = memo(
    forwardRef<HTMLDivElement, LightdashVisualizationProps>(
        // ... existing code ...
        () => {
            switch (visualizationConfig.chartType) {
                // ... existing cases ...
                case ChartType.MY_CHART:
                    return (
                        <SimpleMyChart
                            className={className}
                            isInDashboard={!!isDashboard}
                            $shouldExpand
                            data-testid={props['data-testid']}
                            {...props}
                        />
                    );
                // ...
            }
        },
    ),
);
```

**Step 9: Add configuration panel routing**

In `packages/frontend/src/components/VisualizationConfigs/ChartConfigPanel/index.tsx`, add handling for your chart type:

```typescript
// Import your config component
import MyChartConfig from '../MyChartConfig';

// In the render logic:
if (isMyChartConfig(chartConfig)) {
    return <MyChartConfig chartConfig={chartConfig} />;
}
```

Create type guard in `packages/common/src/visualizations/types/index.ts`:

```typescript
export const isMyChartConfig = (
    config: AllVizChartConfig,
): config is MyChartConfig => config.type === ChartKind.MY_CHART;
```

### Phase 4: Visualization Selection UI

**Step 10: Add chart icon and label**

In `packages/frontend/src/components/common/ResourceIcon/utils.ts`, add to `getChartIcon`:

```typescript
import { IconMyChartIcon } from '@tabler/icons-react'; // Use appropriate icon

export const getChartIcon = (chartKind: ChartKind): Icon => {
    switch (chartKind) {
        // ... existing cases ...
        case ChartKind.MY_CHART:
            return IconMyChartIcon;
        // ...
    }
};
```

**Step 11: Make chart selectable**

Update any chart type selector components to include your new chart kind.

### Phase 5: Optional - Backend Services

**Step 12: Update API validation (if needed)**

In `packages/backend/src/services/SavedQuestionService.ts`, ensure your chart config is properly validated when saved/loaded.

**Step 13: Update AI agent support (if EE)**

In `packages/common/src/ee/AiAgent/chartConfig/`, add your chart to available chart types if using AI features.

## Frontend Implementation Details

### Context and Data Access

Use the `VisualizationContext` to access:

```typescript
const {
    visualizationConfig,    // Current chart config
    resultsData,           // Query results array
    isLoading,             // Loading state
    chartRef,              // Reference to chart element
    colorPalette,          // App color theme
    apiErrorDetail,        // Any API errors
} = useVisualizationContext();
```

### eCharts Integration

Lightdash uses **eCharts** for most visualizations (except custom Vega-Lite). Reference:
- [eCharts Documentation](https://echarts.apache.org/)
- Existing examples: `SimplePieChart`, `FunnelChart`, `SimpleGauge`

### Styling & Theme

Use Mantine components and emotion for styling:

```typescript
import { Box, Group, Text } from '@mantine/core';
import styled from '@emotion/styled';

const StyledContainer = styled(Box)`
    display: flex;
    justify-content: center;
    align-items: center;
`;
```

## Type Definitions

### Essential Types

```typescript
// Base config all visualizations inherit
export type VizBaseConfig = {
    fieldConfig?: PivotChartLayout;
};

// Your specific chart config
export type VizMyChartConfig = VizBaseConfig & {
    type: ChartKind.MY_CHART;
    display?: MyChartDisplay;
};

// Display/UI configuration
export type VizMyChartDisplay = {
    // UI-specific rendering options
};

// Options for configurator
export type VizMyChartOptions = {
    // Options users can modify
};
```

## Testing

### Unit Tests

Create `packages/frontend/src/components/SimpleMyChart/SimpleMyChart.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import SimpleMyChart from './index';
import { VisualizationProvider } from '../LightdashVisualization';

describe('SimpleMyChart', () => {
    it('renders loading state', () => {
        render(
            <VisualizationProvider
                visualizationConfig={mockConfig}
                resultsData={undefined}
                isLoading={true}
            >
                <SimpleMyChart isInDashboard={false} />
            </VisualizationProvider>,
        );

        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('renders chart with data', () => {
        render(
            <VisualizationProvider
                visualizationConfig={mockConfig}
                resultsData={mockData}
                isLoading={false}
            >
                <SimpleMyChart isInDashboard={false} />
            </VisualizationProvider>,
        );

        expect(screen.getByTestId('my-chart')).toBeInTheDocument();
    });
});
```

### E2E Tests

In `packages/e2e/cypress/e2e/app/`, add chart interaction tests:

```typescript
describe('My Chart Visualization', () => {
    it('displays my chart when selected', () => {
        cy.visit('/project/dashboard');
        cy.selectChartType('my_chart');
        cy.get('[data-testid="my-chart"]').should('be.visible');
    });
});
```

### Code Quality

```bash
# Type checking
pnpm -F frontend typecheck

# Linting
pnpm -F frontend lint

# Testing
pnpm -F frontend test
```

## Example: Adding a Scatter Chart

Here's a concrete example of adding a **Scatter Chart** visualization.

### 1. Type Definitions (`packages/common/src/types/savedCharts.ts`)

```typescript
export enum ChartKind {
    SCATTER = 'scatter',
    // ... others ...
}

export enum ChartType {
    CARTESIAN = 'cartesian', // Scatter uses cartesian type
    // ... others ...
}

export type ScatterChartDisplay = {
    series: Array<{
        id: string;
        size?: number;
        opacity?: number;
    }>;
};

export type VizScatterChartConfig = VizBaseConfig & {
    type: ChartKind.SCATTER;
    fieldConfig: PivotChartLayout | undefined;
    display: ScatterChartDisplay | undefined;
};
```

### 2. Migration (`packages/backend/src/database/migrations/20250101000000_add-scatter-chart.ts`)

```typescript
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex('chart_types').insert({ chart_type: 'scatter' });
}

export async function down(knex: Knex): Promise<void> {
    await knex('saved_queries_versions')
        .where('chart_type', 'scatter')
        .delete();
    await knex('chart_types').delete().where('chart_type', 'scatter');
}
```

### 3. eCharts Config Hook

```typescript
// packages/frontend/src/hooks/echarts/useEchartsScatterConfig.ts
const useEchartsScatterConfig = (): EChartsOption => {
    const { visualizationConfig, resultsData } = useVisualizationContext();
    const chartConfig = visualizationConfig as VizScatterChartConfig;

    return useMemo(() => {
        const xField = chartConfig.fieldConfig?.xField;
        const yField = chartConfig.fieldConfig?.yField?.[0];

        const series = [
            {
                type: 'scatter',
                data: resultsData?.map((row) => [
                    row[xField],
                    row[yField],
                ]) || [],
                symbolSize: 8,
                itemStyle: {
                    color: colorPalette[0],
                },
            },
        ];

        return {
            xAxis: { type: 'value' },
            yAxis: { type: 'value' },
            series,
            tooltip: { trigger: 'item' },
        };
    }, [visualizationConfig, resultsData, colorPalette]);
};

export default useEchartsScatterConfig;
```

### 4. Component

```typescript
// packages/frontend/src/components/SimpleScatterChart/index.tsx
const SimpleScatterChart: FC<SimpleScatterChartProps> = memo((props) => {
    const { chartRef, isLoading, resultsData } = useVisualizationContext();
    const chartConfig = useEchartsScatterConfig();

    if (isLoading) return <LoadingChart />;
    if (!resultsData?.length) return <EmptyChart />;

    return (
        <EChartsReact
            ref={chartRef}
            option={chartConfig}
            opts={EchartOptions}
            {...props}
        />
    );
});
```

### 5. Register in LightdashVisualization

```typescript
case ChartType.CARTESIAN:
    if (visualizationConfig.chartKind === ChartKind.SCATTER) {
        return <SimpleScatterChart {...props} />;
    }
    return <SimpleChart {...props} />;
```

## Debugging

### Common Issues

| Issue | Solution |
|-------|----------|
| Chart not rendering | Check `visualizationConfig` and `resultsData` in context |
| Type errors | Ensure types are exported from `packages/common/src/types/` |
| eCharts config wrong | Validate against eCharts docs and use browser dev tools |
| Component not showing | Verify case added in `LightdashVisualization` switch statement |
| Database error on save | Run migrations: `pnpm db:migrate` |

### Debugging Tools

```bash
# Check all types compile
pnpm -F common typecheck

# Run frontend in watch mode
pnpm -F frontend dev

# Debug in browser
# Open DevTools and check Redux state in visualization context
```

## Best Practices

1. **Performance**: Memoize components and hooks with `useMemo` and `memo`
2. **Accessibility**: Add proper ARIA labels and keyboard navigation
3. **Error Handling**: Gracefully handle empty/invalid data
4. **Responsive Design**: Test on mobile and ensure `$shouldExpand` works
5. **Type Safety**: Don't use `any` types; define proper interfaces
6. **Testing**: Add unit and E2E tests for your visualization
7. **Documentation**: Add comments explaining chart-specific logic

## Related Resources

- [Architecture Overview](./ARCHITECTURE.md)
- [Frontend Patterns](./DEVELOPMENT_WORKFLOW.md)
- [Testing Guide](./TESTING.md)
- [eCharts Documentation](https://echarts.apache.org/)
- [Mantine UI Components](https://mantine.dev/)

