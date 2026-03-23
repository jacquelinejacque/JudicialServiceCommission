<script>
import { Const } from '@/utils/constants'
import { Toast } from 'bootstrap/dist/js/bootstrap.bundle'
import axios from 'axios'

export default {
  data() {
    return {
      formData: {
        username: 'joy@example.com',
        password: 'password123'
      },
      loading: false,
      formSubmitted: false,
      toastElement: null
    }
  },

  mounted() {
    this.toastElement = new Toast(document.getElementById(`login-toast`))
  },

  methods: {
    showToastMessage(message) {
      const toastEl = document.getElementById('login-toast')
      toastEl.querySelector('.toast-body').textContent = message
      this.toastElement.show()
    },

    async handleSubmit() {
      try {
        this.loading = true;

        const res = await axios.post(`${Const.BASE_URL}/users/login`, this.formData);

        console.log(res.data);

        if (res.data?.status !== 200) {
          throw new Error(res.data.error || 'Unexpected error');
        }

        const accessToken = res.data.jwtToken;
        const user = res.data.user;

        console.log('Access Token:', accessToken);
        console.log('User Object:', user);

        // Save to localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('user', JSON.stringify(user));

        // Redirect
        this.$router.push('/records/users/list-users');

      } catch (error) {
        console.error(error);
        this.showToastMessage('Invalid Credentials');
      } finally {
        this.loading = false;
      }
    }

  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div class="mb-3">
      <label class="form-label">Email address</label>
      <input type="text" class="form-control" v-model="formData.username" placeholder="your@email.com"
        autocomplete="off" required />
    </div>
    <div class="mb-3">
      <label class="form-label">
        Password
        <!-- <span class="form-label-description">
                    <a href="">I forgot password</a>
                </span> -->
      </label>
      <div class="input-group input-group-flat">
        <input type="password" class="form-control" placeholder="Your password" v-model="formData.password" required
          autocomplete="off" />
      </div>
    </div>

    <div class="form-footer">
      <button type="submit" class="btn btn-primary w-100">
        <span v-if="loading">Signing in...</span> <span v-if="!loading">Sign in</span>
      </button>
    </div>
  </form>

  <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 11">
    <div id="login-toast" class="toast align-items-center bg-danger text-white border-0" role="alert"
      aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body"></div>
        <button :disabled="loading" type="submit" class="btn-close btn-close-white ms-auto me-2" aria-label="Close"
          @click="hideToast"></button>
          
      </div>
    </div>
  </div>
</template>