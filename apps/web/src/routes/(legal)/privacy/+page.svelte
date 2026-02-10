<svelte:head>
	<title>Privacy Policy | ft_transcendence</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-16">
	<header class="mb-12 space-y-4">
		<h1 class="text-4xl font-bold tracking-tight">Privacy Policy</h1>
		<p class="text-muted-foreground">Last updated: February 2026</p>
	</header>

	<div class="prose prose-neutral dark:prose-invert max-w-none space-y-8">
		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">1. Introduction</h2>
			<p class="leading-relaxed text-muted-foreground">
				Welcome to ft_transcendence. This Privacy Policy explains how we collect, use, store,
				and protect your personal information when you use our platform. We are committed to
				safeguarding your privacy and ensuring transparency in our data practices.
			</p>
			<p class="leading-relaxed text-muted-foreground">
				This platform is developed as part of the 42 school curriculum and is intended for
				educational purposes. By using ft_transcendence, you agree to the data practices
				described in this policy.
			</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">2. Information We Collect</h2>
			<p class="leading-relaxed text-muted-foreground">
				We collect the following categories of personal data:
			</p>
			<h3 class="text-lg font-medium">2.1 Account Information</h3>
			<ul class="list-disc space-y-2 pl-6 text-muted-foreground">
				<li>Email address (used for registration, login, and account recovery)</li>
				<li>Username and display name</li>
				<li>Password (stored as a salted hash using Argon2, never in plain text)</li>
				<li>Profile avatar (uploaded image or default)</li>
			</ul>
			<h3 class="text-lg font-medium">2.2 OAuth Data</h3>
			<ul class="list-disc space-y-2 pl-6 text-muted-foreground">
				<li>When you authenticate via 42 OAuth, we receive your 42 intra profile information
					(login, email, and profile picture) as authorized by the OAuth scope</li>
				<li>We do not store your 42 password</li>
			</ul>
			<h3 class="text-lg font-medium">2.3 Usage Data</h3>
			<ul class="list-disc space-y-2 pl-6 text-muted-foreground">
				<li>Game statistics (wins, losses, rankings, match history)</li>
				<li>Chat messages exchanged within the platform</li>
				<li>Friend list and social interactions</li>
				<li>Achievements, points, streaks, and gamification progress</li>
				<li>Session data (login timestamps, active sessions)</li>
			</ul>
			<h3 class="text-lg font-medium">2.4 Two-Factor Authentication</h3>
			<ul class="list-disc space-y-2 pl-6 text-muted-foreground">
				<li>If you enable 2FA, we store a TOTP secret key linked to your account</li>
				<li>This key is used solely for generating time-based one-time passwords</li>
			</ul>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">3. How We Use Your Information</h2>
			<p class="leading-relaxed text-muted-foreground">We use your data for the following purposes:</p>
			<ul class="list-disc space-y-2 pl-6 text-muted-foreground">
				<li><strong>Account management:</strong> Creating and maintaining your user account, authenticating your identity, and managing sessions</li>
				<li><strong>Platform functionality:</strong> Enabling gameplay, real-time chat, friend systems, leaderboards, and notifications</li>
				<li><strong>Gamification:</strong> Tracking achievements, daily rewards, streaks, and ranking progression</li>
				<li><strong>Security:</strong> Protecting against unauthorized access, enforcing moderation policies, and maintaining platform integrity</li>
				<li><strong>Communication:</strong> Sending account-related emails (verification, password reset) via our email service</li>
			</ul>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">4. Data Storage and Security</h2>
			<ul class="list-disc space-y-2 pl-6 text-muted-foreground">
				<li>All data is stored in a PostgreSQL database</li>
				<li>Passwords are hashed using Argon2 with individual salts</li>
				<li>Sessions are stored server-side in the database (not client-side JWTs)</li>
				<li>Chat messages are encrypted at rest</li>
				<li>All communications between your browser and our servers use HTTPS encryption</li>
				<li>The platform runs in isolated Docker containers</li>
			</ul>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">5. Data Sharing</h2>
			<p class="leading-relaxed text-muted-foreground">
				We do not sell, rent, or share your personal data with third parties. Your data is
				only used within the ft_transcendence platform. The only external service interaction
				is with the 42 OAuth provider during authentication, which is governed by 42's own
				privacy policy.
			</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">6. Your Rights</h2>
			<p class="leading-relaxed text-muted-foreground">You have the right to:</p>
			<ul class="list-disc space-y-2 pl-6 text-muted-foreground">
				<li><strong>Access:</strong> View all personal data we hold about you through your profile and settings pages</li>
				<li><strong>Rectification:</strong> Update or correct your profile information at any time</li>
				<li><strong>Deletion:</strong> Request the deletion of your account and all associated data by contacting an administrator</li>
				<li><strong>Data portability:</strong> Request a copy of your data in a readable format</li>
				<li><strong>Withdraw consent:</strong> Disable optional features such as 2FA or disconnect your 42 OAuth link</li>
			</ul>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">7. Cookies and Sessions</h2>
			<p class="leading-relaxed text-muted-foreground">
				We use essential cookies to maintain your authenticated session. These cookies are
				strictly necessary for the platform to function and cannot be disabled. We do not
				use tracking cookies, analytics cookies, or any third-party advertising cookies.
			</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">8. Data Retention</h2>
			<p class="leading-relaxed text-muted-foreground">
				Your personal data is retained for as long as your account is active. If you request
				account deletion, all personal data will be permanently removed from our systems
				within 30 days. Game statistics and chat messages associated with your account will
				also be deleted.
			</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">9. Children's Privacy</h2>
			<p class="leading-relaxed text-muted-foreground">
				ft_transcendence is not intended for users under the age of 16. We do not knowingly
				collect personal data from children. If we become aware that we have collected data
				from a user under 16, we will take steps to delete that information promptly.
			</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">10. Changes to This Policy</h2>
			<p class="leading-relaxed text-muted-foreground">
				We may update this Privacy Policy from time to time. Any changes will be reflected
				on this page with an updated revision date. We encourage you to review this policy
				periodically.
			</p>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold">11. Contact</h2>
			<p class="leading-relaxed text-muted-foreground">
				If you have questions about this Privacy Policy or wish to exercise your data rights,
				please contact the platform administrators through the in-app moderation system or
				reach out to the development team via the project repository.
			</p>
		</section>
	</div>
</div>
