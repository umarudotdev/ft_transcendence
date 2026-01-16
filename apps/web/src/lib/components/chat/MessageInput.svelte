<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Textarea } from "$lib/components/ui/textarea";
  import { createSendMessageMutation } from "$lib/queries/chat";
  import { getChatStore } from "$lib/stores/chat.svelte";
  import SendIcon from "@lucide/svelte/icons/send";

  interface Props {
    channelId: number;
  }

  let { channelId }: Props = $props();

  const chatStore = getChatStore();
  const sendMessageMutation = createSendMessageMutation();

  let content = $state("");
  let isTyping = $state(false);
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleInput() {
    // Start typing indicator
    if (!isTyping && content.trim()) {
      isTyping = true;
      chatStore.startTyping(channelId);
    }

    // Reset typing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    typingTimeout = setTimeout(() => {
      if (isTyping) {
        isTyping = false;
        chatStore.stopTyping(channelId);
      }
    }, 2000);
  }

  async function handleSubmit(e?: Event) {
    e?.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    // Stop typing indicator
    if (isTyping) {
      isTyping = false;
      chatStore.stopTyping(channelId);
    }

    // Clear input immediately for responsiveness
    const messageContent = trimmedContent;
    content = "";

    // Send via WebSocket if connected, otherwise use REST
    if (chatStore.isConnected) {
      chatStore.sendMessage(channelId, messageContent);
    } else {
      await sendMessageMutation.mutateAsync({ channelId, content: messageContent });
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<form onsubmit={handleSubmit} class="border-t p-4">
  <div class="flex items-end gap-2">
    <Textarea
      bind:value={content}
      oninput={handleInput}
      onkeydown={handleKeydown}
      placeholder="Type a message..."
      class="min-h-[2.5rem] max-h-32 resize-none"
      rows={1}
    />
    <Button
      type="submit"
      size="icon"
      disabled={!content.trim() || sendMessageMutation.isPending}
    >
      <SendIcon class="size-4" />
      <span class="sr-only">Send message</span>
    </Button>
  </div>
</form>
