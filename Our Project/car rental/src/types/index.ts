export type UserRole = 'admin' | 'manager' | 'clerk';
export type VehicleStatus = 'available' | 'booked' | 'rented' | 'maintenance';
export type BookingStatus = 'confirmed' | 'active' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'eft';
export type VehicleCondition = 'good' | 'fair' | 'poor';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  full_name: string;
}

export interface CurrentUser {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  employee_id: string | null;
  is_active: boolean;
  last_login: string | null;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  vehicle_type: string;
  fuel_type: string;
  seats: number;
  color: string | null;
  mileage: number;
  last_service_mileage: number;
  status: VehicleStatus;
  daily_rate: number;
  weekly_rate: number | null;
  monthly_rate: number | null;
}

export interface Customer {
  id: string;
  full_name: string;
  id_number: string | null;
  drivers_license: string | null;
  phone: string;
  email: string | null;
}

export interface Booking {
  id: string;
  customer_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  base_amount: number;
  vat_amount: number;
  total_amount: number;
  status: BookingStatus;
  created_by: string;
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  method: PaymentMethod;
  deposit_amount: number;
  deposit_reference: string | null;
  processed_by: string;
  processed_at: string;
}

export interface VehicleReturn {
  id: string;
  booking_id: string;
  actual_return_date: string;
  ending_odometer: number;
  ending_fuel_level: number;
  condition: VehicleCondition;
  damage_notes: string | null;
  days_overdue: number;
  late_fee: number;
  fuel_penalty: number;
  total_penalty: number;
  km_driven: number;
  processed_by: string;
}

// Generic shape of FastAPI's error responses, used to show useful messages.
export interface ApiErrorBody {
  detail?: string | { msg: string; loc: (string | number)[] }[];
}

export interface RevenueReport {
  start_date: string;
  end_date: string;
  total_revenue: number;
  transaction_count: number;
  by_method: Record<string, number>;
  by_day: { date: string; amount: number }[];
}

export interface FleetVehicleRow {
  vehicle_id: string;
  make: string;
  model: string;
  plate: string;
  status: VehicleStatus;
  total_bookings: number;
  total_days_rented: number;
  total_revenue: number;
}

export interface FleetUtilizationReport {
  fleet_size: number;
  status_breakdown: Record<VehicleStatus, number>;
  vehicles: FleetVehicleRow[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_id: string | null;
  action: string;
  affected_table: string;
  detail: string | null;
  ip_address: string | null;
}

export interface OverdueReturnAlert {
  booking_id: string;
  vehicle_id: string;
  vehicle: string;
  customer: string;
  end_date: string;
  days_overdue: number;
}

export interface ServiceDueAlert {
  vehicle_id: string;
  vehicle: string;
  mileage: number;
  last_service_mileage: number;
  km_since_service: number;
}

export interface LowFuelAlert {
  vehicle_id: string;
  vehicle: string;
  fuel_level: number;
}

export interface MaintenanceAlert {
  vehicle_id: string;
  vehicle: string;
}

export interface NotificationsResponse {
  overdue_returns: OverdueReturnAlert[];
  service_due: ServiceDueAlert[];
  low_fuel: LowFuelAlert[];
  in_maintenance: MaintenanceAlert[];
  total_count: number;
}
