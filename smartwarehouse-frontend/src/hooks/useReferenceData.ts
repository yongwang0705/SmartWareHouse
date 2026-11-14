import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type {
  Employee, ProductionRouting, RoutingOperation, WorkCenter,
} from '../types';

interface ReferenceState {
  workCenters: WorkCenter[];
  employees: Employee[];
  routings: ProductionRouting[];
  operations: RoutingOperation[];
  loading: boolean;
  error: string;
}

const initialState: ReferenceState = {
  workCenters: [],
  employees: [],
  routings: [],
  operations: [],
  loading: true,
  error: '',
};

/** Shared production configuration used to resolve IDs to readable labels. */
export function useReferenceData() {
  const [state, setState] = useState<ReferenceState>(initialState);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [workCenters, employees, routings] = await Promise.all([
        api.getWorkCenters(),
        api.getEmployees(),
        api.getRoutings(),
      ]);
      const operations = await api.getAllRoutingOperations();
      setState({ workCenters, employees, routings, operations, loading: false, error: '' });
    } catch (err) {
      setState((current) => ({
        ...current,
        loading: false,
        error: err instanceof Error ? err.message : 'Could not load production configuration.',
      }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { ...state, reload: load };
}
