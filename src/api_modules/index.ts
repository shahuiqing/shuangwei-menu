// Facade for new modular API - re-export for gradual migration
export * from './client';
export * from './settings';
export * from './orders';
export * from './tables';
export * from './inventory';
export * from './finance';
export * from './storage';
export * from './sync';

// Re-export legacy api object for backward compat (App.tsx still imports from '../api')
export { api } from '../api';
