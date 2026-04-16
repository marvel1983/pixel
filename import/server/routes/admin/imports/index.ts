import { Router } from 'express';
import { registerImportJobRoutes } from './jobs';
import { registerImportArchiveRoutes } from './archives';

export function registerImportRoutes(router: Router) {
  registerImportJobRoutes(router);
  registerImportArchiveRoutes(router);
}
