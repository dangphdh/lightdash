# Mô tả Chi tiết Luồng Phân tích Dashboard bằng AI trong Lightdash

## I. Tổng Quan

Lightdash cung cấp 3 chính năng phân tích dashboard bằng AI:

1. **Dashboard Summary** - Tạo tóm tắt tự động cho toàn bộ dashboard
2. **Chart Summary** - Phân tích từng biểu đồ trong dashboard
3. **Custom Visualization** - Tạo biểu đồ tùy chỉnh dựa trên yêu cầu tự nhiên

---

## II. Kiến Trúc Tổng Thể

```
Frontend (React)
       │
       ├─→ POST /api/v1/ai/:projectUuid/dashboard/:dashboardUuid/summary
       ├─→ GET  /api/v1/ai/:projectUuid/dashboard/:dashboardUuid/summary
       └─→ POST /api/v1/ai/:projectUuid/custom-viz
       │
       ▼
AiController (Express.js)
       │
       ├─→ createDashboardSummary()
       ├─→ getDashboardSummary()
       └─→ generateCustomViz()
       │
       ▼
AiService (Business Logic)
       │
       ├─→ getDashboardChartsResults()
       ├─→ createChartSummary()
       ├─→ createDashboardSummary()
       ├─→ getDashboardSummary()
       └─→ generateCustomViz()
       │
       ▼
OpenAI API (LangChain + Claude/GPT)
       │
       └─→ Trả về insights và tóm tắt
```

---

## III. Chi Tiết Luồng Dashboard Summary

### 3.1. Giai Đoạn 1: Khởi tạo Yêu cầu

**Endpoint:** `POST /api/v1/ai/:projectUuid/dashboard/:dashboardUuid/summary`

**Request Body:**
```json
{
  "context": "Hiểu biết thêm về xu hướng doanh số",
  "tone": "professional",
  "audiences": ["executives", "sales_team"]
}
```

**Controllers:** `packages/backend/src/ee/controllers/aiController.ts`
```typescript
async createDashboardSummary(
    @Path() projectUuid: string,
    @Path() dashboardUuid: string,
    @Body() body: Pick<DashboardSummary, 'context' | 'tone' | 'audiences'>,
)
```

### 3.2. Giai Đoạn 2: Trích Xuất Dữ Liệu Dashboard

**Service:** `packages/backend/src/ee/services/AiService/AiService.ts`

**Bước 2.1: Lấy Thông Tin Dashboard**
```typescript
const dashboard = await this.dashboardModel.getByIdOrSlug(dashboardUuid);
```
- Truy vấn cơ sở dữ liệu để lấy cấu hình dashboard
- Lấy danh sách các tiles/biểu đồ trong dashboard

**Bước 2.2: Trích Xuất Kết Quả Từ Các Chart**
```typescript
async getDashboardChartsResults(user: SessionUser, dashboard: DashboardDAO)
```

Quá trình này:
1. Tìm tất cả chart UUIDs từ dashboard tiles
2. Với mỗi chart:
   - Gọi `projectService.getChartAndResults()` để lấy dữ liệu
   - Áp dụng dashboard filters/sorts vào từng chart
   - Chuyển đổi dữ liệu thành CSV format

**Pseudocode:**
```typescript
const chartUuids = dashboard.tiles
  .filter(tile => isDashboardChartTileType(tile))
  .map(tile => tile.properties.savedChartUuid);

const chartPromises = chartUuids.map(async (chartUuid) => {
  // Lấy data + metadata của chart
  const chartAndResults = await projectService.getChartAndResults({
    account: fromSession(user),
    dashboardUuid: dashboard.uuid,
    chartUuid,
    dashboardFilters: dashboard.filters,
    context: QueryExecutionContext.AI,
  });
  
  // Chuẩn bị columns
  const columns = [
    ...chartAndResults.metricQuery.dimensions,
    ...chartAndResults.metricQuery.metrics,
    ...chartAndResults.metricQuery.tableCalculations.map(tc => tc.name),
    ...chartAndResults.metricQuery.customDimensions?.map(cd => cd.id) ?? [],
  ];
  
  // Chuyển đổi sang CSV
  const data = await makeResultsCSV(columns, chartAndResults.rows);
  
  return {
    name: chartAndResults.chart.name,
    description: chartAndResults.chart.description,
    data, // CSV format
    columns,
    fields: chartAndResults.fields, // ItemsMap
  };
});

return Promise.all(chartPromises);
```

**Output của Giai Đoạn 2:**
```typescript
type ChartPromptData = {
  name: string;              // Tên chart
  description?: string;      // Mô tả chart
  data: string;             // Dữ liệu CSV
  columns: string[];        // Danh sách columns
  fields: ItemsMap;         // Thông tin chi tiết field
}[]
```

### 3.3. Giai Đoạn 3: Phân Tích Từng Chart (Parallel Processing)

**Method:** `async createChartSummary(chartData: ChartPromptData)`

**Bước 3.1: Chuẩn Bị Dữ Liệu Cho Prompt**
```typescript
const fieldInsights = chartData.columns
  .map((col) => fieldDesc(col, chartData.fields[col]))
  .join('\n');
```

Kết quả:
```
metric_name (Number): Số tiền bán được
created_date (Date): Ngày tạo đơn hàng
category (String): Danh mục sản phẩm
...
```

**Bước 3.2: Gửi Prompt Đến OpenAI**
```typescript
const { result, tokenUsage } = await this.openAi.run(
  DEFAULT_CHART_SUMMARY_PROMPT,
  {
    chart_data: chartData.data,          // CSV data
    field_insights: fieldInsights,       // Metadata
    chart_name: chartData.name,
    chart_description: chartData.description ?? '',
  }
);
```

**Prompt Template:**
```
Bạn là một trợ lý phân tích dữ liệu chuyên nghiệp.

Bạn sẽ được xem dữ liệu biểu đồ dưới dạng bảng CSV với hàng tiêu đề.
Dữ liệu đại diện cho biểu đồ tên "{chart_name}" với mô tả "{chart_description}".

Thông tin các chiều và chỉ số:
{field_insights}

Dữ liệu biểu đồ:
{chart_data}

Yêu cầu:
1. Phân tích dữ liệu và rút ra insights & nhận xét
2. Luôn bao gồm dữ liệu cụ thể để hỗ trợ insights
3. Chỉ trả về insights, không mô tả dữ liệu
```

**Output của Giai Đoạn 3:**
```
[
  { chartName: "Revenue Trend", summary: "Doanh số tăng...", tokenUsage: {...} },
  { chartName: "Category Breakdown", summary: "Danh mục A chiếm...", tokenUsage: {...} },
  ...
]
```

### 3.4. Giai Đoạn 4: Tổng Hợp Dashboard Summary

**Bước 4.1: Định Dạng Chart Summaries**
```typescript
const formattedSummaries = formatSummaryArray(chartSummaryResults);
```

Kết quả (Markdown format):
```markdown
## Revenue Trend
Doanh số tăng 45% so với tháng trước...

## Category Breakdown
Danh mục A chiếm 30% tổng doanh số...
```

**Bước 4.2: Gửi Prompt Tổng Hợp Đến OpenAI**
```typescript
const dashboardSummaryResult = await this.openAi.run(
  DEFAULT_DASHBOARD_SUMMARY_PROMPT,
  {
    chart_summaries: formattedSummaries,  // Formatted insights
    context: context ?? '',               // Additional context
    audiences: audiences.join(', '),      // "executives, sales_team"
    tone,                                 // "professional"
  }
);
```

**Prompt Template:**
```
Các insights sau đã được rút ra từ dữ liệu của từng biểu đồ:

{chart_summaries}

Tóm tắt các insights này thành một tóm tắt dashboard ngắn gọn:

Guidelines:
1. Không chỉ lặp lại insights mà cần cung cấp cái nhìn tổng thể
2. Bao gồm dữ liệu cụ thể để hỗ trợ kết luận
3. Tìm các mối liên hệ giữa dữ liệu
4. Định dạng kết quả dưới dạng Markdown
5. Không có tiêu đề, không có code block
6. Tone: {tone}
7. Đối tượng: {audiences}

Context thêm:
{context}
```

**Output:**
```markdown
Doanh số tổng thể tăng 45% với sự tăng trưởng mạnh mẽ từ danh mục A...
Lợi nhuận ròng tăng 38% nhờ tối ưu hóa chi phí...
Dự báo: Duy trì tăng trưởng 25-30% trong quý tiếp theo nếu tiếp tục chiến lược hiện tại
```

### 3.5. Giai Đoạn 5: Lưu Trữ Kết Quả

**Method:** `dashboardSummaryModel.save()`
```typescript
const dashboardSummary = await this.dashboardSummaryModel.save(
  dashboard.uuid,
  dashboard.dashboardVersionId,
  dashboardSummaryText,      // Kết quả phân tích
  tone,
  audiences,
  context
);
```

**Database Entity:** `packages/backend/src/ee/database/entities/aiDashboardSummary.ts`

Lưu trữ:
- Dashboard UUID
- Dashboard Version ID
- Summary text
- Tone & Audiences
- Created/Updated timestamps

### 3.6. Giai Đoạn 6: Analytics & Response

**Analytics Tracking:**
```typescript
this.analytics.track<DashboardSummaryCreated>({
  userId: user.userUuid,
  event: 'ai.dashboard_summary.executed',
  properties: {
    openAIModelName: 'claude-3-sonnet',
    organizationId: user.organizationUuid,
    projectId: projectUuid,
    dashboardId: dashboardUuid,
    responseSize: dashboardSummaryText.length,
    tokenUsage: totalTokens,
    timeGetCharts,        // ms để lấy dữ liệu
    timeOpenAi,          // ms để gọi OpenAI
    timeTotal,           // Tổng thời gian
  }
});
```

**Response:**
```json
{
  "status": "ok",
  "results": {
    "dashboardSummaryUuid": "abc123...",
    "dashboardUuid": "xyz789...",
    "summary": "Doanh số tổng thể tăng 45%...",
    "tone": "professional",
    "audiences": ["executives", "sales_team"],
    "context": "Hiểu biết thêm về xu hướng doanh số",
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

---

## IV. Chi Tiết Luồng Lấy Dashboard Summary (GET)

### 4.1. Endpoint

**GET** `/api/v1/ai/:projectUuid/dashboard/:dashboardUuidOrSlug/summary`

### 4.2. Luồng Xử Lý

```typescript
async getDashboardSummary(
  user: SessionUser,
  projectUuid: string,
  dashboardUuidOrSlug: string
)
{
  // 1. Kiểm tra feature flag
  await AiService.throwOnFeatureDisabled(user);
  
  // 2. Lấy dashboard
  const dashboard = await this.dashboardModel.getByIdOrSlug(dashboardUuidOrSlug);
  
  // 3. Lấy summary từ database
  const dashboardSummary = await this.dashboardSummaryModel
    .getByDashboardUuid(dashboard.uuid);
  
  // 4. Track analytics
  this.analytics.track<DashboardSummaryViewed>({
    userId: user.userUuid,
    event: 'ai.dashboard_summary.viewed',
    properties: { ... }
  });
  
  // 5. Return kết quả
  return dashboardSummary;
}
```

---

## V. Chi Tiết Luồng Custom Visualization

### 5.1. Endpoint

**POST** `/api/v1/ai/:projectUuid/custom-viz`

### 5.2. Request

```json
{
  "prompt": "Tạo một biểu đồ thể hiện doanh số theo tháng",
  "itemsMap": {
    "field_1": { "id": "field_1", "name": "created_date", "type": "DATE" },
    "metric_1": { "id": "metric_1", "name": "revenue", "type": "NUMBER" }
  },
  "sampleResults": [
    { "created_date": "2025-01-01", "revenue": 10000 },
    { "created_date": "2025-01-02", "revenue": 12000 }
  ],
  "currentVizConfig": "{}" 
}
```

### 5.3. Luồng Xử Lý

**Bước 1: Chuẩn Bị Dữ Liệu**
```typescript
const fields = Object.values(itemsMap).map((item) => ({
  id: getItemId(item),
  name: item.name,
  type: item.type,
  fieldType: isField(item) ? item.fieldType : undefined,
}));

// Output:
// [
//   { id: "field_1", name: "created_date", type: "DATE", fieldType: "DATE" },
//   { id: "metric_1", name: "revenue", type: "NUMBER", fieldType: "METRIC" }
// ]
```

**Bước 2: Gửi Prompt Đến OpenAI**
```typescript
const openAiResponse = await this.openAi.run(
  DEFAULT_CUSTOM_VIZ_PROMPT,
  {
    user_prompt: "Tạo một biểu đồ thể hiện doanh số theo tháng",
    fields: JSON.stringify(fields),
    sample_data: JSON.stringify(sampleResults),
    current_viz_config: currentVizConfig,
  }
);
```

**Prompt Template:**
```
Bạn là một trợ lý tạo biểu đồ Vega-Lite chuyên nghiệp.

Người dùng yêu cầu:
{user_prompt}

Các field có sẵn:
{fields}

Dữ liệu mẫu:
{sample_data}

Cấu hình Vega-Lite hiện tại:
{current_viz_config}

Guidelines:
1. Nếu không chỉ định loại biểu đồ, chọn loại phù hợp nhất
2. Ưu tiên đặt DATE/TIMESTAMP trên X-axis, NUMBER trên Y-axis
3. Trả về JSON Vega-Lite đầy đủ, không có giải thích
```

**Output:**
```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Monthly revenue trend",
  "data": {
    "values": [
      { "created_date": "2025-01-01", "revenue": 10000 },
      { "created_date": "2025-01-02", "revenue": 12000 }
    ]
  },
  "mark": "line",
  "encoding": {
    "x": { "field": "created_date", "type": "temporal" },
    "y": { "field": "revenue", "type": "quantitative" }
  }
}
```

### 5.4. Analytics

```typescript
this.analytics.track<CustomVizGenerated>({
  userId: user.userUuid,
  event: 'ai.custom_viz.generated',
  properties: {
    openAIModelName: 'claude-3-sonnet',
    organizationId: user.organizationUuid,
    projectId: projectUuid,
    prompt,
    responseSize: vegaConfigResult.length,
    tokenUsage: totalTokens,
    timeOpenAi,
  }
});
```

---

## VI. Feature Flags & Permissions

### 6.1. Feature Flags

- **ai-dashboard-summary**: Kích hoạt/vô hiệu hóa Dashboard Summary
- **AiCustomViz**: Kích hoạt/vô hiệu hóa Custom Visualization

### 6.2. Kiểm Tra Feature

```typescript
private static async throwOnFeatureDisabled(user: SessionUser) {
  const isAIDashboardSummaryEnabled = await isFeatureFlagEnabled(
    'ai-dashboard-summary',
    user,
    { throwOnTimeout: true }
  );

  if (!isAIDashboardSummaryEnabled) {
    throw new Error('AI Dashboard summary feature not enabled!');
  }
}
```

### 6.3. Permissions

- Người dùng phải được xác thực (middleware: `isAuthenticated`)
- Có thể sử dụng API key (middleware: `allowApiKeyAuthentication`)
- Cần quyền truy cập vào project

---

## VII. Luồng Agent V2 (AI Agents)

### 7.1. Kiến Trúc Agent

**File:** `packages/backend/src/ee/services/ai/agents/agentV2.ts`

```typescript
export const defaultAgentOptions = {
  toolChoice: 'auto' as const,
  stopWhen: stepCountIs(20),      // Tối đa 20 bước
  maxRetries: 6,
};
```

### 7.2. Tools Có Sẵn

Agent có quyền truy cập đến các tools:

1. **findExplores** - Tìm explores (bảng dữ liệu)
2. **findFields** - Tìm các field/cột cần thiết
3. **findContent** - Tìm dashboards, charts
4. **runQuery** - Thực thi query trên warehouse
5. **searchFieldValues** - Tìm kiếm giá trị cụ thể trong field
6. **generateDashboard** / **generateDashboardV2** - Tạo dashboard
7. **improveContext** - Cải thiện context cho truy vấn
8. **proposeChange** - Đề xuất thay đổi

### 7.3. Luồng Execution

```
User Message
    │
    ▼
Agent Reasoning
    │
    ├─→ Analyze user intent
    ├─→ Select appropriate tools
    ├─→ Call tools in sequence or parallel
    │
    ▼
Tool Execution
    │
    ├─→ findExplores (Find relevant tables)
    ├─→ runQuery (Execute query on warehouse)
    ├─→ generateDashboard (Create visualizations)
    │
    ▼
Response Generation
    │
    └─→ Return results to user
```

### 7.4. Repair Tool Call Mechanism

Nếu tool call không hợp lệ, Agent sẽ cố gắng sửa:

```typescript
const getRepairToolCall = (args, tools): ToolCallRepairFunction => 
  async ({ messages, error, toolCall, inputSchema }) => {
    if (NoSuchToolError.isInstance(error)) {
      return null; // Tool không tồn tại
    }

    // Tạo prompt để sửa arguments
    const { object: repairedArgs } = await generateObject({
      model: args.model,
      schema: tool.inputSchema,
      messages: [...conversationHistory, ...repairPrompt],
    });

    return { ...toolCall, args: JSON.stringify(repairedArgs) };
  };
```

---

## VIII. Database Schema

### 8.1. Dashboard Summary Entity

**Table:** `dashboard_summaries`

```sql
CREATE TABLE dashboard_summaries (
  dashboard_summary_uuid UUID PRIMARY KEY,
  dashboard_uuid UUID NOT NULL REFERENCES dashboards(dashboard_uuid),
  dashboard_version_id INTEGER NOT NULL,
  summary_text TEXT NOT NULL,
  tone VARCHAR(50),
  audiences JSON,
  context TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 8.2. AI Agent Entities

**Tables:**
- `ai_agents` - Cấu hình agent
- `ai_agent_threads` - Cuộc trò chuyện
- `ai_agent_prompts` - Lịch sử prompt
- `ai_agent_artifacts` - Dashboard/Chart được tạo
- `ai_agent_tool_results` - Kết quả từ tool execution
- `ai_evals` - Evaluation results

---

## IX. Performance Considerations

### 9.1. Parallel Processing

```typescript
// Chart summaries được xử lý song song
const chartSummaries = dashboardCharts.map(async (chartData) => {
  return this.createChartSummary(chartData);
});

const results = await Promise.all(chartSummaries);
```

**Lợi ích:**
- Giảm thời gian xử lý từ O(n) → O(1) nếu máy chủ OpenAI hỗ trợ
- Tuyến tính trong thực tế do rate limits

### 9.2. Caching

- Dashboard data được cache sau query
- Summary được cache lại database
- Tránh tạo summary lặp lại cho dashboard chưa thay đổi

### 9.3. Token Usage

```typescript
const totalTokens = getTotalTokenUsage(totalTokenUsages);
// Theo dõi: input tokens + output tokens
// Sử dụng cho billing và optimization
```

---

## X. Error Handling

### 10.1. Feature Flag Disabled

```typescript
throw new Error('AI Dashboard summary feature not enabled!')
```

### 10.2. OpenAI API Errors

```typescript
try {
  const result = await this.openAi.run(prompt, variables);
} catch (e) {
  const errorCode = e instanceof Error && 'code' in e ? e.code : getErrorMessage(e);
  throw new Error(`Failed to generate summary - ${errorCode}`);
}
```

### 10.3. Database Errors

- Lỗi lưu dashboard summary
- Lỗi truy vấn dashboard

---

## XI. Frontend Integration

### 11.1. Hooks & Queries

**File:** `packages/frontend/src/ee/features/aiCopilot/hooks/`

```typescript
// Lấy dashboard summary
useGetDashboardSummary(projectUuid, dashboardUuid)

// Tạo dashboard summary
useCreateDashboardSummary(projectUuid, dashboardUuid)

// Custom visualization
useGenerateCustomViz(projectUuid)
```

### 11.2. Components

**File:** `packages/frontend/src/ee/features/aiCopilot/components/`

- `AIDashboardSummary.tsx` - Hiển thị summary
- `AiDashboardSummaryModal.tsx` - Modal để tạo summary
- `AiCustomVizModal.tsx` - Modal tạo biểu đồ tùy chỉnh
- `AiDashboardVisualizationItem.tsx` - Hiển thị chart từ Agent

### 11.3. Store (Redux)

```typescript
// aiArtifactSlice - Quản lý artifact (dashboard/chart)
// aiAgentThreadStreamSlice - Quản lý stream từ agent
```

---

## XII. API Endpoints Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/ai/:projectUuid/dashboard/:dashboardUuid/summary` | Tạo dashboard summary |
| GET | `/api/v1/ai/:projectUuid/dashboard/:dashboardUuidOrSlug/summary` | Lấy dashboard summary |
| POST | `/api/v1/ai/:projectUuid/custom-viz` | Tạo custom visualization |
| GET | `/api/v1/projects/:projectUuid/aiAgents` | Liệt kê AI agents |
| GET | `/api/v1/projects/:projectUuid/aiAgents/:agentUuid` | Lấy chi tiết agent |
| POST | `/api/v1/projects/:projectUuid/aiAgents/:agentUuid/generate` | Gửi prompt cho agent |

---

## XIII. Timeline & Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ User Action: Click "Generate Summary"                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
          ┌────────────────────────────────┐
          │ Frontend: Show modal           │
          │ - Tone: professional           │
          │ - Audiences: executives, etc   │
          │ - Context: optional            │
          └────────────────┬───────────────┘
                           │
                           ▼
          ┌────────────────────────────────┐
          │ POST /api/v1/ai/:projectUuid/  │
          │     dashboard/:dashboardUuid/  │
          │     summary                    │
          └────────────────┬───────────────┘
                           │
                    ┌──────▼──────┐
                    │ t0 = now()  │ ┐
                    └──────┬──────┘ │
                           │       │ Giai đoạn 1
                    ┌──────▼──────┐ │ ~0-50ms
                    │Load Dashboard│ │
                    └──────┬──────┘ ┘
                           │
                    ┌──────▼──────────────────┐
                    │ t1 = now()              │
                    │ Extract Chart Uuids     │
                    └──────┬─────────────────┘
                           │
                    ┌──────▼──────────────────┐
                    │ t2 = now()              │
                    │ Parallel: Run 4 Charts  │ ┐
                    │ - Execute query         │ │ Giai đoạn 2
                    │ - Format CSV            │ │ ~2-10s
                    │ - Prepare fields        │ │ (phụ thuộc dữ liệu)
                    └──────┬─────────────────┘ ┘
                           │
                    ┌──────▼──────────────────┐
                    │ t3 = now()              │
                    │ Parallel: Call OpenAI   │ ┐
                    │ for each chart          │ │ Giai đoạn 3
                    │ - Send CSV + prompt     │ │ ~5-15s
                    │ - Get insights          │ │ (phụ thuộc OpenAI)
                    └──────┬─────────────────┘ ┘
                           │
                    ┌──────▼──────────────────┐
                    │ t4 = now()              │
                    │ Aggregate summaries     │ ┐
                    │ Format Markdown         │ │ Giai đoạn 4
                    └──────┬─────────────────┘ │ ~1-2s
                           │                   │
                    ┌──────▼──────────────────┐ │
                    │ Call OpenAI for final   │ │
                    │ dashboard summary       │ │
                    └──────┬─────────────────┘ ┘
                           │
                    ┌──────▼──────────────────┐
                    │ t5 = now()              │
                    │ Save to database        │ ┐
                    │ - summary_text          │ │ Giai đoạn 5
                    │ - tone, audiences       │ │ ~200-500ms
                    │ - context               │ │
                    └──────┬─────────────────┘ ┘
                           │
                    ┌──────▼──────────────────┐
                    │ t6 = now()              │
                    │ Track analytics         │ Giai đoạn 6
                    │ - timeGetCharts = t3-t2 │ ~50ms
                    │ - timeOpenAi = t5-t3    │
                    │ - totalTime = t6-t0     │
                    └──────┬─────────────────┘
                           │
                    ┌──────▼──────────────────┐
                    │ Return Response         │
                    │ dashboardSummaryUuid    │
                    │ summary text            │
                    └──────┬─────────────────┘
                           │
                           ▼
            ┌────────────────────────────────┐
            │ Frontend: Display summary      │
            │ - Show insights                │
            │ - Update cache                 │
            │ - Close modal                  │
            └────────────────────────────────┘

Total Time: ~10-30s (phụ thuộc OpenAI response time)
```

---

## XIV. Best Practices

### 14.1. Prompt Engineering

1. **Be Specific**: Cung cấp context rõ ràng
2. **Include Guidelines**: Định nghĩa rõ output format
3. **Use Examples**: Nếu có thể, thêm example
4. **Iterate**: Test prompt với dữ liệu khác nhau

### 14.2. Error Handling

1. Retry logic cho API timeouts
2. Graceful degradation nếu OpenAI unavailable
3. Clear error messages cho user

### 14.3. Performance Optimization

1. Parallel processing khi có thể
2. Cache results
3. Monitor token usage
4. Set appropriate rate limits

### 14.4. Security

1. Validate user permissions
2. Sanitize user inputs
3. Rate limiting per user/project
4. Audit trail cho AI operations

---

## XV. Conclusion

Luồng phân tích Dashboard bằng AI trong Lightdash là một hệ thống phức tạp nhưng hiệu quả:

1. **Multi-stage pipeline**: Từ extraction → analysis → aggregation
2. **Parallel processing**: Tối ưu hóa thời gian xử lý
3. **Smart prompting**: Sử dụng LangChain templates
4. **Flexible configuration**: Context, tone, audiences
5. **Analytics integration**: Tracking usage và performance
6. **Agent support**: Mở rộng khả năng với AI Agents

Hệ thống này cung cấp nền tảng mạnh mẽ cho các ứng dụng phân tích dữ liệu thông minh.
