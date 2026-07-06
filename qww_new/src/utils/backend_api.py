"""
Backend API Module with Offline-First Architecture
Handles all backend communication with automatic offline queuing
"""

import requests
import json
import os
import time
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path
from dotenv import load_dotenv
from .offline_queue import get_offline_queue

load_dotenv()


class BackendAPI:
    """
    Handle all backend communication with offline-first approach
    
    Features:
    - Automatic offline detection
    - Queue data when offline
    - Auto-sync when connection restored
    - No data loss
    - Token auto-refresh on 401
    """
    
    def __init__(self):
        self.base_url = os.getenv('BACKEND_API_URL', 'http://localhost:3000/api/v1').rstrip('/')
        self.api_key = os.getenv('BACKEND_API_KEY')
        self.enabled = True  # Enforce backend uploads by default
        self.accessToken = None
        self.refreshToken = None
        self.session_id = None
        self.offline_queue = get_offline_queue()
        
        # Load persisted tokens if available
        self.session_file = self._resolve_session_file()
        self._load_tokens_from_disk()
        
        print(f"🔌 Backend API initialized:")
        print(f"   URL: {self.base_url}")
        print(f"   Enabled: {self.enabled}")
        print(f"   Offline queue: {self.offline_queue.queue_dir}")

    def _resolve_session_file(self) -> Path:
        runtime_dir = os.getenv("ECG_RUNTIME_DIR", "").strip()
        if runtime_dir:
            base = Path(runtime_dir)
        else:
            base = Path(os.getenv("LOCALAPPDATA") or Path.home()) / "Deckmount" / "ECGMonitor"
        base.mkdir(parents=True, exist_ok=True)
        return base / "ecg_auth_session.json"

    def _load_tokens_from_disk(self):
        try:
            if self.session_file.exists():
                with open(self.session_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.accessToken = data.get('accessToken') or data.get('token')
                    self.refreshToken = data.get('refreshToken')
        except Exception as e:
            print(f"[WARN] Error loading auth tokens: {e}")

    def _save_tokens_to_disk(self):
        try:
            self.session_file.parent.mkdir(parents=True, exist_ok=True)
            session_data = {
                "token": self.accessToken,
                "accessToken": self.accessToken,
                "refreshToken": self.refreshToken,
                "verified_at": datetime.utcnow().isoformat() + "Z"
            }
            with open(self.session_file, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2)
        except Exception as e:
            print(f"[WARN] Error saving auth tokens to disk: {e}")

    def is_enabled(self) -> bool:
        """Check if backend upload is enabled"""
        return self.enabled
    
    def set_token(self, token: str):
        """Set JWT token for authenticated requests"""
        self.accessToken = token
        self._save_tokens_to_disk()
    
    def _headers(self) -> Dict[str, str]:
        """Get request headers"""
        headers = {'Content-Type': 'application/json'}
        if self.accessToken:
            headers['Authorization'] = f'Bearer {self.accessToken}'
        elif self.api_key:
            headers['X-API-Key'] = self.api_key
        return headers

    def refresh_tokens(self) -> bool:
        """Refresh expired access token using refresh token"""
        if not self.refreshToken:
            print("[WARN] No refresh token available to perform auto-refresh")
            return False

        refresh_url = f'{self.base_url}/auth/refresh'
        try:
            print("[INFO] Attempting token refresh...")
            payload = {'refreshToken': self.refreshToken}
            response = requests.post(refresh_url, json=payload, timeout=10)
            if response.status_code in [200, 201]:
                res_data = response.json()
                data_body = res_data.get('data') or res_data
                self.accessToken = data_body.get('accessToken') or data_body.get('token')
                self.refreshToken = data_body.get('refreshToken') or self.refreshToken
                self._save_tokens_to_disk()
                print("[OK] Token refreshed successfully")
                return True
            else:
                print(f"[ERR] Token refresh failed: status={response.status_code}")
                return False
        except Exception as e:
            print(f"[ERR] Exception during token refresh: {e}")
            return False
    
    def _make_request(self, method: str, endpoint: str, retry_on_auth_fail: bool = True, **kwargs) -> Dict[str, Any]:
        """
        Make HTTP request with offline handling and token auto-refresh
        """
        if not self.enabled:
            return {"status": "disabled", "message": "Backend upload is disabled"}
        
        url = f'{self.base_url}/{endpoint}'
        
        try:
            # Check if online
            if not self.offline_queue.is_online():
                return {"status": "queued", "message": "Offline - data queued for sync"}
            
            # Make request
            kwargs['headers'] = self._headers()
            kwargs.setdefault('timeout', 15)
            
            response = requests.request(method, url, **kwargs)
            
            if response.status_code in [200, 201]:
                return response.json() if response.content else {"status": "success"}
            
            elif response.status_code == 401 and retry_on_auth_fail:
                print("[WARN] Received 401 Unauthorized, attempting auto-refresh...")
                if self.refresh_tokens():
                    # Retry once with new token recursively
                    return self._make_request(method, endpoint, retry_on_auth_fail=False, **kwargs)
            
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text
            }
                
        except requests.exceptions.ConnectionError:
            return {"status": "queued", "message": "Connection error - data queued for sync"}
        except requests.exceptions.Timeout:
            return {"status": "queued", "message": "Request timeout - data queued for sync"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def register_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Register a new user
        """
        if not self.offline_queue.is_online():
            return {
                "status": "error",
                "message": "Registration requires internet connection"
            }
        
        return self._make_request('POST', 'auth/register', json=user_data)
    
    def login(self, identifier: str, password: str) -> Dict[str, Any]:
        """
        Login user via POST /desktop/login
        """
        if not self.offline_queue.is_online():
            return {
                "status": "error",
                "message": "Login requires internet connection"
            }
        
        result = self._make_request(
            'POST',
            'desktop/login',
            json={'identifier': identifier, 'password': password}
        )
        
        data_body = result.get('data') or result
        if (result.get('status') == 'success' or 'accessToken' in data_body) and ('accessToken' in data_body or 'token' in data_body):
            self.accessToken = data_body.get('accessToken') or data_body.get('token')
            self.refreshToken = data_body.get('refreshToken')
            self._save_tokens_to_disk()
            # Mark parent dictionary as success for UI expectations
            result['status'] = 'success'
            result['token'] = self.accessToken
        
        return result
    
    # ─── ECG Session API mappings ──────────────────────────────────────────────

    def start_session(self, device_serial: str, device_info: Dict, patient_id: str = "OFFLINE-SYNC", report_type: str = "12_LEAD") -> str:
        """Start a new recording session via POST /desktop/session/start"""
        payload = {
            'device_serial': device_serial,
            'device_id': device_serial,
            'device_info': device_info,
            'patient_id': patient_id,
            'report_type': report_type,
            'sampling_rate': device_info.get('sampling_rate', 500),
            'lead_count': device_info.get('lead_count', 12),
            'duration_seconds': device_info.get('duration_seconds', 10),
            'desktop_version': device_info.get('app_version', '2.0.0'),
            'firmware_version': device_info.get('firmware_version', '1.0.0')
        }
        
        result = self._make_request('POST', 'desktop/session/start', json=payload)
        
        data_body = result.get('data') or result
        if result.get('status') == 'queued':
            # Queue for later sync
            self.offline_queue.queue_data('session_start', payload, priority=1)
            # Generate local session ID
            self.session_id = f"offline_session_{int(datetime.utcnow().timestamp())}"
        elif result.get('status') == 'success' or 'id' in data_body:
            self.session_id = data_body.get('id') or data_body.get('session_id')
        
        return self.session_id
    
    def update_session(self, session_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Update live ECG session metadata via PUT /desktop/session/:id"""
        result = self._make_request('PUT', f'desktop/session/{session_id}', json=payload)
        if result.get('status') == 'queued':
            self.offline_queue.queue_data('session_update', {'session_id': session_id, 'data': payload}, priority=4)
        return result

    def finish_session(self, session_id: str, status: str = "COMPLETED", report_id: str = None) -> Dict[str, Any]:
        """Finish current session via POST /desktop/session/:id/finish"""
        payload = {
            'session_status': status,
            'report_id': report_id
        }
        result = self._make_request('POST', f'desktop/session/{session_id}/finish', json=payload)
        if result.get('status') == 'queued':
            self.offline_queue.queue_data('session_finish', {'session_id': session_id, 'data': payload}, priority=3)
        return result

    def upload_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Upload real-time metrics (updates session metadata or heartbeat logs)"""
        if not self.session_id:
            return {"status": "error", "message": "No active session"}
        
        payload = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'metrics': metrics,
            'session_id': self.session_id
        }
        
        result = self._make_request(
            'POST',
            f'sessions/{self.session_id}/metrics',
            json=payload
        )
        
        if result.get('status') == 'queued':
            self.offline_queue.queue_data('metrics', payload, priority=7)
        
        return result
    
    def upload_waveform(self, leads_data: Dict[str, list], sampling_rate: int) -> Dict[str, Any]:
        """Upload ECG waveform data"""
        if not self.session_id:
            return {"status": "error", "message": "No active session"}
        
        payload = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'sampling_rate': sampling_rate,
            'leads': leads_data,
            'session_id': self.session_id
        }
        
        result = self._make_request(
            'POST',
            f'sessions/{self.session_id}/waveform',
            json=payload
        )
        
        if result.get('status') == 'queued':
            self.offline_queue.queue_data('waveform', payload, priority=5)
        
        return result
    
    # ─── Report Upload and Files Mapping ──────────────────────────────────────

    def upload_report(self, pdf_path: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Upload generated PDF report via POST /desktop/report/upload with multipart file parsing"""
        if not os.path.exists(pdf_path):
            return {"status": "error", "message": "PDF file not found"}
        
        try:
            # Check if online for immediate upload
            if self.offline_queue.is_online() and self.enabled:
                with open(pdf_path, 'rb') as f:
                    files = [('file', ('report.pdf', f, 'application/pdf'))]
                    
                    # Attach JSON twin if present
                    json_twin = Path(pdf_path).with_suffix('.json')
                    opened_twin = None
                    if json_twin.exists():
                        opened_twin = open(json_twin, 'rb')
                        files.append(('file', ('report.json', opened_twin, 'application/json')))

                    # Include active session_id in report payload
                    if self.session_id:
                        metadata['session_id'] = self.session_id

                    data = {'metadata': json.dumps(metadata)}
                    
                    headers = {}
                    if self.accessToken:
                        headers['Authorization'] = f'Bearer {self.accessToken}'
                    
                    try:
                        response = requests.post(
                            f'{self.base_url}/desktop/report/upload',
                            files=files,
                            data=data,
                            headers=headers,
                            timeout=30
                        )
                        
                        if opened_twin:
                            opened_twin.close()

                        if response.status_code in [200, 201]:
                            res_body = response.json()
                            data_body = res_body.get('data') or res_body
                            # Finish session on successful upload
                            if self.session_id:
                                self.finish_session(self.session_id, "COMPLETED", data_body.get('id') or data_body.get('report_id'))
                                self.session_id = None
                            return res_body
                    except Exception as upload_err:
                        if opened_twin:
                            opened_twin.close()
                        print(f"[WARN] Immediate report upload error: {upload_err}")
            
            # Queue for later if offline or upload failed
            payload = {
                'file_path': pdf_path,
                'metadata': metadata,
                'session_id': self.session_id
            }
            self.offline_queue.queue_data('report', payload, priority=2)
            
            return {
                "status": "queued",
                "message": "Report queued for upload when online"
            }
            
        except Exception as e:
            payload = {
                'file_path': pdf_path,
                'metadata': metadata,
                'session_id': self.session_id
            }
            self.offline_queue.queue_data('report', payload, priority=2)
            
            return {
                "status": "queued",
                "message": f"Upload error - queued for retry: {str(e)}"
            }
    
    def end_session(self, summary: Dict[str, Any]) -> Dict[str, Any]:
        """End current session (delegates to finish_session COMPLETED flow)"""
        if not self.session_id:
            return {"status": "error", "message": "No active session"}
        
        result = self.finish_session(self.session_id, "COMPLETED")
        self.session_id = None
        return result
    
    # ─── Heartbeat ────────────────────────────────────────────────────────────

    def send_heartbeat(self, device_serial: str, app_version: str, firmware_version: str, sync_status: str) -> Dict[str, Any]:
        """Send periodic device status check-in via POST /desktop/heartbeat"""
        payload = {
            "device_serial": device_serial,
            "app_version": app_version,
            "firmware_version": firmware_version,
            "sync_status": sync_status
        }
        return self._make_request('POST', 'desktop/heartbeat', json=payload)

    # ─── Patients API ─────────────────────────────────────────────────────────

    def search_patients(self, query: str = "", phone: str = "", mrn: str = "") -> List[Dict[str, Any]]:
        """Search patients from the backend via GET /patients/search"""
        params = {}
        if query:
            params['search'] = query
        if phone:
            params['phone'] = phone
        if mrn:
            params['mrn'] = mrn
            
        result = self._make_request('GET', 'patients/search', params=params)
        data_body = result.get('data') or []
        return data_body if isinstance(data_body, list) else []

    def create_patient(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new patient record in the backend via POST /patients"""
        return self._make_request('POST', 'patients', json=patient_data)

    def update_patient(self, patient_id: str, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update patient record details in the backend via PUT /patients/:id"""
        return self._make_request('PUT', f'patients/{patient_id}', json=patient_data)

    # ─── Legacy/Utility functions ─────────────────────────────────────────────

    def get_user_sessions(self, user_id: str) -> Dict[str, Any]:
        if not self.offline_queue.is_online():
            return {"status": "error", "message": "Offline - cannot retrieve sessions"}
        return self._make_request('GET', f'users/{user_id}/sessions')
    
    def get_session_data(self, session_id: str) -> Dict[str, Any]:
        if not self.offline_queue.is_online():
            return {"status": "error", "message": "Offline - cannot retrieve session data"}
        return self._make_request('GET', f'sessions/{session_id}/data')
    
    def get_queue_stats(self) -> Dict[str, Any]:
        return self.offline_queue.get_stats()
    
    def force_sync(self) -> None:
        self.offline_queue.force_sync_now()
    
    def retry_failed(self) -> int:
        return self.offline_queue.retry_failed_items()


# Global instance
_backend_api = None

def get_backend_api() -> BackendAPI:
    global _backend_api
    if _backend_api is None:
        _backend_api = BackendAPI()
    return _backend_api
