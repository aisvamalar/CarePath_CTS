#!/bin/bash
# Post-Discharge Integration Verification Script
# Run this to check if all files are in place

echo "🔍 Verifying Post-Discharge Care Agent Integration..."
echo ""

FRONTEND_ROOT="/Users/vishwa/Desktop/CarePath_CTS"
BACKEND_ROOT="/Users/vishwa/Desktop/CarepathAI_backend"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $2"
    return 0
  else
    echo -e "${RED}✗${NC} $2 (MISSING)"
    return 1
  fi
}

check_content() {
  if grep -q "$2" "$1" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $3"
    return 0
  else
    echo -e "${RED}✗${NC} $3 (NOT FOUND)"
    return 1
  fi
}

ERRORS=0

# Backend Files
echo "📦 BACKEND FILES:"
check_file "$BACKEND_ROOT/migrations/create_notifications_table.sql" "Notifications migration" || ((ERRORS++))
check_file "$BACKEND_ROOT/migrations/add_appointment_type_column.sql" "Appointment type migration" || ((ERRORS++))
check_file "$BACKEND_ROOT/app/models/notification.py" "Notification model" || ((ERRORS++))
check_file "$BACKEND_ROOT/app/schemas/notification.py" "Notification schemas" || ((ERRORS++))
check_file "$BACKEND_ROOT/app/services/notification_service.py" "Notification service" || ((ERRORS++))
check_file "$BACKEND_ROOT/app/api/v1/endpoints/notifications.py" "Notification API endpoints" || ((ERRORS++))
echo ""

# Backend Code Checks
echo "🔧 BACKEND CODE:"
check_content "$BACKEND_ROOT/app/api/v1/api.py" "notifications" "Notifications router registered" || ((ERRORS++))
check_content "$BACKEND_ROOT/app/patient/router.py" "/care-plan" "Care plan endpoint registered" || ((ERRORS++))
check_content "$BACKEND_ROOT/app/services/notification_service.py" "reframe_task_with_llm" "LLM reframing function" || ((ERRORS++))
check_content "$BACKEND_ROOT/app/services/notification_service.py" "schedule_task_reminders" "Task scheduling function" || ((ERRORS++))
echo ""

# Frontend Files
echo "🎨 FRONTEND FILES:"
check_file "$FRONTEND_ROOT/src/hooks/useNotifications.ts" "useNotifications hook" || ((ERRORS++))
check_file "$FRONTEND_ROOT/src/components/NotificationBadge.tsx" "NotificationBadge component" || ((ERRORS++))
check_file "$FRONTEND_ROOT/src/components/NotificationsPanel.tsx" "NotificationsPanel component" || ((ERRORS++))
check_file "$FRONTEND_ROOT/src/components/TaskReminderModal.tsx" "TaskReminderModal component" || ((ERRORS++))
echo ""

# Frontend Code Checks
echo "⚙️  FRONTEND CODE:"
check_content "$FRONTEND_ROOT/src/services/api.ts" "notificationAPI" "Notification API client" || ((ERRORS++))
check_content "$FRONTEND_ROOT/src/services/api.ts" "getMyCarePlan" "Care plan API method" || ((ERRORS++))
check_content "$FRONTEND_ROOT/src/services/appointmentStore.ts" "appointment_type" "Appointment type field" || ((ERRORS++))
check_content "$FRONTEND_ROOT/src/pages/CarePlans.tsx" "useNotifications" "CarePlans notification integration" || ((ERRORS++))
check_content "$FRONTEND_ROOT/src/pages/CarePlans.tsx" "NotificationBadge" "CarePlans badge component" || ((ERRORS++))
check_content "$FRONTEND_ROOT/src/pages/Appointments.tsx" "post_discharge_followup" "Appointments followup badge" || ((ERRORS++))
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Run database migrations:"
  echo "   psql -U vishwa -d carepath_db -f $BACKEND_ROOT/migrations/create_notifications_table.sql"
  echo "   psql -U vishwa -d carepath_db -f $BACKEND_ROOT/migrations/add_appointment_type_column.sql"
  echo ""
  echo "2. Start backend:"
  echo "   cd $BACKEND_ROOT"
  echo "   source venv/bin/activate"
  echo "   python -m uvicorn app.main:app --reload --port 8000"
  echo ""
  echo "3. Start frontend:"
  echo "   cd $FRONTEND_ROOT"
  echo "   npm run dev"
  echo ""
  echo "4. Test the integration (see POST_DISCHARGE_INTEGRATION_COMPLETE.md)"
else
  echo -e "${RED}❌ Found $ERRORS error(s)!${NC}"
  echo "Please review the missing files/code above."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
