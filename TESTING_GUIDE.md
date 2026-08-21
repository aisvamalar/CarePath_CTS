# Smart Safety Questions - Testing Guide

## Prerequisites
- ✅ Backend running on port 8000
- ✅ Frontend running on dev server
- ✅ Valid Gemini API key in backend .env
- ✅ PostgreSQL database accessible

## Quick Start

### 1. Start Backend
```bash
cd /Users/vishwa/Desktop/CarepathAI_backend
source venv/bin/activate  # if needed
uvicorn app.main:app --reload --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### 2. Start Frontend
```bash
cd /Users/vishwa/Desktop/CarePath_CTS
npm run dev
```

**Expected output:**
```
VITE ready in XXX ms
➜  Local:   http://localhost:5173/
```

## Test Scenarios

### Scenario 1: Chest Pain (Critical Symptoms)

1. **Login** as a patient
2. **Click** "New Assessment" or the input area
3. **Type:** "I'm having chest pain"
4. **Answer follow-up questions:**
   - When did it start? → "1 hour ago"
   - Pain level? → "7 out of 10"
   - Any other symptoms? → "No"
5. **Watch for phase transition** → "Safety" phase should load
6. **Verify SmartSafetyQuestions renders:**
   - Shows "Analyzing your symptoms..." (loading state)
   - Then shows 3-5 targeted questions
   - Should include: chest_pain, difficulty_breathing, possibly altered_consciousness
   - Should NOT show: unable_to_walk, severe_abdominal_pain (not relevant)
7. **Check console:**
   ```
   [SmartSafety] Fetching filter for: { sessionId: "...", chiefComplaint: "chest pain", ... }
   [SmartSafety] Got filtered flags: { relevant_flags: [...], total_relevant: 3-5, ... }
   ```
8. **Answer questions** (Yes/No buttons)
9. **Submit** and verify verdict card shows

**Expected questions for chest pain:**
- ✅ Chest pain or pressure (critical)
- ✅ Difficulty breathing (critical)
- ✅ Altered consciousness (high)
- ✅ Possibly high fever (medium)
- ❌ NOT asking about walking, abdominal pain, bleeding

### Scenario 2: Ankle Pain (Non-Critical)

1. **New Assessment**
2. **Type:** "I twisted my ankle"
3. **Answer follow-ups:**
   - When? → "This morning"
   - Pain level? → "5"
   - Swelling? → "Yes, moderate"
4. **Safety phase loads**
5. **Verify SmartSafetyQuestions shows 2-3 questions:**
   - Should include: unable_to_walk, possibly severe_bleeding
   - Should NOT include: chest_pain, stroke_symptoms, suicidal_ideation
6. **Check console for filtering**
7. **Answer and submit**

**Expected questions for ankle pain:**
- ✅ Unable to walk or stand (high)
- ✅ Severe bleeding (medium, if open wound mentioned)
- ❌ NOT asking about chest, breathing, consciousness

### Scenario 3: Headache with Mental Health Keywords

1. **New Assessment**
2. **Type:** "I have a severe headache and feeling really depressed"
3. **Answer follow-ups**
4. **Verify questions include:**
   - altered_consciousness (neurological)
   - suicidal_ideation (mental health keyword detected)
   - possibly high_fever

### Scenario 4: Error Handling

**Test 4A: Expired Token**
1. Clear localStorage: `localStorage.removeItem('cp_token')`
2. Try to start new assessment
3. **Expected:** Redirected to login page

**Test 4B: Network Error**
1. Stop backend server
2. Start new assessment and complete intake
3. **Expected:** 
   - Loading state appears
   - Then error message: "Failed to load safety questions"
   - Retry button shown
   - NO fallback to full checklist

**Test 4C: LLM Failure**
1. Set invalid `google_api_key` in backend .env
2. Restart backend
3. Complete intake
4. **Expected:** Backend returns all 10 questions (safety fallback)

## Console Output Examples

### ✅ Success Case
```
[Chat] renderMainArea: { phase: "safety", hasActiveConv: true, sessionId: "sess_123", chiefComplaint: "chest pain", useSmartSafety: true }

[SmartSafety] Fetching filter for: { sessionId: "sess_123", chiefComplaint: "chest pain", extractedFeatures: { pain_scale: 7, symptom_onset: "1 hour ago" } }

[SmartSafety] Got filtered flags: {
  relevant_flags: [
    { field: "chest_pain", priority: "critical", relevance_reason: "..." },
    { field: "difficulty_breathing", priority: "critical", relevance_reason: "..." },
    { field: "altered_consciousness", priority: "high", relevance_reason: "..." }
  ],
  total_relevant: 3,
  skipped_count: 7,
  reasoning: "Chest pain requires immediate cardiac and respiratory screening"
}
```

### ❌ Error Case (Token Missing)
```
[SmartSafety] Filter error: Error: Request failed with status code 401
ERROR: Your session has expired. Please log in again.
```

## UI Verification Checklist

### Smart Safety Questions Component
- [ ] Shows loading spinner with "Analyzing your symptoms..."
- [ ] Displays 2-5 question cards (not all 10)
- [ ] Each card shows:
  - [ ] Question number (1, 2, 3...)
  - [ ] Priority badge (critical/high/medium) with color coding
  - [ ] Full question text
  - [ ] Relevance hint (explains why this question is relevant)
  - [ ] Yes/No buttons (not checkboxes)
- [ ] Shows AI reasoning box at top
- [ ] Shows progress indicator (X concerns noted)
- [ ] Shows summary: "X targeted questions • Y skipped as not relevant"
- [ ] Submit button enabled when questions answered
- [ ] Loading state during submit shows "Evaluating..."

### After Booking
- [ ] VerdictCard shows care plan
- [ ] CareNavigation shows provider search
- [ ] "Start New Assessment" button visible
- [ ] Clicking button resets conversation and starts fresh intake

## Backend Verification

### Check Logs
```bash
tail -f /path/to/backend/logs
```

**Expected log entries:**
```
INFO - Smart red flag filtering: selected 3/10 questions for 'chest pain'
INFO - Successfully executed ML best_avoidable_ed_model
INFO - navigate: classification complete (destination=PCP)
```

### API Test (Manual)
```bash
# 1. Get auth token (login)
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"patient1","password":"password"}' | jq -r '.access_token')

# 2. Create intake session
SESSION=$(curl -s -X POST http://127.0.0.1:8000/api/v1/intake/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patient_id":"patient1"}' | jq -r '.session_id')

# 3. Test smart filter
curl -X POST "http://127.0.0.1:8000/api/v1/safety/sessions/$SESSION/smart-filter?chief_complaint=chest%20pain" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pain_scale":7,"symptom_onset":"1 hour ago"}' | jq
```

**Expected response:**
```json
{
  "relevant_flags": [
    {
      "field": "chest_pain",
      "question": "Are you having chest pain or pressure...",
      "relevance_reason": "Direct match to chief complaint",
      "priority": "critical"
    },
    ...
  ],
  "total_relevant": 3,
  "skipped_count": 7,
  "reasoning": "Chest pain requires immediate cardiac and respiratory screening"
}
```

## Performance Metrics

- **LLM response time:** 2-5 seconds (Gemini API call)
- **Component load time:** < 100ms (excluding LLM)
- **Total safety phase time:** 3-6 seconds (LLM + user answers)

## Known Issues & Limitations

1. **LLM Dependency:** If Gemini API is down, falls back to all 10 questions
2. **Token Expiry:** 30-minute session timeout (configurable in backend)
3. **Browser Support:** Modern browsers only (ES2020+)

## Troubleshooting

### "No auth token" error
- **Cause:** Token not in localStorage or invalid
- **Fix:** Re-login, check backend JWT configuration

### "Failed to load safety questions"
- **Cause:** Backend endpoint error or LLM failure
- **Check:** Backend logs for detailed error
- **Fix:** Verify Gemini API key, check network

### Component shows old SafetyChecklist
- **Cause:** useSmartSafety flag is false or chief_complaint missing
- **Check:** Chat.tsx renderMainArea logic
- **Fix:** Ensure intake completed with chief_complaint

### Questions seem irrelevant
- **Cause:** LLM prompt needs tuning
- **Check:** smart_red_flags.py prompt template
- **Fix:** Adjust constraint-based prompt

## Success Criteria

✅ **Component renders without errors**
✅ **Shows 2-5 questions (not all 10)**
✅ **Questions match symptom context**
✅ **AI reasoning displayed**
✅ **Priority badges shown**
✅ **Yes/No buttons work**
✅ **Submit progresses to verdict**
✅ **"Start New Assessment" restarts flow**
✅ **No token errors in console**
✅ **Backend logs show LLM filtering**

## Contact

If issues persist:
1. Check SMART_SAFETY_FIX.md for detailed architecture
2. Check TOKEN_FIX_SUMMARY.md for authentication flow
3. Review backend logs for detailed errors
4. Test with different symptom types
