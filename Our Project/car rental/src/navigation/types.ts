import type { Booking, Vehicle } from '../types';

export type RootStackParamList = {
  Main: undefined;
  VehicleDetail: { vehicleId: string };
  Booking: { vehicle: Vehicle };
  Payment: { booking: Booking };
  Return: { booking: Booking; vehicle: Vehicle };
  Notifications: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Vehicles: undefined;
  Bookings: undefined;
  Reports: undefined;
  Admin: undefined;
  Profile: undefined;
};
