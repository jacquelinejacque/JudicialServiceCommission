<script>
import AppHeader from './common/AppHeader.vue'

export default {
  name: "EuroluxMain",
  components: {
    AppHeader,
  }
}
</script>

<template>
  <AppHeader></AppHeader>
  <div class="page">
    <!-- Navbar -->

    <div class="page-wrapper">
      <router-view :key="$route.path"></router-view>

    </div>

    <!-- <AppFooter></AppFooter> -->
  </div>
</template>