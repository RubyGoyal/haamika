/**
 * Repository factory: selects memoryRepository or firestoreRepository
 * based on the DATA_BACKEND configuration.
 */
import type { Repository } from './repository.js';
import { createMemoryRepository } from './memoryRepository.js';
import { createFirestoreRepository } from './firestoreRepository.js';

export function createRepository(backend: 'memory' | 'firestore', projectId?: string): Repository {
  if (backend === 'firestore') {
    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT is required when DATA_BACKEND=firestore');
    }
    return createFirestoreRepository(projectId);
  }
  return createMemoryRepository();
}
