# Financial Metrics Feature - Implementation Tasks

## Task Status Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked

---

## Phase 1: Backend Foundation

### Task 1.1: Database Schema Setup
**Status**: `[x]`  
**Assignee**: Backend Developer  
**Estimated Time**: 2 hours  
**Priority**: High

**Description**: Create database migrations for financial metrics tables.

**Steps**:
1. Create migration file: `migrations/002_create_financial_schema.sql`
2. Add `financial_metrics` table with columns for savings, costs, dates
3. Add `intervention_costs` table with standard cost data
4. Add `patient_intervention_log` table for tracking interventions
5. Add appropriate indexes for performance
6. Test migration on dev database

**Acceptance Criteria**:
- [ ] All three tables created successfully
- [ ] Foreign key constraints work correctly
- [ ] Indexes are in place
- [ ] Migration can be rolled back cleanly

**Files to Create**:
- `/Users/vishwa/Desktop/CarepathAI_backend/migrations/002_create_financial_schema.sql`

---

### Task 1.2: Seed Intervention Cost Data
**Status**: `[x]`  
**Assignee**: Backend Developer  
**Estimated Time**: 30 minutes  
**Priority**: High

**Description**: Populate intervention_costs table with standard values.

**Steps**:
1. Create seed script or migration
2. Insert 5-7 standard intervention types with costs and savings
3. Verify data integrity

**Acceptance Criteria**:
- [ ] All intervention types seeded
- [ ] Cost and savings values are realistic
- [ ] Description fields are populated

**Depends On**: Task 1.1

---

### Task 1.3: Create Financial Backend Module
**Status**: `[x]`  
**Assignee**: Backend Developer  
**Estimated Time**: 1 hour  
**Priority**: High

**Description**: Create the backend module structure for financial analytics.

**Steps**:
1. Create directory: `app/care_manager/financial/`
2. Create `__init__.py`
3. Create `router.py` with FastAPI router skeleton
4. Create `schemas.py` with Pydantic models
5. Create `service.py` with business logic stubs
6. Register router in main application

**Acceptance Criteria**:
- [ ] Module structure created
- [ ] Router mounted at `/api/v1/care-manager/financial`
- [ ] Health check endpoint returns 200

**Files to Create**:
- `/Users/vishwa/Desktop/CarepathAI_backend/app/care_manager/financial/__init__.py`
- `/Users/vishwa/Desktop/CarepathAI_backend/app/care_manager/financial/router.py`
- `/Users/vishwa/Desktop/CarepathAI_backend/app/care_manager/financial/schemas.py`
- `/Users/vishwa/Desktop/CarepathAI_backend/app/care_manager/financial/service.py`

**Depends On**: Task 1.1

---

### Task 1.4: Implement GET /financial/metrics Endpoint
**Status**: `[x]`  
**Assignee**: Backend Developer  
**Estimated Time**: 3 hours  
**Priority**: High

**Description**: Implement aggregate financial metrics endpoint with calculations.

**Steps**:
1. Create Pydantic schema `FinancialMetricsOut` in `schemas.py`
2. Implement `calculate_aggregate_metrics()` in `service.py`
3. Write SQL queries to aggregate savings by category
4. Calculate ROI, cost per patient, cost avoidance
5. Create route handler in `router.py`
6. Add query parameters for date range filtering
7. Add error handling and validation
8. Write unit tests

**Acceptance Criteria**:
- [ ] Endpoint returns correct financial metrics
- [ ] Date range filtering works
- [ ] All calculations match documented formulas
- [ ] Returns 200 with valid data
- [ ] Returns 400 for invalid date ranges
- [ ] Unit tests pass with 80%+ coverage

**Files to Modify**:
- `app/care_manager/financial/router.py`
- `app/care_manager/financial/schemas.py`
- `app/care_manager/financial/service.py`

**Depends On**: Task 1.3

---

### Task 1.5: Implement GET /financial/patients Endpoint
**Status**: `[x]`  
**Assignee**: Backend Developer  
**Estimated Time**: 2 hours  
**Priority**: Medium

**Description**: Implement patient-level financial data endpoint with pagination.

**Steps**:
1. Create Pydantic schema `PatientFinancialOut` in `schemas.py`
2. Implement `get_patient_financials()` in `service.py`
3. Join financial_metrics with ehr_patients table
4. Add pagination (limit/offset)
5. Add sorting capability
6. Create route handler
7. Write tests

**Acceptance Criteria**:
- [ ] Returns list of patient financial data
- [ ] Pagination works correctly
- [ ] Sorting by savings amount works
- [ ] Handles patients with no financial data gracefully
- [ ] Tests pass

**Files to Modify**:
- `app/care_manager/financial/router.py`
- `app/care_manager/financial/schemas.py`
- `app/care_manager/financial/service.py`

**Depends On**: Task 1.4

---

### Task 1.6: Write Backend Tests
**Status**: `[ ]`  
**Assignee**: Backend Developer  
**Estimated Time**: 2 hours  
**Priority**: Medium

**Description**: Comprehensive test coverage for financial endpoints.

**Steps**:
1. Create `test_financial_router.py`
2. Test all endpoints with various inputs
3. Test edge cases (no data, invalid dates)
4. Test calculation accuracy
5. Test authorization (care manager only)

**Acceptance Criteria**:
- [ ] All endpoints have test coverage
- [ ] Edge cases handled
- [ ] Test coverage > 80%
- [ ] All tests pass

**Files to Create**:
- `app/tests/care_manager/test_financial_router.py`

**Depends On**: Task 1.5

---

## Phase 2: Frontend Service Layer

### Task 2.1: Create Financial Service
**Status**: `[x]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 1.5 hours  
**Priority**: High

**Description**: Create API client for financial endpoints.

**Steps**:
1. Create file `src/services/financialService.ts`
2. Import `apiClient` utility
3. Define TypeScript interfaces for responses
4. Implement methods for each endpoint
5. Add error handling
6. Export service object

**Acceptance Criteria**:
- [ ] All API methods implemented
- [ ] TypeScript types defined correctly
- [ ] Error handling in place
- [ ] Follows existing service patterns

**Files to Create**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/services/financialService.ts`

**Depends On**: Task 1.4, Task 1.5

---

### Task 2.2: Create Financial Data Hook
**Status**: `[x]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 2 hours  
**Priority**: High

**Description**: Create custom React hook for financial data management.

**Steps**:
1. Create file `src/hooks/useFinancialData.ts`
2. Follow pattern from `useCareManagerData.ts`
3. Implement state management for metrics, patients, interventions
4. Add loading and error states
5. Implement reload functionality
6. Add date range parameter support
7. Export hook and types

**Acceptance Criteria**:
- [ ] Hook returns all necessary data
- [ ] Loading states work correctly
- [ ] Error handling implemented
- [ ] Follows existing hook patterns
- [ ] TypeScript types exported

**Files to Create**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/hooks/useFinancialData.ts`

**Depends On**: Task 2.1

---

## Phase 3: UI Components

### Task 3.1: Create Financial Page Component
**Status**: `[x]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 2 hours  
**Priority**: High

**Description**: Create main Financial Analytics page with layout.

**Steps**:
1. Create file `src/pages/care_manager/Financial.tsx`
2. Use `CareManagerLayout` wrapper
3. Add page header with title and date selector
4. Create grid layout for KPIs and charts
5. Add loading and error states
6. Use `useFinancialData` hook
7. Follow existing page patterns from Dashboard.tsx

**Acceptance Criteria**:
- [ ] Page renders with correct layout
- [ ] Uses CareManagerLayout
- [ ] Loading state shows skeletons
- [ ] Error state shows ErrorState component
- [ ] Follows CarePath design system

**Files to Create**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Financial.tsx`

**Depends On**: Task 2.2

---

### Task 3.2: Create Date Range Selector
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 1 hour  
**Priority**: Medium

**Description**: Reusable date range selector component.

**Steps**:
1. Create quick select buttons (30d, 60d, 90d, YTD)
2. Add custom date picker
3. Style to match design system
4. Handle date range changes
5. Add validation

**Acceptance Criteria**:
- [ ] Quick select buttons work
- [ ] Custom date picker functional
- [ ] Validates date ranges
- [ ] Matches CarePath styling
- [ ] Callbacks fire correctly

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Financial.tsx`

**Depends On**: Task 3.1

---

### Task 3.3: Implement Financial KPI Cards
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 1.5 hours  
**Priority**: High

**Description**: Add 5 financial KPI cards to Financial page.

**Steps**:
1. Use existing `<KpiCard>` component
2. Create cards for:
   - Total Cost Savings (coral tone)
   - Cost Per Patient (rose tone)
   - ROI Percentage (peach tone)
   - Cost Avoidance (coral tone)
   - Resource Utilization (neutral tone)
3. Add appropriate icons
4. Add click handlers (future drill-down)
5. Add loading states

**Acceptance Criteria**:
- [ ] All 5 KPI cards render
- [ ] Data displays correctly
- [ ] Loading states work
- [ ] Icons match theme
- [ ] Follows existing KPI patterns

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Financial.tsx`

**Depends On**: Task 3.1

---

### Task 3.4: Create Savings Trend Chart
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 1.5 hours  
**Priority**: High

**Description**: Line chart showing savings over time.

**Steps**:
1. Use Recharts `<LineChart>` component
2. Follow pattern from Dashboard "New Registrations" chart
3. Use green color (`#7cc4a4`) for positive trend
4. Add proper axis labels and tooltip
5. Make responsive
6. Add empty state

**Acceptance Criteria**:
- [ ] Chart renders with data
- [ ] Tooltip shows values correctly
- [ ] Responsive design works
- [ ] Empty state for no data
- [ ] Matches design system colors

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Financial.tsx`

**Depends On**: Task 3.3

---

### Task 3.5: Create Intervention Cost Chart
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 1.5 hours  
**Priority**: Medium

**Description**: Bar chart comparing intervention costs vs. savings.

**Steps**:
1. Use Recharts `<BarChart>` component
2. Two bars per intervention: cost and savings
3. Use coral (`#f2846b`) for costs, green (`#7cc4a4`) for savings
4. Add legend
5. Add tooltip with ROI calculation
6. Make responsive

**Acceptance Criteria**:
- [ ] Chart displays all intervention types
- [ ] Cost vs savings clearly visible
- [ ] Legend shows what each bar means
- [ ] Tooltip shows ROI
- [ ] Responsive layout

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Financial.tsx`

**Depends On**: Task 3.4

---

### Task 3.6: Create Readmission Impact Donut
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 1 hour  
**Priority**: Medium

**Description**: Donut chart showing savings breakdown.

**Steps**:
1. Use Recharts `<PieChart>` component
2. Follow pattern from Dashboard donut charts
3. Segments: readmission, ED, LOS, other savings
4. Add legend with values
5. Center text showing total savings

**Acceptance Criteria**:
- [ ] Donut displays all categories
- [ ] Colors match theme
- [ ] Center shows total
- [ ] Legend displays correctly
- [ ] Follows existing donut patterns

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Financial.tsx`

**Depends On**: Task 3.5

---

### Task 3.7: Create Patient Financial Table
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 2 hours  
**Priority**: Medium

**Description**: Detailed table with patient-level financial data.

**Steps**:
1. Follow pattern from Dashboard attention table
2. Columns: Patient, MRN, Total Savings, Interventions, Trend, Action
3. Add sorting capability
4. Add mobile card view
5. Add click to view patient detail
6. Add pagination

**Acceptance Criteria**:
- [ ] Table displays all columns
- [ ] Sorting works
- [ ] Mobile card view functional
- [ ] Click navigates to patient detail
- [ ] Pagination works correctly

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Financial.tsx`

**Depends On**: Task 3.6

---

## Phase 4: Integration

### Task 4.1: Add Financial KPIs to Dashboard
**Status**: `[x]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 1 hour  
**Priority**: High

**Description**: Integrate 2 financial KPI cards into main Dashboard.

**Steps**:
1. Import `useFinancialData` hook in Dashboard.tsx
2. Add 2 KpiCard components after existing 5:
   - Total Cost Savings
   - ROI Percentage
3. Add click handlers to navigate to Financial page
4. Handle loading states
5. Test integration doesn't break existing dashboard

**Acceptance Criteria**:
- [ ] 2 new KPI cards appear on Dashboard
- [ ] Data loads correctly
- [ ] Click navigates to Financial page
- [ ] Existing dashboard functionality unchanged
- [ ] Loading states work

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Dashboard.tsx`

**Depends On**: Task 2.2

---

### Task 4.2: Add Financial Navigation Link
**Status**: `[x]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 30 minutes  
**Priority**: High

**Description**: Add Financial menu item to sidebar navigation.

**Steps**:
1. Open `CareManagerRail.tsx`
2. Add navigation link with dollar sign icon
3. Place between "Post-Discharge" and "Profile"
4. Add active state styling
5. Test navigation

**Acceptance Criteria**:
- [ ] Financial link appears in sidebar
- [ ] Icon displays correctly
- [ ] Click navigates to /care-manager/financial
- [ ] Active state highlights correctly
- [ ] Matches existing nav item styling

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/components/care_manager/CareManagerRail.tsx`

**Depends On**: Task 3.1

---

### Task 4.3: Add Financial Route
**Status**: `[x]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 15 minutes  
**Priority**: High

**Description**: Register Financial page in application routing.

**Steps**:
1. Open `App.tsx` or routing configuration
2. Add route: `/care-manager/financial` → `<Financial />`
3. Ensure route is protected (care manager only)
4. Test route loads correctly

**Acceptance Criteria**:
- [ ] Route registered correctly
- [ ] Page loads at /care-manager/financial
- [ ] Route requires care manager role
- [ ] 404 if not authorized

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/App.tsx`

**Depends On**: Task 3.1

---

### Task 4.4: CSS Updates (if needed)
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 30 minutes  
**Priority**: Low

**Description**: Add any custom CSS needed for financial page.

**Steps**:
1. Check if existing `care-manager.css` covers all needs
2. Add financial-specific styles if needed
3. Ensure responsive design works
4. Test across browsers

**Acceptance Criteria**:
- [ ] All components styled correctly
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Follows CarePath design system
- [ ] No style conflicts

**Files to Modify** (if needed):
- `/Users/vishwa/Desktop/CarePath_CTS/src/care-manager.css`

**Depends On**: Task 3.7

---

## Phase 5: Advanced Features

### Task 5.1: Implement GET /financial/interventions
**Status**: `[ ]`  
**Assignee**: Backend Developer  
**Estimated Time**: 1.5 hours  
**Priority**: Medium

**Description**: Endpoint for detailed intervention cost breakdown.

**Steps**:
1. Create Pydantic schema
2. Implement service method
3. Query intervention logs and costs
4. Calculate totals by type
5. Create route handler
6. Write tests

**Acceptance Criteria**:
- [ ] Returns intervention breakdown
- [ ] Calculations accurate
- [ ] Tests pass

**Files to Modify**:
- `app/care_manager/financial/router.py`
- `app/care_manager/financial/service.py`

**Depends On**: Task 1.5

---

### Task 5.2: Implement GET /financial/trend
**Status**: `[ ]`  
**Assignee**: Backend Developer  
**Estimated Time**: 1 hour  
**Priority**: Medium

**Description**: Endpoint for time-series savings data.

**Steps**:
1. Create Pydantic schema
2. Implement service method to aggregate by date
3. Support configurable time periods
4. Create route handler
5. Write tests

**Acceptance Criteria**:
- [ ] Returns daily savings data
- [ ] Configurable period works
- [ ] Data ordered chronologically
- [ ] Tests pass

**Files to Modify**:
- `app/care_manager/financial/router.py`
- `app/care_manager/financial/service.py`

**Depends On**: Task 5.1

---

### Task 5.3: Implement Report Export
**Status**: `[ ]`  
**Assignee**: Backend Developer  
**Estimated Time**: 3 hours  
**Priority**: Low

**Description**: PDF and Excel export functionality.

**Steps**:
1. Install PDF/Excel generation libraries
2. Create report templates
3. Implement export service methods
4. Add POST /financial/report endpoint
5. Handle file downloads
6. Write tests

**Acceptance Criteria**:
- [ ] PDF export works
- [ ] Excel export works
- [ ] Reports contain all key metrics
- [ ] Downloads trigger correctly
- [ ] Tests pass

**Files to Modify**:
- `app/care_manager/financial/router.py`
- `app/care_manager/financial/service.py`
- `requirements.txt` (add libraries)

**Depends On**: Task 5.2

---

### Task 5.4: Add Export UI
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 1.5 hours  
**Priority**: Low

**Description**: Export buttons on Financial page.

**Steps**:
1. Add "Export" button group to page header
2. Create modal for export options (PDF/Excel, date range)
3. Call export endpoint
4. Handle file download
5. Show loading state during export
6. Handle errors

**Acceptance Criteria**:
- [ ] Export buttons visible
- [ ] Modal shows options
- [ ] Download triggers correctly
- [ ] Loading spinner during export
- [ ] Error handling works

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/Financial.tsx`
- `/Users/vishwa/Desktop/CarePath_CTS/src/services/financialService.ts`

**Depends On**: Task 5.3

---

### Task 5.5: Patient Drill-Down
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 2 hours  
**Priority**: Low

**Description**: Click patient to see detailed financial breakdown.

**Steps**:
1. Add click handler to patient table rows
2. Navigate to patient detail page
3. Add financial section to patient detail page
4. Show intervention history
5. Show cost/savings timeline

**Acceptance Criteria**:
- [ ] Click navigates correctly
- [ ] Patient detail shows financial data
- [ ] Intervention history displays
- [ ] Timeline renders

**Files to Modify**:
- `/Users/vishwa/Desktop/CarePath_CTS/src/pages/care_manager/PatientDetail.tsx`

**Depends On**: Task 3.7

---

## Phase 6: Testing & Polish

### Task 6.1: Backend Integration Tests
**Status**: `[ ]`  
**Assignee**: Backend Developer  
**Estimated Time**: 2 hours  
**Priority**: High

**Description**: End-to-end backend tests.

**Steps**:
1. Test full request/response cycle
2. Test with real database
3. Test calculation accuracy
4. Test error scenarios
5. Test authorization

**Acceptance Criteria**:
- [ ] All integration tests pass
- [ ] Edge cases covered
- [ ] Error handling verified

**Files to Create/Modify**:
- `app/tests/integration/test_financial_flow.py`

**Depends On**: Task 5.2

---

### Task 6.2: Frontend Component Tests
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 2 hours  
**Priority**: Medium

**Description**: Unit tests for React components.

**Steps**:
1. Test Financial page rendering
2. Test hook behavior
3. Mock API responses
4. Test loading and error states
5. Test user interactions

**Acceptance Criteria**:
- [ ] Component tests pass
- [ ] Hook tests pass
- [ ] Coverage > 70%

**Files to Create**:
- `src/__tests__/pages/Financial.test.tsx`
- `src/__tests__/hooks/useFinancialData.test.ts`

**Depends On**: Task 3.7

---

### Task 6.3: Cross-Browser Testing
**Status**: `[ ]`  
**Assignee**: QA / Frontend Developer  
**Estimated Time**: 1 hour  
**Priority**: Medium

**Description**: Verify UI works across browsers.

**Steps**:
1. Test on Chrome, Firefox, Safari, Edge
2. Test responsive design on mobile devices
3. Test charts render correctly
4. Fix any browser-specific issues

**Acceptance Criteria**:
- [ ] Works on Chrome, Firefox, Safari, Edge
- [ ] Mobile responsive
- [ ] Charts render correctly
- [ ] No console errors

**Depends On**: Task 4.4

---

### Task 6.4: Calculation Verification
**Status**: `[ ]`  
**Assignee**: Backend Developer + Product Owner  
**Estimated Time**: 1 hour  
**Priority**: High

**Description**: Manually verify financial calculations are accurate.

**Steps**:
1. Create test data with known outcomes
2. Run calculations through system
3. Verify results match expected values
4. Adjust formulas if needed
5. Document any assumptions

**Acceptance Criteria**:
- [ ] All formulas verified correct
- [ ] Test cases documented
- [ ] Assumptions documented

**Depends On**: Task 1.4

---

### Task 6.5: Performance Optimization
**Status**: `[ ]`  
**Assignee**: Full Stack Developer  
**Estimated Time**: 2 hours  
**Priority**: Medium

**Description**: Ensure financial page loads quickly.

**Steps**:
1. Add database query optimization
2. Add backend caching (5-minute cache)
3. Add frontend memoization
4. Lazy load charts
5. Test with large datasets
6. Profile and optimize bottlenecks

**Acceptance Criteria**:
- [ ] Page loads in < 2 seconds
- [ ] Charts render smoothly
- [ ] No UI freezes
- [ ] Handles 1000+ patients

**Depends On**: Task 6.1

---

### Task 6.6: Accessibility Audit
**Status**: `[ ]`  
**Assignee**: Frontend Developer  
**Estimated Time**: 1 hour  
**Priority**: Medium

**Description**: Ensure financial page is accessible.

**Steps**:
1. Run axe DevTools audit
2. Test keyboard navigation
3. Test screen reader compatibility
4. Add ARIA labels where needed
5. Ensure color contrast meets WCAG AA
6. Fix any issues found

**Acceptance Criteria**:
- [ ] No critical accessibility issues
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast meets WCAG AA

**Depends On**: Task 6.3

---

### Task 6.7: Documentation
**Status**: `[ ]`  
**Assignee**: Technical Writer / Developer  
**Estimated Time**: 1.5 hours  
**Priority**: Low

**Description**: Document financial metrics feature.

**Steps**:
1. Update README with financial endpoints
2. Document API endpoints (OpenAPI/Swagger)
3. Create user guide for care managers
4. Document calculation formulas
5. Add inline code comments

**Acceptance Criteria**:
- [ ] API documentation complete
- [ ] User guide created
- [ ] Formulas documented
- [ ] Code comments added

**Depends On**: Task 6.6

---

## Summary

**Total Tasks**: 37  
**Estimated Time**: ~55 hours  

**By Phase**:
- Phase 1 (Backend Foundation): 10.5 hours
- Phase 2 (Frontend Service): 3.5 hours
- Phase 3 (UI Components): 11.5 hours
- Phase 4 (Integration): 2.25 hours
- Phase 5 (Advanced): 9 hours
- Phase 6 (Testing): 11.5 hours

**By Priority**:
- High: 18 tasks (~25 hours)
- Medium: 13 tasks (~22 hours)
- Low: 6 tasks (~8 hours)

**Critical Path**:
1.1 → 1.3 → 1.4 → 2.1 → 2.2 → 3.1 → 4.1 → 6.4

**Recommended Team**:
- 1 Backend Developer
- 1 Frontend Developer
- 1 QA Engineer (part-time for Phase 6)

**Estimated Delivery**: 2-3 weeks with 2 developers

---

**Status**: Draft  
**Created**: 2026-08-22  
**Last Updated**: 2026-08-22  
**Next**: Begin Phase 1 implementation
