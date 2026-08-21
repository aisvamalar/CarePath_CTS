# Smart Safety Questions - Token Authentication Fix

## Problem
SmartSafetyQuestions component was failing with "No auth token" error because it was using raw `fetch` API instead of the centralized axios client that handles authentication automatically.

## Solution
1. **Added smart filter endpoint to safetyAPI** (`src/services/api.ts`)
   - New method: `smartFilter(session_id, chief_complaint, extracted_features)`
   - Uses axios client which automatically adds `Authorization: Bearer <token>` header

2. **Updated SmartSafetyQuestions component** (`src/components/SmartSafetyQuestions.tsx`)
   - Replaced raw `fetch` with `safetyAPI.smartFilter()`
   - Token now handled automatically by axios interceptor
   - Better error messages for different failure scenarios
   - Improved loading state messages

3. **Fixed backend router** (`app/patient/safety/router.py`)
   - Properly defined `chief_complaint` as query parameter with `Query(...)`
   - Defined `extracted_features` as body parameter with `Body(default={})`
   - Imports `Query` and `Body` from FastAPI

## How Authentication Works
1. Token stored in localStorage as `'cp_token'` (managed by AppContext)
2. Axios client reads token via interceptor: `localStorage.getItem('cp_token')`
3. Every API request automatically includes: `Authorization: Bearer <token>`
4. Backend validates token using `get_current_patient` dependency

## Files Changed

### Frontend
- ✅ `src/services/api.ts` - Added `smartFilter` to `safetyAPI`
- ✅ `src/components/SmartSafetyQuestions.tsx` - Use `safetyAPI` instead of raw fetch
- ✅ `src/pages/Chat.tsx` - Already correctly passes props to SmartSafetyQuestions

### Backend
- ✅ `app/patient/safety/router.py` - Fixed endpoint parameter definitions
- ✅ `app/patient/safety/smart_red_flags.py` - Already correct (no changes needed)

## Testing Steps

1. **Start Backend** (if not running):
   ```bash
   cd /Users/vishwa/Desktop/CarepathAI_backend
   source venv/bin/activate
   uvicorn app.main:app --reload --port 8000
   ```

2. **Start Frontend** (if not running):
   ```bash
   cd /Users/vishwa/Desktop/CarePath_CTS
   npm run dev
   ```

3. **Test Flow**:
   - Login as a patient
   - Start new conversation
   - Complete intake phase (describe symptoms like "chest pain" or "leg pain")
   - Verify safety phase renders SmartSafetyQuestions
   - Check console - should see:
     - `[SmartSafety] Fetching filter for:` with session data
     - `[SmartSafety] Got filtered flags:` with filtered questions
   - Should see 2-5 targeted questions (not all 10)
   - Answer questions and submit
   - After booking, click "Start New Assessment" to restart

4. **Expected Behavior**:
   - ✅ No "No auth token" error
   - ✅ Smart questions load successfully
   - ✅ Shows AI reasoning for question selection
   - ✅ Shows priority badges (critical/high/medium)
   - ✅ Shows "X targeted questions • Y skipped as not relevant"
   - ✅ Symptoms like "chest pain" → 4-5 cardiac/respiratory questions
   - ✅ Symptoms like "ankle pain" → 2-3 mobility/injury questions

## Error Scenarios

If you see errors, check:

1. **"Your session has expired"** → Token invalid, need to re-login
2. **"Failed to load safety questions"** → Backend endpoint issue, check logs
3. **"Safety assessment not found"** → Session ID mismatch, restart conversation
4. **Component shows all 10 questions** → Using fallback SafetyChecklist (shouldn't happen)

## Console Debug Output

You should see these console logs when it works correctly:
```
[SmartSafety] Fetching filter for: { sessionId: "...", chiefComplaint: "chest pain", extractedFeatures: {...} }
[SmartSafety] Got filtered flags: { relevant_flags: [...], total_relevant: 4, skipped_count: 6, reasoning: "..." }
```

## Key Features

- ✅ **No fallbacks** - Component shows error if filtering fails (per user request)
- ✅ **Token handled automatically** - No manual token management needed
- ✅ **LLM-powered filtering** - Uses Gemini with constraint-based prompting
- ✅ **2-5 relevant questions** - Not all 10 scary questions
- ✅ **Priority levels** - Shows critical/high/medium badges
- ✅ **AI reasoning** - Explains why questions were selected
- ✅ **Conversational UI** - Yes/No buttons instead of checkboxes

## API Endpoint

```
POST /api/v1/safety/sessions/{session_id}/smart-filter?chief_complaint=chest%20pain
Authorization: Bearer <token>
Content-Type: application/json

{
  "pain_scale": 7,
  "symptom_onset": "1 hour ago",
  "location": "Austin, Texas"
}
```

**Response:**
```json
{
  "relevant_flags": [
    {
      "field": "chest_pain",
      "question": "Are you having chest pain or pressure...",
      "relevance_reason": "Direct match to chief complaint",
      "priority": "critical"
    },
    {
      "field": "difficulty_breathing",
      "question": "Are you having SEVERE difficulty breathing...",
      "relevance_reason": "Cardiac symptoms often present with respiratory distress",
      "priority": "high"
    }
  ],
  "total_relevant": 2,
  "skipped_count": 8,
  "reasoning": "Chest pain requires immediate cardiac and respiratory screening"
}
```

## Next Steps

After this fix is verified working:
1. Test with various chief complaints (chest pain, ankle injury, headache, etc.)
2. Verify "Start New Assessment" button works after appointment booking
3. Test error scenarios (expired token, network issues)
4. Consider adding loading animation similar to Claude's "thinking" display
