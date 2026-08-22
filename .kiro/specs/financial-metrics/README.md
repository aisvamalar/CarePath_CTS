# Financial Metrics Feature Specification

## Overview
This spec defines a comprehensive financial analytics feature for the CarePath Care Manager platform. It enables care managers to track cost savings, measure ROI, and demonstrate the value of care management interventions.

## Quick Links
- **[Requirements](./requirements.md)** - What we're building and why
- **[Design](./design.md)** - How we're building it (architecture, APIs, UI)
- **[Tasks](./tasks.md)** - Implementation breakdown (37 tasks, ~55 hours)

## Feature Summary

### What's Being Built
A financial analytics dashboard that shows:
- **Total cost savings** from care management interventions
- **Return on investment (ROI)** for the program
- **Cost breakdown** by intervention type
- **Patient-level financial data** for detailed analysis
- **Trend analysis** over time

### Key Benefits
- **For Care Managers**: Understand impact of their work, prioritize high-value interventions
- **For Leadership**: Demonstrate program ROI, justify budgets, make data-driven decisions
- **For Finance Teams**: Track program costs vs. savings in real-time

### Technical Scope
- **Backend**: New financial analytics API endpoints, database tables, calculation engine
- **Frontend**: New Financial Analytics page, KPI cards on dashboard, charts and tables
- **Integration**: Connects to existing patient, intervention, and readmission data

## Current Status

**Phase**: Requirements & Design Complete  
**Next Action**: Begin Phase 1 implementation (Backend Foundation)  
**Estimated Completion**: 2-3 weeks with 2 developers

### Progress Tracker
- [x] Requirements documented
- [x] Design architecture defined
- [x] Implementation tasks broken down
- [ ] Backend foundation (Phase 1)
- [ ] Frontend service layer (Phase 2)
- [ ] UI components (Phase 3)
- [ ] Integration (Phase 4)
- [ ] Advanced features (Phase 5)
- [ ] Testing & polish (Phase 6)

## Getting Started

### For Developers

**Start here**:
1. Read [requirements.md](./requirements.md) to understand the business context
2. Review [design.md](./design.md) to understand the technical architecture
3. Pick a task from [tasks.md](./tasks.md) based on your role (backend/frontend)

**Backend developers** should start with:
- Task 1.1: Database Schema Setup
- Task 1.3: Create Financial Backend Module

**Frontend developers** should start with:
- Task 2.1: Create Financial Service (after backend Task 1.4 is done)
- Task 2.2: Create Financial Data Hook

### For Product/Project Managers

**Review priorities**:
1. All **High priority** tasks must be completed for V1
2. **Medium priority** tasks enhance the feature but can be deferred
3. **Low priority** tasks (exports, drill-downs) can be saved for V1.1

**Resource allocation**:
- Minimum: 1 backend + 1 frontend developer
- Recommended: Add QA engineer for Phase 6 testing
- Timeline: 2-3 weeks with recommended team

## Key Decisions

### Cost Calculation Assumptions
Standard costs used in calculations (configurable via environment variables):
- **Readmission**: $15,000 per occurrence
- **ED Visit**: $1,500 per occurrence  
- **Hospital Day**: $2,000 per day (for LOS reduction)
- **Care Manager**: $75 per hour

### Data Requirements
**Requires integration with**:
- EHR patient data (`ehr_patients` table)
- Readmission predictions (`readmission_predictions` table)
- Post-discharge tracking (care plan tasks, appointments)
- Intervention logging (new `patient_intervention_log` table)

### Technical Decisions
- **Charts**: Using Recharts (already in use on Dashboard)
- **Styling**: Reusing existing CarePath design system
- **API Pattern**: Following existing care-manager service patterns
- **Caching**: 5-minute cache on backend for aggregate metrics

## Dependencies

### Must Be Complete Before Starting
- None - this is a new feature that extends existing platform

### External Dependencies
- Backend: May need PDF/Excel generation libraries for exports (Phase 5)
- Frontend: No new dependencies (uses existing Recharts, React Router)

### Data Dependencies
- Readmission prediction data must be available
- Intervention logging must be implemented
- Standard cost values must be configured

## Future Enhancements (Post-V1)

Ideas for future iterations:
- **Predictive Cost Modeling**: ML-based cost forecasting
- **Billing Integration**: Connect to actual billing systems for real costs
- **Real-time Alerts**: Notify when costs exceed thresholds
- **Multi-facility Comparison**: Compare financial metrics across locations
- **Customizable Dashboards**: Let users configure their own financial views
- **Mobile App**: Native mobile financial tracking

## Questions or Issues?

### Common Questions

**Q: Where does the cost data come from?**  
A: We calculate savings based on prevented events (readmissions, ED visits) using standard cost values. Intervention costs come from the `intervention_costs` table.

**Q: How accurate are the ROI calculations?**  
A: Calculations use industry-standard cost estimates. For more accuracy, customize the standard cost values in environment variables to match your facility's actual costs.

**Q: Can we track costs per care manager?**  
A: Not in V1, but this could be added by linking interventions to care manager IDs. See Future Enhancements.

**Q: What if we don't have readmission data yet?**  
A: The financial dashboard will show "N/A" for metrics that depend on missing data. Populate readmission predictions first (using existing readmission prediction endpoint).

### Need Help?

- **Technical questions**: Review [design.md](./design.md) architecture section
- **Business questions**: Review [requirements.md](./requirements.md) user stories
- **Implementation questions**: Check [tasks.md](./tasks.md) for detailed steps

### Report Issues

If you find gaps, inconsistencies, or have suggestions:
1. Document the issue clearly
2. Propose a solution if possible
3. Update the relevant spec document (requirements/design/tasks)
4. Notify the team

## Document History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-08-22 | 1.0 | Initial spec creation | Kiro AI |

---

**Ready to build?** Start with [tasks.md](./tasks.md) Task 1.1!
