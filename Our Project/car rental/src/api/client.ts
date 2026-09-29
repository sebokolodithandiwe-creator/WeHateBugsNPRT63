import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../config';
import type {
  ApiErrorBody,
  AuditLogEntry,
  Booking,
  Customer,
  CurrentUser,
  FleetUtilizationReport,
  LoginResponse,
  NotificationsResponse,
  Payment,
  RevenueReport,
  UserRole,
  Vehicle,
  VehicleReturn,
} from '../types';

const TOKEN_KEY = 'vrms_access_token';

let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

async function setToken(token: string | null) {
  cachedToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

// Turns FastAPI's error shape into a single readable string for the UI.
function extractErrorMessage(body: ApiErrorBody, fallback: string): string {
  if (!body || !body.detail) return fallback;
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail.map((d) => d.msg).join('\n');
  }
  return fallback;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    form?: Record<string, string>;
    auth?: boolean;
  } = {}
): Promise<T> {
  const { method = 'GET', body, form, auth = true } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  let requestBody: string | undefined;

  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    requestBody = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: requestBody,
    });
  } catch (networkError) {
    // This is the error you'll see if the phone/emulator can't reach the
    // backend at all - wrong IP in config.ts, backend not running, etc.
    throw new ApiError(
      `Could not reach the server at ${API_BASE_URL}. Make sure the backend is running and the address in src/config.ts is correct.`,
      0
    );
  }

  const text = await response.text();
  let data: ApiErrorBody | null = null;

  if (text) {
    try {
      data = JSON.parse(text) as ApiErrorBody;
    } catch {
      // Some proxy/server failures can return HTML or plain text instead of JSON.
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      await setToken(null);
    }
    throw new ApiError(extractErrorMessage(data, `Request failed (${response.status})`), response.status);
  }

  return data as T;
}

export const api = {
  // ---------- Auth ----------
  async login(username: string, password: string): Promise<LoginResponse> {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      form: { grant_type: 'password', username, password },
      auth: false,
    });
    await setToken(result.access_token);
    return result;
  },

  async register(payload: {
    full_name: string;
    username: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    employee_id?: string;
  }): Promise<CurrentUser> {
    return request<CurrentUser>('/auth/register', { method: 'POST', body: payload, auth: false });
  },

  async me(): Promise<CurrentUser> {
    return request<CurrentUser>('/auth/me');
  },

  async logout() {
    await setToken(null);
  },

  // ---------- Vehicles ----------
  async searchVehicles(params: { q?: string; vehicle_type?: string; status?: string } = {}): Promise<Vehicle[]> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    return request<Vehicle[]>(`/vehicles${query ? `?${query}` : ''}`);
  },

  async getVehicle(id: string): Promise<Vehicle> {
    return request<Vehicle>(`/vehicles/${id}`);
  },

  async updateVehicle(id: string, payload: Partial<Pick<Vehicle, 'status' | 'mileage' | 'daily_rate' | 'weekly_rate' | 'monthly_rate'>>): Promise<Vehicle> {
    return request<Vehicle>(`/vehicles/${id}`, { method: 'PATCH', body: payload });
  },

  async createVehicle(payload: Partial<Vehicle>): Promise<Vehicle> {
    return request<Vehicle>('/vehicles', { method: 'POST', body: payload });
  },

  // ---------- Customers ----------
  async searchCustomers(q?: string): Promise<Customer[]> {
    return request<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  },

  async createCustomer(payload: {
    full_name: string;
    phone: string;
    id_number?: string;
    drivers_license?: string;
    email?: string;
  }): Promise<Customer> {
    return request<Customer>('/customers', { method: 'POST', body: payload });
  },

  // ---------- Bookings ----------
  async listBookings(params: { customer_id?: string; vehicle_id?: string; status?: string } = {}): Promise<Booking[]> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
    return request<Booking[]>(`/bookings${query ? `?${query}` : ''}`);
  },

  async createBooking(payload: {
    customer_id: string;
    vehicle_id: string;
    start_date: string;
    end_date: string;
  }): Promise<Booking> {
    return request<Booking>('/bookings', { method: 'POST', body: payload });
  },

  async cancelBooking(id: string): Promise<Booking> {
    return request<Booking>(`/bookings/${id}/cancel`, { method: 'POST' });
  },

  // ---------- Payments ----------
  async createPayment(payload: {
    booking_id: string;
    amount: number;
    method: 'cash' | 'card' | 'eft';
    deposit_amount?: number;
    deposit_reference?: string;
  }): Promise<Payment> {
    return request<Payment>('/payments', { method: 'POST', body: payload });
  },

  // ---------- Returns ----------
  async createReturn(payload: {
    booking_id: string;
    ending_odometer: number;
    ending_fuel_level: number;
    condition: 'good' | 'fair' | 'poor';
    damage_notes?: string;
  }): Promise<VehicleReturn> {
    return request<VehicleReturn>('/returns', { method: 'POST', body: payload });
  },

  // ---------- Admin: users + audit log ----------
  async listUsers(): Promise<CurrentUser[]> {
    return request<CurrentUser[]>('/users');
  },

  async updateUser(id: string, payload: { role?: UserRole; is_active?: boolean; password?: string }): Promise<CurrentUser> {
    return request<CurrentUser>(`/users/${id}`, { method: 'PATCH', body: payload });
  },

  async deleteUser(id: string): Promise<void> {
    await request<void>(`/users/${id}`, { method: 'DELETE' });
  },

  async getAuditLog(): Promise<AuditLogEntry[]> {
    return request<AuditLogEntry[]>('/users/audit-log/all');
  },

  // ---------- Notifications ----------
  async getNotifications(): Promise<NotificationsResponse> {
    return request<NotificationsResponse>('/notifications');
  },

  async recordService(vehicleId: string): Promise<void> {
    await request(`/notifications/vehicles/${vehicleId}/service`, { method: 'POST' });
  },

  // ---------- Reports ----------
  async getRevenueReport(): Promise<RevenueReport> {
    return request<RevenueReport>('/reports/revenue');
  },

  async getFleetUtilizationReport(): Promise<FleetUtilizationReport> {
    return request<FleetUtilizationReport>('/reports/fleet-utilization');
  },

  // ---------- Contracts ----------
  // The contract endpoint returns a real PDF, not JSON, so it can't go through
  // the generic `request` helper above. We download it to the device's local
  // storage, then hand it to the OS share/view sheet so the person can open
  // it in a PDF viewer, save it, or share it.
  async downloadAndOpenContract(bookingId: string): Promise<void> {
    const token = await getToken();
    const url = `${API_BASE_URL}/bookings/${bookingId}/contract`;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    if (Platform.OS === 'web') {
      // Browsers have no file-system or native share sheet - fetch the PDF as
      // a blob and open it in a new tab instead, which the browser renders
      // using its own built-in PDF viewer.
      let response: Response;
      try {
        response = await fetch(url, { headers });
      } catch {
        throw new ApiError('Could not reach the server to fetch the contract.', 0);
      }
      if (!response.ok) {
        throw new ApiError(`Could not generate the contract (status ${response.status}).`, response.status);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      return;
    }

    const destination = new File(Paths.cache, `rental-agreement-${bookingId}.pdf`);

    // If a previous attempt left a file behind, remove it so the download doesn't fail.
    if (destination.exists) {
      destination.delete();
    }

    let downloadedFile: File;
    try {
      downloadedFile = await File.downloadFileAsync(url, destination, { headers });
    } catch (e) {
      throw new ApiError('Could not download the contract. Check that the backend is reachable.', 0);
    }

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(downloadedFile.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Rental Agreement',
      });
    }
  },
};

export { ApiError };
