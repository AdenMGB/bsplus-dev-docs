<template>
  <div
    class="px-4 py-6 md:px-8"
    :class="[config.main.padded && 'container']"
  >
    <ContentRenderer
      :key="page._id"
      :value="page"
      :data="(appConfig.shadcnDocs as any)?.data"
    />
  </div>
</template>

<script setup lang="ts">
const { page } = useContent();
const config = useConfig();
const appConfig = useAppConfig();

useDynamicSeo({
  title: page.value?.title ?? 'Home',
  description: page.value?.description ?? config.value.site.description,
  image: config.value.site.ogImage,
});
</script>
