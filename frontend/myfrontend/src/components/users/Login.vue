<script setup>
import LoginForm from './LoginForm.vue'
import logo from '@/assets/Judicial Service Commission Logo.png'
</script>

<template>
  
  <div class="page page-center">
    <div class="container container-tight py-4">
      <div class="text-center mb-4">
      </div>
      <div class="card card-md">
        <div class="card-body">
            <div class="text-center mb-4">
                <img :src="logo" alt="Judicial Service Commission Logo" class="login-logo" />
            </div>        
            <h2 class="h2 text-center mb-4">Login to your account</h2>
            <LoginForm />
        </div>
      </div>


    </div>
  </div>
  
</template>

<style scoped>
header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>