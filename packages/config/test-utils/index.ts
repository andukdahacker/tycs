/**
 * Canonical mock factories and test utilities for tycs.
 *
 * All test mocks should be centralized here. Import from '@tycs/config/test-utils'
 * in test files — never create ad-hoc mocks.
 *
 * Mock factories to be populated in Story 1.5:
 * - msw v2 handlers (http.get, not rest.get)
 * - Firebase Auth mock (verifyIdToken → test uid)
 * - Anthropic SDK mock (scripted streaming chunks)
 * - EventSource mock (injectable constructor)
 * - createTestQueryClient (no retries, no cache)
 * - TestProviders wrapper
 */

export {}
