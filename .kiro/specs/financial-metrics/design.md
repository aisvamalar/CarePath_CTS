# Financial Metrics Feature - Design Document

## Overview
Add a Financial Analytics page and integrate financial KPIs into the Care Manager Dashboard, following CarePath's existing architectural patterns and design system.

## Architecture

### Frontend Components

#### 1. New Page: Financial Analytics (`/care-manager/financial`)
Full-page financial dashboard with comprehensive metrics and visualizations.

**Location**: `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Financial.tsx`

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Header: "Financial Analytics" + Date Range Selector         │
├─────────────────────────────────────────────────────────────┤
│ [KPI Cards Row - 5 cards]                                   │
│  • Total Savings  • Cost Per Patient  • ROI  • Cost Avoid.  │
├─────────────────────────────────────────────────────────────┤
│ [Charts Section - 3 cards in grid]                          │
│  • Savings Trend (Line)                                     │
│  • Cost by Intervention (Bar)                               │
│  • Readmission Impact (Donut)                               │
├─────────────────────────────────────────────────────────────┤
│ [Detailed Table]                                            │
│  Patient-level financial breakdown with sorting/filtering   │
└─────────────────────────────────────────────────────────────┘
```

#### 2. New Hook: `useFinancialData.ts`
Custom hook following the pattern of `useCareManagerData.ts`.

**Location**: `/Users/vishwa/Desktop/CarePath_CTS/src/hooks/useFinancialData.ts`

**Responsibilities**:
- Fetch aggregate financial metrics from backend
- Fetch patient-level financial data
- Calculate derived metrics (ROI, averages, trends)
- Handle loading and error states
- Provide reload functionality

**Type Definitions**:
```typescript
export interface FinancialMetrics {
  total_savings: number;
  cost_per_patient: number;
  roi_percentage: number;
  cost_avoidance: number;
  readmission_savings: number;
  ed_visit_savings: number;
  los_reduction_savings: number;
  program_cost: number;
  timestamp: string;
}

export interface PatientFinancialData {
  patient_id: string;
  patient_name: string;
  mrn: string;
  total_savings: number;
  readmission_prevented: boolean;
  intervention_count: number;
  cost_trend: 'decreasing' | 'stable' | 'increasing';
  last_updated: string;
}

export interface InterventionCost {
  type: string;
  count: number;
  total_cost: number;
  total_savings: number;
  roi: number;
}

export interface FinancialData {
  metrics: FinancialMetrics | null;
  patientData: PatientFinancialData[];
  interventions: InterventionCost[];
  savingsTrend: { date: string; savings: number }[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}
```

#### 3. New Service: `financialService.ts`
API client for financial endpoints.

**Location**: `/Users/vishwa/Desktop/CarePath_CTS/src/services/financialService.ts`

**Endpoints** (to be created on backend):
```typescript
export const financialService = {
  // GET /care-manager/financial/metrics
  getMetrics: (params?: { start_date?: string; end_date?: string }) => 
    Promise<FinancialMetrics>,
  
  // GET /care-manager/financial/patients
  getPatientFinancials: (params?: { limit?: number; offset?: number }) => 
    Promise<PatientFinancialData[]>,
  
  // GET /care-manager/financial/interventions
  getInterventionCosts: () => 
    Promise<InterventionCost[]>,
  
  // GET /care-manager/financial/trend
  getSavingsTrend: (params: { days: number }) => 
    Promise<{ date: string; savings: number }[]>,
  
  // GET /care-manager/financial/report
  exportReport: (format: 'pdf' | 'excel', params: ReportParams) => 
    Promise<Blob>,
};
```

#### 4. Dashboard Integration
Add 2 new financial KPI cards to existing dashboard.

**Location**: Modify `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Dashboard.tsx`

**Changes**:
- Import `useFinancialData` hook
- Add 2 KpiCard components for:
  - Total Cost Savings (coral tone)
  - ROI Percentage (peach tone)
- Place after existing 5 KPI cards
- Link to new Financial Analytics page

#### 5. Navigation Integration
Add Financial menu item to CareManagerRail.

**Location**: Modify `/Users/vishwa/Desktop/CarePath_CTS/src/components/care_manager/CareManagerRail.tsx`

**Changes**:
- Add "Financial" navigation link with dollar sign icon
- Place between "Post-Discharge" and "Profile" sections

### Backend API Requirements

#### New Router: `/app/care_manager/financial/`

**File Structure**:
```
CarepathAI_backend/app/care_manager/financial/
├── __init__.py
├── router.py         # FastAPI router with endpoints
├── schemas.py        # Pydantic models for requests/responses
└── service.py        # Business logic and calculations
```

#### Endpoints to Implement:

**1. GET `/api/v1/care-manager/financial/metrics`**
- Query params: `start_date`, `end_date` (optional, defaults to last 30 days)
- Returns: `FinancialMetrics` object
- Calculates aggregate financial KPIs

**2. GET `/api/v1/care-manager/financial/patients`**
- Query params: `limit`, `offset` for pagination
- Returns: Array of `PatientFinancialData`
- Patient-level financial breakdown

**3. GET `/api/v1/care-manager/financial/interventions`**
- Returns: Array of `InterventionCost`
- Cost breakdown by intervention type

**4. GET `/api/v1/care-manager/financial/trend`**
- Query params: `days` (default 30)
- Returns: Time-series data for savings trend chart

**5. POST `/api/v1/care-manager/financial/report`**
- Body: Report parameters (date range, filters, format)
- Returns: File download (PDF or Excel)

### Database Schema

#### New Table: `financial_metrics`

```sql
CREATE TABLE financial_metrics (
  id SERIAL PRIMARY KEY,
  patient_id VARCHAR(50) REFERENCES ehr_patients(patient_id),
  
  -- Savings breakdown
  readmission_savings DECIMAL(10, 2) DEFAULT 0,
  ed_visit_savings DECIMAL(10, 2) DEFAULT 0,
  los_reduction_savings DECIMAL(10, 2) DEFAULT 0,
  total_savings DECIMAL(10, 2) DEFAULT 0,
  
  -- Cost tracking
  intervention_costs DECIMAL(10, 2) DEFAULT 0,
  program_costs DECIMAL(10, 2) DEFAULT 0,
  
  -- Metadata
  calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  UNIQUE(patient_id, period_start, period_end)
);

CREATE INDEX idx_financial_patient ON financial_metrics(patient_id);
CREATE INDEX idx_financial_period ON financial_metrics(period_start, period_end);
```

#### New Table: `intervention_costs`

```sql
CREATE TABLE intervention_costs (
  id SERIAL PRIMARY KEY,
  intervention_type VARCHAR(100) NOT NULL,
  cost_per_unit DECIMAL(10, 2) NOT NULL,
  estimated_savings_per_unit DECIMAL(10, 2) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed with standard intervention types
INSERT INTO intervention_costs (intervention_type, cost_per_unit, estimated_savings_per_unit, description) VALUES
  ('readmission_prevention', 500.00, 15000.00, 'Cost of care coordination to prevent readmission'),
  ('ed_visit_avoidance', 200.00, 1500.00, 'Early intervention to avoid ED visit'),
  ('medication_adherence', 50.00, 800.00, 'Medication compliance support'),
  ('follow_up_call', 25.00, 300.00, 'Post-discharge follow-up call'),
  ('care_plan_review', 100.00, 500.00, 'Comprehensive care plan review session');
```

#### New Table: `patient_intervention_log`

```sql
CREATE TABLE patient_intervention_log (
  id SERIAL PRIMARY KEY,
  patient_id VARCHAR(50) REFERENCES ehr_patients(patient_id),
  intervention_type VARCHAR(100) REFERENCES intervention_costs(intervention_type),
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  performed_by VARCHAR(100),
  outcome VARCHAR(50), -- 'success', 'in_progress', 'failed'
  notes TEXT,
  
  FOREIGN KEY (patient_id) REFERENCES ehr_patients(patient_id)
);

CREATE INDEX idx_intervention_patient ON patient_intervention_log(patient_id);
CREATE INDEX idx_intervention_type ON patient_intervention_log(intervention_type);
CREATE INDEX idx_intervention_date ON patient_intervention_log(performed_at);
```

### Cost Calculation Logic

#### Savings Formulas

**Readmission Prevention Savings**:
```
For each patient with high readmission risk (score >= 0.7):
  If no readmission occurred within 30 days of discharge:
    Savings = Standard_Readmission_Cost - Intervention_Cost
    Standard_Readmission_Cost = $15,000 (configurable)
```

**ED Visit Avoidance Savings**:
```
For each patient with intervention preventing ED visit:
  Savings = Standard_ED_Cost - Intervention_Cost
  Standard_ED_Cost = $1,500 (configurable)
```

**Length of Stay Reduction**:
```
For each patient with reduced LOS:
  Savings = (Expected_LOS - Actual_LOS) * Cost_Per_Day
  Cost_Per_Day = $2,000 (configurable)
```

**ROI Calculation**:
```
Total_Savings = sum(all savings categories)
Total_Program_Cost = sum(all intervention costs) + (care_manager_hours * hourly_rate)
ROI = ((Total_Savings - Total_Program_Cost) / Total_Program_Cost) * 100
```

**Cost Per Patient**:
```
Cost_Per_Patient = Total_Program_Cost / Active_Patients_Count
```

### UI Component Design

#### Color Palette (from existing theme)
- Primary: `#f2846b` (coral)
- Secondary: `#f5a08a` (rose)
- Success: `#7cc4a4` (green)
- Neutral: `#d9d4d1` (gray)
- Text: `#1c1c1e`

#### Chart Components
Use existing Recharts library (already in Dashboard.tsx):

**1. Savings Trend (LineChart)**:
- Similar to "New Registrations" chart
- X-axis: Dates (last 30/60/90 days)
- Y-axis: Dollar amounts
- Color: `#7cc4a4` (green for positive savings)

**2. Cost by Intervention (BarChart)**:
- X-axis: Intervention types
- Y-axis: Dollar amounts
- Two bars per intervention: Cost vs. Savings
- Colors: `#f2846b` (cost), `#7cc4a4` (savings)

**3. Readmission Impact (PieChart/Donut)**:
- Similar to existing donut charts
- Segments: Readmission savings, ED savings, LOS savings, Other
- Colors from PLAN_COLORS array

#### KPI Card Configuration

**Total Cost Savings**:
```typescript
<KpiCard
  tone="coral"
  label="Total Cost Savings"
  value={metrics?.total_savings}
  hint="Last 30 days"
  icon={<DollarSignIcon />}
  trend={{ direction: 'up', text: '+$12K from last month' }}
/>
```

**ROI Percentage**:
```typescript
<KpiCard
  tone="peach"
  label="Return on Investment"
  value={metrics ? `${metrics.roi_percentage.toFixed(1)}%` : null}
  hint="Program efficiency"
  icon={<TrendingUpIcon />}
/>
```

### Responsive Design

Follow existing patterns from Dashboard.tsx:

- Desktop: Grid layout with 3 columns for charts
- Tablet: 2 columns
- Mobile: Single column stack
- Use `cmp-*` CSS classes for consistency
- Tables convert to card lists on mobile (`cmp-cardlist`)

### Error Handling

**Loading States**:
- Use `<Skeleton>` component while fetching data
- Show spinner for async operations

**Error States**:
- Use `<ErrorState>` component with retry button
- Display user-friendly error messages
- Log detailed errors to console

**Empty States**:
- Use `<EmptyState>` component
- Guide users to generate financial data
- Example: "No financial data yet. Financial metrics will appear once interventions are tracked."

### Data Flow

```
User navigates to /care-manager/financial
           ↓
Financial.tsx mounts
           ↓
useFinancialData() hook executes
           ↓
financialService.getMetrics() API call
           ↓
Backend router → service → database
           ↓
Calculate metrics using formulas
           ↓
Return JSON response
           ↓
Hook updates state, component re-renders
           ↓
Charts and KPIs display data
```

## Implementation Tasks

### Phase 1: Backend Foundation
1. Create database migrations for new tables
2. Seed intervention_costs table with standard values
3. Create financial router, schemas, service files
4. Implement GET /financial/metrics endpoint
5. Implement GET /financial/patients endpoint
6. Write backend tests

### Phase 2: Frontend Service Layer
7. Create financialService.ts with API client methods
8. Create useFinancialData.ts hook
9. Define TypeScript interfaces
10. Add error handling and loading states

### Phase 3: UI Components
11. Create Financial.tsx page component
12. Add date range selector component
13. Implement financial KPI cards
14. Create savings trend chart
15. Create intervention cost chart
16. Create readmission impact donut chart
17. Create patient financial data table

### Phase 4: Integration
18. Add financial KPIs to Dashboard.tsx
19. Add navigation link to CareManagerRail.tsx
20. Add route to App.tsx
21. Update CSS if needed (use existing styles)

### Phase 5: Advanced Features
22. Implement GET /financial/interventions endpoint
23. Implement GET /financial/trend endpoint
24. Add export functionality (PDF/Excel)
25. Add patient drill-down capability
26. Add filtering and date range selection

### Phase 6: Testing & Polish
27. Test all API endpoints
28. Test UI across browsers
29. Test responsive design
30. Verify calculations accuracy
31. Performance optimization
32. Accessibility audit

## Dependencies

### External Libraries (already installed)
- `recharts`: Charts and graphs (already used in Dashboard)
- `react-router-dom`: Navigation
- Existing UI components: KpiCard, ErrorState, EmptyState, Skeleton

### Backend Dependencies (check if needed)
- May need PDF generation library (e.g., `reportlab`, `weasyprint`)
- May need Excel generation library (e.g., `openpyxl`, `xlsxwriter`)

## Configuration

### Environment Variables
```bash
# Backend .env
STANDARD_READMISSION_COST=15000
STANDARD_ED_COST=1500
COST_PER_DAY_LOS=2000
CARE_MANAGER_HOURLY_RATE=75
```

### Feature Flags (optional)
```typescript
// Frontend
export const FEATURES = {
  FINANCIAL_ANALYTICS: true,
  FINANCIAL_EXPORT: false, // Enable in Phase 5
  FINANCIAL_PREDICTIONS: false, // Future enhancement
};
```

## Performance Considerations

1. **Caching**: Cache aggregate metrics for 5 minutes on backend
2. **Pagination**: Patient financial data should paginate (50 per page)
3. **Lazy Loading**: Load charts only when visible
4. **Debouncing**: Debounce date range selector to avoid excessive API calls
5. **Indexing**: Ensure database indexes on date ranges and patient_id

## Security Considerations

1. **Authorization**: Only care managers can access financial endpoints
2. **Data Privacy**: Mask sensitive patient info in exports
3. **Audit Logging**: Log all financial data access
4. **Input Validation**: Validate date ranges and numeric inputs
5. **Rate Limiting**: Limit financial report generation requests

## Testing Strategy

### Backend Tests
- Unit tests for calculation functions
- Integration tests for API endpoints
- Test edge cases (no data, negative values, invalid dates)

### Frontend Tests
- Component rendering tests
- Hook behavior tests  
- Mock API responses
- Test loading and error states

### E2E Tests
- Navigate to financial page
- Verify data loads correctly
- Test filtering and sorting
- Test export functionality

## Future Enhancements (Out of Scope V1)

1. **Predictive Cost Modeling**: ML-based cost predictions
2. **Billing Integration**: Connect to billing systems
3. **Real-time Alerts**: Cost anomaly detection
4. **Multi-facility Comparison**: Compare across locations
5. **Customizable Dashboards**: User-defined metrics
6. **Mobile App**: Native mobile financial tracking

---

**Status**: Draft  
**Created**: 2026-08-22  
**Last Updated**: 2026-08-22  
**Dependencies**: requirements.md  
**Next**: Break down into implementation tasks
