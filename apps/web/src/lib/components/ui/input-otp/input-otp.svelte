<script lang="ts">
	import { PinInput as InputOTPPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		value = $bindable(''),
		...restProps
	}: InputOTPPrimitive.RootProps = $props();
</script>

<InputOTPPrimitive.Root
	bind:ref
	bind:value
	data-slot="input-otp"
	class={cn(
		// MD3 OTP Input container
		'flex items-center gap-2',
		'has-disabled:opacity-38 [&_input]:disabled:cursor-not-allowed',
		className
	)}
	{...restProps}
/>
