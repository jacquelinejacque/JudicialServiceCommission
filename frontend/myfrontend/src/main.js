// import './assets/css/tabler.min.css'
// import './assets/css/demo.min.css'
import '@tabler/core/dist/css/tabler.min.css' 
import 'bootstrap/dist/js/bootstrap.bundle.js'
import "toastify-js/src/toastify.css"
import './assets/main.css'
// import vSelect from 'vue-select'

import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import App from './App.vue'
import { routes } from './utils/Routes.js'
// import { isTokenExpired } from './utils/helpers'  // No longer needed

const router = createRouter({
  history: createWebHistory('/'),
  routes
})

// Removed route guard that blocked navigation

const app = createApp(App)
app.use(router)
// app.component("v-select", vSelect)
app.mount('#app')