import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy and waitFor give up after 1 s by default; under the whole monorepo test run (turbo
// runs packages in parallel) the mock client's timers can take longer, and tests failed only
// then (after-order, ChatContainer). A slower machine is not a failure; a missing element is.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
