import { useState, useEffect } from 'react';
import { careService, type CarePlan, type FollowUpCheckIn } from '../../services/api';
import { toApiError } from '../../services/apiClient';

export default function MyCarePlan() {
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);
  const [checkins, setCheckins] = useState<FollowUpCheckIn[]>([]);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitStatus, setSubmitStatus] = useState('');

  // Load care plan on mount
  useEffect(() => {
    loadCarePlan();
  }, []);

  async function loadCarePlan() {
    try {
      setLoading(true);
      setError('');
      
      // Call the /my-care-plan endpoint which uses the JWT token to identify the patient
      const plan = await careService.getMyCarePlan();
      setCarePlan(plan);
      
      if (plan?.care_plan_id) {
        const { checkins: checkinsData } = await careService.getCheckIns(plan.care_plan_id);
        setCheckins(checkinsData);
      }
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitResponse() {
    if (!response.trim()) return;
    
    try {
      setLoading(true);
      setSubmitStatus('');
      setError('');
      
      // Get current user info
      const userResponse = await fetch('http://localhost:8000/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cp_token')}`
        }
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }
      
      const userData = await userResponse.json();
      
      const result = await careService.submitResponse(userData.patient_id, response);
      
      if (result.classification === 'URGENT') {
        setSubmitStatus('⚠️ Urgent response detected. An appointment is being scheduled.');
      } else if (result.classification === 'CONCERN') {
        setSubmitStatus('⚠️ Your care plan has been updated based on your response.');
      } else {
        setSubmitStatus('✅ Thank you for your update.');
      }
      
      setResponse('');
      await loadCarePlan(); // Refresh
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !carePlan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your care plan...</p>
        </div>
      </div>
    );
  }

  if (error && !carePlan) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Care Plan</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadCarePlan}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!carePlan) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h3 className="text-xl font-semibold text-yellow-800 mb-2">No Active Care Plan</h3>
          <p className="text-yellow-700">You don't have an active care plan at the moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">My Care Plan</h1>
      
      {/* Care Plan Summary */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Plan ID: {carePlan.care_plan_id}</h2>
            <div className="mt-2 space-y-1">
              <p className="text-gray-600">
                Risk Level: <span className={`font-medium ${
                  carePlan.risk_level === 'HIGH' ? 'text-red-600' :
                  carePlan.risk_level === 'MODERATE' ? 'text-yellow-600' :
                  'text-green-600'
                }`}>{carePlan.risk_level}</span>
              </p>
              <p className="text-gray-600">
                Intensity: <span className="font-medium text-blue-600">{carePlan.intensity}</span>
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            carePlan.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
            carePlan.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {carePlan.status}
          </span>
        </div>
        
        {carePlan.doctor_instructions && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded">
            <p className="font-medium text-blue-900 mb-1">Doctor's Instructions:</p>
            <p className="text-blue-800">{carePlan.doctor_instructions}</p>
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Care Tasks</h3>
        {carePlan.tasks && carePlan.tasks.length > 0 ? (
          <div className="space-y-3">
            {carePlan.tasks.map((task) => (
              <div
                key={task.task_id}
                className="flex items-start border-l-4 pl-4 py-2"
                style={{
                  borderColor: task.status === 'COMPLETED' ? '#10b981' :
                              task.status === 'IN_PROGRESS' ? '#3b82f6' :
                              '#d1d5db'
                }}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{task.task_type.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                  {task.scheduled_date && (
                    <p className="text-xs text-gray-500 mt-1">
                      Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span className={`text-sm font-medium ml-4 ${
                  task.status === 'COMPLETED' ? 'text-green-600' :
                  task.status === 'IN_PROGRESS' ? 'text-blue-600' :
                  'text-gray-500'
                }`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No tasks assigned yet.</p>
        )}
      </div>

      {/* Follow-Up Check-Ins */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-In History</h3>
        {checkins && checkins.length > 0 ? (
          <div className="space-y-4">
            {checkins.map((checkin) => (
              <div key={checkin.checkin_id} className="border rounded-lg p-4">
                <p className="font-medium text-gray-800">{checkin.message}</p>
                {checkin.response && (
                  <div className="mt-2 bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600 font-medium">Your Response:</p>
                    <p className="text-gray-800 mt-1">{checkin.response}</p>
                    {checkin.classification && (
                      <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                        checkin.classification === 'URGENT' ? 'bg-red-100 text-red-800' :
                        checkin.classification === 'CONCERN' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {checkin.classification}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">Status: {checkin.status}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No check-ins yet.</p>
        )}
      </div>

      {/* Submit Response */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-In Response</h3>
        <p className="text-sm text-gray-600 mb-3">How are you feeling? Any concerns or symptoms?</p>
        <textarea
          className="w-full border border-gray-300 rounded-lg p-3 mb-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={4}
          placeholder="E.g., I'm feeling much better today, no issues..."
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          disabled={loading}
        />
        <button
          onClick={handleSubmitResponse}
          disabled={loading || !response.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Submitting...' : 'Submit Response'}
        </button>
        
        {submitStatus && (
          <div className={`mt-4 p-3 rounded-lg ${
            submitStatus.includes('Urgent') ? 'bg-red-50 text-red-800' :
            submitStatus.includes('updated') ? 'bg-yellow-50 text-yellow-800' :
            'bg-green-50 text-green-800'
          }`}>
            <p className="font-medium">{submitStatus}</p>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-800">
            <p className="font-medium">Error: {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
