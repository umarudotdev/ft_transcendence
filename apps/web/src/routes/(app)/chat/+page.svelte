<script lang="ts">
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
</script>

<div class="hidden h-full flex-col items-center justify-center lg:flex">
  <div class="text-center">
    <MessageSquareIcon class="mx-auto mb-4 size-16 text-muted-foreground" />
    <h2 class="text-xl font-semibold">Select a conversation</h2>
    <p class="mt-2 text-muted-foreground">
      Choose a conversation from the sidebar to start chatting
    </p>
  </div>
</div>

<div class="lg:hidden">
  <!-- On mobile, the conversation list is shown instead -->
</div>
