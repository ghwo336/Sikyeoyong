import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy and waitFor give up after 1 s by default; under the whole monorepo test run (turbo
// runs packages in parallel) the mock client's timers can take longer, and tests failed only
// then (after-order, ChatContainer). A slower machine is not a failure; a missing element is.
// Below vitest's 5 s test timeout, so a real miss still shows testing-library's DOM dump.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
});
