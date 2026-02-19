import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import PageWithWrapper from './PageWithWrapper.svelte';

describe('/+page.svelte', () => {
	it('should render h1', async () => {
		render(PageWithWrapper);

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});
});
